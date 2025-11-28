/**
 * Receipt Parser Module
 * 
 * Parses structured table data from AWS Textract output and extracts products.
 * Handles product code separation (HSN codes) and provides serialization functions.
 * 
 * Requirements: 1.2, 2.5, 6.1, 6.2
 */

import { 
  ParsedReceipt, 
  ParsedRow, 
  CellData, 
  ExtractedReceiptProduct,
  BoundingBox,
  ReceiptFormatType
} from './receiptTypes';
import { mapColumns, MapColumnsResult } from './receiptColumnMapper';
import { calculateUnitPrice } from './unitPriceCalculator';

// ============================================================================
// Constants
// ============================================================================

/**
 * Pattern to match HSN codes (typically 4-8 digit numbers at start or end of product name)
 */
const HSN_CODE_PATTERN = /^(\d{4,8})\s+|\s+(\d{4,8})$/;

/**
 * Pattern to match product codes (alphanumeric codes like SKU, item codes)
 * Must contain at least one digit to be considered a product code
 */
const PRODUCT_CODE_PATTERN = /^([A-Z]*\d+[A-Z0-9]*[-/]?[A-Z0-9]*)\s+|\s+([A-Z]*\d+[A-Z0-9]*[-/]?[A-Z0-9]*)$/i;

/**
 * Pattern to match purely numeric codes that might be product IDs
 */
const NUMERIC_CODE_PATTERN = /^\d{5,12}\s+|\s+\d{5,12}$/;

// ============================================================================
// Product Code Separation
// ============================================================================

/**
 * Separates product codes (HSN codes, SKUs) from product names.
 * 
 * @param text - The original product text that may contain codes
 * @returns Object with cleaned name and extracted code (if any)
 * 
 * Requirements: 2.5
 */
export function separateProductCode(text: string): { name: string; code: string | null } {
  if (!text || typeof text !== 'string') {
    return { name: '', code: null };
  }

  let cleanedName = text.trim();
  let extractedCode: string | null = null;

  // Try to extract HSN code first (most common in Indian invoices)
  const hsnMatch = cleanedName.match(HSN_CODE_PATTERN);
  if (hsnMatch) {
    extractedCode = hsnMatch[1] || hsnMatch[2];
    cleanedName = cleanedName.replace(HSN_CODE_PATTERN, '').trim();
  }

  // If no HSN code, try numeric product codes
  if (!extractedCode) {
    const numericMatch = cleanedName.match(NUMERIC_CODE_PATTERN);
    if (numericMatch) {
      extractedCode = numericMatch[0].trim();
      cleanedName = cleanedName.replace(NUMERIC_CODE_PATTERN, '').trim();
    }
  }

  // Try alphanumeric product codes (SKUs) - must contain digits
  if (!extractedCode) {
    const productCodeMatch = cleanedName.match(PRODUCT_CODE_PATTERN);
    if (productCodeMatch) {
      const potentialCode = productCodeMatch[1] || productCodeMatch[2];
      // Only treat as code if it contains numbers (pattern already enforces this)
      if (potentialCode && /\d/.test(potentialCode)) {
        extractedCode = potentialCode;
        cleanedName = cleanedName.replace(PRODUCT_CODE_PATTERN, '').trim();
      }
    }
  }

  return { name: cleanedName, code: extractedCode };
}


// ============================================================================
// Table Parsing from Textract
// ============================================================================

/**
 * Textract Block interface (simplified for our needs)
 */
export interface TextractBlock {
  Id?: string;
  BlockType?: string;
  Text?: string;
  Confidence?: number;
  RowIndex?: number;
  ColumnIndex?: number;
  Geometry?: {
    BoundingBox?: {
      Left?: number;
      Top?: number;
      Width?: number;
      Height?: number;
    };
  };
  Relationships?: Array<{
    Type?: string;
    Ids?: string[];
  }>;
}

/**
 * Converts a Textract bounding box to our BoundingBox type
 */
function convertBoundingBox(geometry?: TextractBlock['Geometry']): BoundingBox | undefined {
  if (!geometry?.BoundingBox) return undefined;
  
  const bb = geometry.BoundingBox;
  return {
    left: bb.Left ?? 0,
    top: bb.Top ?? 0,
    width: bb.Width ?? 0,
    height: bb.Height ?? 0,
  };
}

/**
 * Parses AWS Textract blocks into a ParsedReceipt structure.
 * 
 * @param blocks - Array of Textract blocks from AnalyzeDocument response
 * @returns ParsedReceipt with headers, rows, and format type
 * 
 * Requirements: 1.2
 */
