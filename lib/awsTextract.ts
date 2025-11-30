import { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand, Block } from '@aws-sdk/client-textract';
import { fromEnv } from '@aws-sdk/credential-providers';
import { extractProductNameFromLine, cleanProductName } from './productNameCleaner';

// AWS Textract configuration
const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '';

// Initialize Textract client only if credentials are available
let textractClient: TextractClient | null = null;

if (AWS_ACCESS_KEY_ID && AWS_ACCESS_KEY_ID !== 'your-aws-access-key-here' && 
    AWS_SECRET_ACCESS_KEY && AWS_SECRET_ACCESS_KEY !== 'your-aws-secret-key-here') {
  try {
    textractClient = new TextractClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  } catch (error) {
    console.warn('Failed to initialize AWS Textract client:', error);
  }
}

export interface AWSExtractedProduct {
  name: string;
  price: number;
  quantity?: number;
  unit?: string;
  category?: string;
  confidence: number;
}

export interface AWSReceiptData {
  products: AWSExtractedProduct[];
  totalAmount?: number;
  merchantName?: string;
  date?: string;
  confidence: number;
}

export interface AWSProcessingResult {
  success: boolean;
  data?: AWSReceiptData;
  error?: string;
}

// Helper function to extract text from image using AWS Textract
export async function extractTextFromImageAWS(imageBuffer: Buffer): Promise<string[]> {
  if (!textractClient) {
    throw new Error('AWS Textract client is not initialized. Please check your AWS configuration.');
  }

  try {
    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: imageBuffer,
      },
    });

    const response = await textractClient.send(command);
    const textLines: string[] = [];

    if (response.Blocks) {
      // Extract LINE blocks which contain the text content
      const lineBlocks = response.Blocks.filter(block => block.BlockType === 'LINE');
      
      for (const block of lineBlocks) {
        if (block.Text) {
          textLines.push(block.Text);
        }
      }
    }

    return textLines;
  } catch (error) {
    console.error('Error extracting text from image with AWS Textract:', error);
    throw error;
  }
}

// Enhanced function to analyze document structure using AWS Textract
// This is used by the OLD Scan Receipt - DO NOT MODIFY
export async function analyzeReceiptStructureAWS(imageBuffer: Buffer): Promise<{
  tables: any[];
  keyValuePairs: any[];
  textLines: string[];
}> {
  if (!textractClient) {
    throw new Error('AWS Textract client is not initialized. Please check your AWS configuration.');
  }

  try {
    const command = new AnalyzeDocumentCommand({
      Document: {
        Bytes: imageBuffer,
      },
      FeatureTypes: ['TABLES', 'FORMS'],
    });

    const response = await textractClient.send(command);
    const tables: any[] = [];
    const keyValuePairs: any[] = [];
    const textLines: string[] = [];

    if (response.Blocks) {
      // Extract different types of blocks
      const lineBlocks = response.Blocks.filter(block => block.BlockType === 'LINE');
      const tableBlocks = response.Blocks.filter(block => block.BlockType === 'TABLE');
      const keyValueBlocks = response.Blocks.filter(block => block.BlockType === 'KEY_VALUE_SET');

      // Extract text lines
      for (const block of lineBlocks) {
        if (block.Text) {
          textLines.push(block.Text);
        }
      }

      // Extract tables (useful for itemized receipts)
      for (const tableBlock of tableBlocks) {
        if (tableBlock.Relationships) {
          const cellBlocks = tableBlock.Relationships
            .filter(rel => rel.Type === 'CHILD')
            .flatMap(rel => rel.Ids || [])
            .map(id => response.Blocks?.find(block => block.Id === id))
            .filter(block => block && block.BlockType === 'CELL');

          tables.push({
            id: tableBlock.Id,
            cells: cellBlocks,
            confidence: tableBlock.Confidence || 0
          });
        }
      }

      // Extract key-value pairs (useful for receipt metadata)
      for (const kvBlock of keyValueBlocks) {
        if (kvBlock.EntityTypes?.includes('KEY')) {
          keyValuePairs.push({
            id: kvBlock.Id,
            text: kvBlock.Text,
            confidence: kvBlock.Confidence || 0
          });
        }
      }
    }

    return { tables, keyValuePairs, textLines };
  } catch (error) {
    console.error('Error analyzing document structure with AWS Textract:', error);
    throw error;
  }
}

