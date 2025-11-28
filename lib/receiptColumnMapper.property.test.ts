/**
 * Property-Based Tests for Receipt Column Mapper
 * 
 * Uses fast-check to verify universal properties of the column mapping functions.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  normalizeHeader, 
  mapColumns, 
  HEADER_VARIATIONS,
  StandardFieldName 
} from './receiptColumnMapper';

describe('ReceiptColumnMapper Property Tests', () => {
  /**
   * **Feature: scan-receipts-2, Property 2: Header Normalization Consistency**
   * **Validates: Requirements 2.1, 2.2**
   * 
   * For any column header text that matches a known variation (e.g., "Qty", "Pcs", "Units", "quantity"),
   * the column mapper SHALL normalize it to the corresponding standard field name (e.g., "quantity").
   */
  it('Property 2: Header Normalization Consistency - known variations normalize to standard field names', () => {
    // Test quantity variations
    const quantityVariations = HEADER_VARIATIONS.quantity;
    fc.assert(
      fc.property(
        fc.constantFrom(...quantityVariations),
        (headerText) => {
          const result = normalizeHeader(headerText);
          return result === 'quantity';
        }
      ),
      { numRuns: 100 }
    );

    // Test productName variations
    const productNameVariations = HEADER_VARIATIONS.productName;
    fc.assert(
      fc.property(
        fc.constantFrom(...productNameVariations),
        (headerText) => {
          const result = normalizeHeader(headerText);
          return result === 'productName';
        }
      ),
      { numRuns: 100 }
    );

    // Test netAmount variations
    const netAmountVariations = HEADER_VARIATIONS.netAmount;
    fc.assert(
      fc.property(
        fc.constantFrom(...netAmountVariations),
        (headerText) => {
          const result = normalizeHeader(headerText);
          return result === 'netAmount';
        }
      ),
      { numRuns: 100 }
    );

    // Test mrp variations
    const mrpVariations = HEADER_VARIATIONS.mrp;
    fc.assert(
      fc.property(
        fc.constantFrom(...mrpVariations),
        (headerText) => {
          const result = normalizeHeader(headerText);
          return result === 'mrp';
        }
      ),
      { numRuns: 100 }
    );

    // Test grossAmount variations
    const grossAmountVariations = HEADER_VARIATIONS.grossAmount;
    fc.assert(
      fc.property(
        fc.constantFrom(...grossAmountVariations),
        (headerText) => {
          const result = normalizeHeader(headerText);
          return result === 'grossAmount';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: scan-receipts-2, Property 2: Header Normalization Consistency (Case Insensitivity)**
   * **Validates: Requirements 2.1, 2.2**
   * 
   * For any known header variation, case transformations (upper, lower, mixed) 
   * SHALL normalize to the same standard field name.
   */
  it('Property 2: Header Normalization Consistency - case insensitive matching', () => {
    // Collect all variations with their expected field names
    const allVariationsWithFields: Array<{ variation: string; expectedField: StandardFieldName }> = [];
    
    for (const [fieldName, variations] of Object.entries(HEADER_VARIATIONS)) {
      for (const variation of variations) {
        allVariationsWithFields.push({
          variation,
          expectedField: fieldName as StandardFieldName,
        });
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...allVariationsWithFields),
        fc.constantFrom('upper', 'lower', 'original') as fc.Arbitrary<'upper' | 'lower' | 'original'>,
        ({ variation, expectedField }, caseType) => {
          let transformedHeader: string;
          switch (caseType) {
            case 'upper':
              transformedHeader = variation.toUpperCase();
              break;
            case 'lower':
              transformedHeader = variation.toLowerCase();
              break;
            default:
              transformedHeader = variation;
          }
          
          const result = normalizeHeader(transformedHeader);
          return result === expectedField;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: scan-receipts-2, Property 3: Net Amount Priority Selection**
   * **Validates: Requirements 2.3**
   * 
   * For any receipt table containing multiple price columns (MRP, Gross Amount, Net Amount),
   * the system SHALL select the Net Amount column for unit price calculation.
   */
  it('Property 3: Net Amount Priority Selection - netAmount is preferred over mrp and grossAmount', () => {
    // Generate headers that always include productName, quantity, and various price column combinations
    const productNameHeaders = HEADER_VARIATIONS.productName;
    const quantityHeaders = HEADER_VARIATIONS.quantity;
    const netAmountHeaders = HEADER_VARIATIONS.netAmount;
    const mrpHeaders = HEADER_VARIATIONS.mrp;
    const grossAmountHeaders = HEADER_VARIATIONS.grossAmount;

    fc.assert(
      fc.property(
        fc.constantFrom(...productNameHeaders),
        fc.constantFrom(...quantityHeaders),
        fc.constantFrom(...netAmountHeaders),
        fc.option(fc.constantFrom(...mrpHeaders), { nil: undefined }),
        fc.option(fc.constantFrom(...grossAmountHeaders), { nil: undefined }),
        (productNameHeader, quantityHeader, netAmountHeader, mrpHeader, grossAmountHeader) => {
          // Build headers array with various combinations
          const headers = [productNameHeader, quantityHeader];
          
          // Add price columns in random order
          if (mrpHeader) headers.push(mrpHeader);
          if (grossAmountHeader) headers.push(grossAmountHeader);
          headers.push(netAmountHeader); // Net amount always present
          
          const result = mapColumns(headers);
          
          // Property: When netAmount is present, it should always be selected
          expect(result.success).toBe(true);
          expect(result.priceColumnType).toBe('netAmount');
          
          return result.priceColumnType === 'netAmount';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: scan-receipts-2, Property 3: Net Amount Priority Selection (MRP fallback)**
   * **Validates: Requirements 2.3**
   * 
   * When Net Amount is not present but MRP is, MRP should be selected over Gross Amount.
   */
  it('Property 3: Net Amount Priority Selection - mrp is preferred over grossAmount when netAmount absent', () => {
    const productNameHeaders = HEADER_VARIATIONS.productName;
    const quantityHeaders = HEADER_VARIATIONS.quantity;
    const mrpHeaders = HEADER_VARIATIONS.mrp;
    const grossAmountHeaders = HEADER_VARIATIONS.grossAmount;

    fc.assert(
      fc.property(
        fc.constantFrom(...productNameHeaders),
        fc.constantFrom(...quantityHeaders),
        fc.constantFrom(...mrpHeaders),
        fc.option(fc.constantFrom(...grossAmountHeaders), { nil: undefined }),
        (productNameHeader, quantityHeader, mrpHeader, grossAmountHeader) => {
          // Build headers without netAmount
          const headers = [productNameHeader, quantityHeader];
          
          if (grossAmountHeader) headers.push(grossAmountHeader);
          headers.push(mrpHeader);
          
          const result = mapColumns(headers);
          
          // Property: When netAmount is absent but mrp is present, mrp should be selected
          expect(result.success).toBe(true);
          expect(result.priceColumnType).toBe('mrp');
          
          return result.priceColumnType === 'mrp';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: scan-receipts-2, Property 9: Mapping Log Completeness**
   * **Validates: Requirements 6.4**
   * 
   * For any column mapping operation, the mapping log SHALL contain an entry 
   * with the matched header text and the assigned field type for each header.
   */
  it('Property 9: Mapping Log Completeness - every header has a mapping decision entry', () => {
    // Generate arbitrary header arrays (mix of known and unknown headers)
    const knownHeaders = [
      ...HEADER_VARIATIONS.productName,
      ...HEADER_VARIATIONS.quantity,
      ...HEADER_VARIATIONS.netAmount,
      ...HEADER_VARIATIONS.mrp,
      ...HEADER_VARIATIONS.grossAmount,
    ];
    
    const unknownHeaders = ['S.No', 'HSN', 'Code', 'Batch', 'Expiry', 'Discount', 'Tax'];
    const allPossibleHeaders = [...knownHeaders, ...unknownHeaders];

    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...allPossibleHeaders), { minLength: 1, maxLength: 10 }),
        (headers) => {
          const result = mapColumns(headers);
          
          // Property: decisions array should have exactly one entry per header
          if (result.decisions.length !== headers.length) {
            return false;
          }
          
          // Property: each decision should contain the original header text
          for (let i = 0; i < headers.length; i++) {
            const decision = result.decisions[i];
            if (decision.headerText !== headers[i]) {
              return false;
            }
            // Each decision should have an assigned field (even if 'unknown')
            if (!decision.assignedField) {
              return false;
            }
            // Each decision should have a reason
            if (!decision.reason) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
