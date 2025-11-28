/**
 * Receipt Scanner Service
 * 
 * Main orchestrator for receipt processing. Integrates AWS Textract OCR,
 * column mapping, receipt parsing, and unit price calculation.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.2, 5.3, 6.5
 */

import { analyzeReceiptStructureAWS, validateAWSConfig } from './awsTextract';
import { mapColumns, MapColumnsResult } from './receiptColumnMapper';
import { 
  parseTableFromTextract, 
  extractProductsFromReceipt,
  TextractBlock 
} from './receiptParser';
import { calculateUnitPrice } from './unitPriceCalculator';
import { extractFromImage as aiExtractFromImage } from './aiExtractionService';
import {
  ScanResult,
  ExtractedReceiptProduct,
  ReceiptMetadata,
  MappingDecision,
  ReceiptScannerConfig,
  DEFAULT_RECEIPT_SCANNER_CONFIG,
  ReceiptFormatType,
} from './receiptTypes';

// ============================================================================
// Constants
// ============================================================================

/**
 * Confidence threshold below which products are flagged for review
 * Requirements: 3.2
 */
const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Maximum confidence for unknown format extractions
 * Requirements: 6.5
 */
const UNKNOWN_FORMAT_MAX_CONFIDENCE = 0.5;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates a unique ID for extracted products
 */
function generateProductId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clamps a confidence score to the valid range [0, 1]
 * Requirements: 1.5
 */
