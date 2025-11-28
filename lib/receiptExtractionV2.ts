/**
 * Receipt Extraction V2.0 Service
 * 
 * Super intelligent receipt extraction system focused ONLY on extracting:
 * - Product names (cleaned, without codes/barcodes)
 * - Quantity
 * - Unit (pieces, kg, etc.)
 * - Net Amount / Total Amount
 * - Calculated Unit Price (Net Amount / Quantity)
 * 
 * Ignores: addresses, supplier names, invoice numbers, dates, etc.
 * Uses AWS Textract + AI (Claude Sonnet 4.5) EXCLUSIVELY for intelligent extraction
 * No fallback methods - ensures highest quality extraction through AI
 */

import { analyzeReceiptStructureAWS, validateAWSConfig } from './awsTextract';
import { extractProductNameFromLine, cleanProductName } from './productNameCleaner';
import { invokeEnhancedModel, ENHANCED_BEDROCK_CONFIG } from './awsBedrockEnhanced';
import { parseBedrockJSON } from './awsBedrock';

// Product extraction result interface
export interface ExtractedProductV2 {
  id: string;
  name: string; // Clean product name only
  quantity: number;
  unit: string; // pieces, kg, g, pack, etc.
  netAmount: number; // Total amount for this product
  unitPrice: number; // Calculated: netAmount / quantity
  confidence: number; // 0-1 confidence score
  needsReview: boolean; // Flag if confidence is low
  rowIndex: number; // Original row index in table
}

export interface ReceiptExtractionResultV2 {
  success: boolean;
  products: ExtractedProductV2[];
  confidence: number; // Overall confidence
  error?: string;
  metadata?: {
    totalItems: number;
    totalAmount: number;
  };
}

// Column patterns learned from receipt examples
const PRODUCT_NAME_COLUMNS = [
  'item description',
  'item name',
  'item',
  'description',
  'product',
  'product name',
  'particulars',
  'goods',
];

const QUANTITY_COLUMNS = [
  'qty',
  'quantity',
  'pcs',
  'pieces',
  'cs', // cases
  'ea', // each
  'nos',
  'no',
  'count',
  'unit',
  'units',
];

const AMOUNT_COLUMNS = [
  'net amount',
  'net amt',
  'netamt',
  'net',
  'total',
  'amount',
  'amt',
  'netrate',
  'total amount',
  'net value',
];

const UNIT_COLUMNS = [
  'unit',
  'uom', // unit of measure
  'kgm/nos',
  'kgm',
];

// Skip patterns for irrelevant lines and metadata
const SKIP_PATTERNS = [
  /^(invoice|receipt|bill|tax invoice)/i,
  /^(gstin|fssai|pan|phone|ph|address|state|retailer|supplier)/i,
  /^(sender|receiver|billed to|shipped to|consignee)/i,
  /^(total|grand total|net total|subtotal|discount|tax|gst|cgst|sgst|tcs)/i,
  /^(sl|si|sr|s\.no|serial)/i, // Only if it's a header row indicator
  /^(channel|traditional|small|sectorized)/i, // Skip channel names like "Traditional", "Small A Traditional"
  /^(stn|cin|dl|route|visit|po number|credit customer|pay term)/i, // Skip metadata fields
];

/**
 * Intelligent column identifier - learns from receipt structure
 */
