/**
 * Unit Price Calculator Module
 * 
 * Calculates unit price from net amount and quantity with edge case handling.
 * 
 * Requirements: 1.3, 6.3
 */

import { PriceCalculationResult } from './receiptTypes';

/**
 * Calculates unit price by dividing net amount by quantity.
 * 
 * @param netAmount - The total net amount for the line item (can be null/undefined)
 * @param quantity - The quantity of units (can be null/undefined)
 * @returns PriceCalculationResult with unitPrice, success flag, and optional error code
 * 
 * Edge cases handled:
 * - Zero quantity: returns null with 'zero_quantity' error
 * - Missing net amount: returns null with 'missing_net_amount' error
 * - Missing quantity: returns null with 'missing_quantity' error
 * - Invalid values (NaN, negative): returns null with 'invalid_values' error
 * 
 * Requirements: 1.3, 6.3
 */
export function calculateUnitPrice(
  netAmount: number | null | undefined,
  quantity: number | null | undefined
): PriceCalculationResult {
  // Check for missing net amount
  if (netAmount === null || netAmount === undefined) {
    return {
      unitPrice: null,
      success: false,
      error: 'missing_net_amount',
    };
  }

  // Check for missing quantity
  if (quantity === null || quantity === undefined) {
    return {
      unitPrice: null,
      success: false,
      error: 'missing_quantity',
    };
  }

  // Check for invalid values (NaN or negative)
  if (
    typeof netAmount !== 'number' ||
    typeof quantity !== 'number' ||
    isNaN(netAmount) ||
    isNaN(quantity) ||
    netAmount < 0 ||
    quantity < 0
  ) {
    return {
      unitPrice: null,
      success: false,
      error: 'invalid_values',
    };
  }

  // Check for zero quantity
  if (quantity === 0) {
    return {
      unitPrice: null,
      success: false,
      error: 'zero_quantity',
    };
  }

  // Calculate unit price
  const unitPrice = netAmount / quantity;

  return {
    unitPrice,
    success: true,
  };
}
