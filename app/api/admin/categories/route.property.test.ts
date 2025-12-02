import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Helper types for testing category deletion logic
 */
interface Product {
  id: string;
  category: string | null;
  subcategory: string | null;
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

/**
 * Pure function that simulates category deletion orphan handling logic
 * This mirrors the logic in the DELETE handler
 */
function simulateCategoryDeletion(
  categoryToDelete: Category,
  products: Product[],
  subcategories: Subcategory[]
): { orphanedProducts: Product[]; orphanedCount: number } {
  const categoryNameLower = categoryToDelete.name.toLowerCase().trim();
  
  // Find products that belong to this category
  const orphanedProducts = products
    .filter(p => p.category && p.category.toLowerCase().trim() === categoryNameLower)
    .map(p => ({
      ...p,
      category: null,
      subcategory: null
    }));

  return {
    orphanedProducts,
    orphanedCount: orphanedProducts.length
  };
}

/**
 * Pure function that simulates subcategory deletion logic
 * This mirrors the logic in the DELETE handler
 */
function simulateSubcategoryDeletion(
  subcategoryToDelete: Subcategory,
  parentCategory: Category,
  products: Product[]
): { affectedProducts: Product[]; affectedCount: number } {
  const subcategoryNameLower = subcategoryToDelete.name.toLowerCase().trim();
  const categoryNameLower = parentCategory.name.toLowerCase().trim();
  
  // Find products that belong to this subcategory and parent category
  const affectedProducts = products
    .filter(p => 
      p.category && 
      p.subcategory && 
      p.category.toLowerCase().trim() === categoryNameLower &&
      p.subcategory.toLowerCase().trim() === subcategoryNameLower
    )
    .map(p => ({
      ...p,
      subcategory: null
      // category is preserved
    }));

  return {
    affectedProducts,
    affectedCount: affectedProducts.length
  };
}

/**
 * Arbitraries for generating test data
 */
const categoryNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

const categoryArb = fc.record({
  id: fc.uuid(),
  name: categoryNameArb
});

const subcategoryArb = (categoryId: string) => fc.record({
  id: fc.uuid(),
  name: categoryNameArb,
  category_id: fc.constant(categoryId)
});

const productArb = (categoryName: string | null, subcategoryName: string | null) => fc.record({
  id: fc.uuid(),
  category: fc.constant(categoryName),
  subcategory: fc.constant(subcategoryName)
});

/**
 * **Feature: category-inventory-improvements, Property 10: Category Deletion Orphan Handling**
 * **Validates: Requirements 4.1**
 * 
 * For any category with products, when the category is deleted, all products from that
 * category SHALL be moved to "Uncategorized" with null category and subcategory values.
 */
describe('Category Deletion Orphan Handling Property Tests', () => {
  it('Property 10: All products in deleted category have null category after deletion', () => {
    fc.assert(
      fc.property(
        categoryArb,
        fc.integer({ min: 0, max: 20 }),
        (category, productCount) => {
          // Generate products that belong to this category
          const products: Product[] = Array.from({ length: productCount }, (_, i) => ({
            id: `product-${i}`,
            category: category.name,
            subcategory: i % 2 === 0 ? `subcategory-${i}` : null
          }));

          const result = simulateCategoryDeletion(category, products, []);

          // All orphaned products should have null category
          result.orphanedProducts.forEach(p => {
            expect(p.category).toBeNull();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: All products in deleted category have null subcategory after deletion', () => {
    fc.assert(
      fc.property(
        categoryArb,
        fc.integer({ min: 0, max: 20 }),
        (category, productCount) => {
          // Generate products with subcategories
          const products: Product[] = Array.from({ length: productCount }, (_, i) => ({
            id: `product-${i}`,
            category: category.name,
            subcategory: `subcategory-${i}`
          }));

          const result = simulateCategoryDeletion(category, products, []);

          // All orphaned products should have null subcategory
          result.orphanedProducts.forEach(p => {
            expect(p.subcategory).toBeNull();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Orphaned count equals number of products in category', () => {
    fc.assert(
      fc.property(
        categoryArb,
        fc.integer({ min: 0, max: 20 }),
        (category, productCount) => {
          const products: Product[] = Array.from({ length: productCount }, (_, i) => ({
            id: `product-${i}`,
            category: category.name,
            subcategory: null
          }));

          const result = simulateCategoryDeletion(category, products, []);

          expect(result.orphanedCount).toBe(productCount);
          expect(result.orphanedProducts.length).toBe(productCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Products in other categories are not affected', () => {
    fc.assert(
      fc.property(
        categoryArb,
        categoryArb,
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (categoryToDelete, otherCategory, deleteCount, otherCount) => {
          // Skip if categories have same name (case-insensitive)
          if (categoryToDelete.name.toLowerCase().trim() === otherCategory.name.toLowerCase().trim()) {
            return true;
          }

          const productsToDelete: Product[] = Array.from({ length: deleteCount }, (_, i) => ({
            id: `delete-${i}`,
            category: categoryToDelete.name,
            subcategory: null
          }));

          const otherProducts: Product[] = Array.from({ length: otherCount }, (_, i) => ({
            id: `other-${i}`,
            category: otherCategory.name,
            subcategory: null
          }));

          const allProducts = [...productsToDelete, ...otherProducts];
          const result = simulateCategoryDeletion(categoryToDelete, allProducts, []);

          // Only products from deleted category should be orphaned
          expect(result.orphanedCount).toBe(deleteCount);
          
          // Orphaned products should only be from the deleted category
          result.orphanedProducts.forEach(p => {
            expect(productsToDelete.some(dp => dp.id === p.id)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Category matching is case-insensitive', () => {
    fc.assert(
      fc.property(
        categoryNameArb,
        fc.integer({ min: 1, max: 10 }),
        (baseName, productCount) => {
          const category: Category = { id: 'cat-1', name: baseName };
          
          // Create products with various case variations
          const products: Product[] = Array.from({ length: productCount }, (_, i) => ({
            id: `product-${i}`,
            category: i % 3 === 0 ? baseName.toUpperCase() : 
                      i % 3 === 1 ? baseName.toLowerCase() : baseName,
            subcategory: null
          }));

          const result = simulateCategoryDeletion(category, products, []);

          // All products should be orphaned regardless of case
          expect(result.orphanedCount).toBe(productCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: category-inventory-improvements, Property 11: Subcategory Deletion Parent Preservation**
 * **Validates: Requirements 4.2**
 * 
 * For any subcategory with products, when the subcategory is deleted, all products
 * SHALL retain their parent category assignment but have null subcategory values.
 */
describe('Subcategory Deletion Parent Preservation Property Tests', () => {
  it('Property 11: Products retain parent category after subcategory deletion', () => {
    fc.assert(
      fc.property(
        categoryArb,
        categoryNameArb,
        fc.integer({ min: 1, max: 20 }),
        (parentCategory, subcategoryName, productCount) => {
          const subcategory: Subcategory = {
            id: 'sub-1',
            name: subcategoryName,
            category_id: parentCategory.id
          };

          const products: Product[] = Array.from({ length: productCount }, (_, i) => ({
            id: `product-${i}`,
            category: parentCategory.name,
            subcategory: subcategoryName
          }));

          const result = simulateSubcategoryDeletion(subcategory, parentCategory, products);

          // All affected products should retain their category
          result.affectedProducts.forEach(p => {
            expect(p.category).toBe(parentCategory.name);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Products have null subcategory after subcategory deletion', () => {
    fc.assert(
      fc.property(
        categoryArb,
        categoryNameArb,
        fc.integer({ min: 1, max: 20 }),
        (parentCategory, subcategoryName, productCount) => {
          const subcategory: Subcategory = {
            id: 'sub-1',
            name: subcategoryName,
            category_id: parentCategory.id
          };

          const products: Product[] = Array.from({ length: productCount }, (_, i) => ({
            id: `product-${i}`,
            category: parentCategory.name,
            subcategory: subcategoryName
          }));

          const result = simulateSubcategoryDeletion(subcategory, parentCategory, products);

          // All affected products should have null subcategory
          result.affectedProducts.forEach(p => {
            expect(p.subcategory).toBeNull();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Affected count equals products in subcategory', () => {
    fc.assert(
      fc.property(
        categoryArb,
        categoryNameArb,
        fc.integer({ min: 0, max: 20 }),
        (parentCategory, subcategoryName, productCount) => {
          const subcategory: Subcategory = {
            id: 'sub-1',
            name: subcategoryName,
            category_id: parentCategory.id
          };

          const products: Product[] = Array.from({ length: productCount }, (_, i) => ({
            id: `product-${i}`,
            category: parentCategory.name,
            subcategory: subcategoryName
          }));

          const result = simulateSubcategoryDeletion(subcategory, parentCategory, products);

          expect(result.affectedCount).toBe(productCount);
          expect(result.affectedProducts.length).toBe(productCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Products in other subcategories are not affected', () => {
    fc.assert(
      fc.property(
        categoryArb,
        categoryNameArb,
        categoryNameArb,
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (parentCategory, subcatToDelete, otherSubcat, deleteCount, otherCount) => {
          // Skip if subcategories have same name
          if (subcatToDelete.toLowerCase().trim() === otherSubcat.toLowerCase().trim()) {
            return true;
          }

          const subcategory: Subcategory = {
            id: 'sub-1',
            name: subcatToDelete,
            category_id: parentCategory.id
          };

          const productsToAffect: Product[] = Array.from({ length: deleteCount }, (_, i) => ({
            id: `affect-${i}`,
            category: parentCategory.name,
            subcategory: subcatToDelete
          }));

          const otherProducts: Product[] = Array.from({ length: otherCount }, (_, i) => ({
            id: `other-${i}`,
            category: parentCategory.name,
            subcategory: otherSubcat
          }));

          const allProducts = [...productsToAffect, ...otherProducts];
          const result = simulateSubcategoryDeletion(subcategory, parentCategory, allProducts);

          // Only products from deleted subcategory should be affected
          expect(result.affectedCount).toBe(deleteCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Products in different categories are not affected', () => {
    fc.assert(
      fc.property(
        categoryArb,
        categoryArb,
        categoryNameArb,
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (parentCategory, otherCategory, subcategoryName, targetCount, otherCount) => {
          // Skip if categories have same name
          if (parentCategory.name.toLowerCase().trim() === otherCategory.name.toLowerCase().trim()) {
            return true;
          }

          const subcategory: Subcategory = {
            id: 'sub-1',
            name: subcategoryName,
            category_id: parentCategory.id
          };

          const targetProducts: Product[] = Array.from({ length: targetCount }, (_, i) => ({
            id: `target-${i}`,
            category: parentCategory.name,
            subcategory: subcategoryName
          }));

          // Products in different category with same subcategory name
          const otherProducts: Product[] = Array.from({ length: otherCount }, (_, i) => ({
            id: `other-${i}`,
            category: otherCategory.name,
            subcategory: subcategoryName
          }));

          const allProducts = [...targetProducts, ...otherProducts];
          const result = simulateSubcategoryDeletion(subcategory, parentCategory, allProducts);

          // Only products from the correct category should be affected
          expect(result.affectedCount).toBe(targetCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Subcategory matching is case-insensitive', () => {
    fc.assert(
      fc.property(
        categoryArb,
        categoryNameArb,
        fc.integer({ min: 1, max: 10 }),
        (parentCategory, subcategoryName, productCount) => {
          const subcategory: Subcategory = {
            id: 'sub-1',
            name: subcategoryName,
            category_id: parentCategory.id
          };

          // Create products with various case variations
          const products: Product[] = Array.from({ length: productCount }, (_, i) => ({
            id: `product-${i}`,
            category: parentCategory.name,
            subcategory: i % 3 === 0 ? subcategoryName.toUpperCase() : 
                         i % 3 === 1 ? subcategoryName.toLowerCase() : subcategoryName
          }));

          const result = simulateSubcategoryDeletion(subcategory, parentCategory, products);

          // All products should be affected regardless of case
          expect(result.affectedCount).toBe(productCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: category-inventory-improvements, Property 13: Delete Operation Count Accuracy**
 * **Validates: Requirements 4.8**
 * 
 * For any delete operation on a category or subcategory, the system SHALL recalculate
 * and display accurate product counts for all affected categories after the operation completes.
 */
describe('Delete Operation Count Accuracy Property Tests', () => {
  /**
   * Helper function to calculate product counts per category
   */
  function calculateCategoryCounts(products: Product[]): Map<string, number> {
    const counts = new Map<string, number>();
    products.forEach(p => {
      if (p.category) {
        const key = p.category.toLowerCase().trim();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    return counts;
  }

  /**
   * Helper function to calculate product counts per subcategory
   */
  function calculateSubcategoryCounts(products: Product[]): Map<string, number> {
    const counts = new Map<string, number>();
    products.forEach(p => {
      if (p.category && p.subcategory) {
        const key = `${p.category.toLowerCase().trim()}:${p.subcategory.toLowerCase().trim()}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    return counts;
  }

  it('Property 13: Category deletion returns accurate orphaned product count', () => {
    fc.assert(
      fc.property(
        categoryArb,
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        (categoryToDelete, targetCount, otherCount) => {
          // Products in the category to delete
          const targetProducts: Product[] = Array.from({ length: targetCount }, (_, i) => ({
            id: `target-${i}`,
            category: categoryToDelete.name,
            subcategory: i % 2 === 0 ? `sub-${i}` : null
          }));

          // Products in other categories
          const otherProducts: Product[] = Array.from({ length: otherCount }, (_, i) => ({
            id: `other-${i}`,
            category: `other-category-${i}`,
            subcategory: null
          }));

          const allProducts = [...targetProducts, ...otherProducts];
          const result = simulateCategoryDeletion(categoryToDelete, allProducts, []);

          // The orphaned count should exactly match the number of products in the deleted category
          expect(result.orphanedCount).toBe(targetCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: Subcategory deletion returns accurate affected product count', () => {
    fc.assert(
      fc.property(
        categoryArb,
        categoryNameArb,
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        (parentCategory, subcategoryName, targetCount, otherCount) => {
          const subcategory: Subcategory = {
            id: 'sub-1',
            name: subcategoryName,
            category_id: parentCategory.id
          };

          // Products in the subcategory to delete
          const targetProducts: Product[] = Array.from({ length: targetCount }, (_, i) => ({
            id: `target-${i}`,
            category: parentCategory.name,
            subcategory: subcategoryName
          }));

          // Products in other subcategories of the same category
          const otherProducts: Product[] = Array.from({ length: otherCount }, (_, i) => ({
            id: `other-${i}`,
            category: parentCategory.name,
            subcategory: `other-subcategory-${i}`
          }));

          const allProducts = [...targetProducts, ...otherProducts];
          const result = simulateSubcategoryDeletion(subcategory, parentCategory, allProducts);

          // The affected count should exactly match the number of products in the deleted subcategory
          expect(result.affectedCount).toBe(targetCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: After category deletion, category count decreases by orphaned amount', () => {
    fc.assert(
      fc.property(
        categoryArb,
        fc.integer({ min: 1, max: 30 }),
        (categoryToDelete, productCount) => {
          const products: Product[] = Array.from({ length: productCount }, (_, i) => ({
            id: `product-${i}`,
            category: categoryToDelete.name,
            subcategory: null
          }));

          // Count before deletion
          const countsBefore = calculateCategoryCounts(products);
          const categoryKey = categoryToDelete.name.toLowerCase().trim();
          const countBefore = countsBefore.get(categoryKey) || 0;

          // Simulate deletion
          const result = simulateCategoryDeletion(categoryToDelete, products, []);

          // Count after deletion (orphaned products have null category)
          const countsAfter = calculateCategoryCounts(result.orphanedProducts);
          const countAfter = countsAfter.get(categoryKey) || 0;

          // After deletion, the category should have 0 products
          expect(countAfter).toBe(0);
          // The orphaned count should equal the original count
          expect(result.orphanedCount).toBe(countBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: After subcategory deletion, subcategory count becomes zero while category count remains', () => {
    fc.assert(
      fc.property(
        categoryArb,
        categoryNameArb,
        fc.integer({ min: 1, max: 30 }),
        (parentCategory, subcategoryName, productCount) => {
          const subcategory: Subcategory = {
            id: 'sub-1',
            name: subcategoryName,
            category_id: parentCategory.id
          };

          const products: Product[] = Array.from({ length: productCount }, (_, i) => ({
            id: `product-${i}`,
            category: parentCategory.name,
            subcategory: subcategoryName
          }));

          // Count before deletion
          const categoryCountsBefore = calculateCategoryCounts(products);
          const subcategoryCountsBefore = calculateSubcategoryCounts(products);
          
          const categoryKey = parentCategory.name.toLowerCase().trim();
          const subcategoryKey = `${categoryKey}:${subcategoryName.toLowerCase().trim()}`;
          
          const categoryCountBefore = categoryCountsBefore.get(categoryKey) || 0;
          const subcategoryCountBefore = subcategoryCountsBefore.get(subcategoryKey) || 0;

          // Simulate deletion
          const result = simulateSubcategoryDeletion(subcategory, parentCategory, products);

          // Count after deletion
          const categoryCountsAfter = calculateCategoryCounts(result.affectedProducts);
          const subcategoryCountsAfter = calculateSubcategoryCounts(result.affectedProducts);
          
          const categoryCountAfter = categoryCountsAfter.get(categoryKey) || 0;
          const subcategoryCountAfter = subcategoryCountsAfter.get(subcategoryKey) || 0;

          // Category count should remain the same (products still have category)
          expect(categoryCountAfter).toBe(categoryCountBefore);
          // Subcategory count should be 0 (all products have null subcategory)
          expect(subcategoryCountAfter).toBe(0);
          // Affected count should equal original subcategory count
          expect(result.affectedCount).toBe(subcategoryCountBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: Sum of orphaned + remaining equals total products', () => {
    fc.assert(
      fc.property(
        categoryArb,
        categoryArb,
        fc.integer({ min: 0, max: 25 }),
        fc.integer({ min: 0, max: 25 }),
        (categoryToDelete, otherCategory, deleteCount, otherCount) => {
          // Skip if categories have same name
          if (categoryToDelete.name.toLowerCase().trim() === otherCategory.name.toLowerCase().trim()) {
            return true;
          }

          const productsToDelete: Product[] = Array.from({ length: deleteCount }, (_, i) => ({
            id: `delete-${i}`,
            category: categoryToDelete.name,
            subcategory: null
          }));

          const otherProducts: Product[] = Array.from({ length: otherCount }, (_, i) => ({
            id: `other-${i}`,
            category: otherCategory.name,
            subcategory: null
          }));

          const allProducts = [...productsToDelete, ...otherProducts];
          const totalBefore = allProducts.length;

          const result = simulateCategoryDeletion(categoryToDelete, allProducts, []);

          // Orphaned products + products not affected should equal total
          const remainingProducts = allProducts.filter(p => 
            !p.category || p.category.toLowerCase().trim() !== categoryToDelete.name.toLowerCase().trim()
          );

          expect(result.orphanedCount + remainingProducts.length).toBe(totalBefore);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: category-inventory-improvements, Property 12: Drag and Drop Uncategorized Products**
 * **Validates: Requirements 4.5**
 * 
 * For any product in the "Uncategorized" section, the product SHALL have functional
 * drag handlers that allow it to be dropped into any category or subcategory.
 */
describe('Drag and Drop Uncategorized Products Property Tests', () => {
  /**
   * Interface for uncategorized product
   */
  interface UncategorizedProduct {
    id: string;
    name: string;
    category: null;
    subcategory: null;
  }

  /**
   * Pure function that simulates assigning a category to an uncategorized product
   * This mirrors the logic in the updateProductCategory handler
   */
  function assignCategoryToProduct(
    product: UncategorizedProduct,
    targetCategory: Category,
    targetSubcategory: Subcategory | null
  ): Product {
    return {
      id: product.id,
      category: targetCategory.name,
      subcategory: targetSubcategory ? targetSubcategory.name : null
    };
  }

  /**
   * Pure function that validates if a product can be dropped into a category
   */
  function canDropIntoCategory(
    product: UncategorizedProduct,
    targetCategory: Category
  ): boolean {
    // An uncategorized product can always be dropped into any valid category
    return product.category === null && 
           targetCategory.id !== undefined && 
           targetCategory.name.trim().length > 0;
  }

  /**
   * Pure function that validates if a product can be dropped into a subcategory
   */
  function canDropIntoSubcategory(
    product: UncategorizedProduct,
    targetSubcategory: Subcategory,
    parentCategory: Category
  ): boolean {
    // An uncategorized product can be dropped into any valid subcategory
    return product.category === null && 
           targetSubcategory.id !== undefined && 
           targetSubcategory.name.trim().length > 0 &&
           targetSubcategory.category_id === parentCategory.id;
  }

  /**
   * Arbitrary for generating uncategorized products
   */
  const uncategorizedProductArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    category: fc.constant(null as null),
    subcategory: fc.constant(null as null)
  });

  it('Property 12: Uncategorized products can be dropped into any category', () => {
    fc.assert(
      fc.property(
        uncategorizedProductArb,
        categoryArb,
        (product, targetCategory) => {
          // Verify the product can be dropped into the category
          const canDrop = canDropIntoCategory(product, targetCategory);
          expect(canDrop).toBe(true);

          // Verify the assignment produces correct result
          const result = assignCategoryToProduct(product, targetCategory, null);
          
          // Product should now have the target category
          expect(result.category).toBe(targetCategory.name);
          // Subcategory should be null when dropping directly into category
          expect(result.subcategory).toBeNull();
          // Product ID should be preserved
          expect(result.id).toBe(product.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Uncategorized products can be dropped into any subcategory', () => {
    fc.assert(
      fc.property(
        uncategorizedProductArb,
        categoryArb,
        categoryNameArb,
        (product, parentCategory, subcategoryName) => {
          const targetSubcategory: Subcategory = {
            id: `sub-${parentCategory.id}`,
            name: subcategoryName,
            category_id: parentCategory.id
          };

          // Verify the product can be dropped into the subcategory
          const canDrop = canDropIntoSubcategory(product, targetSubcategory, parentCategory);
          expect(canDrop).toBe(true);

          // Verify the assignment produces correct result
          const result = assignCategoryToProduct(product, parentCategory, targetSubcategory);
          
          // Product should have both category and subcategory
          expect(result.category).toBe(parentCategory.name);
          expect(result.subcategory).toBe(targetSubcategory.name);
          // Product ID should be preserved
          expect(result.id).toBe(product.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: After drop, product is no longer uncategorized', () => {
    fc.assert(
      fc.property(
        uncategorizedProductArb,
        categoryArb,
        fc.boolean(),
        categoryNameArb,
        (product, targetCategory, useSubcategory, subcategoryName) => {
          // Verify product starts as uncategorized
          expect(product.category).toBeNull();
          expect(product.subcategory).toBeNull();

          let result: Product;
          if (useSubcategory) {
            const targetSubcategory: Subcategory = {
              id: `sub-${targetCategory.id}`,
              name: subcategoryName,
              category_id: targetCategory.id
            };
            result = assignCategoryToProduct(product, targetCategory, targetSubcategory);
          } else {
            result = assignCategoryToProduct(product, targetCategory, null);
          }

          // After drop, product should have a category (not null)
          expect(result.category).not.toBeNull();
          expect(result.category).toBe(targetCategory.name);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Multiple uncategorized products can be assigned to same category', () => {
    fc.assert(
      fc.property(
        fc.array(uncategorizedProductArb, { minLength: 1, maxLength: 20 }),
        categoryArb,
        (products, targetCategory) => {
          // Assign all products to the same category
          const results = products.map(p => assignCategoryToProduct(p, targetCategory, null));

          // All products should have the same category
          results.forEach(result => {
            expect(result.category).toBe(targetCategory.name);
          });

          // All product IDs should be unique and preserved
          const originalIds = new Set(products.map(p => p.id));
          const resultIds = new Set(results.map(r => r.id));
          expect(resultIds.size).toBe(originalIds.size);
          
          results.forEach(result => {
            expect(originalIds.has(result.id)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Dropping into subcategory sets both category and subcategory', () => {
    fc.assert(
      fc.property(
        uncategorizedProductArb,
        categoryArb,
        categoryNameArb,
        (product, parentCategory, subcategoryName) => {
          const targetSubcategory: Subcategory = {
            id: `sub-${parentCategory.id}`,
            name: subcategoryName,
            category_id: parentCategory.id
          };

          const result = assignCategoryToProduct(product, parentCategory, targetSubcategory);

          // Both category and subcategory should be set
          expect(result.category).toBe(parentCategory.name);
          expect(result.subcategory).toBe(targetSubcategory.name);
          
          // Neither should be null
          expect(result.category).not.toBeNull();
          expect(result.subcategory).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Dropping into category only sets category, subcategory remains null', () => {
    fc.assert(
      fc.property(
        uncategorizedProductArb,
        categoryArb,
        (product, targetCategory) => {
          const result = assignCategoryToProduct(product, targetCategory, null);

          // Category should be set
          expect(result.category).toBe(targetCategory.name);
          // Subcategory should be null
          expect(result.subcategory).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
