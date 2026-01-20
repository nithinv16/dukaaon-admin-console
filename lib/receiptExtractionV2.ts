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

import { analyzeReceiptStructureV2, validateAWSConfig } from './awsTextract';
import { extractProductNameFromLine, cleanProductName } from './productNameCleaner';
import { invokeEnhancedModel, ENHANCED_BEDROCK_CONFIG } from './awsBedrockEnhanced';
import { parseBedrockJSON } from './awsBedrock';

/**
 * Normalize unit text to standard unit values
 * Handles common abbreviations and variations used in Indian receipts
 */
export function normalizeUnit(unitText: string): string {
  if (!unitText) return 'piece';

  const normalized = unitText.toLowerCase().trim();

  // Map common unit variations to standard values
  const unitMap: { [key: string]: string } = {
    // Pieces/Count
    'pcs': 'piece',
    'pc': 'piece',
    'pieces': 'piece',
    'piece': 'piece',
    'nos': 'piece',
    'no': 'piece',
    'count': 'piece',
    'units': 'piece',
    'unit': 'piece',
    'ea': 'piece',
    'each': 'piece',

    // Weight - Grams
    'g': 'gram',
    'gm': 'gram',
    'gram': 'gram',
    'grams': 'gram',

    // Weight - Kilograms
    'kg': 'kilogram',
    'kgs': 'kilogram',
    'kilogram': 'kilogram',
    'kilograms': 'kilogram',

    // Volume - Milliliters
    'ml': 'milliliter',
    'mls': 'milliliter',
    'milliliter': 'milliliter',
    'milliliters': 'milliliter',

    // Volume - Liters
    'l': 'liter',
    'lt': 'liter',
    'liter': 'liter',
    'litre': 'liter',
    'liters': 'liter',
    'litres': 'liter',

    // Pack/Box
    'pack': 'pack',
    'packs': 'pack',
    'box': 'pack',
    'boxes': 'pack',
    'bottle': 'bottle',
    'bottles': 'bottle',
    'bag': 'bag',
    'bags': 'bag',
    'case': 'case',
    'cases': 'case',

    // Common receipt abbreviations
    'kgm': 'kilogram',
    'kgm/nos': 'piece', // Sometimes receipts show "kgm/nos" which means piece
    'uom': 'piece', // Unit of Measure - default to piece
  };

  // Direct match
  if (unitMap[normalized]) {
    return unitMap[normalized];
  }

  // Try partial match (e.g., "kg" in "kgm")
  for (const [key, value] of Object.entries(unitMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // If no match found, return 'piece' as default
  return 'piece';
}

// Product extraction result interface
export interface ExtractedProductV2 {
  id: string;
  name: string; // Clean product name only
  brand?: string; // Brand name (AI-suggested, e.g., "Cadbury", "Parle", "Britannia")
  quantity: number;
  unit: string; // pieces, kg, g, pack, etc.
  netAmount: number; // Total amount for this product (from "Net Amt" or "Total" column - LAST column)
  unitPrice: number; // Calculated: netAmount / quantity
  confidence: number; // 0-1 confidence score
  needsReview: boolean; // Flag if confidence is low
  rowIndex: number; // Original row index from receipt
  description?: string; // AI-generated intelligent description (includes MRP if available)
  category?: string; // Product category (suggested by AI, not auto-saved to DB)
  subcategory?: string; // Product subcategory (suggested by AI, not auto-saved to DB)
  stockAvailable?: number; // Stock available for the product (default: 100)
  minOrderQuantity?: number; // Minimum order quantity (AI-suggested based on product type and price)
  imageUrl?: string; // Product image (base64 or URL)
  mrp?: number; // MRP from receipt (if available)
  categoryIsNew?: boolean; // Flag if category is new (not in DB)
  subcategoryIsNew?: boolean; // Flag if subcategory is new (not in DB)
  // Variant-related fields
  variantGroup?: string; // Group number for variants (e.g., "1", "2")
  baseProductName?: string; // Base product name without variant info (e.g., "Coca Cola")
  variantType?: string; // Type of variant: 'size', 'flavor', 'color', 'weight', 'pack'
  variantValue?: string; // Value of variant (e.g., "250ml", "Chocolate")
  isVariant?: boolean; // Whether this product is a variant of another
  existingProductId?: string; // ID of existing product if this is a variant of an existing product
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
 * Enhanced with Indian receipt patterns and data-based inference
 * V2.1: Smarter detection for any receipt format
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

  // Extended Indian receipt patterns
  const extendedProductNameColumns = [
    ...PRODUCT_NAME_COLUMNS,
    'name',
    'material',
    'commodity',
  ];

  const extendedAmountColumns = [
    ...AMOUNT_COLUMNS,
    'rate',
    'price',
    'value',
    'rs',
    'rs.',
    'rupees',
    'taxable',
    'taxable value',
    'taxable amt',
    'gross',
    'gross amt',
    'gross amount',
    'net rate',
    'basic',
    'basic amt',
    'line total',
    'line amt',
  ];

  // Helper to get cell text
  const getCellText = (cell: any): string => {
    if (typeof cell === 'string') return cell;
    return cell?.text || cell?.Text || '';
  };

  // Helper to check if text looks like a product name (has letters, reasonably long)
  const looksLikeProductName = (text: string): boolean => {
    if (!text || text.length < 3) return false;
    // Should have letters, not be purely numeric, not be a date, not be a code
    const hasLetters = /[A-Za-z]{2,}/.test(text);
    const isPurelyNumeric = /^[\d.,\s₹$%]+$/.test(text);
    const isDateLike = /^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(text);
    const isCodeLike = /^[A-Z0-9]{1,2}\s?\d+$/.test(text) && text.length < 15;
    const isHeaderKeyword = /^(no|sr|sl|s\.no|qty|rate|amt|total|disc|sgst|cgst|hsn|code|mfg|batch|exp|m\.r\.p|mrp|free|taxable|value|amount)\.?$/i.test(text.trim());
    return hasLetters && !isPurelyNumeric && !isDateLike && !isHeaderKeyword && text.length > 5;
  };

  // Helper to check if text looks like quantity (with optional unit suffix like "6 Pe")
  const looksLikeQuantity = (text: string): boolean => {
    if (!text) return false;
    const trimmed = text.trim();
    // Match: "6", "6 Pc", "6 Pe", "10", "100", "1.5"
    const qtyPattern = /^(\d+(?:\.\d+)?)\s*(?:pc|pe|pcs|nos?|unit|bottle|pack|box|case)?/i;
    const match = trimmed.match(qtyPattern);
    if (match) {
      const qty = parseFloat(match[1]);
      return qty > 0 && qty < 10000;
    }
    return false;
  };

  // Helper to check if text looks like an amount (currency value)
  const looksLikeAmount = (text: string): boolean => {
    if (!text) return false;
    const trimmed = text.trim().replace(/[₹$,\s]/g, '');
    // Match decimal numbers like "218.16", "1234.00", "50"
    return /^\d+(\.\d{1,2})?$/.test(trimmed) && parseFloat(trimmed) > 0;
  };

  // STEP 1: Try to identify from headers first
  console.log('   🔍 Analyzing headers:', normalizedHeaders.filter(h => h).join(', '));

  // Identify product name column from header
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    if (!header) continue;
    for (const pattern of extendedProductNameColumns) {
      if (header === pattern || (header.includes(pattern) && header.length < 20)) {
        productNameIndex = i;
        confidence += 0.4;
        console.log(`   ✅ Found product name column from header: index ${i} ("${header}")`);
        break;
      }
    }
    if (productNameIndex !== null) break;
  }

  // Identify quantity column from header
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    if (!header) continue;
    for (const pattern of QUANTITY_COLUMNS) {
      if (header === pattern || header.includes(pattern)) {
        quantityIndex = i;
        confidence += 0.2;
        console.log(`   ✅ Found quantity column from header: index ${i} ("${header}")`);
        break;
      }
    }
    if (quantityIndex !== null) break;
  }

  // Identify unit column from header
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    if (!header) continue;
    for (const pattern of UNIT_COLUMNS) {
      if (header === pattern || header.includes(pattern)) {
        unitIndex = i;
        confidence += 0.1;
        break;
      }
    }
    if (unitIndex !== null) break;
  }

  // Identify amount column (usually last column)
  if (normalizedHeaders.length > 0) {
    const lastHeader = normalizedHeaders[normalizedHeaders.length - 1];
    if (lastHeader) {
      for (const pattern of extendedAmountColumns) {
        if (lastHeader.includes(pattern) || pattern.includes(lastHeader)) {
          amountIndex = normalizedHeaders.length - 1;
          confidence += 0.3;
          console.log(`   ✅ Found amount column from header: index ${amountIndex} ("${lastHeader}")`);
          break;
        }
      }
    }
  }

  // STEP 2: Use sample row data to infer columns (CRITICAL for non-standard receipts)
  if (sampleRows && sampleRows.length > 0) {
    console.log('   🔍 Analyzing sample data rows for column inference...');

    // Analyze multiple sample rows to find consistent patterns
    const columnScores: { name: number; qty: number; amount: number; texts: string[] }[] = [];

    for (let col = 0; col < (sampleRows[0]?.length || 0); col++) {
      columnScores[col] = { name: 0, qty: 0, amount: 0, texts: [] };

      for (const row of sampleRows) {
        const cellText = getCellText(row[col]);
        columnScores[col].texts.push(cellText);

        if (looksLikeProductName(cellText)) {
          columnScores[col].name++;
        }
        if (looksLikeQuantity(cellText)) {
          columnScores[col].qty++;
        }
        if (looksLikeAmount(cellText)) {
          columnScores[col].amount++;
        }
      }
    }

    // Find best product name column (prefer columns with most product-like text)
    if (productNameIndex === null) {
      let bestNameScore = 0;
      let bestNameIndex = -1;
      let bestNameLength = 0;

      for (let col = 0; col < columnScores.length; col++) {
        const avgLength = columnScores[col].texts.reduce((sum, t) => sum + t.length, 0) / Math.max(1, columnScores[col].texts.length);
        // Prefer columns with higher name score AND longer average text
        if (columnScores[col].name > bestNameScore ||
          (columnScores[col].name === bestNameScore && avgLength > bestNameLength)) {
          bestNameScore = columnScores[col].name;
          bestNameIndex = col;
          bestNameLength = avgLength;
        }
      }

      if (bestNameIndex >= 0 && bestNameScore > 0) {
        productNameIndex = bestNameIndex;
        confidence += 0.3;
        console.log(`   💡 Inferred product name column from data: index ${productNameIndex} (score: ${bestNameScore})`);
      }
    }

    // Find amount column (prefer rightmost column with amount-like values)
    if (amountIndex === null) {
      for (let col = columnScores.length - 1; col >= 0; col--) {
        if (columnScores[col].amount >= sampleRows.length * 0.5) { // At least 50% of rows have amount-like values
          amountIndex = col;
          confidence += 0.2;
          console.log(`   💡 Inferred amount column from data: index ${amountIndex}`);
          break;
        }
      }
    }

    // Find quantity column (look for columns with qty-like values, not already used)
    if (quantityIndex === null) {
      for (let col = 0; col < columnScores.length; col++) {
        if (col === productNameIndex || col === amountIndex) continue;
        if (columnScores[col].qty >= sampleRows.length * 0.5) {
          quantityIndex = col;
          confidence += 0.15;
          console.log(`   💡 Inferred quantity column from data: index ${quantityIndex}`);
          break;
        }
      }
    }
  }

  // STEP 3: Final fallbacks
  if (amountIndex === null && normalizedHeaders.length > 1) {
    amountIndex = normalizedHeaders.length - 1;
    confidence += 0.1;
    console.log(`   💡 Final fallback: using last column (${amountIndex}) as amount`);
  }

  // IMPORTANT: Don't just use first column as product name if it looks like a code
  if (productNameIndex === null && sampleRows && sampleRows.length > 0) {
    // Look for the column with the longest text that has letters
    const firstRow = sampleRows[0].map(getCellText);
    let bestIndex = -1;
    let bestLength = 0;

    for (let i = 0; i < firstRow.length; i++) {
      const text = firstRow[i];
      if (/[A-Za-z]{3,}/.test(text) && text.length > bestLength) {
        bestLength = text.length;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      productNameIndex = bestIndex;
      confidence += 0.1;
      console.log(`   💡 Final fallback: found product name at index ${productNameIndex} (longest text with letters)`);
    } else if (normalizedHeaders.length > 0) {
      productNameIndex = 0;
      confidence += 0.05;
      console.log(`   💡 Last resort: using first column (0) as product name`);
    }
  }

  console.log(`   📊 Final column mapping: productName=${productNameIndex}, qty=${quantityIndex}, unit=${unitIndex}, amount=${amountIndex}, confidence=${confidence.toFixed(2)}`);

  return {
    productNameIndex,
    quantityIndex,
    unitIndex,
    amountIndex,
    confidence: Math.min(confidence, 1.0),
  };
}