export function parseTableFromTextract(blocks: TextractBlock[]): ParsedReceipt {
  if (!blocks || blocks.length === 0) {
    return {
      headers: [],
      rows: [],
      formatType: 'unknown',
    };
  }

  // Create a map of block IDs to blocks for quick lookup
  const blockMap = new Map<string, TextractBlock>();
  blocks.forEach(block => {
    if (block.Id) {
      blockMap.set(block.Id, block);
    }
  });

  // Find TABLE blocks
  const tableBlocks = blocks.filter(b => b.BlockType === 'TABLE');
  
  if (tableBlocks.length === 0) {
    // No table found, try to extract from LINE blocks
    return parseFromLineBlocks(blocks);
  }

  // Use the first table (usually the main product table)
  const tableBlock = tableBlocks[0];
  
  // Get all CELL blocks that belong to this table
  const cellIds = tableBlock.Relationships
    ?.filter(rel => rel.Type === 'CHILD')
    .flatMap(rel => rel.Ids || []) || [];

  const cellBlocks = cellIds
    .map(id => blockMap.get(id))
    .filter((block): block is TextractBlock => 
      block !== undefined && block.BlockType === 'CELL'
    );

  // Group cells by row
  const rowMap = new Map<number, TextractBlock[]>();
  cellBlocks.forEach(cell => {
    const rowIndex = cell.RowIndex ?? 0;
    if (!rowMap.has(rowIndex)) {
      rowMap.set(rowIndex, []);
    }
    rowMap.get(rowIndex)!.push(cell);
  });

  // Sort rows by index and cells within each row by column index
  const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
  
  // Extract headers from first row
  const headerRow = rowMap.get(sortedRowIndices[0]) || [];
  const headers = headerRow
    .sort((a, b) => (a.ColumnIndex ?? 0) - (b.ColumnIndex ?? 0))
    .map(cell => getCellText(cell, blockMap));

  // Extract data rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < sortedRowIndices.length; i++) {
    const rowIndex = sortedRowIndices[i];
    const rowCells = rowMap.get(rowIndex) || [];
    
    const sortedCells = rowCells.sort((a, b) => 
      (a.ColumnIndex ?? 0) - (b.ColumnIndex ?? 0)
    );

    const cells: CellData[] = sortedCells.map(cell => ({
      text: getCellText(cell, blockMap),
      columnIndex: (cell.ColumnIndex ?? 1) - 1, // Convert to 0-based
      rowIndex: i - 1, // 0-based row index for data rows
      confidence: (cell.Confidence ?? 0) / 100, // Normalize to 0-1
      boundingBox: convertBoundingBox(cell.Geometry),
    }));

    const rawText = cells.map(c => c.text).join(' | ');
    
    rows.push({ cells, rawText });
  }

  // Determine format type based on headers
  const formatType = detectFormatType(headers);

  return {
    headers,
    rows,
    formatType,
  };
}

/**
 * Gets the text content of a cell, resolving WORD block references
 */
function getCellText(cell: TextractBlock, blockMap: Map<string, TextractBlock>): string {
  // If cell has direct text, use it
  if (cell.Text) {
    return cell.Text;
  }

  // Otherwise, get text from child WORD blocks
  const wordIds = cell.Relationships
    ?.filter(rel => rel.Type === 'CHILD')
    .flatMap(rel => rel.Ids || []) || [];

  const words = wordIds
    .map(id => blockMap.get(id))
    .filter((block): block is TextractBlock => 
      block !== undefined && block.BlockType === 'WORD' && !!block.Text
    )
    .map(block => block.Text!);

  return words.join(' ');
}

/**
 * Fallback parser when no TABLE blocks are found - extracts from LINE blocks
 */
function parseFromLineBlocks(blocks: TextractBlock[]): ParsedReceipt {
  const lineBlocks = blocks
    .filter(b => b.BlockType === 'LINE' && b.Text)
    .sort((a, b) => {
      const aTop = a.Geometry?.BoundingBox?.Top ?? 0;
      const bTop = b.Geometry?.BoundingBox?.Top ?? 0;
      return aTop - bTop;
    });

  if (lineBlocks.length === 0) {
    return { headers: [], rows: [], formatType: 'unknown' };
  }

  // Try to detect headers from first few lines
  const headers: string[] = [];
  const rows: ParsedRow[] = [];

  // Simple heuristic: first line with multiple tab/space separated values is header
  let headerFound = false;
  
  for (let i = 0; i < lineBlocks.length; i++) {
    const text = lineBlocks[i].Text || '';
    const parts = text.split(/\t|\s{2,}/).filter(p => p.trim());
    
    if (!headerFound && parts.length >= 3) {
      // This might be a header row
      headers.push(...parts);
      headerFound = true;
      continue;
    }

    if (headerFound && parts.length >= 2) {
      const cells: CellData[] = parts.map((part, idx) => ({
        text: part.trim(),
        columnIndex: idx,
        rowIndex: rows.length,
        confidence: (lineBlocks[i].Confidence ?? 0) / 100,
        boundingBox: convertBoundingBox(lineBlocks[i].Geometry),
      }));

      rows.push({ cells, rawText: text });
    }
  }

  return {
    headers,
    rows,
    formatType: headerFound ? 'simple_list' : 'unknown',
  };
}

