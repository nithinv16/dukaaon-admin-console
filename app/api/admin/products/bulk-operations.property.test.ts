import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Helper types for testing bulk product operations
 */
interface Product {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  price: number;
  seller_id: string;
}

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
  category_id: string;
}

interface BulkMoveResult {
  success: boolean;
  movedCount: number;
  failedProducts: Array<{ id: string; error: string }>;
  products: Product[];
}

interface BulkCopyResult {
  success: boolean;
  copiedCount: number;
  failedProducts: Array<{ id: string; error: string }>;
  originalProducts: Product[];
  copiedProducts: Product[];
}

/**
 * Pure function that simulates bulk move operation
 * This mirrors the logic in the bulk-move API endpoint
 */
function simulateBulkMove(
  products: Product[],
  productIds: string[],
  targetCategory: string,
  targetSubcategory: string | null
): BulkMoveResult {
  const failedProducts: Array<{ id: string; error: string }> = [];
  const movedProducts: Product[] = [];
  
  // Find products to move
  const productMap = new Map(products.map(p => [p.id, p]));
  
  for (const productId of productIds) {
    const product = productMap.get(productId);
    if (!product) {
      failedProducts.push({ id: productId, error: 'Product not found' });
    } else {
      // Move the product
      movedProducts.push({
        ...product,
        category: targetCategory,
        subcategory: targetSubcategory
      });
    }
  }
  
  // Update the products array with moved products
  const updatedProducts = products.map(p => {
    const moved = movedProducts.find(m => m.id === p.id);
    return moved || p;
  });
  
  return {
    success: failedProducts.length === 0,
    movedCount: movedProducts.length,
    failedProducts,
    products: updatedProducts
  };
}

/**
 * Pure function that simulates bulk copy operation
 * This mirrors the logic in the bulk-copy API endpoint
 */
function simulateBulkCopy(
  products: Product[],
  productIds: string[],
  targetCategory: string,
  targetSubcategory: string | null
): BulkCopyResult {
  const failedProducts: Array<{ id: string; error: string }> = [];
  const copiedProducts: Product[] = [];
  
  // Find products to copy
  const productMap = new Map(products.map(p => [p.id, p]));
  
  for (const productId of productIds) {
    const product = productMap.get(productId);
    if (!product) {
      failedProducts.push({ id: productId, error: 'Product not found' });
    } else {
      // Create a copy with new ID and target category
      copiedProducts.push({
        ...product,
        id: `copy-${product.id}-${Date.now()}`,
        category: targetCategory,
        subcategory: targetSubcategory
      });
    }
  }
  
  return {
    success: failedProducts.length === 0,
    copiedCount: copiedProducts.length,
    failedProducts,
    originalProducts: products,
    copiedProducts
  };
}

/**
 * Arbitraries for generating test data
 */
const categoryNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

const productArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  category: fc.oneof(categoryNameArb, fc.constant(null as null)),
  subcategory: fc.oneof(categoryNameArb, fc.constant(null as null)),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  seller_id: fc.uuid()
});

const productsArrayArb = fc.array(productArb, { minLength: 1, maxLength: 20 });

/**
 * **Feature: category-inventory-improvements, Property 16: Bulk Move Operation Correctness**
 * **Validates: Requirements 5.6, 5.7**
 * 
 * For any set of selected products and target category/subcategory, after a move operation,
 * all selected products SHALL have the target category and subcategory assignments and
 * SHALL NOT appear in the original location.
 */