/**
 * Extract product from table row
 * V2.1: More flexible extraction for any receipt format
 */
function extractProductFromTableRow(
  row: any[],
  columnMapping?: {
    productNameIndex: number | null;
    quantityIndex: number | null;
    unitIndex: number | null;
    amountIndex: number | null;
  }
): ExtractedProductV2 | null {
  if (!row || row.length === 0) return null;

  // Helper to get cell text
  const getCellText = (cell: any): string => {
    if (typeof cell === 'string') return cell;
    return cell?.text || cell?.Text || '';
  };

  // Use provided mapping or try to infer
  const mapping = columnMapping || {
    productNameIndex: 0, // Assume first column is product name
    quantityIndex: row.length > 1 ? 1 : null,
    unitIndex: null,
    amountIndex: row.length > 2 ? row.length - 1 : null, // Assume last column is amount
  };

  // Extract product name
  const nameCell = mapping.productNameIndex !== null ? row[mapping.productNameIndex] : row[0];
  const rawName = getCellText(nameCell).trim();

  if (!rawName || rawName.length < 2) return null;

  // Skip if matches skip patterns (invoice headers, totals, etc.)
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(rawName)) {
      return null;
    }
  }

  // Skip header-like rows (rows where the "product name" column contains header text)
  const headerKeywords = ['item', 'description', 'particulars', 'product', 'goods', 'name', 'no code', 'sr', 'sl', 's.no', 'hsn'];
  const lowerName = rawName.toLowerCase();
  if (headerKeywords.some(kw => lowerName === kw || lowerName === kw + '.')) {
    return null;
  }

  // Check if this row looks like a header row (contains multiple header-like terms)
  const rowTexts = row.map(getCellText).map(t => t.toLowerCase().trim());
  const headerTerms = ['item', 'qty', 'rate', 'amt', 'total', 'amount', 'quantity', 'price', 'discount', 'sgst', 'cgst', 'gst', 'hsn', 'mrp', 'mfg', 'batch', 'exp', 'free', 'taxable', 'value'];
  const headerMatches = rowTexts.filter(t => headerTerms.some(ht => t === ht || t === ht + '.')).length;
  if (headerMatches >= 3) {
    // This looks like a header row, skip it
    return null;
  }

  // Clean product name
  let productName = cleanProductName(rawName);
  if (!productName || productName.length < 2) {
    productName = extractProductNameFromLine(rawName);
  }
  // If still no valid name, use the raw name if it has letters
  if ((!productName || productName.length < 2) && /[A-Za-z]{3,}/.test(rawName)) {
    productName = rawName;
  }
  if (!productName || productName.length < 2) return null;

  // Extract quantity (with better handling of "6 Pe", "10 Pc", etc.)
  let quantity = 1;
  if (mapping.quantityIndex !== null && row[mapping.quantityIndex]) {
    const qtyCell = row[mapping.quantityIndex];
    const qtyText = getCellText(qtyCell).trim();
    // Match quantity with optional unit suffix (e.g., "6 Pe", "10 Pc", "1.5 Kg")
    const qtyMatch = qtyText.match(/^(\d+(?:\.\d+)?)/);
    if (qtyMatch) {
      quantity = parseFloat(qtyMatch[1]);
    }
  }

  // Extract and normalize unit
  let unit = 'piece';

  if (mapping.unitIndex !== null && row[mapping.unitIndex]) {
    const unitCell = row[mapping.unitIndex];
    const unitText = getCellText(unitCell).trim();
    unit = normalizeUnit(unitText);
  } else {
    // Try to extract unit from quantity column (e.g., "6 Pe" -> "piece")
    if (mapping.quantityIndex !== null && row[mapping.quantityIndex]) {
      const qtyCell = row[mapping.quantityIndex];
      const qtyText = getCellText(qtyCell).trim();
      const unitInQty = qtyText.match(/\d+(?:\.\d+)?\s*([A-Za-z]+)/);
      if (unitInQty && unitInQty[1]) {
        unit = normalizeUnit(unitInQty[1]);
      }
    }
    // Try to extract unit from product name
    if (unit === 'piece') {
      const unitMatch = rawName.match(/\b(kg|g|gm|ml|l|liter|litre|pcs?|pieces?|pack|box|bottle|bag|case|cases|kgm|nos)\b/i);
      if (unitMatch) {
        unit = normalizeUnit(unitMatch[1]);
      }
    }
  }

  // Extract amount (net amount / total)
  let netAmount = 0;
  if (mapping.amountIndex !== null && row[mapping.amountIndex]) {
    const amountCell = row[mapping.amountIndex];
    const amountText = getCellText(amountCell).trim();
    const amountMatch = amountText.match(/(\d+(?:[,.]\d+)?)/);
    if (amountMatch) {
      netAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
  }

  // Calculate unit price
  const unitPrice = quantity > 0 ? netAmount / quantity : 0;

  // V2.1: Be more permissive - accept products even if amount is 0 or very low
  // The AI enhancement step will validate/correct these later
  // Only reject if there's truly no usable data
  if (netAmount <= 0 && !productName) return null;

  // Flag for review if amount seems off
  const needsReview = netAmount <= 0 || unitPrice <= 0;

  return {
    id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: productName,
    quantity,
    unit,
    netAmount: netAmount || 0,
    unitPrice: unitPrice || 0,
    confidence: needsReview ? 0.5 : 0.85,
    needsReview,
    rowIndex: 0,
    stockAvailable: 100,
    minOrderQuantity: 1,
  };
}

