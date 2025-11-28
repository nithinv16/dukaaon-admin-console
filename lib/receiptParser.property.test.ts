/**
 * Property-Based Tests for Receipt Parser
 * 
 * Uses fast-check to verify universal properties of the receipt parsing functions.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  separateProductCode,
  serializeReceipt,
  deserializeReceipt,
  prettyPrintReceipt
} from './receiptParser';
import { ParsedReceipt, ParsedRow, CellData } from './receiptTypes';

// ============================================================================
// Custom Arbitraries
// ============================================================================

/**
 * Generates valid product names (alphabetic with spaces)
 */
const productNameArb: fc.Arbitrary<string> = fc.string({ minLength: 3, maxLength: 50 })
  .filter((s: string) => /^[a-zA-Z\s]+$/.test(s) && s.trim().length >= 3);

/**
 * Generates HSN codes (4-8 digit numbers)
 */
const hsnCodeArb = fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString());

/**
 * Generates numeric product codes (5-12 digits)
 */
const numericCodeArb = fc.integer({ min: 10000, max: 999999999999 }).map(n => n.toString());

/**
 * Generates valid CellData objects
 */
const cellDataArb: fc.Arbitrary<CellData> = fc.record({
  text: fc.string({ minLength: 0, maxLength: 100 }),
  columnIndex: fc.integer({ min: 0, max: 20 }),
  rowIndex: fc.integer({ min: 0, max: 100 }),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  boundingBox: fc.option(
    fc.record({
      left: fc.float({ min: 0, max: 1, noNaN: true }),
      top: fc.float({ min: 0, max: 1, noNaN: true }),
      width: fc.float({ min: 0, max: 1, noNaN: true }),
      height: fc.float({ min: 0, max: 1, noNaN: true }),
    }),
    { nil: undefined }
  ),
});

/**
 * Generates valid ParsedRow objects
 */
const parsedRowArb: fc.Arbitrary<ParsedRow> = fc.record({
  cells: fc.array(cellDataArb, { minLength: 0, maxLength: 10 }),
  rawText: fc.string({ minLength: 0, maxLength: 200 }),
});

/**
 * Generates valid ParsedReceipt objects
 */
const parsedReceiptArb: fc.Arbitrary<ParsedReceipt> = fc.record({
  headers: fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 0, maxLength: 10 }),
  rows: fc.array(parsedRowArb, { minLength: 0, maxLength: 20 }),
  formatType: fc.constantFrom('tax_invoice', 'distributor_bill', 'simple_list', 'unknown'),
});

describe('ReceiptParser Property Tests', () => {
  /**
   * **Feature: scan-receipts-2, Property 4: Product Code Separation**
   * **Validates: Requirements 2.5**
   * 
   * For any product text containing HSN codes or product codes (numeric patterns),
   * the extracted product name SHALL not contain the code portion.
   */
  describe('Property 4: Product Code Separation', () => {
    it('HSN codes at the start of product name are separated', () => {
      fc.assert(
        fc.property(
          hsnCodeArb,
          productNameArb,
          (hsnCode, productName) => {
            const input = `${hsnCode} ${productName}`;
            const result = separateProductCode(input);
            
            // The cleaned name should not contain the HSN code
            expect(result.name).not.toContain(hsnCode);
            // The code should be extracted
            expect(result.code).toBe(hsnCode);
            // The cleaned name should be the product name (trimmed)
            expect(result.name.trim()).toBe(productName.trim());
            
            return !result.name.includes(hsnCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('HSN codes at the end of product name are separated', () => {
      fc.assert(
        fc.property(
          productNameArb,
          hsnCodeArb,
          (productName, hsnCode) => {
            const input = `${productName} ${hsnCode}`;
            const result = separateProductCode(input);
            
            // The cleaned name should not contain the HSN code
            expect(result.name).not.toContain(hsnCode);
            // The code should be extracted
            expect(result.code).toBe(hsnCode);
            
            return !result.name.includes(hsnCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Numeric product codes (5-12 digits) are separated from product names', () => {
      fc.assert(
        fc.property(
          numericCodeArb,
          productNameArb,
          (numericCode, productName) => {
            // Only test codes that are 5+ digits (to match NUMERIC_CODE_PATTERN)
            if (numericCode.length < 5) return true;
            
            const input = `${numericCode} ${productName}`;
            const result = separateProductCode(input);
            
            // The cleaned name should not contain the numeric code
            return !result.name.includes(numericCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Product names without codes remain unchanged', () => {
      fc.assert(
        fc.property(
          productNameArb,
          (productName) => {
            const result = separateProductCode(productName);
            
            // No code should be extracted
            expect(result.code).toBeNull();
            // Name should be the same (trimmed)
            expect(result.name).toBe(productName.trim());
            
            return result.code === null && result.name === productName.trim();
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: scan-receipts-2, Property 8: Serialization Round-Trip**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * For any valid ParsedReceipt structure, serializing to JSON and then deserializing
   * SHALL produce a structure equivalent to the original.
   */
  describe('Property 8: Serialization Round-Trip', () => {
    it('serialize then deserialize produces equivalent structure', () => {
      fc.assert(
        fc.property(
          parsedReceiptArb,
          (receipt) => {
            const serialized = serializeReceipt(receipt);
            const deserialized = deserializeReceipt(serialized);
            
            // Headers should match
            expect(deserialized.headers).toEqual(receipt.headers);
            
            // Format type should match
            expect(deserialized.formatType).toBe(receipt.formatType);
            
            // Number of rows should match
            expect(deserialized.rows.length).toBe(receipt.rows.length);
            
            // Each row should match
            for (let i = 0; i < receipt.rows.length; i++) {
              const originalRow = receipt.rows[i];
              const deserializedRow = deserialized.rows[i];
              
              expect(deserializedRow.rawText).toBe(originalRow.rawText);
              expect(deserializedRow.cells.length).toBe(originalRow.cells.length);
              
              for (let j = 0; j < originalRow.cells.length; j++) {
                const originalCell = originalRow.cells[j];
                const deserializedCell = deserializedRow.cells[j];
                
                expect(deserializedCell.text).toBe(originalCell.text);
                expect(deserializedCell.columnIndex).toBe(originalCell.columnIndex);
                expect(deserializedCell.rowIndex).toBe(originalCell.rowIndex);
                // Use closeTo for floating point comparison
                expect(deserializedCell.confidence).toBeCloseTo(originalCell.confidence, 5);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('double serialization produces same result', () => {
      fc.assert(
        fc.property(
          parsedReceiptArb,
          (receipt) => {
            const serialized1 = serializeReceipt(receipt);
            const deserialized1 = deserializeReceipt(serialized1);
            const serialized2 = serializeReceipt(deserialized1);
            const deserialized2 = deserializeReceipt(serialized2);
            
            // Second round-trip should produce same structure
            expect(deserialized2.headers).toEqual(deserialized1.headers);
            expect(deserialized2.formatType).toBe(deserialized1.formatType);
            expect(deserialized2.rows.length).toBe(deserialized1.rows.length);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prettyPrint produces non-empty output for any valid receipt', () => {
      fc.assert(
        fc.property(
          parsedReceiptArb,
          (receipt) => {
            const prettyOutput = prettyPrintReceipt(receipt);
            
            // Output should be a non-empty string
            expect(typeof prettyOutput).toBe('string');
            expect(prettyOutput.length).toBeGreaterThan(0);
            
            // Output should contain the format type
            expect(prettyOutput).toContain(receipt.formatType);
            
            return prettyOutput.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