/**
 * Detects the receipt format type based on headers
 */
function detectFormatType(headers: string[]): ReceiptFormatType {
  const headerText = headers.join(' ').toLowerCase();
  
  if (headerText.includes('hsn') || headerText.includes('cgst') || headerText.includes('sgst')) {
    return 'tax_invoice';
  }
  
  if (headerText.includes('distributor') || headerText.includes('dealer')) {
    return 'distributor_bill';
  }
  
  if (headers.length >= 3) {
    return 'simple_list';
  }
  
  return 'unknown';
}


// ============================================================================
// Product Extraction
// ============================================================================

/**
 * Generates a unique ID for extracted products
 */
function generateProductId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extracts a product from a parsed row using column mapping.
 * 
 * @param row - The parsed row containing cell data
 * @param mappingResult - The column mapping result from mapColumns
 * @returns ExtractedReceiptProduct or null if extraction failed
 * 
 * Requirements: 1.2, 2.5
 */
export function extractProductFromRow(
  row: ParsedRow,
  mappingResult: MapColumnsResult
): ExtractedReceiptProduct | null {
  if (!mappingResult.success || !mappingResult.mapping) {
    return null;
  }

  const { mapping } = mappingResult;
  
  // Get cell values by column index
  const getCellValue = (columnIndex: number): CellData | undefined => {
    return row.cells.find(cell => cell.columnIndex === columnIndex);
  };

  const nameCell = getCellValue(mapping.productName);
  const quantityCell = getCellValue(mapping.quantity);
  const netAmountCell = getCellValue(mapping.netAmount);

  // Product name is required
  if (!nameCell || !nameCell.text.trim()) {
    return null;
  }

  // Separate product code from name
  const { name: cleanedName, code: hsnCode } = separateProductCode(nameCell.text);
  
  if (!cleanedName) {
    return null;
  }

  // Parse quantity (default to 1 if not parseable)
  const quantityText = quantityCell?.text || '1';
  const quantity = parseFloat(quantityText.replace(/[^\d.]/g, '')) || 1;

  // Parse net amount
  const netAmountText = netAmountCell?.text || '0';
  const netAmount = parseFloat(netAmountText.replace(/[^\d.]/g, '')) || 0;

  // Calculate unit price
  const priceResult = calculateUnitPrice(netAmount, quantity);

  // Calculate confidence as average of cell confidences
  const confidences = [
    nameCell?.confidence ?? 0,
    quantityCell?.confidence ?? 0.5,
    netAmountCell?.confidence ?? 0.5,
  ];
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

  // Parse MRP if available
  let mrp: number | undefined;
  if (mapping.mrp !== undefined) {
    const mrpCell = getCellValue(mapping.mrp);
    if (mrpCell?.text) {
      mrp = parseFloat(mrpCell.text.replace(/[^\d.]/g, '')) || undefined;
    }
  }

  const product: ExtractedReceiptProduct = {
    id: generateProductId(),
    name: cleanedName,
    originalName: nameCell.text,
    quantity,
    netAmount,
    unitPrice: priceResult.unitPrice,
    mrp,
    hsnCode: hsnCode || undefined,
    confidence: avgConfidence,
    needsReview: avgConfidence < 0.7 || !priceResult.success,
    boundingBox: nameCell.boundingBox,
    originalText: row.rawText,
    fieldConfidences: {
      name: nameCell?.confidence ?? 0,
      quantity: quantityCell?.confidence ?? 0.5,
      netAmount: netAmountCell?.confidence ?? 0.5,
    },
  };

  return product;
}

/**
 * Extracts all products from a parsed receipt.
 * 
 * @param receipt - The parsed receipt structure
 * @returns Array of extracted products
 * 
 * Requirements: 1.2
 */