/**
 * Enhanced AWS Textract function specifically for Scan Receipt 2.0
 * Focuses on comprehensive table extraction to capture ALL product rows
 * Uses more detailed table parsing to ensure no rows are missed
 */
export async function analyzeReceiptStructureV2(imageBuffer: Buffer): Promise<{
  tables: any[];
  keyValuePairs: any[];
  textLines: string[];
}> {
  if (!textractClient) {
    throw new Error('AWS Textract client is not initialized. Please check your AWS configuration.');
  }

  try {
    const command = new AnalyzeDocumentCommand({
      Document: {
        Bytes: imageBuffer,
      },
      FeatureTypes: ['TABLES', 'FORMS'],
    });

    const response = await textractClient.send(command);
    const tables: any[] = [];
    const keyValuePairs: any[] = [];
    const textLines: string[] = [];

    if (!response.Blocks) {
      return { tables, keyValuePairs, textLines };
    }

    // Create a map of all blocks by ID for efficient lookup
    const blockMap = new Map<string, Block>();
    response.Blocks.forEach(block => {
      if (block.Id) {
        blockMap.set(block.Id, block);
      }
    });

    // Extract text lines
    const lineBlocks = response.Blocks.filter(block => block.BlockType === 'LINE');
    for (const block of lineBlocks) {
      if (block.Text) {
        textLines.push(block.Text);
      }
    }

    // Extract key-value pairs
    const keyValueBlocks = response.Blocks.filter(block => block.BlockType === 'KEY_VALUE_SET');
    for (const kvBlock of keyValueBlocks) {
      if (kvBlock.EntityTypes?.includes('KEY')) {
        keyValuePairs.push({
          id: kvBlock.Id,
          text: kvBlock.Text,
          confidence: kvBlock.Confidence || 0
        });
      }
    }

    // Enhanced table extraction for Scan Receipt 2.0
    // Extract ALL tables with comprehensive cell extraction
    const tableBlocks = response.Blocks.filter(block => block.BlockType === 'TABLE');
    
    for (const tableBlock of tableBlocks) {
      if (!tableBlock.Relationships) continue;

      // Get all cell IDs from table relationships
      const cellIds = tableBlock.Relationships
        .filter(rel => rel.Type === 'CHILD')
        .flatMap(rel => rel.Ids || []);

      // Extract all cells with full details
      const cellBlocks: any[] = [];
      for (const cellId of cellIds) {
        const cellBlock = blockMap.get(cellId);
        if (cellBlock && cellBlock.BlockType === 'CELL') {
          // Get cell text from relationships if available
          let cellText = cellBlock.Text || '';
          
          // If cell has child relationships (for merged cells or complex content)
          if (cellBlock.Relationships) {
            const childIds = cellBlock.Relationships
              .filter(rel => rel.Type === 'CHILD')
              .flatMap(rel => rel.Ids || []);
            
            // Collect text from child blocks (WORD blocks)
            const childTexts: string[] = [];
            for (const childId of childIds) {
              const childBlock = blockMap.get(childId);
              if (childBlock && childBlock.Text) {
                childTexts.push(childBlock.Text);
              }
            }
            
            if (childTexts.length > 0) {
              cellText = childTexts.join(' ');
            }
          }

          cellBlocks.push({
            ...cellBlock,
            Text: cellText || cellBlock.Text || '',
            RowIndex: cellBlock.RowIndex,
            ColumnIndex: cellBlock.ColumnIndex,
            Confidence: cellBlock.Confidence || 0
          });
        }
      }

      // Group cells by row and column for better structure
      const rowMap = new Map<number, Map<number, any>>();
      for (const cell of cellBlocks) {
        const rowIdx = cell.RowIndex || 0;
        const colIdx = cell.ColumnIndex || 0;
        
        if (!rowMap.has(rowIdx)) {
          rowMap.set(rowIdx, new Map());
        }
        rowMap.get(rowIdx)!.set(colIdx, cell);
      }

      // Convert to structured format with all rows
      const structuredRows: any[][] = [];
      const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
      
      for (const rowIdx of sortedRowIndices) {
        const colMap = rowMap.get(rowIdx)!;
        const sortedColIndices = Array.from(colMap.keys()).sort((a, b) => a - b);
        const row: any[] = [];
        
        for (const colIdx of sortedColIndices) {
          row.push(colMap.get(colIdx));
        }
        
        structuredRows.push(row);
      }

      // Store table with enhanced structure
      tables.push({
        id: tableBlock.Id,
        cells: cellBlocks,
        structuredRows: structuredRows, // Add structured rows for easier processing
        rowCount: structuredRows.length,
        columnCount: structuredRows.length > 0 ? structuredRows[0].length : 0,
        confidence: tableBlock.Confidence || 0
      });
    }

    // Log extraction summary
    console.log(`📊 Scan Receipt 2.0 - AWS Textract extraction complete:`);
    console.log(`   - Tables found: ${tables.length}`);
    console.log(`   - Total table rows: ${tables.reduce((sum, t) => sum + (t.rowCount || 0), 0)}`);
    console.log(`   - Text lines: ${textLines.length}`);
    console.log(`   - Key-value pairs: ${keyValuePairs.length}`);

    return { tables, keyValuePairs, textLines };
  } catch (error) {
    console.error('Error analyzing document structure with AWS Textract (V2):', error);
    throw error;
  }
}