describe('Bulk Move Operation Correctness Property Tests', () => {
  it('Property 16: All moved products have target category after move', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        fc.option(categoryNameArb, { nil: null }),
        (products, targetCategory, targetSubcategory) => {
          // Select some products to move
          const productIds = products.slice(0, Math.max(1, Math.floor(products.length / 2))).map(p => p.id);
          
          const result = simulateBulkMove(products, productIds, targetCategory, targetSubcategory);
          
          // All moved products should have the target category
          for (const productId of productIds) {
            const movedProduct = result.products.find(p => p.id === productId);
            if (movedProduct) {
              expect(movedProduct.category).toBe(targetCategory);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: All moved products have target subcategory after move', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        fc.option(categoryNameArb, { nil: null }),
        (products, targetCategory, targetSubcategory) => {
          const productIds = products.slice(0, Math.max(1, Math.floor(products.length / 2))).map(p => p.id);
          
          const result = simulateBulkMove(products, productIds, targetCategory, targetSubcategory);
          
          // All moved products should have the target subcategory
          for (const productId of productIds) {
            const movedProduct = result.products.find(p => p.id === productId);
            if (movedProduct) {
              expect(movedProduct.subcategory).toBe(targetSubcategory);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: Moved count equals number of valid product IDs', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        (products, targetCategory) => {
          const productIds = products.map(p => p.id);
          
          const result = simulateBulkMove(products, productIds, targetCategory, null);
          
          // Moved count should equal the number of products
          expect(result.movedCount).toBe(products.length);
          expect(result.failedProducts.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: Non-existent product IDs are reported as failed', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        (products, targetCategory, fakeIds) => {
          // Mix real and fake IDs
          const realIds = products.slice(0, 2).map(p => p.id);
          const allIds = [...realIds, ...fakeIds];
          
          const result = simulateBulkMove(products, allIds, targetCategory, null);
          
          // Failed products should include all fake IDs
          const failedIds = result.failedProducts.map(f => f.id);
          for (const fakeId of fakeIds) {
            expect(failedIds).toContain(fakeId);
          }
          
          // Moved count should equal real IDs count
          expect(result.movedCount).toBe(realIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: Products not in selection retain original category', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        (products, targetCategory) => {
          // Only move first half
          const toMove = products.slice(0, Math.floor(products.length / 2));
          const notMoved = products.slice(Math.floor(products.length / 2));
          const productIds = toMove.map(p => p.id);
          
          const result = simulateBulkMove(products, productIds, targetCategory, null);
          
          // Products not in selection should retain original category
          for (const original of notMoved) {
            const afterMove = result.products.find(p => p.id === original.id);
            expect(afterMove?.category).toBe(original.category);
            expect(afterMove?.subcategory).toBe(original.subcategory);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: Move operation preserves other product properties', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        (products, targetCategory) => {
          const productIds = products.map(p => p.id);
          
          const result = simulateBulkMove(products, productIds, targetCategory, null);
          
          // All other properties should be preserved
          for (const original of products) {
            const moved = result.products.find(p => p.id === original.id);
            expect(moved?.id).toBe(original.id);
            expect(moved?.name).toBe(original.name);
            expect(moved?.price).toBe(original.price);
            expect(moved?.seller_id).toBe(original.seller_id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: Success is true only when all products are moved', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        fc.boolean(),
        (products, targetCategory, includeFakeId) => {
          const productIds = products.map(p => p.id);
          if (includeFakeId) {
            productIds.push('fake-id-that-does-not-exist');
          }
          
          const result = simulateBulkMove(products, productIds, targetCategory, null);
          
          // Success should be true only if no failures
          expect(result.success).toBe(result.failedProducts.length === 0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: category-inventory-improvements, Property 17: Bulk Copy Operation Correctness**
 * **Validates: Requirements 5.8, 5.9**
 * 
 * For any set of selected products and target category/subcategory, after a copy operation,
 * the system SHALL create exact duplicates with the target category assignment while
 * preserving the originals in their current location.
 */
describe('Bulk Copy Operation Correctness Property Tests', () => {
  it('Property 17: All copied products have target category', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        fc.option(categoryNameArb, { nil: null }),
        (products, targetCategory, targetSubcategory) => {
          const productIds = products.map(p => p.id);
          
          const result = simulateBulkCopy(products, productIds, targetCategory, targetSubcategory);
          
          // All copied products should have the target category
          for (const copied of result.copiedProducts) {
            expect(copied.category).toBe(targetCategory);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 17: All copied products have target subcategory', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        fc.option(categoryNameArb, { nil: null }),
        (products, targetCategory, targetSubcategory) => {
          const productIds = products.map(p => p.id);
          
          const result = simulateBulkCopy(products, productIds, targetCategory, targetSubcategory);
          
          // All copied products should have the target subcategory
          for (const copied of result.copiedProducts) {
            expect(copied.subcategory).toBe(targetSubcategory);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 17: Original products are preserved unchanged', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        (products, targetCategory) => {
          const productIds = products.map(p => p.id);
          
          const result = simulateBulkCopy(products, productIds, targetCategory, null);
          
          // Original products should be unchanged
          for (const original of products) {
            const preserved = result.originalProducts.find(p => p.id === original.id);
            expect(preserved).toEqual(original);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 17: Copied count equals number of valid product IDs', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        (products, targetCategory) => {
          const productIds = products.map(p => p.id);
          
          const result = simulateBulkCopy(products, productIds, targetCategory, null);
          
          // Copied count should equal the number of products
          expect(result.copiedCount).toBe(products.length);
          expect(result.copiedProducts.length).toBe(products.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 17: Copied products have different IDs than originals', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        (products, targetCategory) => {
          const productIds = products.map(p => p.id);
          
          const result = simulateBulkCopy(products, productIds, targetCategory, null);
          
          // Copied products should have different IDs
          const originalIds = new Set(products.map(p => p.id));
          for (const copied of result.copiedProducts) {
            expect(originalIds.has(copied.id)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 17: Copied products preserve other properties from originals', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        (products, targetCategory) => {
          const productIds = products.map(p => p.id);
          
          const result = simulateBulkCopy(products, productIds, targetCategory, null);
          
          // Each copied product should have same properties as original (except id, category, subcategory)
          for (let i = 0; i < products.length; i++) {
            const original = products[i];
            // Find the copy (it should be in the same order)
            const copied = result.copiedProducts[i];
            
            expect(copied.name).toBe(original.name);
            expect(copied.price).toBe(original.price);
            expect(copied.seller_id).toBe(original.seller_id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 17: Non-existent product IDs are reported as failed', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        (products, targetCategory, fakeIds) => {
          // Mix real and fake IDs
          const realIds = products.slice(0, 2).map(p => p.id);
          const allIds = [...realIds, ...fakeIds];
          
          const result = simulateBulkCopy(products, allIds, targetCategory, null);
          
          // Failed products should include all fake IDs
          const failedIds = result.failedProducts.map(f => f.id);
          for (const fakeId of fakeIds) {
            expect(failedIds).toContain(fakeId);
          }
          
          // Copied count should equal real IDs count
          expect(result.copiedCount).toBe(realIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 17: Success is true only when all products are copied', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        fc.boolean(),
        (products, targetCategory, includeFakeId) => {
          const productIds = products.map(p => p.id);
          if (includeFakeId) {
            productIds.push('fake-id-that-does-not-exist');
          }
          
          const result = simulateBulkCopy(products, productIds, targetCategory, null);
          
          // Success should be true only if no failures
          expect(result.success).toBe(result.failedProducts.length === 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 17: Total products after copy equals original + copied', () => {
    fc.assert(
      fc.property(
        productsArrayArb,
        categoryNameArb,
        (products, targetCategory) => {
          const productIds = products.map(p => p.id);
          
          const result = simulateBulkCopy(products, productIds, targetCategory, null);
          
          // Total should be original + copied
          const totalAfter = result.originalProducts.length + result.copiedProducts.length;
          expect(totalAfter).toBe(products.length * 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
