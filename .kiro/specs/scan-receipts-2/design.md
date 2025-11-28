# Design Document: Scan Receipts 2.0

## Overview

Scan Receipts 2.0 is an intelligent receipt scanning system that extracts product names and calculates unit prices from various receipt formats commonly used in Indian retail/FMCG distribution. The system leverages AWS Textract for OCR with table detection capabilities, combined with AI-powered parsing using AWS Bedrock to intelligently identify columns, map fields, and calculate unit prices from net amounts and quantities.

The system builds upon the existing `awsTextract.ts` and `aiExtractionService.ts` infrastructure, extending it with specialized receipt parsing logic for tabular invoice formats.

## Architecture

```mermaid
flowchart TB
    subgraph UI["UI Layer"]
        Upload[Receipt Upload Component]
        Preview[Extraction Preview]
        Editor[Product Editor]
    end
    
    subgraph API["API Layer"]
        ScanAPI[/api/admin/scan-receipt]
    end
    
    subgraph Services["Service Layer"]
        Scanner[ReceiptScannerService]
        Parser[ReceiptParser]
        Calculator[UnitPriceCalculator]
        Mapper[ColumnMapper]
    end
    
    subgraph External["External Services"]
        Textract[AWS Textract]
        Bedrock[AWS Bedrock AI]
    end
    
    subgraph Storage["Data Layer"]
        Supabase[(Supabase DB)]
    end
    
    Upload --> ScanAPI
    ScanAPI --> Scanner
    Scanner --> Textract
    Scanner --> Parser
    Parser --> Mapper
    Parser --> Calculator
    Parser --> Bedrock
    Scanner --> Preview
    Preview --> Editor
    Editor --> Supabase
```

## Components and Interfaces

### 1. ReceiptScannerService (`lib/receiptScannerService.ts`)

Main orchestrator for receipt processing.

```typescript
interface ReceiptScannerConfig {
  confidenceThreshold: number;  // Default: 0.7
  enableAIFallback: boolean;    // Default: true
  maxProducts: number;          // Default: 100
}

interface ScanResult {
  success: boolean;
  products: ExtractedReceiptProduct[];
  metadata: ReceiptMetadata;
  confidence: number;
  mappingLog: MappingDecision[];
  error?: string;
}

interface ExtractedReceiptProduct {
  name: string;
  quantity: number;
  netAmount: number;
  unitPrice: number | null;  // null if calculation failed
  confidence: number;
  needsReview: boolean;
  originalText: string;
  boundingBox?: BoundingBox;
}

interface ReceiptMetadata {
  formatType: 'tax_invoice' | 'distributor_bill' | 'simple_list' | 'unknown';
  merchantName?: string;
  invoiceNumber?: string;
  date?: string;
  totalAmount?: number;
}
```

### 2. ColumnMapper (`lib/receiptColumnMapper.ts`)

Identifies and maps column headers to standard field names.

```typescript
interface ColumnMapping {
  productName: number;   // Column index for product name
  quantity: number;      // Column index for quantity
  netAmount: number;     // Column index for net amount
  mrp?: number;          // Optional: MRP column
  grossAmount?: number;  // Optional: Gross amount column
}

interface MappingDecision {
  headerText: string;
  assignedField: string;
  confidence: number;
  reason: string;
}

// Header variations to normalize
const HEADER_VARIATIONS = {
  productName: ['item description', 'description', 'item', 'product', 'particulars', 'goods'],
  quantity: ['qty', 'pcs', 'units', 'cs', 'quantity', 'nos'],
  netAmount: ['net amt', 'net amount', 'amount', 'amt', 'total', 'value', 'net'],
  mrp: ['mrp', 'rate', 'price', 'unit price'],
  grossAmount: ['gross amt', 'gross amount', 'gross']
};
```

### 3. UnitPriceCalculator (`lib/unitPriceCalculator.ts`)

Calculates unit price from net amount and quantity with edge case handling.

```typescript
interface PriceCalculationResult {
  unitPrice: number | null;
  success: boolean;
  error?: 'zero_quantity' | 'missing_net_amount' | 'missing_quantity' | 'invalid_values';
}

function calculateUnitPrice(netAmount: number | null, quantity: number | null): PriceCalculationResult;
```

### 4. ReceiptParser (`lib/receiptParser.ts`)

Parses structured table data from Textract output.