// Enhanced receipt parsing using AWS Textract's structured data
export function parseReceiptTextAWS(textLines: string[], structuredData?: {
  tables: any[];
  keyValuePairs: any[];
}): AWSReceiptData {
  const products: AWSExtractedProduct[] = [];
  let totalAmount: number | undefined;
  let merchantName: string | undefined;
  let date: string | undefined;

  // Enhanced patterns for better extraction
  const pricePattern = /\$?([0-9]+[,.]?[0-9]*\.?[0-9]{0,2})/g;
  const quantityPattern = /\b([0-9]+(?:\.[0-9]+)?)\s*(?:pcs?|pc|pieces?|qty|x|units?)?\b/i;
  const datePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
  const totalPattern = /(?:total|sum|amount|net\s*amount|grand\s*total|final\s*total)\s*:?\s*\$?([0-9]+[,.]?[0-9]*\.?[0-9]{0,2})/i;
  
  // Patterns to skip non-product lines
  const skipPatterns = [
    /^\s*(?:receipt|invoice|bill|store|shop|market)/i,
    /^\s*(?:date|time|cashier|clerk|thank\s*you)/i,
    /^\s*(?:subtotal|tax|discount|change|tender)/i,
    /^\s*(?:card|cash|payment|method)/i,
    /^\s*(?:address|phone|email|website)/i
  ];

  // PRIORITY 1: Extract products from table data (most accurate for receipts)
  if (structuredData?.tables && structuredData.tables.length > 0) {
    console.log('Processing tabular receipt data with AWS Textract...');
    
    for (const table of structuredData.tables) {
      const tableRows = groupCellsIntoRows(table.cells);
      
      // Skip header row (usually first row)
      const dataRows = tableRows.slice(1);
      
      for (const row of dataRows) {
        const product = extractProductFromTableRow(row);
        if (product) {
          products.push(product);
        }
      }
    }
  }

  // First, try to extract from structured table data if available
  if (structuredData?.tables && structuredData.tables.length > 0) {
    for (const table of structuredData.tables) {
      if (table.cells && table.cells.length > 0) {
        // Process table cells to extract product information
        const rows = groupCellsIntoRows(table.cells);
        
        for (const row of rows) {
          const productInfo = extractProductFromTableRow(row);
          if (productInfo) {
            products.push(productInfo);
          }
        }
      }
    }
  }

  // PRIORITY 2: If no products found from tables, fall back to text-based extraction
  if (products.length === 0) {
    console.log('No products found in tables, falling back to text-based extraction...');
    
    // Extract metadata from key-value pairs first
    if (structuredData?.keyValuePairs) {
      for (const kvPair of structuredData.keyValuePairs) {
        const text = kvPair.text?.toLowerCase() || '';
        if (text.includes('total') && !totalAmount) {
          const match = kvPair.text?.match(totalPattern);
          if (match) {
            totalAmount = parseFloat(match[1].replace(/,/g, ''));
          }
        }
        if (text.includes('date') && !date) {
          const match = kvPair.text?.match(datePattern);
          if (match) {
            date = match[0];
          }
        }
      }
    }

  // Continue with text line parsing for remaining data extraction
  if (products.length === 0) {
    console.log('Processing text lines for product extraction...');
    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i].trim();
      if (!line) continue;
      
      // Extract merchant name (usually first few lines)
      if (i < 3 && !merchantName && line.length > 3 && !pricePattern.test(line) && 
          !skipPatterns.some(pattern => pattern.test(line))) {
        merchantName = line;
      }

      // Extract date
      const dateMatch = line.match(datePattern);
      if (dateMatch && !date) {
        date = dateMatch[0];
      }

      // Extract total amount
      const totalMatch = line.match(totalPattern);
      if (totalMatch) {
        totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
        continue;
      }

      // Skip non-product lines
      if (skipPatterns.some(pattern => pattern.test(line))) {
        continue;
      }

      // Extract products from text lines
      const prices = Array.from(line.matchAll(pricePattern)).map(match => 
        parseFloat(match[1].replace(/,/g, ''))
      ).filter(price => price > 0);
      
      if (prices.length > 0) {
        const quantityMatch = line.match(quantityPattern);
        const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : 1;
        
      // Extract and clean product name using enhanced cleaning utility
      let productName = extractProductNameFromLine(line);
      
      // If extraction failed, fall back to basic cleaning
      if (!productName || productName.length < 2) {
        productName = line;
        productName = productName.replace(pricePattern, '');
        if (quantityMatch) {
          productName = productName.replace(quantityMatch[0], '');
        }
        productName = productName.replace(/^\s*\d+\s*/, '');
        productName = productName.replace(/\s+/g, ' ').trim();
        productName = productName.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      }
        
        if (productName.length > 2) {
          const itemTotal = prices[prices.length - 1];
          const unitPrice = prices.length > 1 ? prices[0] : itemTotal / quantity;
          
          products.push({
            name: productName,
            price: unitPrice,
            quantity: quantity,
            confidence: 0.90 // Higher confidence for AWS Textract
          });
        }
      }
    }
  }
  }

  // Remove duplicates
  const uniqueProducts = products.filter((product, index, self) => 
    index === self.findIndex(p => p.name.toLowerCase() === product.name.toLowerCase())
  );

  // Log extraction summary
  console.log(`AWS Textract extraction complete:`);
  console.log(`- Products found: ${uniqueProducts.length}`);
  console.log(`- Table-based extraction: ${structuredData?.tables?.length || 0} tables processed`);
  console.log(`- Merchant: ${merchantName || 'Not found'}`);
  console.log(`- Total: ${totalAmount || 'Not found'}`);
  console.log(`- Date: ${date || 'Not found'}`);

  return {
    products: uniqueProducts,
    totalAmount,
    merchantName,
    date,
    confidence: uniqueProducts.length > 0 ? 0.90 : 0.4
  };
}