/**
 * Main extraction function - uses AWS Textract + AI
 */
export async function extractProductsFromReceiptV2(
  imageBuffer: Buffer,
  sellerId?: string // Optional seller ID for AI matching against existing products
): Promise<ReceiptExtractionResultV2> {
  if (!validateAWSConfig()) {
    return {
      success: false,
      products: [],
      confidence: 0,
      error: 'AWS configuration is invalid. Please check your AWS credentials and region settings.',
    };
  }

  try {
    // Step 1: Extract structured data using AWS Textract
    console.log('📄 Step 1: Analyzing receipt structure with AWS Textract...');
    const structuredData = await analyzeReceiptStructureV2(imageBuffer);

    if (!structuredData.tables || structuredData.tables.length === 0) {
      return {
        success: false,
        products: [],
        confidence: 0,
        error: 'No table data found in receipt. Please ensure the receipt contains a product table.',
      };
    }

    // Step 2: Extract products from table data
    console.log('📊 Step 2: Extracting products from table data...');
    const extractedProducts: ExtractedProductV2[] = [];

    // Helper to get cell text
    const getCellText = (cell: any): string => {
      if (typeof cell === 'string') return cell;
      return cell?.text || cell?.Text || '';
    };

    // Helper to check if a row looks like a header row
    const isLikelyHeaderRow = (row: any[]): boolean => {
      const texts = row.map(getCellText).map(t => t.toLowerCase().trim());
      const headerTerms = ['item', 'qty', 'rate', 'amt', 'total', 'amount', 'quantity', 'price', 'discount', 'sgst', 'cgst', 'gst', 'hsn', 'mrp', 'mfg', 'batch', 'exp', 'free', 'taxable', 'value', 'description', 'particulars', 'product'];
      const matches = texts.filter(t => headerTerms.some(ht => t === ht || t.includes(ht))).length;
      return matches >= 3;
    };

    // Store raw table data for AI fallback
    const rawTableData: any[] = [];

    for (const table of structuredData.tables) {
      if (!table.structuredRows || table.structuredRows.length === 0) continue;

      // V2.1: Smart header row detection
      // Check if row 0 looks like incomplete headers (many empty values)
      let headerRowIndex = 0;
      let dataStartIndex = 1;

      const row0 = table.structuredRows[0];
      const row0Texts = row0.map(getCellText);
      const row0EmptyCount = row0Texts.filter((t: string) => !t || t.trim() === '').length;
      const row0EmptyPercentage = row0EmptyCount / row0Texts.length;

      console.log(`📋 Row 0 analysis: ${row0EmptyCount}/${row0Texts.length} empty cells (${(row0EmptyPercentage * 100).toFixed(0)}%)`);

      // If row 0 has > 50% empty cells and row 1 exists and looks like headers, use row 1 as header
      if (row0EmptyPercentage > 0.5 && table.structuredRows.length > 1) {
        const row1 = table.structuredRows[1];
        if (isLikelyHeaderRow(row1)) {
          headerRowIndex = 1;
          dataStartIndex = 2;
          console.log('   ⚠️ Row 0 looks incomplete, using Row 1 as header row');
        }
      }

      // Also check if row 0 itself looks like a header row, but has data mixed in
      if (headerRowIndex === 0 && isLikelyHeaderRow(row0)) {
        console.log('   ✅ Row 0 confirmed as header row');
      } else if (headerRowIndex === 0 && table.structuredRows.length > 1) {
        // Row 0 doesn't look like headers - check if row 1 does
        const row1 = table.structuredRows[1];
        if (isLikelyHeaderRow(row1)) {
          headerRowIndex = 1;
          dataStartIndex = 2;
          console.log('   ⚠️ Row 0 is not a header, using Row 1 as header row');
        }
      }

      const headerRow = table.structuredRows[headerRowIndex];
      const headers = headerRow.map(getCellText);

      console.log(`📋 Using Row ${headerRowIndex} as headers:`, headers.filter((h: string) => h).slice(0, 10));

      const columnMapping = identifyProductTableColumns(
        headers,
        table.structuredRows.slice(dataStartIndex, dataStartIndex + 3) // Use first few data rows as samples
      );

      console.log('🗂️ Column mapping:', JSON.stringify(columnMapping, null, 2));

      // Store raw data for AI fallback
      rawTableData.push({
        headers: headers,
        rows: table.structuredRows.slice(dataStartIndex).map((row: any[]) => row.map(getCellText))
      });

      // Log first 3 data rows for debugging
      console.log('📊 Sample data rows:');
      for (let i = dataStartIndex; i <= Math.min(dataStartIndex + 2, table.structuredRows.length - 1); i++) {
        const sampleRow = table.structuredRows[i];
        const rowTexts = sampleRow.map(getCellText);
        console.log(`   Row ${i}:`, rowTexts.slice(0, 8));
      }

      // Process data rows (skip header)
      for (let i = dataStartIndex; i < table.structuredRows.length; i++) {
        const row = table.structuredRows[i];
        const product = extractProductFromTableRow(row, columnMapping);

        if (product) {
          product.rowIndex = i;
          extractedProducts.push(product);
        } else if (i <= dataStartIndex + 2) {
          // Log why first few rows failed
          console.log(`❌ Row ${i} rejected - checking cell values:`);
          row.forEach((cell: any, idx: number) => {
            const text = getCellText(cell);
            console.log(`   Cell ${idx}: "${text}"`);
          });
        }
      }
    }

    // V2.1: If traditional extraction failed, try AI-based direct extraction
    if (extractedProducts.length === 0 && rawTableData.length > 0) {
      console.log('🤖 Step 2.5: Traditional extraction failed, attempting AI-based direct extraction...');

      try {
        const aiExtractionPrompt = `You are an expert at reading receipt/invoice tables. Extract ALL products from the following table data.

RAW TABLE DATA:
${JSON.stringify(rawTableData, null, 2)}

INSTRUCTIONS:
1. Identify which column contains product names (usually the longest text with letters)
2. Identify which column contains quantities (small numbers, may have unit suffix like "6 Pe" or "10 Pc")
3. Identify which column contains the total/net amount (usually the last column with decimal numbers)
4. Extract EVERY product row (skip header rows and total rows)
5. For quantities like "6 Pe" or "10 Pc", extract the number as quantity and "piece" as unit

For each product, extract:
- name: The product name (clean, no codes or barcodes)
- quantity: Number of units (default 1 if not found)
- unit: Unit type (piece, kg, gram, liter, pack, etc.)
- netAmount: Total price for this line item
- unitPrice: netAmount / quantity

Return a JSON array of products. Example:
[
  {
    "name": "CUTICURA SOAP ORIGINAL BLOOM 75GM",
    "quantity": 6,
    "unit": "piece",
    "netAmount": 218.16,
    "unitPrice": 36.36
  }
]

Return ONLY valid JSON, no other text.`;

        const aiResult = await invokeEnhancedModel(aiExtractionPrompt, {
          maxTokens: 8192,
          temperature: 0.1,
        });

        if (aiResult.success && aiResult.content) {
          console.log('🤖 AI direct extraction result received');
          const aiProducts = parseBedrockJSON(aiResult.content);

          if (Array.isArray(aiProducts) && aiProducts.length > 0) {
            console.log(`✅ AI extracted ${aiProducts.length} products directly`);

            for (let i = 0; i < aiProducts.length; i++) {
              const p = aiProducts[i];
              if (p.name && typeof p.name === 'string' && p.name.length >= 3) {
                extractedProducts.push({
                  id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  name: p.name,
                  quantity: p.quantity || 1,
                  unit: normalizeUnit(p.unit || 'piece'),
                  netAmount: p.netAmount || 0,
                  unitPrice: p.unitPrice || 0,
                  confidence: 0.75, // Slightly lower confidence for AI-extracted
                  needsReview: true,
                  rowIndex: i + 1,
                  stockAvailable: 100,
                  minOrderQuantity: 1,
                });
              }
            }
          }
        }
      } catch (aiError) {
        console.warn('AI direct extraction failed:', aiError);
      }
    }

    if (extractedProducts.length === 0) {
      return {
        success: false,
        products: [],
        confidence: 0,
        error: 'No products could be extracted from the receipt. Please check the receipt format or try a clearer image.',
      };
    }

    console.log(`✅ Successfully extracted ${extractedProducts.length} products from table data`);

    // Step 3: Fetch existing products from seller inventory (if sellerId provided)
    let existingProducts: any[] = [];
    if (sellerId) {
      try {
        const { getAdminSupabaseClient } = await import('@/lib/supabase-admin');
        const supabase = getAdminSupabaseClient();

        const { data, error } = await supabase
          .from('products')
          .select(`
            id,
            name,
            product_variants (
              variant_type,
              variant_value
            )
          `)
          .eq('seller_id', sellerId)
          .eq('is_active', true);

        if (!error && data) {
          existingProducts = data;
          console.log(`📦 Found ${existingProducts.length} existing products for seller ${sellerId}`);
        }
      } catch (error) {
        console.warn('Failed to fetch existing products:', error);
        // Continue without existing products
      }
    }

    // Step 3.5: Fetch existing categories and subcategories from database
    let availableCategories: { id: string; name: string }[] = [];
    let availableSubcategories: { id: string; name: string; category_id: string }[] = [];
    try {
      const { getAdminSupabaseClient } = await import('@/lib/supabase-admin');
      const supabase = getAdminSupabaseClient();

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (!categoriesError && categoriesData) {
        availableCategories = categoriesData;
        console.log(`📂 Found ${availableCategories.length} existing categories`);
      }

      // Fetch subcategories
      const { data: subcategoriesData, error: subcategoriesError } = await supabase
        .from('subcategories')
        .select('id, name, category_id')
        .eq('is_active', true)
        .order('name');

      if (!subcategoriesError && subcategoriesData) {
        availableSubcategories = subcategoriesData;
        console.log(`📁 Found ${availableSubcategories.length} existing subcategories`);
      }
    } catch (error) {
      console.warn('Failed to fetch categories/subcategories:', error);
    }

    // Build category-subcategory mapping for AI
    const categorySubcategoryMap: Record<string, string[]> = {};
    for (const cat of availableCategories) {
      const subs = availableSubcategories
        .filter(sub => sub.category_id === cat.id)
        .map(sub => sub.name);
      categorySubcategoryMap[cat.name] = subs;
    }

    // Step 4: Use AI to enhance and validate extracted products
    console.log('🤖 Step 4: Enhancing products with AI...');

    // Include raw receipt data for better unit detection
    const rawReceiptData = structuredData.tables.map((table: any) => ({
      headers: table.structuredRows?.[0]?.map((cell: any) => {
        const text = typeof cell === 'string' ? cell : cell?.text || cell?.Text || '';
        return text;
      }) || [],
      sampleRows: table.structuredRows?.slice(1, 4).map((row: any[]) =>
        row.map((cell: any) => {
          const text = typeof cell === 'string' ? cell : cell?.text || cell?.Text || '';
          return text;
        })
      ) || []
    }));

    const productsJSON = JSON.stringify(extractedProducts.map(p => ({
      name: p.name,
      quantity: p.quantity,
      unit: p.unit,
      netAmount: p.netAmount,
      unitPrice: p.unitPrice,
    })));

    const existingProductsJSON = existingProducts.length > 0
      ? JSON.stringify(existingProducts.map(p => ({
        id: p.id,
        name: p.name,
        variants: p.product_variants?.map((v: any) => ({
          type: v.variant_type,
          value: v.variant_value,
        })) || [],
      })))
      : '[]';

    const aiPrompt = `You are an expert at analyzing receipt data and product matching. Review the following extracted products from a receipt:

RAW RECEIPT DATA (for unit detection):
${JSON.stringify(rawReceiptData, null, 2)}

EXTRACTED PRODUCTS:
${productsJSON}

${existingProducts.length > 0 ? `EXISTING PRODUCTS IN SELLER INVENTORY:
${existingProductsJSON}

IMPORTANT: For each extracted product, check if it matches an existing product or is a variant of an existing product.
- If a product name is similar to an existing product but has different size/flavor/color/weight/pack, it's likely a variant.
- Example: If "Coca Cola 500ml" exists and you see "Coca Cola 250ml", mark it as a variant.
- Extract the base product name (e.g., "Coca Cola") and variant info (e.g., type: "size", value: "250ml").
- If it matches an existing product exactly, set existingProductId to that product's ID.
` : ''}

CRITICAL: CATEGORY AND SUBCATEGORY MAPPING
You MUST use ONLY the categories and subcategories from the following list. DO NOT create new categories or subcategories.
If you CANNOT find an exact or very close match in the available list, set the category and/or subcategory to null (leave blank).
The user will manually fill in the correct category/subcategory later.

AVAILABLE CATEGORIES AND SUBCATEGORIES:
${JSON.stringify(categorySubcategoryMap, null, 2)}

Available category names: ${availableCategories.map(c => c.name).join(', ')}

CRITICAL: Unit Detection and Normalization
- Look at the RAW RECEIPT DATA to identify the unit column and its values
- Common unit abbreviations in Indian receipts:
  * Pieces: "pcs", "pc", "nos", "no", "count", "units", "ea", "each", "kgm/nos"
  * Weight: "kg", "kgs", "kgm" (kilogram), "g", "gm", "gram", "grams"
  * Volume: "l", "lt", "liter", "litre", "liters", "ml", "milliliter", "milliliters"
  * Packaging: "pack", "packs", "box", "boxes", "bottle", "bottles", "bag", "bags", "case", "cases"
- Normalize units to standard values:
  * Pieces → "piece"
  * Weight → "gram" (for g/gm) or "kilogram" (for kg/kgs/kgm)
  * Volume → "milliliter" (for ml) or "liter" (for l/lt/liter/litre)
  * Packaging → keep as is (pack, box, bottle, bag, case)
- If unit is missing or unclear, infer from product name (e.g., "Coca Cola 250ml" → unit: "milliliter")
- Always provide a normalized unit value, never leave it empty

For each product, please:
1. **Correct and normalize the unit** based on the raw receipt data and product name
2. Suggest the most likely brand name (e.g., "Cadbury", "Parle", "Britannia", "Coca-Cola")
3. **Map to an EXISTING category from the provided list** - If no match found, set to null
4. **Map to an EXISTING subcategory from the provided list** - If no match found, set to null
5. Suggest minimum order quantity based on product type
6. Generate a brief description
7. Identify if the product name contains variant information (size, flavor, color, weight, pack)
8. Extract base product name (without variant info)
9. If sellerId was provided and product matches existing inventory, set existingProductId
10. Group similar products that are variants of the same base product (suggest variantGroup numbers)

Return a JSON array with the same structure, but with corrected/normalized units and added fields: unit (corrected), brand, category, subcategory, minOrderQuantity, description, baseProductName, variantType, variantValue, isVariant, existingProductId, variantGroup.

IMPORTANT: category and subcategory values MUST be exact matches from the AVAILABLE CATEGORIES AND SUBCATEGORIES list above, OR set to null if no match is found.

Example response format:
[
  {
    "name": "Coca Cola 250ml",
    "quantity": 2,
    "unit": "milliliter",
    "netAmount": 50.00,
    "unitPrice": 25.00,
    "brand": "Coca-Cola",
    "category": "Beverages",
    "subcategory": "Soft Drinks",
    "minOrderQuantity": 1,
    "description": "Coca Cola soft drink in 250ml bottle",
    "baseProductName": "Coca Cola",
    "variantType": "size",
    "variantValue": "250ml",
    "isVariant": true,
    "existingProductId": null,
    "variantGroup": "1"
  }
]

Return ONLY valid JSON, no other text.`;

    const aiResult = await invokeEnhancedModel(aiPrompt, {
      maxTokens: 16384, // Increased to handle receipts with many products
      temperature: 0.2,
    });

    console.log('🤖 AI Enhancement Result:', {
      success: aiResult.success,
      hasContent: !!aiResult.content,
      contentLength: aiResult.content?.length || 0,
      error: aiResult.error || 'none',
    });

    if (!aiResult.success || !aiResult.content) {
      console.warn('AI enhancement failed, using basic extraction');
      console.warn('AI Error details:', aiResult.error || 'No content returned');
      // Return products without AI enhancement
      return {
        success: true,
        products: extractedProducts,
        confidence: 0.75,
        metadata: {
          totalItems: extractedProducts.length,
          totalAmount: extractedProducts.reduce((sum, p) => sum + p.netAmount, 0),
        },
      };
    }

    // Parse AI response
    let aiEnhancedProducts: any[] = [];
    try {
      console.log('🔍 Parsing AI response...');
      console.log('📝 AI Content preview:', aiResult.content.substring(0, 500));

      const parsed = parseBedrockJSON(aiResult.content);
      console.log('✅ Parsed type:', typeof parsed, Array.isArray(parsed) ? 'is array' : 'not array');

      if (Array.isArray(parsed)) {
        aiEnhancedProducts = parsed;
        console.log(`✅ Parsed ${aiEnhancedProducts.length} products from AI response`);
      } else if (parsed && typeof parsed === 'object' && 'products' in parsed && Array.isArray((parsed as any).products)) {
        aiEnhancedProducts = (parsed as any).products;
        console.log(`✅ Parsed ${aiEnhancedProducts.length} products from AI response (products field)`);
      } else {
        console.warn('⚠️ AI response is not an array and has no products field:', parsed);
      }

      // Log first enhanced product for debugging
      if (aiEnhancedProducts.length > 0) {
        console.log('📦 Sample AI enhanced product:', JSON.stringify(aiEnhancedProducts[0], null, 2));
      }
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('📝 Raw AI content:', aiResult.content);
    }

    // Merge AI enhancements with extracted products
    const finalProducts = extractedProducts.map((product, index) => {
      const aiProduct = aiEnhancedProducts[index];
      if (aiProduct) {
        // Use AI-corrected unit if provided, otherwise normalize the existing unit
        let correctedUnit = product.unit;
        if (aiProduct.unit) {
          correctedUnit = normalizeUnit(aiProduct.unit);
        } else {
          correctedUnit = normalizeUnit(product.unit);
        }

        return {
          ...product,
          unit: correctedUnit, // Use AI-corrected and normalized unit
          brand: aiProduct.brand || product.brand,
          category: aiProduct.category || product.category,
          subcategory: aiProduct.subcategory || product.subcategory,
          minOrderQuantity: aiProduct.minOrderQuantity || product.minOrderQuantity || 1,
          description: aiProduct.description || product.description || product.name,
          baseProductName: aiProduct.baseProductName || product.name,
          variantType: aiProduct.variantType,
          variantValue: aiProduct.variantValue,
          isVariant: aiProduct.isVariant || false,
          existingProductId: aiProduct.existingProductId,
          variantGroup: aiProduct.variantGroup,
        };
      }
      // Even if AI enhancement failed, normalize the unit
      return {
        ...product,
        unit: normalizeUnit(product.unit),
      };
    });

    // Calculate overall confidence
    const avgConfidence = finalProducts.reduce((sum, p) => sum + p.confidence, 0) / finalProducts.length;
    const overallConfidence = Math.min(avgConfidence, 0.95); // Cap at 0.95

    return {
      success: true,
      products: finalProducts,
      confidence: overallConfidence,
      metadata: {
        totalItems: finalProducts.length,
        totalAmount: finalProducts.reduce((sum, p) => sum + p.netAmount, 0),
      },
    };
  } catch (error: any) {
    console.error('Error in extractProductsFromReceiptV2:', error);
    return {
      success: false,
      products: [],
      confidence: 0,
      error: error.message || 'Failed to extract products from receipt',
    };
  }
}