function identifyProductTableColumns(
  headers: string[],
  sampleRows: any[][]
): {
  productNameIndex: number | null;
  quantityIndex: number | null;
  unitIndex: number | null;
  amountIndex: number | null;
  confidence: number;
} {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  let productNameIndex: number | null = null;
  let quantityIndex: number | null = null;
  let unitIndex: number | null = null;
  let amountIndex: number | null = null;
  let confidence = 0;

  // Identify product name column (most important)
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (const pattern of PRODUCT_NAME_COLUMNS) {
      if (header.includes(pattern) || pattern.includes(header)) {
        productNameIndex = i;
        confidence += 0.4;
        break;
      }
    }
  }

  // Identify quantity column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (const pattern of QUANTITY_COLUMNS) {
      if (header === pattern || header.includes(pattern)) {
        quantityIndex = i;
        confidence += 0.3;
        break;
      }
    }
  }

  // Identify amount column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (const pattern of AMOUNT_COLUMNS) {
      if (header === pattern || header.includes(pattern)) {
        amountIndex = i;
        confidence += 0.3;
        break;
      }
    }
  }

  // Identify unit column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (const pattern of UNIT_COLUMNS) {
      if (header === pattern || header.includes(pattern)) {
        unitIndex = i;
        break;
      }
    }
  }

  // If product name not found, try heuristics from sample data
  if (!productNameIndex && sampleRows.length > 0) {
    // Find column with longest text (usually product names)
    const columnLengths = headers.map((_, colIdx) => {
      const avgLength = sampleRows
        .slice(0, 3)
        .map(row => (row[colIdx] || '').toString().length)
        .reduce((a, b) => a + b, 0) / Math.min(3, sampleRows.length);
      return { index: colIdx, avgLength };
    });
    
    columnLengths.sort((a, b) => b.avgLength - a.avgLength);
    if (columnLengths[0] && columnLengths[0].avgLength > 10) {
      productNameIndex = columnLengths[0].index;
      confidence += 0.2;
    }
  }

  // If quantity not found, try to find numeric-only column
  if (!quantityIndex && sampleRows.length > 0) {
    for (let i = 0; i < headers.length; i++) {
      const isNumeric = sampleRows
        .slice(0, 3)
        .every(row => /^\d+(\.\d+)?$/.test((row[i] || '').toString().trim()));
      if (isNumeric && sampleRows[0][i] && parseFloat(sampleRows[0][i]) < 1000) {
        quantityIndex = i;
        confidence += 0.2;
        break;
      }
    }
  }

  // If amount not found, find column with price-like values
  if (!amountIndex && sampleRows.length > 0) {
    for (let i = 0; i < headers.length; i++) {
      const hasPricePattern = sampleRows
        .slice(0, 3)
        .some(row => {
          const val = (row[i] || '').toString();
          return /^\d+\.\d{2}$/.test(val) || (parseFloat(val) > 10 && parseFloat(val) < 100000);
        });
      if (hasPricePattern) {
        amountIndex = i;
        confidence += 0.2;
        break;
      }
    }
  }

  return {
    productNameIndex,
    quantityIndex,
    unitIndex,
    amountIndex,
    confidence: Math.min(confidence, 1),
  };
}

/**
 * Check if a line should be skipped (header, footer, metadata)
 */
function shouldSkipLine(line: string, lineIndex: number, totalLines: number): boolean {
  const trimmed = line.trim();
  
  // Skip empty lines
  if (!trimmed) return true;

  // Skip if matches skip patterns
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  // Skip if it's clearly a header line (usually first 5 lines)
  if (lineIndex < 5) {
    if (trimmed.toLowerCase().includes('gstin') || 
        trimmed.toLowerCase().includes('address') ||
        trimmed.toLowerCase().includes('phone') ||
        /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return true;
    }
  }

  // Skip if it's clearly a total/footer line (usually last 5 lines)
  if (lineIndex >= totalLines - 5) {
    if (trimmed.toLowerCase().includes('total') ||
        trimmed.toLowerCase().includes('grand') ||
        trimmed.toLowerCase().includes('net amount') ||
        trimmed.toLowerCase().includes('authorised')) {
      return true;
    }
  }

  return false;
}

/**
 * Extract products from table using intelligent column mapping
 */