// Helper function to group table cells into rows
function groupCellsIntoRows(cells: any[]): any[][] {
  const rowMap = new Map<number, any[]>();
  
  for (const cell of cells) {
    if (cell.RowIndex !== undefined) {
      if (!rowMap.has(cell.RowIndex)) {
        rowMap.set(cell.RowIndex, []);
      }
      rowMap.get(cell.RowIndex)?.push(cell);
    }
  }
  
  return Array.from(rowMap.values()).map(row => 
    row.sort((a, b) => (a.ColumnIndex || 0) - (b.ColumnIndex || 0))
  );
}

// Enhanced helper function to extract product information from table row
function extractProductFromTableRow(row: any[]): AWSExtractedProduct | null {
  if (row.length < 2) return null;
  
  let productName = '';
  let unitPrice = 0;
  let totalPrice = 0;
  let quantity = 1;
  let confidence = 0;
  
  // Enhanced patterns for better price detection
  const pricePattern = /\$?([0-9]+[,.]?[0-9]*\.?[0-9]{0,2})/;
  const quantityPattern = /^([0-9]+(?:\.[0-9]+)?)(?:\s*(?:pcs?|pc|pieces?|qty|x|units?))?$/i;
  const unitPricePattern = /(?:@|each|unit)\s*\$?([0-9]+[,.]?[0-9]*\.?[0-9]{0,2})/i;
  
  // Analyze each cell in the row
  for (let i = 0; i < row.length; i++) {
    const cell = row[i];
    const text = (cell.Text || '').trim();
    
    if (!text) continue;
    
    // Calculate cell confidence
    confidence += (cell.Confidence || 0);
    
    // Column-based analysis (common receipt table formats)
    if (i === 0) {
      // First column usually contains product name or quantity
      const qtyMatch = text.match(quantityPattern);
      if (qtyMatch) {
        quantity = parseFloat(qtyMatch[1]);
      } else if (text.length > 2) {
        // Use raw text for now, will clean later
        productName = text;
      }
    } else if (i === 1 && !productName) {
      // Second column might be product name if first was quantity
      if (text.length > 2 && !pricePattern.test(text)) {
        productName = text;
      }
    }
    
    // Also check if this cell looks like it could be a product name (has text that's not just numbers/codes)
    if (!productName && text.length > 3 && /[A-Za-z]/.test(text) && !pricePattern.test(text)) {
      // Check if it's not a pure code/SKU
      if (!/^[A-Z0-9]{6,}$/i.test(text) && !/^\d+$/.test(text)) {
        productName = text;
      }
    }
    
    // Look for prices in any column
    const priceMatch = text.match(pricePattern);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      
      // Determine if it's unit price or total price based on context
      const unitMatch = text.match(unitPricePattern);
      if (unitMatch || text.toLowerCase().includes('each') || text.toLowerCase().includes('@')) {
        unitPrice = price;
      } else {
        // Last price column is usually total
        totalPrice = price;
      }
    }
    
    // Extract quantity from text patterns
    if (!quantity || quantity === 1) {
      const qtyMatch = text.match(quantityPattern);
      if (qtyMatch) {
        quantity = parseFloat(qtyMatch[1]);
      }
    }
  }
  
  // Calculate average confidence
  confidence = row.length > 0 ? confidence / row.length : 0;
  
  // Determine final price
  let finalPrice = totalPrice;
  if (!finalPrice && unitPrice) {
    finalPrice = unitPrice * quantity;
  } else if (!finalPrice && unitPrice === 0 && totalPrice > 0) {
    finalPrice = totalPrice;
    unitPrice = totalPrice / quantity;
  }
  
  // Clean up product name using enhanced cleaning utility
  if (productName) {
    const cleaned = extractProductNameFromLine(productName);
    productName = cleaned || cleanProductName(productName);
    
    // Fallback to basic cleaning if enhanced cleaning didn't work
    if (!productName || productName.length < 2) {
      productName = productName
        .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  
  // Validate extracted data
  if (productName && productName.length > 1 && finalPrice > 0) {
    return {
      name: productName,
      price: finalPrice,
      quantity: quantity,
      confidence: Math.min(confidence / 100, 1) // Normalize to 0-1 range
    };
  }
  
  return null;
}

// Main function to process receipt image with AWS Textract
export async function processReceiptImageAWS(imageBuffer: Buffer): Promise<AWSProcessingResult> {
  try {
    console.log('Starting AWS Textract analysis with table detection...');
    
    // First try structured analysis with table detection
    const structuredData = await analyzeReceiptStructureAWS(imageBuffer);
    const receiptData = parseReceiptTextAWS(structuredData.textLines, structuredData);
    
    return {
      success: true,
      data: receiptData
    };
  } catch (error) {
    console.error('Error processing receipt image with AWS Textract:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Function to validate AWS configuration
export function validateAWSConfig(): boolean {
  return !!(AWS_ACCESS_KEY_ID && 
           AWS_SECRET_ACCESS_KEY && 
           AWS_REGION && 
           AWS_ACCESS_KEY_ID !== 'your-aws-access-key-here' && 
           AWS_SECRET_ACCESS_KEY !== 'your-aws-secret-key-here' &&
           textractClient !== null);
}

export default {
  extractTextFromImageAWS,
  analyzeReceiptStructureAWS,
  analyzeReceiptStructureV2, // New function for Scan Receipt 2.0
  parseReceiptTextAWS,
  processReceiptImageAWS,
  validateAWSConfig
};