```typescript
interface ParsedReceipt {
  headers: string[];
  rows: ParsedRow[];
  formatType: string;
}

interface ParsedRow {
  cells: CellData[];
  rawText: string;
}

interface CellData {
  text: string;
  columnIndex: number;
  rowIndex: number;
  confidence: number;
  boundingBox?: BoundingBox;
}

// Serialization for round-trip testing
function serializeReceipt(receipt: ParsedReceipt): string;
function deserializeReceipt(json: string): ParsedReceipt;
function prettyPrintReceipt(receipt: ParsedReceipt): string;
```

### 5. API Endpoint (`app/api/admin/scan-receipt/route.ts`)

```typescript
// POST /api/admin/scan-receipt
interface ScanReceiptRequest {
  image: string;  // Base64 encoded image
}

interface ScanReceiptResponse {
  success: boolean;
  products: ExtractedReceiptProduct[];
  metadata: ReceiptMetadata;
  confidence: number;
  originalImageUrl?: string;
  error?: string;
}
```

### 6. UI Components

#### ReceiptScanner Component (`components/ReceiptScanner.tsx`)
- Image upload with drag-and-drop
- Camera capture support
- Image preview with zoom

#### ReceiptExtractionPreview Component (`components/ReceiptExtractionPreview.tsx`)
- Side-by-side view: original image + extracted data
- Hover highlighting of source regions
- Confidence indicators with color coding
- Low-confidence product highlighting

#### ReceiptProductEditor Component (`components/ReceiptProductEditor.tsx`)
- Editable product list
- Recalculation on edit
- Bulk confirm/reject actions

## Data Models

### ExtractedReceiptProduct

```typescript
interface ExtractedReceiptProduct {
  id: string;                    // Unique identifier
  name: string;                  // Cleaned product name
  originalName: string;          // Original OCR text
  quantity: number;              // Extracted quantity
  netAmount: number;             // Net amount from receipt
  unitPrice: number | null;      // Calculated: netAmount / quantity
  mrp?: number;                  // MRP if available
  hsnCode?: string;              // HSN code if present
  confidence: number;            // 0-1 confidence score
  needsReview: boolean;          // True if confidence < 0.7
  boundingBox?: BoundingBox;     // Location in original image
  fieldConfidences: {
    name: number;
    quantity: number;
    netAmount: number;
  };
}
```

### ReceiptFormat