function extractProductsFromTable(
  headers: string[],
  rows: any[][],
  textractBlocks?: any[]
): ExtractedProductV2[] {
  const products: ExtractedProductV2[] = [];

  // Identify columns
  const columnMapping = identifyProductTableColumns(headers, rows.slice(0, 5));

  if (!columnMapping.productNameIndex && columnMapping.productNameIndex !== 0) {
    console.warn('Could not identify product name column');
    return [];
  }

  // Extract products from each row
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    
    // Get product name
    const productNameCell = row[columnMapping.productNameIndex!];
    if (!productNameCell) continue;

    const rawProductName = productNameCell.toString().trim();
    
    // Clean product name using our cleaner
    const cleanedName = extractProductNameFromLine(rawProductName);
    if (!cleanedName || cleanedName.length < 2) continue;

    // Get quantity
    let quantity = 1;
    if (columnMapping.quantityIndex !== null && columnMapping.quantityIndex !== undefined) {
      const qtyCell = row[columnMapping.quantityIndex];
      if (qtyCell) {
        const qtyText = qtyCell.toString().trim().replace(/[^\d.]/g, '');
        quantity = parseFloat(qtyText) || 1;
      }
    }

    // Get unit
    let unit = 'piece';
    if (columnMapping.unitIndex !== null && columnMapping.unitIndex !== undefined) {
      const unitCell = row[columnMapping.unitIndex];
      if (unitCell) {
        const unitText = unitCell.toString().trim().toLowerCase();
        if (unitText && unitText !== 'nos' && unitText !== 'pcs') {
          unit = unitText;
        }
      }
    } else {
      // Try to extract unit from quantity cell or product name
      if (columnMapping.quantityIndex !== null) {
        const qtyCell = row[columnMapping.quantityIndex];
        if (qtyCell) {
          const qtyText = qtyCell.toString().trim().toLowerCase();
          const unitMatch = qtyText.match(/\b(pcs|pieces|kg|g|gm|ml|l|pack|box|bags|cas|case|cases)\b/i);
          if (unitMatch) {
            unit = unitMatch[1].toLowerCase();
          }
        }
      }
    }

    // Get net amount
    let netAmount = 0;
    if (columnMapping.amountIndex !== null && columnMapping.amountIndex !== undefined) {
      const amountCell = row[columnMapping.amountIndex];
      if (amountCell) {
        const amountText = amountCell.toString().trim().replace(/[^\d.]/g, '');
        netAmount = parseFloat(amountText) || 0;
      }
    }

    // Calculate unit price
    const unitPrice = quantity > 0 ? netAmount / quantity : 0;

    // Calculate confidence based on data completeness
    let confidence = 0.8;
    if (!columnMapping.quantityIndex && quantity === 1) confidence -= 0.1;
    if (!columnMapping.amountIndex || netAmount === 0) confidence -= 0.2;
    if (cleanedName.length < 5) confidence -= 0.1;

    // Skip if essential data is missing
    if (netAmount === 0 && unitPrice === 0) continue;

    products.push({
      id: `prod_${Date.now()}_${rowIndex}`,
      name: cleanedName,
      quantity,
      unit,
      netAmount,
      unitPrice,
      confidence: Math.max(0, Math.min(1, confidence)),
      needsReview: confidence < 0.7,
      rowIndex,
    });
  }

  return products;
}

/**
 * Fallback extraction from text lines when AI is not available
 * Attempts pattern matching to extract products from unstructured text
 */
function extractProductsFromTextLines(textLines: string[]): ExtractedProductV2[] {
  const products: ExtractedProductV2[] = [];
  
  // Pattern to match: ProductName Quantity Price or ProductName Price
  const productLinePattern = /(.+?)\s+(\d+(?:\.\d+)?)\s+(?:x|X|\*|×)\s+(\d+\.\d{2})/i;
  const productPricePattern = /(.+?)\s+(\d+\.\d{2})/;
  
  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i].trim();
    
    // Skip header/footer/metadata lines
    if (shouldSkipLine(line, i, textLines.length)) continue;
    
    // Skip lines that are clearly not products
    if (line.length < 5 || /^(total|subtotal|tax|gst|cgst|sgst|discount|grand)/i.test(line)) {
      continue;
    }
    
    // Try pattern matching
    let match = line.match(productLinePattern);
    let productName = '';
    let quantity = 1;
    let netAmount = 0;
    
    if (match) {
      productName = match[1].trim();
      quantity = parseFloat(match[2]) || 1;
      netAmount = parseFloat(match[3]) || 0;
    } else {
      // Try simpler pattern: ProductName Price
      match = line.match(productPricePattern);
      if (match) {
        productName = match[1].trim();
        netAmount = parseFloat(match[2]) || 0;
      }
    }
    
    // Clean and validate product name
    if (productName && netAmount > 0) {
      const cleanedName = extractProductNameFromLine(productName);
      if (cleanedName && cleanedName.length >= 3) {
        const unitPrice = quantity > 0 ? netAmount / quantity : netAmount;
        
        products.push({
          id: `prod_${Date.now()}_${i}`,
          name: cleanProductName(cleanedName),
          quantity,
          unit: 'piece',
          netAmount,
          unitPrice,
          confidence: 0.6, // Lower confidence for fallback
          needsReview: true,
          rowIndex: i,
        });
      }
    }
  }
  
  return products;
}

