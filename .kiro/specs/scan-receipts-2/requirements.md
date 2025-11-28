# Requirements Document

## Introduction

Scan Receipts 2.0 is an intelligent receipt scanning feature that extracts product names and calculates unit prices from various receipt formats. The system uses AWS Textract for OCR, combined with AI-powered algorithms to intelligently parse tabular invoice data, identify product names, quantities, and net amounts, then accurately map and calculate unit prices (price = net amount / quantity). This feature will be located in the products section and will handle diverse receipt formats including tax invoices, distributor bills, and inventory lists commonly used in Indian retail/FMCG distribution.

## Glossary

- **Receipt_Scanner**: The main system component responsible for processing receipt images and extracting product data
- **Net_Amount**: The total amount for a line item (may appear as "Net Amt", "Amount", "Total", "Amt" in receipts)
- **Unit_Price**: The calculated price per unit (Net_Amount divided by Quantity)
- **Quantity**: The number of units purchased (may appear as "Qty", "Pcs", "Units", "Cs" in receipts)
- **Product_Name**: The name/description of the product (may appear as "Item Description", "Description", "Item", "Product")
- **Table_Structure**: The organized row-column format commonly found in tax invoices and distributor bills
- **Confidence_Score**: A numerical value (0-1) indicating the reliability of extracted data
- **Field_Mapping**: The process of identifying which column contains which data type

## Requirements

### Requirement 1

**User Story:** As a seller, I want to upload receipt images and have the system automatically extract product names and prices, so that I can quickly add inventory without manual data entry.

#### Acceptance Criteria

1. WHEN a user uploads a receipt image THEN the Receipt_Scanner SHALL process the image using AWS Textract OCR and extract all text content
2. WHEN the Receipt_Scanner detects a tabular structure THEN the Receipt_Scanner SHALL identify column headers and map fields to Product_Name, Quantity, and Net_Amount
3. WHEN the Receipt_Scanner extracts a product row THEN the Receipt_Scanner SHALL calculate Unit_Price by dividing Net_Amount by Quantity
4. WHEN the Receipt_Scanner completes extraction THEN the Receipt_Scanner SHALL return a list of products with name and calculated Unit_Price correctly mapped to each other
5. WHEN the Receipt_Scanner processes a receipt THEN the Receipt_Scanner SHALL provide a Confidence_Score for each extracted product

### Requirement 2

**User Story:** As a seller, I want the system to handle various receipt formats intelligently, so that I can scan receipts from different distributors and suppliers.

#### Acceptance Criteria

1. WHEN the Receipt_Scanner receives a tax invoice format THEN the Receipt_Scanner SHALL identify columns like "Item Description", "MRP", "Qty", "Pcs", "Net Amt" regardless of exact header text
2. WHEN the Receipt_Scanner encounters column headers with variations (Qty/Pcs/Units, Amount/Amt/Total/Net Amt) THEN the Receipt_Scanner SHALL normalize these to standard field names
3. WHEN the Receipt_Scanner detects multiple price columns (MRP, Gross Amt, Net Amt) THEN the Receipt_Scanner SHALL use Net_Amount for Unit_Price calculation
4. WHEN the Receipt_Scanner encounters a rotated or skewed receipt image THEN the Receipt_Scanner SHALL attempt to correct orientation before processing
5. WHEN the Receipt_Scanner processes receipts with HSN codes or product codes THEN the Receipt_Scanner SHALL extract Product_Name separately from codes

### Requirement 3

**User Story:** As a seller, I want to review and edit extracted products before adding them to inventory, so that I can correct any extraction errors.

#### Acceptance Criteria

1. WHEN the Receipt_Scanner completes extraction THEN the Receipt_Scanner SHALL display extracted products in an editable preview interface
2. WHEN a product has Confidence_Score below 0.7 THEN the Receipt_Scanner SHALL highlight the product for user review
3. WHEN a user edits an extracted product THEN the Receipt_Scanner SHALL update the product data and recalculate any dependent values
4. WHEN a user confirms the extracted products THEN the Receipt_Scanner SHALL add the products to the seller's inventory
5. WHEN the Receipt_Scanner cannot extract any products THEN the Receipt_Scanner SHALL display an error message with suggestions for better image quality

### Requirement 4

**User Story:** As a seller, I want the system to learn from common receipt patterns, so that extraction accuracy improves over time.

#### Acceptance Criteria

1. WHEN the Receipt_Scanner processes a receipt THEN the Receipt_Scanner SHALL use AI to identify the receipt format type (tax invoice, distributor bill, simple list)
2. WHEN the Receipt_Scanner encounters a known distributor format (e.g., Kanbros Distributors) THEN the Receipt_Scanner SHALL apply format-specific parsing rules
3. WHEN the Receipt_Scanner extracts product names THEN the Receipt_Scanner SHALL use AI to clean and normalize product names (fix OCR errors, standardize brand names)
4. WHEN the Receipt_Scanner encounters abbreviated product names THEN the Receipt_Scanner SHALL attempt to expand abbreviations using AI context understanding

### Requirement 5

**User Story:** As a seller, I want to see the original receipt alongside extracted data, so that I can verify the extraction accuracy.

#### Acceptance Criteria

1. WHEN the Receipt_Scanner displays extraction results THEN the Receipt_Scanner SHALL show the original receipt image alongside the extracted data
2. WHEN a user hovers over an extracted product THEN the Receipt_Scanner SHALL highlight the corresponding region in the original receipt image
3. WHEN the Receipt_Scanner extracts data THEN the Receipt_Scanner SHALL preserve the original text for reference alongside normalized values

### Requirement 6

**User Story:** As a developer, I want the receipt parsing algorithm to be testable and maintainable, so that I can verify correctness and add new receipt formats.

#### Acceptance Criteria

1. WHEN the Receipt_Scanner parses receipt text THEN the Receipt_Scanner SHALL produce a structured output that can be serialized to JSON and deserialized back to an equivalent structure
2. WHEN the Receipt_Scanner serializes extracted product data THEN the Receipt_Scanner SHALL provide a pretty printer that outputs human-readable JSON format for debugging and round-trip validation
3. WHEN the Receipt_Scanner calculates Unit_Price THEN the Receipt_Scanner SHALL handle edge cases (zero quantity, missing values) by returning null Unit_Price and flagging the product for manual review
4. WHEN the Receipt_Scanner maps columns THEN the Receipt_Scanner SHALL log the mapping decisions including matched header text and assigned field type
5. WHEN the Receipt_Scanner encounters an unknown format THEN the Receipt_Scanner SHALL fall back to AI-based extraction with Confidence_Score capped at 0.5