```typescript
type ReceiptFormatType = 'tax_invoice' | 'distributor_bill' | 'simple_list' | 'unknown';

interface ReceiptFormat {
  type: ReceiptFormatType;
  knownDistributor?: string;
  columnOrder: string[];
  hasHSNCode: boolean;
  hasMRP: boolean;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Unit Price Calculation Correctness

*For any* extracted product with valid net amount (> 0) and valid quantity (> 0), the calculated unit price SHALL equal net amount divided by quantity (within floating-point precision tolerance).

**Validates: Requirements 1.3**

### Property 2: Header Normalization Consistency

*For any* column header text that matches a known variation (e.g., "Qty", "Pcs", "Units", "quantity"), the column mapper SHALL normalize it to the corresponding standard field name (e.g., "quantity").

**Validates: Requirements 2.1, 2.2**

### Property 3: Net Amount Priority Selection

*For any* receipt table containing multiple price columns (MRP, Gross Amount, Net Amount), the system SHALL select the Net Amount column for unit price calculation.

**Validates: Requirements 2.3**

### Property 4: Product Code Separation

*For any* product text containing HSN codes or product codes (numeric patterns), the extracted product name SHALL not contain the code portion.

**Validates: Requirements 2.5**

### Property 5: Confidence Threshold Review Flag

*For any* extracted product with confidence score below 0.7, the needsReview flag SHALL be set to true.

**Validates: Requirements 3.2**

### Property 6: Unit Price Recalculation on Edit

*For any* product where quantity or net amount is edited, the unit price SHALL be recalculated to equal the new net amount divided by the new quantity.

**Validates: Requirements 3.3**

### Property 7: Original Text Preservation

*For any* extracted product, both the original OCR text and the normalized/cleaned product name SHALL be preserved in the output structure.

**Validates: Requirements 5.3**

### Property 8: Serialization Round-Trip

*For any* valid ParsedReceipt structure, serializing to JSON and then deserializing SHALL produce a structure equivalent to the original.

**Validates: Requirements 6.1, 6.2**

### Property 9: Mapping Log Completeness

*For any* column mapping operation, the mapping log SHALL contain an entry with the matched header text and the assigned field type.

**Validates: Requirements 6.4**

### Property 10: Unknown Format Confidence Cap

*For any* receipt with format type "unknown", all extracted products SHALL have confidence scores capped at 0.5.

**Validates: Requirements 6.5**

### Property 11: Confidence Score Bounds

*For any* extracted product, the confidence score SHALL be a number between 0 and 1 (inclusive).

**Validates: Requirements 1.5**

### Property 12: Product Structure Completeness

*For any* successful extraction result, each product in the list SHALL have both a name field (non-empty string) and a unitPrice field (number or null).

**Validates: Requirements 1.4**

## Error Handling

### Edge Cases

| Scenario | Handling | Result |
|----------|----------|--------|
| Zero quantity | Return null unitPrice, set needsReview=true | Product flagged for manual review |
| Missing net amount | Return null unitPrice, set needsReview=true | Product flagged for manual review |
| Missing quantity | Default to 1, reduce confidence | Unit price = net amount |
| No table detected | Fall back to AI extraction | Lower confidence (max 0.5) |
| Empty image | Return error | Error message with suggestions |
| Corrupted image | Return error | Error message with suggestions |
| No products found | Return empty list with error | Suggestions for better image |

### Error Response Format

```typescript
interface ScanError {
  code: 'NO_TEXT_DETECTED' | 'NO_TABLE_FOUND' | 'NO_PRODUCTS_EXTRACTED' | 
        'INVALID_IMAGE' | 'OCR_FAILED' | 'PROCESSING_ERROR';
  message: string;
  suggestions: string[];
}
```

### Validation Rules

1. **Image Validation**
   - Supported formats: JPEG, PNG, WebP
   - Maximum size: 10MB
   - Minimum resolution: 300x300 pixels

2. **Data Validation**
   - Product name: minimum 2 characters
   - Quantity: positive number or null
   - Net amount: non-negative number or null
   - Confidence: 0-1 range

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests:
- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property-based tests**: Verify universal properties that should hold across all inputs

### Property-Based Testing Framework

**Library**: fast-check (TypeScript property-based testing library)

**Configuration**: Each property test runs minimum 100 iterations.

### Property-Based Tests

Each property-based test MUST be tagged with the format: `**Feature: scan-receipts-2, Property {number}: {property_text}**`

#### Test: Unit Price Calculation (Property 1)
```typescript
// **Feature: scan-receipts-2, Property 1: Unit Price Calculation Correctness**
fc.assert(
  fc.property(
    fc.float({ min: 0.01, max: 100000 }), // netAmount
    fc.float({ min: 0.01, max: 10000 }),  // quantity
    (netAmount, quantity) => {
      const result = calculateUnitPrice(netAmount, quantity);
      return Math.abs(result.unitPrice! - (netAmount / quantity)) < 0.001;
    }
  ),
  { numRuns: 100 }
);
```

#### Test: Header Normalization (Property 2)
```typescript
// **Feature: scan-receipts-2, Property 2: Header Normalization Consistency**
fc.assert(
  fc.property(
    fc.constantFrom(...QUANTITY_VARIATIONS), // ['qty', 'pcs', 'units', ...]
    (headerText) => {
      const result = normalizeHeader(headerText);
      return result === 'quantity';
    }
  ),
  { numRuns: 100 }
);
```

#### Test: Serialization Round-Trip (Property 8)
```typescript
// **Feature: scan-receipts-2, Property 8: Serialization Round-Trip**
fc.assert(
  fc.property(
    arbitraryParsedReceipt(), // Custom generator for ParsedReceipt
    (receipt) => {
      const serialized = serializeReceipt(receipt);
      const deserialized = deserializeReceipt(serialized);
      return deepEqual(receipt, deserialized);
    }
  ),
  { numRuns: 100 }
);
```

### Unit Tests

Unit tests cover specific examples and integration points:

1. **ColumnMapper Tests**
   - Known header variations map correctly
   - Unknown headers return null mapping
   - Case-insensitive matching works

2. **UnitPriceCalculator Tests**
   - Normal calculation: 100 / 5 = 20
   - Zero quantity returns null
   - Missing values return null with correct error code

3. **ReceiptParser Tests**
   - Parse simple 3-column table
   - Parse table with extra columns
   - Handle missing cells gracefully

4. **Integration Tests**
   - End-to-end scan with sample receipt image
   - API endpoint returns correct response format

### Test File Structure

```
lib/
  receiptScannerService.ts
  receiptScannerService.test.ts      # Unit tests
  receiptScannerService.property.test.ts  # Property tests
  receiptColumnMapper.ts
  receiptColumnMapper.test.ts
  receiptColumnMapper.property.test.ts
  unitPriceCalculator.ts
  unitPriceCalculator.test.ts
  unitPriceCalculator.property.test.ts
  receiptParser.ts
  receiptParser.test.ts
  receiptParser.property.test.ts
```
