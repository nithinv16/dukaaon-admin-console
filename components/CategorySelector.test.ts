import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  filterCategories, 
  filterSubcategoriesByCategory,
  Category,
  Subcategory 
} from './CategorySelector';

/**
 * **Feature: category-inventory-improvements, Property 1: Category Filtering Correctness**
 * **Validates: Requirements 1.3**
 * 
 * For any input string typed in the category field, the filtered results SHALL only 
 * contain categories whose names include the input string as a substring (case-insensitive),
 * and SHALL NOT display incremental typing characters.
 */
describe('Category Filtering Property Tests', () => {
  // Arbitrary for generating valid category objects
  const categoryArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    slug: fc.string({ minLength: 1, maxLength: 50 })
  });

  const categoriesArb = fc.array(categoryArb, { minLength: 0, maxLength: 20 });
  const searchTermArb = fc.string({ minLength: 0, maxLength: 30 });

  it('Property 1: All filtered results contain the search term as substring (case-insensitive)', () => {
    fc.assert(
      fc.property(categoriesArb, searchTermArb, (categories, searchTerm) => {
        const filtered = filterCategories(categories, searchTerm);
        
        // If search term is empty, all categories should be returned
        if (!searchTerm || searchTerm.trim() === '') {
          expect(filtered).toEqual(categories);
          return;
        }

        const normalizedSearch = searchTerm.toLowerCase().trim();
        
        // Every filtered result must contain the search term
        for (const category of filtered) {
          expect(category.name.toLowerCase()).toContain(normalizedSearch);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: No matching categories are excluded from results', () => {
    fc.assert(
      fc.property(categoriesArb, searchTermArb, (categories, searchTerm) => {
        const filtered = filterCategories(categories, searchTerm);
        
        // If search term is empty, all categories should be returned
        if (!searchTerm || searchTerm.trim() === '') {
          expect(filtered.length).toBe(categories.length);
          return;
        }

        const normalizedSearch = searchTerm.toLowerCase().trim();
        
        // Count how many categories should match
        const expectedMatches = categories.filter(c => 
          c.name.toLowerCase().includes(normalizedSearch)
        );
        
        // Filtered results should have same count as expected matches
        expect(filtered.length).toBe(expectedMatches.length);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: Filtered results are a subset of original categories', () => {
    fc.assert(
      fc.property(categoriesArb, searchTermArb, (categories, searchTerm) => {
        const filtered = filterCategories(categories, searchTerm);
        
        // Every filtered category must exist in original list
        for (const filteredCat of filtered) {
          const exists = categories.some(c => 
            c.id === filteredCat.id && 
            c.name === filteredCat.name && 
            c.slug === filteredCat.slug
          );
          expect(exists).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: Empty search returns all categories', () => {
    fc.assert(
      fc.property(categoriesArb, (categories) => {
        // Test with empty string
        expect(filterCategories(categories, '')).toEqual(categories);
        // Test with whitespace only
        expect(filterCategories(categories, '   ')).toEqual(categories);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: Filtering is case-insensitive', () => {
    fc.assert(
      fc.property(categoriesArb, searchTermArb, (categories, searchTerm) => {
        if (!searchTerm || searchTerm.trim() === '') return;

        const lowerResult = filterCategories(categories, searchTerm.toLowerCase());
        const upperResult = filterCategories(categories, searchTerm.toUpperCase());
        const mixedResult = filterCategories(categories, searchTerm);
        
        // All case variations should produce same results
        expect(lowerResult.length).toBe(upperResult.length);
        expect(lowerResult.length).toBe(mixedResult.length);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: Results do not contain incremental typing characters', () => {
    fc.assert(
      fc.property(categoriesArb, searchTermArb, (categories, searchTerm) => {
        const filtered = filterCategories(categories, searchTerm);
        
        // Results should only contain actual category objects, not partial strings
        for (const result of filtered) {
          // Each result must be a valid category object with all required fields
          expect(result).toHaveProperty('id');
          expect(result).toHaveProperty('name');
          expect(result).toHaveProperty('slug');
          expect(typeof result.id).toBe('string');
          expect(typeof result.name).toBe('string');
          expect(typeof result.slug).toBe('string');
        }
      }),
      { numRuns: 100 }
    );
  });
});



/**
 * **Feature: category-inventory-improvements, Property 2: Subcategory Filtering by Category**
 * **Validates: Requirements 1.2**
 * 
 * For any selected category, the subcategory dropdown SHALL only display subcategories 
 * where the `category_id` matches the selected category's `id`.
 */
describe('Subcategory Filtering Property Tests', () => {
  // Arbitrary for generating valid subcategory objects
  const subcategoryArb = (categoryIds: string[]) => fc.record({
    id: fc.uuid(),
    category_id: categoryIds.length > 0 
      ? fc.constantFrom(...categoryIds) 
      : fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    slug: fc.string({ minLength: 1, maxLength: 50 })
  });

  it('Property 2: All filtered subcategories belong to the selected category', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        fc.uuid(),
        (categoryIds, selectedCategoryId) => {
          // Generate subcategories with various category_ids
          const allCategoryIds = [...categoryIds, selectedCategoryId];
          const subcategories: Subcategory[] = allCategoryIds.flatMap((catId, idx) => 
            Array.from({ length: 3 }, (_, i) => ({
              id: `sub-${idx}-${i}`,
              category_id: catId,
              name: `Subcategory ${idx}-${i}`,
              slug: `subcategory-${idx}-${i}`
            }))
          );

          const filtered = filterSubcategoriesByCategory(subcategories, selectedCategoryId);

          // Every filtered subcategory must have the selected category_id
          for (const sub of filtered) {
            expect(sub.category_id).toBe(selectedCategoryId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: No matching subcategories are excluded', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        fc.uuid(),
        (categoryIds, selectedCategoryId) => {
          // Generate subcategories with various category_ids
          const allCategoryIds = [...categoryIds, selectedCategoryId];
          const subcategories: Subcategory[] = allCategoryIds.flatMap((catId, idx) => 
            Array.from({ length: 2 }, (_, i) => ({
              id: `sub-${idx}-${i}`,
              category_id: catId,
              name: `Subcategory ${idx}-${i}`,
              slug: `subcategory-${idx}-${i}`
            }))
          );

          const filtered = filterSubcategoriesByCategory(subcategories, selectedCategoryId);

          // Count expected matches
          const expectedCount = subcategories.filter(s => s.category_id === selectedCategoryId).length;
          
          expect(filtered.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Empty result when no category is selected', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.uuid(),
          category_id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          slug: fc.string({ minLength: 1, maxLength: 50 })
        }), { minLength: 0, maxLength: 10 }),
        (subcategories) => {
          // When categoryId is undefined, should return empty array
          expect(filterSubcategoriesByCategory(subcategories, undefined)).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Filtered results are a subset of original subcategories', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.uuid(),
          category_id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          slug: fc.string({ minLength: 1, maxLength: 50 })
        }), { minLength: 0, maxLength: 20 }),
        fc.uuid(),
        (subcategories, categoryId) => {
          const filtered = filterSubcategoriesByCategory(subcategories, categoryId);

          // Every filtered subcategory must exist in original list
          for (const filteredSub of filtered) {
            const exists = subcategories.some(s => 
              s.id === filteredSub.id && 
              s.category_id === filteredSub.category_id &&
              s.name === filteredSub.name && 
              s.slug === filteredSub.slug
            );
            expect(exists).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Subcategories from other categories are excluded', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (categoryId1, categoryId2) => {
          // Ensure we have two different category IDs
          fc.pre(categoryId1 !== categoryId2);

          const subcategories: Subcategory[] = [
            { id: 'sub-1', category_id: categoryId1, name: 'Sub 1', slug: 'sub-1' },
            { id: 'sub-2', category_id: categoryId2, name: 'Sub 2', slug: 'sub-2' },
            { id: 'sub-3', category_id: categoryId1, name: 'Sub 3', slug: 'sub-3' },
          ];

          const filtered = filterSubcategoriesByCategory(subcategories, categoryId1);

          // Should not contain subcategories from categoryId2
          const hasOtherCategory = filtered.some(s => s.category_id === categoryId2);
          expect(hasOtherCategory).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
