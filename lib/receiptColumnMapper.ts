/**
 * Receipt Column Mapper Module
 * 
 * Identifies and maps column headers to standard field names for receipt parsing.
 * Handles various header variations commonly found in Indian retail/FMCG receipts.
 * 
 * Requirements: 2.1, 2.2, 6.4
 */

import { ColumnMapping, MappingDecision } from './receiptTypes';

// ============================================================================
// Header Variations Constants
// ============================================================================

/**
 * Known header variations for each standard field.
 * Used for case-insensitive matching during column identification.
 * 
 * Requirements: 2.1, 2.2
 */
export const HEADER_VARIATIONS: Record<string, string[]> = {
  productName: [
    'item description',
    'description',
    'item',
    'product',
    'particulars',
    'goods',
    'product name',
    'item name',
    'material',
    'article',
  ],
  quantity: [
    'qty',
    'pcs',
    'units',
    'cs',
    'quantity',
    'nos',
    'no',
    'count',
    'pieces',
    'unit',
  ],
  netAmount: [
    'net amt',
    'net amount',
    'amount',
    'amt',
    'total',
    'value',
    'net',
    'net value',
    'taxable value',
    'taxable amt',
  ],
  mrp: [
    'mrp',
    'rate',
    'price',
    'unit price',
    'unit rate',
    'u.price',
    'u.rate',
  ],
  grossAmount: [
    'gross amt',
    'gross amount',
    'gross',
    'gross value',
  ],
};

/**
 * Standard field names that can be assigned during mapping
 */
export type StandardFieldName = 'productName' | 'quantity' | 'netAmount' | 'mrp' | 'grossAmount' | 'unknown';

// ============================================================================
// Header Normalization
// ============================================================================

/**
 * Normalizes a header text to a standard field name using case-insensitive matching.
 * 
 * @param headerText - The original header text from the receipt
 * @returns The standard field name or 'unknown' if no match found
 * 
 * Requirements: 2.1, 2.2
 */
export function normalizeHeader(headerText: string): StandardFieldName {
  if (!headerText || typeof headerText !== 'string') {
    return 'unknown';
  }

  const normalizedInput = headerText.toLowerCase().trim();
  
  if (!normalizedInput) {
    return 'unknown';
  }

  for (const [fieldName, variations] of Object.entries(HEADER_VARIATIONS)) {
    for (const variation of variations) {
      if (normalizedInput === variation.toLowerCase()) {
        return fieldName as StandardFieldName;
      }
    }
  }

  return 'unknown';
}

// ============================================================================
// Column Mapping
// ============================================================================

/**
 * Result of the mapColumns function
 */
export interface MapColumnsResult {
  /** The column mapping with indices for each field */
  mapping: ColumnMapping | null;
  /** Log of all mapping decisions made */
  decisions: MappingDecision[];
  /** Whether all required fields were found */
  success: boolean;
  /** The column index selected for price calculation (prefers netAmount over mrp/grossAmount) */
  priceColumnIndex: number | null;
  /** The field type of the selected price column */
  priceColumnType: 'netAmount' | 'mrp' | 'grossAmount' | null;
}

/**
 * Maps column headers to standard field names and returns column indices.
 * 
 * @param headers - Array of header texts from the receipt table
 * @returns MapColumnsResult with mapping, decisions log, and success flag
 * 
 * Requirements: 2.1, 2.2, 6.4
 */
export function mapColumns(headers: string[]): MapColumnsResult {
  const decisions: MappingDecision[] = [];
  const fieldIndices: Partial<Record<StandardFieldName, number>> = {};

  // Process each header and create mapping decisions
  headers.forEach((headerText, index) => {
    const normalizedField = normalizeHeader(headerText);
    const confidence = normalizedField === 'unknown' ? 0 : 1;
    
    const decision: MappingDecision = {
      headerText: headerText,
      assignedField: normalizedField,
      confidence: confidence,
      reason: normalizedField === 'unknown' 
        ? `No matching variation found for "${headerText}"`
        : `Matched "${headerText}" to ${normalizedField} field`,
    };
    
    decisions.push(decision);

    // Store the first occurrence of each field type
    if (normalizedField !== 'unknown' && fieldIndices[normalizedField] === undefined) {
      fieldIndices[normalizedField] = index;
    }
  });

  // Check if all required fields are present
  const hasProductName = fieldIndices.productName !== undefined;
  const hasQuantity = fieldIndices.quantity !== undefined;
  const hasNetAmount = fieldIndices.netAmount !== undefined;
  const hasMrp = fieldIndices.mrp !== undefined;
  const hasGrossAmount = fieldIndices.grossAmount !== undefined;

  // Determine price column with priority: netAmount > mrp > grossAmount
  // Requirements: 2.3 - prefer Net Amount over MRP/Gross for unit price calculation
  let priceColumnIndex: number | null = null;
  let priceColumnType: 'netAmount' | 'mrp' | 'grossAmount' | null = null;

  if (hasNetAmount) {
    priceColumnIndex = fieldIndices.netAmount!;
    priceColumnType = 'netAmount';
  } else if (hasMrp) {
    priceColumnIndex = fieldIndices.mrp!;
    priceColumnType = 'mrp';
  } else if (hasGrossAmount) {
    priceColumnIndex = fieldIndices.grossAmount!;
    priceColumnType = 'grossAmount';
  }

  // For success, we need productName, quantity, and at least one price column
  const hasPriceColumn = priceColumnIndex !== null;

  if (!hasProductName || !hasQuantity || !hasPriceColumn) {
    return {
      mapping: null,
      decisions,
      success: false,
      priceColumnIndex: null,
      priceColumnType: null,
    };
  }

  // Build the column mapping
  // Use the selected price column as netAmount for consistency
  const mapping: ColumnMapping = {
    productName: fieldIndices.productName!,
    quantity: fieldIndices.quantity!,
    netAmount: priceColumnIndex!,
  };

  // Add optional fields if present (and different from the selected price column)
  if (hasMrp && fieldIndices.mrp !== priceColumnIndex) {
    mapping.mrp = fieldIndices.mrp;
  }
  if (hasGrossAmount && fieldIndices.grossAmount !== priceColumnIndex) {
    mapping.grossAmount = fieldIndices.grossAmount;
  }

  return {
    mapping,
    decisions,
    success: true,
    priceColumnIndex,
    priceColumnType,
  };
}
