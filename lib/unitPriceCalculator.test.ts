/**
 * Unit Tests for Unit Price Calculator
 * 
 * Tests edge cases and specific scenarios for the calculateUnitPrice function.
 * Requirements: 6.3
 */

import { describe, it, expect } from 'vitest';
import { calculateUnitPrice } from './unitPriceCalculator';

describe('UnitPriceCalculator Unit Tests', () => {
  describe('Successful calculations', () => {
    it('should calculate unit price correctly for valid inputs', () => {
      const result = calculateUnitPrice(100, 5);
      expect(result.success).toBe(true);
      expect(result.unitPrice).toBe(20);
      expect(result.error).toBeUndefined();
    });

    it('should handle decimal values correctly', () => {
      const result = calculateUnitPrice(99.99, 3);
      expect(result.success).toBe(true);
      expect(result.unitPrice).toBeCloseTo(33.33, 2);
    });
  });

  describe('Zero quantity edge case', () => {
    it('should return null with zero_quantity error when quantity is 0', () => {
      const result = calculateUnitPrice(100, 0);
      expect(result.success).toBe(false);
      expect(result.unitPrice).toBeNull();
      expect(result.error).toBe('zero_quantity');
    });
  });

  describe('Missing net amount edge case', () => {
    it('should return null with missing_net_amount error when netAmount is null', () => {
      const result = calculateUnitPrice(null, 5);
      expect(result.success).toBe(false);
      expect(result.unitPrice).toBeNull();
      expect(result.error).toBe('missing_net_amount');
    });

    it('should return null with missing_net_amount error when netAmount is undefined', () => {
      const result = calculateUnitPrice(undefined, 5);
      expect(result.success).toBe(false);
      expect(result.unitPrice).toBeNull();
      expect(result.error).toBe('missing_net_amount');
    });
  });

  describe('Missing quantity edge case', () => {
    it('should return null with missing_quantity error when quantity is null', () => {
      const result = calculateUnitPrice(100, null);
      expect(result.success).toBe(false);
      expect(result.unitPrice).toBeNull();
      expect(result.error).toBe('missing_quantity');
    });

    it('should return null with missing_quantity error when quantity is undefined', () => {
      const result = calculateUnitPrice(100, undefined);
      expect(result.success).toBe(false);
      expect(result.unitPrice).toBeNull();
      expect(result.error).toBe('missing_quantity');
    });
  });

  describe('Negative values edge case', () => {
    it('should return null with invalid_values error when netAmount is negative', () => {
      const result = calculateUnitPrice(-100, 5);
      expect(result.success).toBe(false);
      expect(result.unitPrice).toBeNull();
      expect(result.error).toBe('invalid_values');
    });

    it('should return null with invalid_values error when quantity is negative', () => {
      const result = calculateUnitPrice(100, -5);
      expect(result.success).toBe(false);
      expect(result.unitPrice).toBeNull();
      expect(result.error).toBe('invalid_values');
    });
  });

  describe('NaN values edge case', () => {
    it('should return null with invalid_values error when netAmount is NaN', () => {
      const result = calculateUnitPrice(NaN, 5);
      expect(result.success).toBe(false);
      expect(result.unitPrice).toBeNull();
      expect(result.error).toBe('invalid_values');
    });

    it('should return null with invalid_values error when quantity is NaN', () => {
      const result = calculateUnitPrice(100, NaN);
      expect(result.success).toBe(false);
      expect(result.unitPrice).toBeNull();
      expect(result.error).toBe('invalid_values');
    });
  });

  describe('Zero net amount', () => {
    it('should return 0 unit price when netAmount is 0 and quantity is valid', () => {
      const result = calculateUnitPrice(0, 5);
      expect(result.success).toBe(true);
      expect(result.unitPrice).toBe(0);
    });
  });
});
