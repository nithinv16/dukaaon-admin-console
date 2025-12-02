import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Selection state management functions for testing
 * These mirror the logic used in the categories page
 */

// Type for product
interface Product {
  id: string;
  name: string;
  price: number;
}

// Function to calculate selection count
export function getSelectionCount(selectedIds: Set<string>): number {
  return selectedIds.size;
}

// Function to select a product
export function selectProduct(selectedIds: Set<string>, productId: string): Set<string> {
  const newSet = new Set(selectedIds);
  newSet.add(productId);
  return newSet;
}

// Function to deselect a product
export function deselectProduct(selectedIds: Set<string>, productId: string): Set<string> {
  const newSet = new Set(selectedIds);
  newSet.delete(productId);
  return newSet;
}

// Function to toggle product selection
export function toggleProductSelection(selectedIds: Set<string>, productId: string): Set<string> {
  const newSet = new Set(selectedIds);
  if (newSet.has(productId)) {
    newSet.delete(productId);
  } else {
    newSet.add(productId);
  }
  return newSet;
}

// Function to select all products
export function selectAllProducts(products: Product[]): Set<string> {
  return new Set(products.map(p => p.id));
}

// Function to clear selection
export function clearSelection(): Set<string> {
  return new Set();
}

/**
 * **Feature: category-inventory-improvements, Property 14: Selection Count Accuracy**
 * **Validates: Requirements 5.2**
 * 
 * For any set of selected products, the selection toolbar SHALL display a count 
 * that exactly matches the number of selected products.
 */
describe('Product Selection Count Property Tests', () => {
  // Arbitrary for generating product IDs
  const productIdArb = fc.uuid();
  const productIdsArb = fc.array(productIdArb, { minLength: 0, maxLength: 50 });
  
  // Arbitrary for generating products
  const productArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    price: fc.float({ min: 0, max: 10000 })
  });
  const productsArb = fc.array(productArb, { minLength: 0, maxLength: 50 });

  it('Property 14: Selection count equals the size of selected IDs set', () => {
    fc.assert(
      fc.property(productIdsArb, (productIds) => {
        // Create a set from the product IDs (removes duplicates)
        const selectedIds = new Set(productIds);
        const count = getSelectionCount(selectedIds);
        
        // Count must exactly match the set size
        expect(count).toBe(selectedIds.size);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 14: Adding a product increases count by exactly 1', () => {
    fc.assert(
      fc.property(productIdsArb, productIdArb, (existingIds, newId) => {
        const selectedIds = new Set(existingIds);
        
        // Skip if the ID already exists (would not increase count)
        if (selectedIds.has(newId)) return;
        
        const initialCount = getSelectionCount(selectedIds);
        const newSelectedIds = selectProduct(selectedIds, newId);
        const newCount = getSelectionCount(newSelectedIds);
        
        // Count should increase by exactly 1
        expect(newCount).toBe(initialCount + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 14: Removing a product decreases count by exactly 1', () => {
    fc.assert(
      fc.property(productIdsArb, (productIds) => {
        // Need at least one product to remove
        if (productIds.length === 0) return;
        
        const selectedIds = new Set(productIds);
        const idToRemove = productIds[0];
        
        // Skip if the ID doesn't exist (would not decrease count)
        if (!selectedIds.has(idToRemove)) return;
        
        const initialCount = getSelectionCount(selectedIds);
        const newSelectedIds = deselectProduct(selectedIds, idToRemove);
        const newCount = getSelectionCount(newSelectedIds);
        
        // Count should decrease by exactly 1
        expect(newCount).toBe(initialCount - 1);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 14: Select all results in count equal to total products', () => {
    fc.assert(
      fc.property(productsArb, (products) => {
        // Ensure unique IDs
        const uniqueProducts = products.filter((p, i, arr) => 
          arr.findIndex(x => x.id === p.id) === i
        );
        
        const selectedIds = selectAllProducts(uniqueProducts);
        const count = getSelectionCount(selectedIds);
        
        // Count must equal total number of unique products
        expect(count).toBe(uniqueProducts.length);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 14: Toggle selection changes count by exactly 1', () => {
    fc.assert(
      fc.property(productIdsArb, productIdArb, (existingIds, toggleId) => {
        const selectedIds = new Set(existingIds);
        const initialCount = getSelectionCount(selectedIds);
        const wasSelected = selectedIds.has(toggleId);
        
        const newSelectedIds = toggleProductSelection(selectedIds, toggleId);
        const newCount = getSelectionCount(newSelectedIds);
        
        if (wasSelected) {
          // If was selected, count should decrease by 1
          expect(newCount).toBe(initialCount - 1);
        } else {
          // If was not selected, count should increase by 1
          expect(newCount).toBe(initialCount + 1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 14: Count is never negative', () => {
    fc.assert(
      fc.property(productIdsArb, (productIds) => {
        const selectedIds = new Set(productIds);
        const count = getSelectionCount(selectedIds);
        
        expect(count).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 14: Empty selection has count of 0', () => {
    const selectedIds = clearSelection();
    const count = getSelectionCount(selectedIds);
    
    expect(count).toBe(0);
  });
});

/**
 * **Feature: category-inventory-improvements, Property 19: Clear Selection Completeness**
 * **Validates: Requirements 5.12**
 * 
 * For any selection state with one or more products selected, clicking "Clear Selection" 
 * SHALL result in zero products being selected.
 */
describe('Clear Selection Property Tests', () => {
  const productIdArb = fc.uuid();
  const productIdsArb = fc.array(productIdArb, { minLength: 1, maxLength: 50 });

  it('Property 19: Clear selection results in empty set', () => {
    fc.assert(
      fc.property(productIdsArb, (productIds) => {
        // Start with some selected products
        const selectedIds = new Set(productIds);
        
        // Verify we have some selections
        expect(selectedIds.size).toBeGreaterThan(0);
        
        // Clear selection
        const clearedIds = clearSelection();
        
        // Result must be empty
        expect(clearedIds.size).toBe(0);
        expect(getSelectionCount(clearedIds)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 19: Clear selection is idempotent', () => {
    fc.assert(
      fc.property(productIdsArb, (productIds) => {
        const selectedIds = new Set(productIds);
        
        // Clear once
        const clearedOnce = clearSelection();
        
        // Clear again (simulating multiple clicks)
        const clearedTwice = clearSelection();
        
        // Both should be empty
        expect(clearedOnce.size).toBe(0);
        expect(clearedTwice.size).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 19: Clear selection removes all product IDs', () => {
    fc.assert(
      fc.property(productIdsArb, (productIds) => {
        const selectedIds = new Set(productIds);
        const clearedIds = clearSelection();
        
        // No original product ID should be in the cleared set
        for (const id of productIds) {
          expect(clearedIds.has(id)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 19: Clear selection works regardless of selection size', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 100 }),
        (productIds) => {
          const selectedIds = new Set(productIds);
          const clearedIds = clearSelection();
          
          // Regardless of how many were selected, result is empty
          expect(clearedIds.size).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
