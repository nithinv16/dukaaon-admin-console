/**
 * Unit Tests for Receipt Column Mapper
 * 
 * Tests for header normalization and column mapping functionality.
 */

import { describe, it, expect } from 'vitest';
import { 
  normalizeHeader, 
  mapColumns, 
  HEADER_VARIATIONS,
  StandardFieldName 
} from './receiptColumnMapper';

describe('receiptColumnMapper', () => {
  describe('normalizeHeader', () => {
    it('should normalize "Qty" to "quantity"', () => {
      expect(normalizeHeader('Qty')).toBe('quantity');
    });

    it('should normalize "Item Description" to "productName"', () => {
      expect(normalizeHeader('Item Description')).toBe('productName');
    });

    it('should normalize "Net Amt" to "netAmount"', () => {
      expect(normalizeHeader('Net Amt')).toBe('netAmount');
    });

    it('should be case-insensitive', () => {
      expect(normalizeHeader('QTY')).toBe('quantity');
      expect(normalizeHeader('qty')).toBe('quantity');
      expect(normalizeHeader('Qty')).toBe('quantity');
    });

    it('should handle whitespace', () => {
      expect(normalizeHeader('  Qty  ')).toBe('quantity');
      expect(normalizeHeader('  Net Amt  ')).toBe('netAmount');
    });

    it('should return "unknown" for unrecognized headers', () => {
      expect(normalizeHeader('Random Header')).toBe('unknown');
      expect(normalizeHeader('XYZ')).toBe('unknown');
    });

    it('should return "unknown" for empty or null input', () => {
      expect(normalizeHeader('')).toBe('unknown');
      expect(normalizeHeader('   ')).toBe('unknown');
      expect(normalizeHeader(null as unknown as string)).toBe('unknown');
      expect(normalizeHeader(undefined as unknown as string)).toBe('unknown');
    });

    it('should normalize MRP variations', () => {
      expect(normalizeHeader('MRP')).toBe('mrp');
      expect(normalizeHeader('Rate')).toBe('mrp');
      expect(normalizeHeader('Price')).toBe('mrp');
    });

    it('should normalize gross amount variations', () => {
      expect(normalizeHeader('Gross Amt')).toBe('grossAmount');
      expect(normalizeHeader('Gross Amount')).toBe('grossAmount');
    });
  });

  describe('mapColumns', () => {
    it('should map a simple header row correctly', () => {
      const headers = ['Item Description', 'Qty', 'Net Amt'];
      const result = mapColumns(headers);

      expect(result.success).toBe(true);
      expect(result.mapping).not.toBeNull();
      expect(result.mapping!.productName).toBe(0);
      expect(result.mapping!.quantity).toBe(1);
      expect(result.mapping!.netAmount).toBe(2);
      expect(result.priceColumnIndex).toBe(2);
      expect(result.priceColumnType).toBe('netAmount');
    });

    it('should handle headers with extra columns', () => {
      const headers = ['S.No', 'Item Description', 'HSN', 'Qty', 'MRP', 'Net Amt'];
      const result = mapColumns(headers);

      expect(result.success).toBe(true);
      expect(result.mapping!.productName).toBe(1);
      expect(result.mapping!.quantity).toBe(3);
      expect(result.mapping!.netAmount).toBe(5);
      expect(result.mapping!.mrp).toBe(4);
    });

    it('should fail when required fields are missing', () => {
      const headers = ['Item Description', 'S.No'];
      const result = mapColumns(headers);

      expect(result.success).toBe(false);
      expect(result.mapping).toBeNull();
    });

    it('should succeed with MRP when Net Amount is missing', () => {
      const headers = ['Item Description', 'Qty', 'MRP'];
      const result = mapColumns(headers);

      expect(result.success).toBe(true);
      expect(result.mapping).not.toBeNull();
      expect(result.priceColumnIndex).toBe(2);
      expect(result.priceColumnType).toBe('mrp');
    });

    it('should prefer Net Amount over MRP when both present', () => {
      const headers = ['Item Description', 'Qty', 'MRP', 'Net Amt'];
      const result = mapColumns(headers);

      expect(result.success).toBe(true);
      expect(result.priceColumnIndex).toBe(3);
      expect(result.priceColumnType).toBe('netAmount');
      expect(result.mapping!.netAmount).toBe(3);
    });

    it('should prefer Net Amount over Gross Amount when both present', () => {
      const headers = ['Item Description', 'Qty', 'Gross Amt', 'Net Amt'];
      const result = mapColumns(headers);

      expect(result.success).toBe(true);
      expect(result.priceColumnIndex).toBe(3);
      expect(result.priceColumnType).toBe('netAmount');
    });

    it('should prefer MRP over Gross Amount when Net Amount is missing', () => {
      const headers = ['Item Description', 'Qty', 'Gross Amt', 'MRP'];
      const result = mapColumns(headers);

      expect(result.success).toBe(true);
      expect(result.priceColumnIndex).toBe(3);
      expect(result.priceColumnType).toBe('mrp');
    });

    it('should create mapping decisions for all headers', () => {
      const headers = ['Item', 'Qty', 'Amount'];
      const result = mapColumns(headers);

      expect(result.decisions).toHaveLength(3);
      expect(result.decisions[0].headerText).toBe('Item');
      expect(result.decisions[0].assignedField).toBe('productName');
      expect(result.decisions[1].headerText).toBe('Qty');
      expect(result.decisions[1].assignedField).toBe('quantity');
      expect(result.decisions[2].headerText).toBe('Amount');
      expect(result.decisions[2].assignedField).toBe('netAmount');
    });

    it('should log unknown headers with reason', () => {
      const headers = ['S.No', 'Item', 'Qty', 'Net Amt'];
      const result = mapColumns(headers);

      const unknownDecision = result.decisions.find(d => d.headerText === 'S.No');
      expect(unknownDecision).toBeDefined();
      expect(unknownDecision!.assignedField).toBe('unknown');
      expect(unknownDecision!.confidence).toBe(0);
      expect(unknownDecision!.reason).toContain('No matching variation found');
    });

    it('should use first occurrence when duplicate field types exist', () => {
      const headers = ['Description', 'Item', 'Qty', 'Net Amt'];
      const result = mapColumns(headers);

      // Both 'Description' and 'Item' map to productName, should use first
      expect(result.mapping!.productName).toBe(0);
    });
  });
});