/**
 * AI-powered product extraction using Claude Sonnet 4.5
 * Analyzes the entire receipt structure and extracts only products
 * Uses model: anthropic.claude-sonnet-4-5-20250929-v1:0 (inference profile)
 * Note: This requires Anthropic use case approval in AWS Bedrock
 */
async function extractProductsWithAI(
  textLines: string[],
  tables: any[],
  structuredData: any
): Promise<ExtractedProductV2[]> {
  // Build structured table context for AI
  // Process tables to extract structured data with headers and rows
  let tableContext = 'No table structure detected';
  let formattedTables: any[] = [];
  
  if (tables.length > 0) {
    // Find the largest table (usually the main product table)
    const sortedTables = [...tables].sort((a, b) => {
      const aCells = (a.cells && Array.isArray(a.cells)) ? a.cells.length : 0;
      const bCells = (b.cells && Array.isArray(b.cells)) ? b.cells.length : 0;
      return bCells - aCells;
    });
    
    // Process the largest tables (main product table is usually the largest)
    for (const table of sortedTables.slice(0, 2)) {
      if (table.cells && Array.isArray(table.cells)) {
        // Group cells by row
        const rowMap = new Map<number, any[]>();
        table.cells.forEach((cell: any) => {
          const rowIdx = cell.RowIndex || 0;
          if (!rowMap.has(rowIdx)) {
            rowMap.set(rowIdx, []);
          }
          rowMap.get(rowIdx)!.push(cell);
        });
        
        // Sort rows and cells
        const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);
        const rows: any[][] = [];
        
        sortedRows.forEach((rowIdx) => {
          const cells = rowMap.get(rowIdx)!;
          cells.sort((a, b) => (a.ColumnIndex || 0) - (b.ColumnIndex || 0));
          rows.push(cells.map(c => c.Text || ''));
        });
        
        // Identify header row (usually first row)
        if (rows.length > 0) {
          const headerRow = rows[0] || [];
          const dataRows = rows.slice(1);
          
          // Check if this looks like a product table
          const hasProductColumns = headerRow.some((h: string) => 
            /item|description|product|particulars|goods|name/i.test(h)
          );
          const hasQuantityColumns = headerRow.some((h: string) => 
            /pcs|pieces|qty|quantity|nos/i.test(h)
          );
          const hasAmountColumns = headerRow.some((h: string) => 
            /net|amount|amt|total|price/i.test(h)
          );
          
          // Skip summary/tax tables - look for headers like CGST, SGST, Tax Slab, etc.
          const isSummaryTable = headerRow.some((h: string) => 
            /cgst|sgst|tax slab|particulars.*cgst|tax.*slab/i.test(h)
          );
          
          // Filter out rows that are clearly not products (metadata, headers, totals)
          const filteredRows = dataRows.filter((row: string[]) => {
            const rowText = row.join(' ').toLowerCase();
            // Skip if row contains only metadata
            if (/channel|traditional|small|sectorized|stn|cin|gstn|pan|dl|fssai/i.test(rowText)) {
              return false;
            }
            // Skip if row is mostly empty or contains only codes
            const nonEmptyCells = row.filter(cell => cell && cell.trim().length > 0);
            if (nonEmptyCells.length < 3) return false;
            return true;
          });
          
          if (!isSummaryTable && hasProductColumns && filteredRows.length > 0) {
            formattedTables.push({
              tableType: 'PRODUCT_TABLE',
              headers: headerRow,
              rowCount: filteredRows.length,
              sampleRows: filteredRows.slice(0, 5), // First 5 rows as examples
              allRows: filteredRows // Include all filtered rows for full extraction
            });
          } else if (!isSummaryTable && filteredRows.length > 10 && hasQuantityColumns) {
            // Large table with quantity column might be product table
            formattedTables.push({
              tableType: 'POSSIBLE_PRODUCT_TABLE',
              headers: headerRow,
              rowCount: filteredRows.length,
              sampleRows: filteredRows.slice(0, 5),
              allRows: filteredRows
            });
          }
        }
      }
    }
    
    // Format tables for AI with clear structure
    if (formattedTables.length > 0) {
      // Prioritize PRODUCT_TABLE over POSSIBLE_PRODUCT_TABLE
      formattedTables.sort((a, b) => {
        if (a.tableType === 'PRODUCT_TABLE' && b.tableType !== 'PRODUCT_TABLE') return -1;
        if (b.tableType === 'PRODUCT_TABLE' && a.tableType !== 'PRODUCT_TABLE') return 1;
        return b.rowCount - a.rowCount; // Sort by row count (largest first)
      });
      
      tableContext = formattedTables.map((table, idx) => {
        // Format all rows for complete extraction
        const allRowsFormatted = table.allRows.map((row: string[], i: number) => 
          `Row ${i + 1}: ${JSON.stringify(row)}`
        ).join('\n');
        
        return `TABLE ${idx + 1} (${table.tableType}, ${table.rowCount} product rows):
Headers: ${JSON.stringify(table.headers)}

ALL PRODUCT ROWS (extract from ALL of these):
${allRowsFormatted}`;
      }).join('\n\n---\n\n');
    } else {
      tableContext = 'No product table structure detected in receipt data';
    }
  }
  
  const textContext = textLines.slice(0, 50).join('\n'); // Limit text context

  const prompt = `You are an expert receipt extraction assistant. Your task is to extract ONLY product information from the ITEMIZED PRODUCT TABLE in the receipt.

CRITICAL REQUIREMENTS - READ CAREFULLY:
1. Find the ITEMIZED PRODUCT TABLE - this is the table with individual product rows, NOT the summary/tax table
2. The itemized table will have:
   - A column for product names (like "Item Description", "Item Name", "Product Name")
   - A column for quantities (like "Pcs", "Pieces", "Qty")
   - A column for net amounts (like "Net Amt", "Net Amount")
   - Multiple rows (usually 10-50 rows) each representing ONE product
3. IGNORE completely these tables/sections:
   - Summary tables showing CGST/SGST tax breakdowns by tax slab
   - Summary tables with "Particulars", "Pcs" showing aggregated totals
   - Header metadata (STN, CIN, GSTN, PAN, DL No, FSSAI, address, phone)
   - CHANNEL field (like "Traditional", "Small A Traditional") - this is NOT a product
   - Initiative/discount sections
   - Terms and conditions
   - Footer text
4. Extract ONLY from the ITEMIZED PRODUCT TABLE rows (each row = one product)
5. Product names must be cleaned (remove HSN codes, PCode, UPC, barcodes, SKUs, serial numbers)
6. Extract quantity from the "Pcs" or "Pieces" column (this is per-product quantity, NOT total pieces)
7. Extract net amount from "Net Amt" or "Net Amount" column (this is per-product total)
8. Calculate unit price = net amount / quantity
9. You MUST extract ALL products from the itemized table (usually 10-50 products)

COLUMN MAPPING INSTRUCTIONS:
- Product Name: Look for columns like "Item Description", "Item Name", "Product Name", "Description", "Particulars", "Goods"
- Quantity: Look for columns like "Pcs", "Pieces", "Qty", "Quantity", "Nos"
- Net Amount: Look for columns like "Net Amt", "Net Amount", "Amount", "Total", "Net"
- Unit: Usually "pieces" or "pcs" - can be found in unit column or inferred

EXAMPLE RECEIPT FORMAT:
Table with headers: ["Sl", "HSN", "PCode", "Item Description", "MRP", "Cs", "Pcs", "UPC", "Pc Price", "Gross Amt", "SCH Amt", "Taxable Amt", "GST %", "Net Amt"]
Row: ["1", "33051090", "80813857", "H&S Daily Cool Rs 2 20S", "40", "0", "1", "60", "25.57", "25.57", "0.64", "24.93", "18.00", "29.41"]
Extract: { name: "H&S Daily Cool Rs 2 20S", quantity: 1, unit: "pieces", netAmount: 29.41, unitPrice: 29.41 }

Table with headers: ["Item Description", "Pcs", "Net Amount"]
Row: ["ELITE MAIDA 500 gm", "5", "166.67"]
Extract: { name: "ELITE MAIDA 500 gm", quantity: 5, unit: "pieces", netAmount: 166.67, unitPrice: 33.33 }

RECEIPT TABLE DATA (find the main product table):
${tableContext}

TEXT LINES (for context):
${textContext}

STEP-BY-STEP INSTRUCTIONS:
1. Look at the table headers to identify which table is the ITEMIZED PRODUCT TABLE
   - It will have columns like: Sl, HSN, PCode, Item Description, MRP, Cs, Pcs, Net Amt
   - It will have MANY rows (10-50 rows), each row representing one product
   - DO NOT confuse with summary tables that have "Particulars", "CGST", "SGST" headers

2. For EACH row in the itemized product table:
   - Extract product name from "Item Description" or similar column
   - Extract quantity from "Pcs" column (individual product quantity, not total)
   - Extract net amount from "Net Amt" column (individual product amount)
   - Clean the product name (remove HSN, PCode, UPC codes, serial numbers)
   - Calculate unit price = net amount / quantity

3. Skip rows that are:
   - Header rows (containing column names)
   - Empty rows
   - Summary/total rows (containing words like "Total", "Subtotal", "Grand Total")
   - Tax breakdown rows (containing CGST, SGST, GST percentages)
   - Metadata rows (containing channel names, addresses, etc.)

4. IMPORTANT: Extract ALL products from the itemized table
   - A receipt typically has 10-50 individual products
   - DO NOT stop at just 1 product
   - Return an array with ALL products found

5. DO NOT extract from:
   - Summary tables showing tax breakdowns
   - CHANNEL field (e.g., "Traditional" is NOT a product)
   - Header metadata sections

CRITICAL: You MUST return ONLY valid JSON. Do not include any markdown formatting, code blocks, explanations, or other text.
Return a JSON array in this exact format:
[
  {
    "name": "cleaned product name",
    "quantity": 1,
    "unit": "pieces",
    "netAmount": 100.0,
    "unitPrice": 100.0,
    "confidence": 0.95
  }
]

IMPORTANT: 
- Start your response with [ (opening bracket)
- End your response with ] (closing bracket)
- Do NOT wrap in markdown code blocks (no code fences or formatting)
- Do NOT include any text before or after the JSON array
- Return ONLY the JSON array, nothing else

CRITICAL EXTRACTION RULES:
- Extract from the ITEMIZED PRODUCT TABLE only (not summary tables, not metadata)
- DO NOT extract from: CHANNEL fields, header information, summary tables, tax tables
- Extract ALL product rows from the table (usually 10-50 products per receipt)
- Clean product names thoroughly: remove HSN codes, PCode, UPC, serial numbers, barcodes
- Extract quantity from Pcs/Pieces/Qty column (must be > 0)
- Extract netAmount from Net Amt/Net Amount column (must be > 0)
- Calculate unitPrice = netAmount / quantity
- Skip rows that are: empty, headers, totals, tax calculations, or contain only metadata
- Set confidence 0.8-0.95 for good extractions
- Return ALL products found in the product table (do not stop at just one product)`;

  // Try Claude Sonnet 4.5 (use case details already submitted, model is accessible)
  let response = await invokeEnhancedModel(prompt, {
    maxTokens: 4096,
    temperature: 0.1, // Low temperature for consistent extraction
  });

  // Check for errors - since model is accessible, errors might indicate other issues
  if (!response.success || !response.content) {
    const errorMsg = response.error || 'AI extraction failed';
    
    console.error('❌ Claude Sonnet 4.5 invocation failed:', errorMsg);
    
    // If error mentions use case details but model is accessible, check for other issues
    if (errorMsg.includes('use case details') || errorMsg.includes('ResourceNotFoundException')) {
      throw new Error(`Claude Sonnet 4.5 model access error: ${errorMsg}

Possible issues:
1. Model ID format: Currently using 'anthropic.claude-sonnet-4-5-20250929-v1:0'
2. Model might not be available in region: ${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}
3. Model access might need to be refreshed in AWS Bedrock Console

To verify:
- Check AWS Bedrock Console: https://console.aws.amazon.com/bedrock/
- Verify model ID in Model Catalog
- Ensure model is enabled in your region`);
    }
    
    throw new Error(`AI extraction failed: ${errorMsg}`);
  }

  // Validate and log response content before parsing
  if (!response.content || response.content.trim().length === 0) {
    console.error('❌ Empty response content from AI model');
    throw new Error('AI model returned empty response. Please check your AWS Bedrock configuration and model access.');
  }

  // Check for suspicious response patterns (like "0...0" which might indicate an error)
  if (response.content.length < 10 || /^0+\.{3}0+$/.test(response.content.trim())) {
    console.error('❌ Invalid response format from AI model:', response.content);
    throw new Error(`AI model returned invalid response format: "${response.content.substring(0, 50)}". This may indicate a model configuration issue or the model may not be available.`);
  }

  // Log first 500 characters of response for debugging
  console.log('📝 AI Response preview:', response.content.substring(0, 500));
  
  // Try to parse JSON
  const parsed = parseBedrockJSON<ExtractedProductV2[]>(response.content);
  if (!parsed || !Array.isArray(parsed)) {
    console.error('❌ Failed to parse AI response as JSON array');
    console.error('📄 Full response content (first 1000 chars):', response.content.substring(0, 1000));
    throw new Error(`Failed to parse AI extraction result. Response was not valid JSON. The AI model may have returned an error message or unexpected format. Content preview: ${response.content.substring(0, 200)}`);
  }
  
  console.log(`✅ Successfully parsed ${parsed.length} products from AI response`);

  // Filter and validate extracted products
  const validProducts = parsed
    .filter(p => {
      // Validate product name
      if (!p.name || typeof p.name !== 'string') return false;
      const cleanedName = cleanProductName(p.name);
      if (!cleanedName || cleanedName.length < 3) return false;
      
      // Filter out metadata fields that were incorrectly extracted
      const nameLower = cleanedName.toLowerCase().trim();
      const invalidPatterns = [
        /^traditional$/i,
        /^small$/i,
        /^sectorized$/i,
        /^channel$/i,
        /^other$/i,
        /^(stn|cin|gstn|pan|dl|fssai)$/i,
        /^(address|phone|state|route|visit|po)$/i,
        /^(kerala|state code|route name|pay term|credit customer)$/i,
        /^(cgst|sgst|igst|gst|tax)$/i,
        /^(particulars|total|subtotal|grand total)$/i,
      ];
      
      // Check if the name matches any invalid pattern
      for (const pattern of invalidPatterns) {
        if (pattern.test(nameLower)) {
          console.warn(`Filtered out invalid product name (metadata field): ${cleanedName}`);
          return false;
        }
      }
      
      // Additional validation: product names should have at least one letter and be reasonably descriptive
      if (cleanedName.length < 5) {
        // Very short names (less than 5 chars) are likely codes or metadata
        console.warn(`Filtered out product name (too short): ${cleanedName}`);
        return false;
      }
      
      // Must contain at least one letter (not just numbers)
      if (!/[A-Za-z]/.test(cleanedName)) {
        console.warn(`Filtered out product name (no letters): ${cleanedName}`);
        return false;
      }
      
      // Validate quantity and amount
      const quantity = p.quantity || 1;
      const netAmount = p.netAmount || 0;
      if (quantity <= 0 || netAmount <= 0) return false;
      
      return true;
    })
    .map((p, idx) => ({
      id: `prod_${Date.now()}_${idx}`,
      name: cleanProductName(p.name),
      quantity: p.quantity || 1,
      unit: p.unit || 'piece',
      netAmount: p.netAmount || 0,
      unitPrice: p.unitPrice || (p.netAmount && p.quantity ? p.netAmount / p.quantity : 0),
      confidence: p.confidence || 0.8,
      needsReview: (p.confidence || 0.8) < 0.7,
      rowIndex: idx,
    }));
  
  // Log warning if too few products extracted
  if (validProducts.length === 1) {
    console.warn(`⚠️ Only 1 product extracted - this may be incorrect. Product: ${validProducts[0]?.name}`);
  }
  
  if (validProducts.length === 0 && parsed.length > 0) {
    console.warn(`⚠️ All ${parsed.length} extracted products were filtered out as invalid`);
  }
  
  return validProducts;
}

