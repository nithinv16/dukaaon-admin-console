/**
 * Receipt Scanner Types
 * 
 * Core type definitions for the Scan Receipts 2.0 feature.
 * These types support receipt scanning, parsing, and product extraction.
 * 
 * Requirements: 1.4, 1.5, 6.1
 */

// ============================================================================
// Bounding Box Types
// ============================================================================

/**
 * Represents a bounding box for locating elements in the original receipt image
 */
export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

// ============================================================================
// Extracted Product Types
// ============================================================================

/**
 * Represents a product extracted from a receipt
 * Requirements: 1.4, 1.5
 */
export interface ExtractedReceiptProduct {
  /** Unique identifier for the extracted product */
  id: string;
  /** Cleaned/normalized product name */
  name: string;
  /** Original OCR text before normalization */
  originalName: string;
  /** Extracted quantity */
  quantity: number;
  /** Net amount from receipt */
  netAmount: number;
  /** Calculated unit price: netAmount / quantity (null if calculation failed) */
  unitPrice: number | null;
  /** MRP if available */
  mrp?: number;
  /** HSN code if present */
  hsnCode?: string;
  /** Confidence score (0-1) indicating reliability of extraction */
  confidence: number;
  /** True if confidence < 0.7, indicating manual review needed */
  needsReview: boolean;
  /** Location in original image */
  boundingBox?: BoundingBox;
  /** Original text as extracted by OCR */
  originalText: string;
  /** Individual field confidence scores */
  fieldConfidences: {
    name: number;
    quantity: number;
    netAmount: number;
  };
}


// ============================================================================
// Receipt Metadata Types
// ============================================================================

/**
 * Type of receipt format detected
 */
export type ReceiptFormatType = 'tax_invoice' | 'distributor_bill' | 'simple_list' | 'unknown';

/**
 * Metadata about the scanned receipt
 */
export interface ReceiptMetadata {
  /** Detected format type of the receipt */
  formatType: ReceiptFormatType;
  /** Merchant/distributor name if detected */
  merchantName?: string;
  /** Invoice number if present */
  invoiceNumber?: string;
  /** Date from the receipt */
  date?: string;
  /** Total amount from the receipt */
  totalAmount?: number;
}

/**
 * Detailed receipt format information
 */
export interface ReceiptFormat {
  type: ReceiptFormatType;
  knownDistributor?: string;
  columnOrder: string[];
  hasHSNCode: boolean;
  hasMRP: boolean;
}

// ============================================================================
// Scan Result Types
// ============================================================================

/**
 * Result of a receipt scan operation
 */
export interface ScanResult {
  /** Whether the scan was successful */
  success: boolean;
  /** List of extracted products */
  products: ExtractedReceiptProduct[];
  /** Metadata about the receipt */
  metadata: ReceiptMetadata;
  /** Overall confidence score for the extraction */
  confidence: number;
  /** Log of column mapping decisions */
  mappingLog: MappingDecision[];
  /** Error message if scan failed */
  error?: string;
}

// ============================================================================
// Column Mapping Types
// ============================================================================

/**
 * Mapping of column indices to standard field names
 */
export interface ColumnMapping {
  /** Column index for product name */
  productName: number;
  /** Column index for quantity */
  quantity: number;
  /** Column index for net amount */
  netAmount: number;
  /** Optional: Column index for MRP */
  mrp?: number;
  /** Optional: Column index for gross amount */
  grossAmount?: number;
}

/**
 * Record of a column mapping decision
 * Requirements: 6.4
 */
export interface MappingDecision {
  /** Original header text from the receipt */
  headerText: string;
  /** Standard field name assigned */
  assignedField: string;
  /** Confidence in the mapping decision */
  confidence: number;
  /** Reason for the mapping decision */
  reason: string;
}


// ============================================================================
// Serialization Types (for round-trip testing)
// ============================================================================

/**
 * Represents a single cell of data in a parsed receipt table
 */
export interface CellData {
  /** Text content of the cell */
  text: string;
  /** Column index (0-based) */
  columnIndex: number;
  /** Row index (0-based) */
  rowIndex: number;
  /** Confidence score for this cell's OCR */
  confidence: number;
  /** Location in original image */
  boundingBox?: BoundingBox;
}

/**
 * Represents a row in a parsed receipt table
 */
export interface ParsedRow {
  /** Cells in this row */
  cells: CellData[];
  /** Raw text of the entire row */
  rawText: string;
}

/**
 * Represents a fully parsed receipt structure
 * Requirements: 6.1, 6.2
 */
export interface ParsedReceipt {
  /** Column headers detected */
  headers: string[];
  /** Data rows */
  rows: ParsedRow[];
  /** Detected format type */
  formatType: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for scan failures
 */
export type ScanErrorCode = 
  | 'NO_TEXT_DETECTED'
  | 'NO_TABLE_FOUND'
  | 'NO_PRODUCTS_EXTRACTED'
  | 'INVALID_IMAGE'
  | 'OCR_FAILED'
  | 'PROCESSING_ERROR';

/**
 * Structured error for scan operations
 */
export interface ScanError {
  /** Error code */
  code: ScanErrorCode;
  /** Human-readable error message */
  message: string;
  /** Suggestions for resolving the error */
  suggestions: string[];
}

/**
 * Error codes for price calculation failures
 */
export type PriceCalculationErrorCode = 
  | 'zero_quantity'
  | 'missing_net_amount'
  | 'missing_quantity'
  | 'invalid_values';

/**
 * Result of a unit price calculation
 * Requirements: 6.3
 */
export interface PriceCalculationResult {
  /** Calculated unit price (null if calculation failed) */
  unitPrice: number | null;
  /** Whether the calculation was successful */
  success: boolean;
  /** Error code if calculation failed */
  error?: PriceCalculationErrorCode;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Request body for the scan-receipt API endpoint
 */
export interface ScanReceiptRequest {
  /** Base64 encoded image */
  image: string;
  /** OCR provider to use: 'azure' or 'aws' (optional, defaults to 'aws' for advanced features) */
  provider?: 'azure' | 'aws';
}

/**
 * Response from the scan-receipt API endpoint
 */
export interface ScanReceiptResponse {
  /** Whether the scan was successful */
  success: boolean;
  /** List of extracted products */
  products: ExtractedReceiptProduct[];
  /** Metadata about the receipt */
  metadata: ReceiptMetadata;
  /** Overall confidence score */
  confidence: number;
  /** URL to the original image (if stored) */
  originalImageUrl?: string;
  /** Error message if scan failed */
  error?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the receipt scanner
 */
export interface ReceiptScannerConfig {
  /** Confidence threshold below which products are flagged for review (default: 0.7) */
  confidenceThreshold: number;
  /** Whether to fall back to AI extraction for unknown formats (default: true) */
  enableAIFallback: boolean;
  /** Maximum number of products to extract (default: 100) */
  maxProducts: number;
}

/**
 * Default configuration for the receipt scanner
 */
export const DEFAULT_RECEIPT_SCANNER_CONFIG: ReceiptScannerConfig = {
  confidenceThreshold: 0.7,
  enableAIFallback: true,
  maxProducts: 100,
};