export function extractProductsFromReceipt(receipt: ParsedReceipt): ExtractedReceiptProduct[] {
  if (!receipt.headers.length || !receipt.rows.length) {
    return [];
  }

  // Map columns based on headers
  const mappingResult = mapColumns(receipt.headers);
  
  if (!mappingResult.success) {
    return [];
  }

  const products: ExtractedReceiptProduct[] = [];

  for (const row of receipt.rows) {
    const product = extractProductFromRow(row, mappingResult);
    if (product) {
      products.push(product);
    }
  }

  return products;
}


// ============================================================================
// Serialization Functions
// ============================================================================

/**
 * Serializes a ParsedReceipt to a JSON string.
 * 
 * @param receipt - The parsed receipt to serialize
 * @returns JSON string representation
 * 
 * Requirements: 6.1
 */
export function serializeReceipt(receipt: ParsedReceipt): string {
  return JSON.stringify(receipt);
}

/**
 * Deserializes a JSON string back to a ParsedReceipt.
 * 
 * @param json - The JSON string to parse
 * @returns ParsedReceipt structure
 * @throws Error if JSON is invalid or doesn't match expected structure
 * 
 * Requirements: 6.1
 */
export function deserializeReceipt(json: string): ParsedReceipt {
  const parsed = JSON.parse(json);
  
  // Validate the structure
  if (!Array.isArray(parsed.headers)) {
    throw new Error('Invalid ParsedReceipt: headers must be an array');
  }
  
  if (!Array.isArray(parsed.rows)) {
    throw new Error('Invalid ParsedReceipt: rows must be an array');
  }
  
  if (typeof parsed.formatType !== 'string') {
    throw new Error('Invalid ParsedReceipt: formatType must be a string');
  }

  // Validate each row
  for (const row of parsed.rows) {
    if (!Array.isArray(row.cells)) {
      throw new Error('Invalid ParsedReceipt: each row must have cells array');
    }
    if (typeof row.rawText !== 'string') {
      throw new Error('Invalid ParsedReceipt: each row must have rawText string');
    }
    
    // Validate each cell
    for (const cell of row.cells) {
      if (typeof cell.text !== 'string') {
        throw new Error('Invalid ParsedReceipt: each cell must have text string');
      }
      if (typeof cell.columnIndex !== 'number') {
        throw new Error('Invalid ParsedReceipt: each cell must have columnIndex number');
      }
      if (typeof cell.rowIndex !== 'number') {
        throw new Error('Invalid ParsedReceipt: each cell must have rowIndex number');
      }
      if (typeof cell.confidence !== 'number') {
        throw new Error('Invalid ParsedReceipt: each cell must have confidence number');
      }
    }
  }

  return parsed as ParsedReceipt;
}

/**
 * Pretty prints a ParsedReceipt for human-readable output and debugging.
 * 
 * @param receipt - The parsed receipt to format
 * @returns Human-readable string representation
 * 
 * Requirements: 6.2
 */
export function prettyPrintReceipt(receipt: ParsedReceipt): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(60));
  lines.push(`Receipt Format: ${receipt.formatType}`);
  lines.push('='.repeat(60));
  lines.push('');
  
  // Print headers
  if (receipt.headers.length > 0) {
    lines.push('Headers:');
    lines.push('-'.repeat(40));
    
    // Calculate column widths
    const colWidths = receipt.headers.map((h, i) => {
      const maxDataWidth = Math.max(
        ...receipt.rows.map(row => {
          const cell = row.cells.find(c => c.columnIndex === i);
          return cell?.text.length || 0;
        })
      );
      return Math.max(h.length, maxDataWidth, 10);
    });
    
    // Print header row
    const headerLine = receipt.headers
      .map((h, i) => h.padEnd(colWidths[i]))
      .join(' | ');
    lines.push(headerLine);
    lines.push('-'.repeat(headerLine.length));
  }
  
  // Print data rows
  if (receipt.rows.length > 0) {
    lines.push('');
    lines.push(`Data Rows (${receipt.rows.length} total):`);
    lines.push('-'.repeat(40));
    
    for (let i = 0; i < receipt.rows.length; i++) {
      const row = receipt.rows[i];
      lines.push(`Row ${i + 1}:`);
      
      for (const cell of row.cells) {
        const header = receipt.headers[cell.columnIndex] || `Col ${cell.columnIndex}`;
        const confidence = (cell.confidence * 100).toFixed(1);
        lines.push(`  ${header}: "${cell.text}" (confidence: ${confidence}%)`);
      }
      
      lines.push(`  Raw: "${row.rawText}"`);
      lines.push('');
    }
  } else {
    lines.push('');
    lines.push('No data rows found.');
  }
  
  lines.push('='.repeat(60));
  
  return lines.join('\n');
}