/**
 * Main extraction function - combines AWS Textract + AI
 */
export async function extractProductsFromReceiptV2(
  imageBuffer: Buffer
): Promise<ReceiptExtractionResultV2> {
  if (!validateAWSConfig()) {
    return {
      success: false,
      products: [],
      confidence: 0,
      error: 'AWS Textract is not configured',
    };
  }

  try {
    // Step 1: Extract structure using AWS Textract
    const textractResult = await analyzeReceiptStructureAWS(imageBuffer);

    if (!textractResult.textLines.length && !textractResult.tables.length) {
      return {
        success: false,
        products: [],
        confidence: 0,
        error: 'No text detected in the image',
      };
    }

    let products: ExtractedProductV2[] = [];

    // Step 2: Use AI extraction exclusively (AWS Textract + AI)
    // This ensures the best accuracy by combining AWS Textract's structured data with AI intelligence
    // AI extraction uses Claude Sonnet 4.5 and requires Anthropic use case approval in AWS Bedrock
    try {
      products = await extractProductsWithAI(
        textractResult.textLines,
        textractResult.tables,
        textractResult
      );
    } catch (aiError: any) {
      const errorMsg = aiError.message || String(aiError);
      
      // Provide helpful error message with updated AWS Bedrock information
      if (errorMsg.includes('use case details') || errorMsg.includes('Anthropic') || errorMsg.includes('approval')) {
        return {
          success: false,
          products: [],
          confidence: 0,
          error: `Anthropic use case details required for Claude Sonnet 4.5.

AWS Bedrock now automatically enables models, but Anthropic requires use case details for first-time users.

📝 HOW TO SUBMIT USE CASE DETAILS:

Method 1 - AWS Console (Easiest):
1. Go to: https://console.aws.amazon.com/bedrock/
2. Click "Model access" in left sidebar
3. Click "Modify model access" button
4. Select "Claude Sonnet 4.5" (model ID: anthropic.claude-sonnet-4-5-20250929-v1:0)
5. Click "Submit use case details"
6. Fill form with: "Receipt extraction and product data processing for inventory management system. Extracting product names, quantities, units, and prices from scanned receipts using OCR and AI to populate seller inventory databases."
7. Submit and wait 15 minutes

Method 2 - Model Catalog:
1. Go to: https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess
2. Find "Claude Sonnet 4.5" in Model catalog
3. Open model → Click "Submit use case details"
4. Complete and submit form

✅ ONE-TIME: Submit once per AWS account, access granted immediately!

📖 Full guide: See ANTHROPIC_USE_CASE_SUBMISSION.md in project root

Note: Using Claude Sonnet 4.5 exclusively for best extraction quality.`,
        };
      }
      
      return {
        success: false,
        products: [],
        confidence: 0,
        error: `AI extraction failed: ${errorMsg}. 

Scan Receipt 2.0 uses AWS Textract + Claude Sonnet 4.5 exclusively for best extraction quality.`,
      };
    }

    // Step 4: Post-process and validate
    products = products.filter(p => {
      // Must have a valid product name
      if (!p.name || p.name.length < 2) return false;
      // Must have quantity > 0
      if (p.quantity <= 0) return false;
      // Must have amount > 0
      if (p.netAmount <= 0 && p.unitPrice <= 0) return false;
      return true;
    });

    // Calculate overall confidence
    const overallConfidence = products.length > 0
      ? products.reduce((sum, p) => sum + p.confidence, 0) / products.length
      : 0;

    // Calculate metadata
    const totalAmount = products.reduce((sum, p) => sum + p.netAmount, 0);

    return {
      success: products.length > 0,
      products,
      confidence: overallConfidence,
      metadata: {
        totalItems: products.length,
        totalAmount,
      },
    };
  } catch (error: any) {
    console.error('Error in receipt extraction V2:', error);
    const errorMsg = error.message || String(error);
    
    // Provide helpful error message for Anthropic approval issue
    if (errorMsg.includes('use case details') || errorMsg.includes('Anthropic')) {
      return {
        success: false,
        products: [],
        confidence: 0,
        error: 'Claude Sonnet 4.5 requires Anthropic use case approval in AWS Bedrock Console. Please complete the approval form in AWS Bedrock Console (https://console.aws.amazon.com/bedrock/), then try again. Scan Receipt 2.0 uses AWS Textract + AI exclusively for better extraction accuracy.',
      };
    }
    
    return {
      success: false,
      products: [],
      confidence: 0,
      error: errorMsg || 'Failed to extract products',
    };
  }
}

export default {
  extractProductsFromReceiptV2,
};