export function clampConfidence(confidence: number): number {
  if (typeof confidence !== 'number' || isNaN(confidence)) {
    return 0;
  }
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Determines if a product needs review based on confidence threshold
 * Requirements: 3.2
 */
export function shouldFlagForReview(confidence: number, threshold: number = CONFIDENCE_THRESHOLD): boolean {
  return confidence < threshold;
}

/**
 * Caps confidence scores for unknown format extractions
 * Requirements: 6.5
 */
export function capConfidenceForUnknownFormat(
  confidence: number, 
  formatType: ReceiptFormatType
): number {
  if (formatType === 'unknown') {
    return Math.min(confidence, UNKNOWN_FORMAT_MAX_CONFIDENCE);
  }
  return confidence;
}

// ============================================================================
// Metadata Extraction
// ============================================================================

/**
 * Extracts receipt metadata from Textract analysis results
 */
function extractMetadata(
  textLines: string[],
  formatType: ReceiptFormatType
): ReceiptMetadata {
  const metadata: ReceiptMetadata = {
    formatType,
  };

  // Try to extract merchant name (usually in first few lines)
  for (let i = 0; i < Math.min(5, textLines.length); i++) {
    const line = textLines[i].trim();
    // Skip lines that look like dates, numbers, or common headers
    if (line.length > 3 && 
        !/^\d+[\/\-]\d+[\/\-]\d+/.test(line) &&
        !/^(invoice|receipt|bill|tax)/i.test(line) &&
        !/^\d+$/.test(line)) {
      metadata.merchantName = line;
      break;
    }
  }

  // Try to extract invoice number
  for (const line of textLines) {
    const invoiceMatch = line.match(/(?:invoice|inv|bill)\s*(?:no|#|number)?[:\s]*([A-Z0-9\-\/]+)/i);
    if (invoiceMatch) {
      metadata.invoiceNumber = invoiceMatch[1];
      break;
    }
  }

  // Try to extract date
  for (const line of textLines) {
    const dateMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch) {
      metadata.date = dateMatch[1];
      break;
    }
  }

  // Try to extract total amount
  for (const line of textLines) {
    const totalMatch = line.match(/(?:total|grand\s*total|net\s*total)[:\s]*(?:rs\.?|₹)?\s*([0-9,]+\.?\d*)/i);
    if (totalMatch) {
      metadata.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
      break;
    }
  }

  return metadata;
}

// ============================================================================
// Main Scanner Service
// ============================================================================

/**
 * Receipt Scanner Service class
 * Main orchestrator for receipt processing
 */
export class ReceiptScannerService {
  private config: ReceiptScannerConfig;

  constructor(config: Partial<ReceiptScannerConfig> = {}) {
    this.config = { ...DEFAULT_RECEIPT_SCANNER_CONFIG, ...config };
  }

  /**
   * Scans a receipt image and extracts products with calculated unit prices.
   * 
   * @param imageBuffer - The image buffer to process
   * @returns ScanResult with extracted products and metadata
   * 
   * Requirements: 1.1, 1.2, 1.3, 1.4
   */
  async scan(imageBuffer: Buffer): Promise<ScanResult> {
    // Validate AWS configuration
    if (!validateAWSConfig()) {
      // If AWS is not configured and AI fallback is enabled, try AI extraction
      if (this.config.enableAIFallback) {
        return this.fallbackToAIExtraction(imageBuffer);
      }
      
      return {
        success: false,
        products: [],
        metadata: { formatType: 'unknown' },
        confidence: 0,
        mappingLog: [],
        error: 'AWS Textract is not configured. Please check your AWS credentials.',
      };
    }

    try {
      // Step 1: Extract text and structure using AWS Textract
      // Requirements: 1.1
      const textractResult = await analyzeReceiptStructureAWS(imageBuffer);
      
      if (!textractResult.textLines.length && !textractResult.tables.length) {
        // No text detected, try AI fallback
        if (this.config.enableAIFallback) {
          return this.fallbackToAIExtraction(imageBuffer);
        }
        
        return {
          success: false,
          products: [],
          metadata: { formatType: 'unknown' },
          confidence: 0,
          mappingLog: [],
          error: 'No text detected in the image. Please ensure the image is clear and contains readable text.',
        };
      }

      // Step 2: Parse table structure from Textract blocks
      // Requirements: 1.2
      const allBlocks = this.convertTextractResultToBlocks(textractResult);
      const parsedReceipt = parseTableFromTextract(allBlocks);

      // Step 3: Map columns to standard fields
      let mappingResult: MapColumnsResult;
      let mappingLog: MappingDecision[] = [];

      if (parsedReceipt.headers.length > 0) {
        mappingResult = mapColumns(parsedReceipt.headers);
        mappingLog = mappingResult.decisions;
      } else {
        mappingResult = {
          mapping: null,
          decisions: [],
          success: false,
          priceColumnIndex: null,
          priceColumnType: null,
        };
      }

      // If no table structure found or mapping failed, try AI fallback
      if (!mappingResult.success) {
        if (this.config.enableAIFallback) {
          const aiResult = await this.fallbackToAIExtraction(imageBuffer);
          // Merge mapping log from failed attempt
          aiResult.mappingLog = [...mappingLog, ...aiResult.mappingLog];
          return aiResult;
        }
        
        return {
          success: false,
          products: [],
          metadata: extractMetadata(textractResult.textLines, 'unknown'),
          confidence: 0,
          mappingLog,
          error: 'Could not identify table structure. Please ensure the receipt has clear column headers.',
        };
      }

      // Step 4: Extract products from parsed receipt
      // Requirements: 1.2, 1.3
      const rawProducts = extractProductsFromReceipt(parsedReceipt);

      // Step 5: Process products - calculate unit prices, set confidence, flag for review
      // Requirements: 1.3, 1.4, 1.5, 3.2, 5.3
      const products = this.processProducts(rawProducts, parsedReceipt.formatType as ReceiptFormatType);

      // Limit products to maxProducts
      const limitedProducts = products.slice(0, this.config.maxProducts);

      // Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(limitedProducts);

      // Extract metadata
      const metadata = extractMetadata(textractResult.textLines, parsedReceipt.formatType as ReceiptFormatType);

      return {
        success: true,
        products: limitedProducts,
        metadata,
        confidence: overallConfidence,
        mappingLog,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Try AI fallback on error
      if (this.config.enableAIFallback) {
        try {
          return await this.fallbackToAIExtraction(imageBuffer);
        } catch {
          // AI fallback also failed
        }
      }

      return {
        success: false,
        products: [],
        metadata: { formatType: 'unknown' },
        confidence: 0,
        mappingLog: [],
        error: `Processing error: ${errorMessage}`,
      };
    }
  }

  /**
   * Processes raw extracted products to add confidence scoring and review flags.
   * 
   * Requirements: 1.3, 1.4, 1.5, 3.2, 5.3
   */
  private processProducts(
    rawProducts: ExtractedReceiptProduct[],
    formatType: ReceiptFormatType
  ): ExtractedReceiptProduct[] {
    return rawProducts.map(product => {
      // Ensure unit price is calculated
      // Requirements: 1.3
      let unitPrice = product.unitPrice;
      if (unitPrice === null && product.netAmount > 0 && product.quantity > 0) {
        const priceResult = calculateUnitPrice(product.netAmount, product.quantity);
        unitPrice = priceResult.unitPrice;
      }

      // Clamp confidence to valid range [0, 1]
      // Requirements: 1.5
      let confidence = clampConfidence(product.confidence);

      // Cap confidence for unknown formats
      // Requirements: 6.5
      confidence = capConfidenceForUnknownFormat(confidence, formatType);

      // Determine if product needs review
      // Requirements: 3.2
      const needsReview = shouldFlagForReview(confidence, this.config.confidenceThreshold);

      // Ensure original text is preserved
      // Requirements: 5.3
      const originalText = product.originalText || product.originalName || product.name;

      return {
        ...product,
        unitPrice,
        confidence,
        needsReview,
        originalText,
      };
    });
  }

  /**
   * Calculates overall confidence from product confidences
   */
  private calculateOverallConfidence(products: ExtractedReceiptProduct[]): number {
    if (products.length === 0) {
      return 0;
    }

    const totalConfidence = products.reduce((sum, p) => sum + p.confidence, 0);
    return clampConfidence(totalConfidence / products.length);
  }

  /**
   * Converts Textract analysis result to Block array for parsing
   */
  private convertTextractResultToBlocks(textractResult: {
    tables: any[];
    keyValuePairs: any[];
    textLines: string[];
  }): TextractBlock[] {
    const blocks: TextractBlock[] = [];
    let blockId = 0;

    // Add LINE blocks for text lines
    textractResult.textLines.forEach((text, index) => {
      blocks.push({
        Id: `line_${blockId++}`,
        BlockType: 'LINE',
        Text: text,
        Confidence: 90,
      });
    });

    // Add TABLE and CELL blocks from tables
    textractResult.tables.forEach((table, tableIndex) => {
      const tableId = `table_${tableIndex}`;
      const cellIds: string[] = [];

      if (table.cells && Array.isArray(table.cells)) {
        table.cells.forEach((cell: any, cellIndex: number) => {
          const cellId = `cell_${tableIndex}_${cellIndex}`;
          cellIds.push(cellId);

          blocks.push({
            Id: cellId,
            BlockType: 'CELL',
            Text: cell.Text || '',
            Confidence: cell.Confidence || 90,
            RowIndex: cell.RowIndex,
            ColumnIndex: cell.ColumnIndex,
            Geometry: cell.Geometry,
          });
        });
      }

      blocks.push({
        Id: tableId,
        BlockType: 'TABLE',
        Confidence: table.confidence || 90,
        Relationships: cellIds.length > 0 ? [{
          Type: 'CHILD',
          Ids: cellIds,
        }] : undefined,
      });
    });

    return blocks;
  }

  /**
   * Falls back to AI-based extraction when table structure is not found.
   * 
   * Requirements: 6.5
   */
  private async fallbackToAIExtraction(imageBuffer: Buffer): Promise<ScanResult> {
    try {
      const aiResult = await aiExtractFromImage(imageBuffer);

      if (!aiResult.success || aiResult.products.length === 0) {
        return {
          success: false,
          products: [],
          metadata: { formatType: 'unknown' },
          confidence: 0,
          mappingLog: [{
            headerText: 'AI Fallback',
            assignedField: 'none',
            confidence: 0,
            reason: aiResult.error || 'AI extraction failed to find products',
          }],
          error: aiResult.error || 'No products could be extracted from the image.',
        };
      }

      // Convert AI extracted products to ExtractedReceiptProduct format
      // Cap confidence at 0.5 for unknown formats (Requirements: 6.5)
      const products: ExtractedReceiptProduct[] = aiResult.products.map(aiProduct => {
        // Cap confidence for AI fallback (unknown format)
        const cappedConfidence = Math.min(aiProduct.confidence.overall, UNKNOWN_FORMAT_MAX_CONFIDENCE);

        return {
          id: generateProductId(),
          name: aiProduct.name,
          originalName: aiProduct.name,
          quantity: aiProduct.quantity,
          netAmount: aiProduct.price * aiProduct.quantity,
          unitPrice: aiProduct.price > 0 ? aiProduct.price : null,
          confidence: cappedConfidence,
          needsReview: shouldFlagForReview(cappedConfidence, this.config.confidenceThreshold),
          originalText: aiProduct.name,
          fieldConfidences: {
            name: Math.min(aiProduct.confidence.name, UNKNOWN_FORMAT_MAX_CONFIDENCE),
            quantity: Math.min(aiProduct.confidence.quantity, UNKNOWN_FORMAT_MAX_CONFIDENCE),
            netAmount: Math.min(aiProduct.confidence.price, UNKNOWN_FORMAT_MAX_CONFIDENCE),
          },
        };
      });

      // Limit products
      const limitedProducts = products.slice(0, this.config.maxProducts);

      // Calculate overall confidence (capped)
      const overallConfidence = this.calculateOverallConfidence(limitedProducts);

      return {
        success: true,
        products: limitedProducts,
        metadata: { formatType: 'unknown' },
        confidence: overallConfidence,
        mappingLog: [{
          headerText: 'AI Fallback',
          assignedField: 'ai_extraction',
          confidence: overallConfidence,
          reason: 'Used AI-based extraction due to unrecognized table structure',
        }],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        products: [],
        metadata: { formatType: 'unknown' },
        confidence: 0,
        mappingLog: [{
          headerText: 'AI Fallback',
          assignedField: 'error',
          confidence: 0,
          reason: `AI extraction failed: ${errorMessage}`,
        }],
        error: `AI extraction failed: ${errorMessage}`,
      };
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Creates a new ReceiptScannerService with default configuration
 */
export function createReceiptScanner(config?: Partial<ReceiptScannerConfig>): ReceiptScannerService {
  return new ReceiptScannerService(config);
}

/**
 * Scans a receipt image using default configuration
 */
export async function scanReceipt(imageBuffer: Buffer): Promise<ScanResult> {
  const scanner = new ReceiptScannerService();
  return scanner.scan(imageBuffer);
}

export default ReceiptScannerService;
