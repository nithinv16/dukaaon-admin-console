# Implementation Plan

## Scan Receipts 2.0

- [x] 1. Create core data types and interfaces






  - [x] 1.1 Create `lib/receiptTypes.ts` with all TypeScript interfaces

    - Define ExtractedReceiptProduct, ReceiptMetadata, ScanResult, ColumnMapping, MappingDecision
    - Define serialization types: ParsedReceipt, ParsedRow, CellData
    - Define error types: ScanError, PriceCalculationResult
    - _Requirements: 1.4, 1.5, 6.1_

- [x] 2. Implement UnitPriceCalculator module





  - [x] 2.1 Create `lib/unitPriceCalculator.ts` with calculateUnitPrice function

    - Implement division logic: unitPrice = netAmount / quantity
    - Handle edge cases: zero quantity returns null with 'zero_quantity' error
    - Handle missing values: return null with appropriate error code
    - Return PriceCalculationResult with success flag
    - _Requirements: 1.3, 6.3_

  - [x] 2.2 Write property test for unit price calculation

    - **Property 1: Unit Price Calculation Correctness**
    - **Validates: Requirements 1.3**

  - [x] 2.3 Write unit tests for edge cases

    - Test zero quantity, missing net amount, missing quantity, negative values
    - _Requirements: 6.3_

- [x] 3. Implement ColumnMapper module




  - [x] 3.1 Create `lib/receiptColumnMapper.ts` with header normalization


    - Define HEADER_VARIATIONS constant with all known variations
    - Implement normalizeHeader function for case-insensitive matching
    - Implement mapColumns function to identify column indices
    - Return MappingDecision array with header text and assigned field
    - _Requirements: 2.1, 2.2, 6.4_

  - [x] 3.2 Write property test for header normalization

    - **Property 2: Header Normalization Consistency**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 3.3 Write property test for mapping log completeness

    - **Property 9: Mapping Log Completeness**
    - **Validates: Requirements 6.4**
  - [x] 3.4 Implement net amount priority selection


    - When multiple price columns detected, prefer Net Amount over MRP/Gross
    - _Requirements: 2.3_

  - [x] 3.5 Write property test for net amount priority

    - **Property 3: Net Amount Priority Selection**
    - **Validates: Requirements 2.3**

- [x] 4. Implement ReceiptParser module





  - [x] 4.1 Create `lib/receiptParser.ts` with table parsing logic


    - Implement parseTableFromTextract to convert Textract blocks to ParsedReceipt
    - Implement extractProductFromRow to create ExtractedReceiptProduct
    - Implement product code separation (remove HSN codes from names)
    - _Requirements: 1.2, 2.5_

  - [x] 4.2 Write property test for product code separation

    - **Property 4: Product Code Separation**
    - **Validates: Requirements 2.5**
  - [x] 4.3 Implement serialization functions

    - Implement serializeReceipt to convert ParsedReceipt to JSON string
    - Implement deserializeReceipt to parse JSON back to ParsedReceipt
    - Implement prettyPrintReceipt for human-readable output
    - _Requirements: 6.1, 6.2_

  - [x] 4.4 Write property test for serialization round-trip
    - **Property 8: Serialization Round-Trip**
    - **Validates: Requirements 6.1, 6.2**

- [x] 5. Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement ReceiptScannerService




  - [x] 6.1 Create `lib/receiptScannerService.ts` main orchestrator


    - Integrate with existing awsTextract.ts for OCR
    - Call ColumnMapper to identify columns
    - Call ReceiptParser to extract products
    - Call UnitPriceCalculator for each product
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 6.2 Implement confidence scoring and review flagging

    - Calculate confidence for each extracted product
    - Set needsReview=true when confidence < 0.7
    - Ensure confidence scores are bounded 0-1
    - _Requirements: 1.5, 3.2_

  - [x] 6.3 Write property test for confidence threshold review

    - **Property 5: Confidence Threshold Review Flag**
    - **Validates: Requirements 3.2**

  - [x] 6.4 Write property test for confidence score bounds
    - **Property 11: Confidence Score Bounds**
    - **Validates: Requirements 1.5**
  - [x] 6.5 Implement original text preservation


    - Store originalText alongside cleaned name for each product
    - _Requirements: 5.3_

  - [x] 6.6 Write property test for original text preservation

    - **Property 7: Original Text Preservation**
    - **Validates: Requirements 5.3**

  - [x] 6.7 Write property test for product structure completeness

    - **Property 12: Product Structure Completeness**
    - **Validates: Requirements 1.4**
  - [x] 6.8 Implement AI fallback for unknown formats


    - Detect when table structure is not found
    - Fall back to AI-based extraction using existing aiExtractionService
    - Cap confidence at 0.5 for unknown formats
    - _Requirements: 6.5_

  - [x] 6.9 Write property test for unknown format confidence cap

    - **Property 10: Unknown Format Confidence Cap**
    - **Validates: Requirements 6.5**


- [x] 7. Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create API endpoint






  - [x] 8.1 Create `app/api/admin/scan-receipt/route.ts`

    - Implement POST handler accepting base64 image
    - Validate image format and size
    - Call ReceiptScannerService.scan()
    - Return ScanReceiptResponse with products and metadata
    - _Requirements: 1.1, 1.4, 3.5_

  - [x] 8.2 Write unit tests for API endpoint

    - Test successful scan response format
    - Test error responses for invalid images
    - _Requirements: 1.1, 3.5_
-

- [x] 9. Implement UI components







  - [-] 9.1 Create `components/ReceiptScanner.tsx` upload component

    - Implement drag-and-drop image upload
    - Add file input for image selection
    - Show image preview before scanning


    - Call scan-receipt API on submit
    - _Requirements: 1.1_
  - [ ] 9.2 Create `components/ReceiptExtractionPreview.tsx` results display
    - Show original image on left, extracted data on right


    - Highlight low-confidence products (confidence < 0.7)
    - Display confidence indicators with color coding
    - Show original text alongside normalized values
    - _Requirements: 3.1, 3.2, 5.1, 5.3_


  - [ ] 9.3 Create `components/ReceiptProductEditor.tsx` editable list
    - Display products in editable table format
    - Allow editing name, quantity, net amount
    - Recalculate unit price on quantity/amount change
    - Add confirm and cancel buttons
    - _Requirements: 3.3_
  - [ ] 9.4 Write property test for recalculation on edit
    - **Property 6: Unit Price Recalculation on Edit**
    - **Validates: Requirements 3.3**

- [x] 10. Integrate with products page




  - [x] 10.1 Add receipt scanner to products page


    - Add "Scan Receipt" button to products page header
    - Open ReceiptScanner in modal/dialog
    - Pass confirmed products to inventory add flow
    - _Requirements: 3.4_

- [x] 11. Final Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.
