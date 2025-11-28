/**
 * Property-Based Tests for Unit Price Calculator
 * 
 * Uses fast-check to verify universal properties of the calculateUnitPrice function.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateUnitPrice } from './unitPriceCalculator';

describe('UnitPriceCalculator Property Tests', () => {
  /**
   * **Feature: scan-receipts-2, Property 1: Unit Price Calculation Correctness**
   * **Validates: Requirements 1.3**
   * 
   * For any extracted product with valid net amount (> 0) and valid quantity (> 0),
   * the calculated unit price SHALL equal net amount divided by quantity
   * (within floating-point precision tolerance).
   */
  it('Property 1: Unit Price Calculation Correctness - unitPrice equals netAmount / quantity for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),  // netAmount > 0
        fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),   // quantity > 0
        (netAmount, quantity) => {
          const result = calculateUnitPrice(netAmount, quantity);
          
          // Should succeed for valid positive inputs
          expect(result.success).toBe(true);
          expect(result.unitPrice).not.toBeNull();
          expect(result.error).toBeUndefined();
          
          // Unit price should equal netAmount / quantity within floating-point tolerance
          const expectedUnitPrice = netAmount / quantity;
          const tolerance = 0.0001;
          
          return Math.abs(result.unitPrice! - expectedUnitPrice) < tolerance;
        }
      ),
      { numRuns: 100 }
    );
  });
});
