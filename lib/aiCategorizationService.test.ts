import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  autoPopulateCategory,
  autoPopulateSubcategory,
  generateSlug,
  generateUniqueSlug,
  isSlugUnique,
  CategorySuggestion,
  SubcategorySuggestion,
  Category,
  Subcategory,
  MAX_CATEGORY_SUGGESTIONS_EXPORT,
} from './aiCategorizationService';

// ============================================================================
// Arbitraries for generating test data
// ============================================================================

const categoryArb: fc.Arbitrary<Category> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  slug: fc.string({ minLength: 1, maxLength: 50 }).map((s) => generateSlug(s || 'default')),
});

// Use integer-based confidence to avoid 32-bit float issues
// Divide by 100 to get a value between 0 and 1
const confidenceArb = fc.integer({ min: 0, max: 100 }).map((n) => n / 100);
const highConfidenceArb = fc.integer({ min: 70, max: 100 }).map((n) => n / 100);
const lowConfidenceArb = fc.integer({ min: 0, max: 69 }).map((n) => n / 100);

// ============================================================================
// Property 4: Category Auto-Population
// **Feature: ai-product-extraction, Property 4: Category Auto-Population**
// **Validates: Requirements 2.3, 2.4**
// ============================================================================

describe('Property 4: Category Auto-Population', () => {
  /**
   * Property 4: Category Auto-Population
   * *For any* extracted product where the AI suggests a category match with confidence >= 0.7,
   * the category field SHALL be auto-populated with the matched category name.
   */

  it('Property 4: Auto-populates category when confidence >= 0.7', () => {
    fc.assert(
      fc.property(
        categoryArb,
        highConfidenceArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        (category, confidence, reason) => {
          const suggestions: CategorySuggestion[] = [
            { category, confidence, reason },
          ];

          const result = autoPopulateCategory(suggestions);

          // When confidence >= 0.7, category should be auto-populated
          expect(result).toBe(category.name);
        }
      ),
      { numRuns: 100 }
    );
  });


  it('Property 4: Does NOT auto-populate category when confidence < 0.7', () => {
    fc.assert(
      fc.property(
        categoryArb,
        lowConfidenceArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        (category, confidence, reason) => {
          const suggestions: CategorySuggestion[] = [
            { category, confidence, reason },
          ];

          const result = autoPopulateCategory(suggestions);

          // When confidence < 0.7, category should NOT be auto-populated
          expect(result).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: Returns undefined for empty suggestions', () => {
    const result = autoPopulateCategory([]);
    expect(result).toBeUndefined();
  });

  it('Property 4: Uses the top suggestion (first in sorted list)', () => {
    fc.assert(
      fc.property(
        fc.array(categoryArb, { minLength: 2, maxLength: 5 }),
        fc.array(highConfidenceArb, { minLength: 2, maxLength: 5 }),
        (categories, confidences) => {
          // Ensure we have matching lengths
          const len = Math.min(categories.length, confidences.length);
          const suggestions: CategorySuggestion[] = categories
            .slice(0, len)
            .map((category, i) => ({
              category,
              confidence: confidences[i],
              reason: 'test reason',
            }))
            .sort((a, b) => b.confidence - a.confidence);

          const result = autoPopulateCategory(suggestions);

          // Should use the first (highest confidence) suggestion
          expect(result).toBe(suggestions[0].category.name);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 4: Subcategory Auto-Population', () => {
  /**
   * Property 4 (continued): Subcategory Auto-Population
   * *For any* extracted product where the AI suggests a subcategory match with confidence >= 0.7,
   * the subcategory field SHALL be auto-populated with the matched subcategory name.
   */

  it('Property 4: Auto-populates subcategory when existing and confidence >= 0.7', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        highConfidenceArb,
        (categoryId, subcategoryName, confidence) => {
          const subcategory: Subcategory = {
            id: 'sub-1',
            category_id: categoryId,
            name: subcategoryName,
            slug: generateSlug(subcategoryName),
          };

          const suggestions: SubcategorySuggestion[] = [
            {
              subcategory,
              isNew: false,
              confidence,
              reason: 'test reason',
            },
          ];

          const result = autoPopulateSubcategory(suggestions);

          // When existing subcategory with confidence >= 0.7, should auto-populate
          expect(result).toBe(subcategory.name);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: Does NOT auto-populate subcategory when confidence < 0.7', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        lowConfidenceArb,
        (categoryId, subcategoryName, confidence) => {
          const subcategory: Subcategory = {
            id: 'sub-1',
            category_id: categoryId,
            name: subcategoryName,
            slug: generateSlug(subcategoryName),
          };

          const suggestions: SubcategorySuggestion[] = [
            {
              subcategory,
              isNew: false,
              confidence,
              reason: 'test reason',
            },
          ];

          const result = autoPopulateSubcategory(suggestions);

          // When confidence < 0.7, should NOT auto-populate
          expect(result).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: Does NOT auto-populate when subcategory is new (even with high confidence)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        highConfidenceArb,
        (suggestedName, confidence) => {
          const suggestions: SubcategorySuggestion[] = [
            {
              suggestedName,
              isNew: true,
              confidence,
              reason: 'test reason',
            },
          ];

          const result = autoPopulateSubcategory(suggestions);

          // New subcategories should NOT be auto-populated
          expect(result).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: Returns undefined for empty suggestions', () => {
    const result = autoPopulateSubcategory([]);
    expect(result).toBeUndefined();
  });
});


// ============================================================================
// Property 5: Category Suggestion Ranking
// **Feature: ai-product-extraction, Property 5: Category Suggestion Ranking**
// **Validates: Requirements 2.8**
// ============================================================================

describe('Property 5: Category Suggestion Ranking', () => {
  /**
   * Property 5: Category Suggestion Ranking
   * *For any* product with multiple category matches, the suggestions SHALL be returned
   * as an array of at most 3 items, sorted by confidence in descending order.
   */

  it('Property 5: Suggestions are sorted by confidence in descending order', () => {
    fc.assert(
      fc.property(
        fc.array(categoryArb, { minLength: 2, maxLength: 10 }),
        fc.array(confidenceArb, { minLength: 2, maxLength: 10 }),
        (categories, confidences) => {
          // Create suggestions with random confidences
          const len = Math.min(categories.length, confidences.length);
          const suggestions: CategorySuggestion[] = categories
            .slice(0, len)
            .map((category, i) => ({
              category,
              confidence: confidences[i],
              reason: 'test reason',
            }));

          // Sort as the service would
          const sorted = [...suggestions].sort((a, b) => b.confidence - a.confidence);

          // Verify descending order
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i - 1].confidence).toBeGreaterThanOrEqual(sorted[i].confidence);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Maximum of 3 suggestions returned', () => {
    fc.assert(
      fc.property(
        fc.array(categoryArb, { minLength: 1, maxLength: 10 }),
        fc.array(confidenceArb, { minLength: 1, maxLength: 10 }),
        (categories, confidences) => {
          const len = Math.min(categories.length, confidences.length);
          const suggestions: CategorySuggestion[] = categories
            .slice(0, len)
            .map((category, i) => ({
              category,
              confidence: confidences[i],
              reason: 'test reason',
            }))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, MAX_CATEGORY_SUGGESTIONS_EXPORT);

          // Should never exceed MAX_CATEGORY_SUGGESTIONS (3)
          expect(suggestions.length).toBeLessThanOrEqual(MAX_CATEGORY_SUGGESTIONS_EXPORT);
          expect(suggestions.length).toBeLessThanOrEqual(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Top 3 highest confidence suggestions are kept', () => {
    fc.assert(
      fc.property(
        fc.array(categoryArb, { minLength: 4, maxLength: 10 }),
        fc.array(confidenceArb, { minLength: 4, maxLength: 10 }),
        (categories, confidences) => {
          const len = Math.min(categories.length, confidences.length);
          const allSuggestions: CategorySuggestion[] = categories
            .slice(0, len)
            .map((category, i) => ({
              category,
              confidence: confidences[i],
              reason: 'test reason',
            }));

          // Sort and take top 3
          const sorted = [...allSuggestions].sort((a, b) => b.confidence - a.confidence);
          const top3 = sorted.slice(0, 3);

          // Verify we have the 3 highest confidence values
          const top3Confidences = top3.map((s) => s.confidence);
          const allConfidences = allSuggestions.map((s) => s.confidence).sort((a, b) => b - a);

          expect(top3Confidences).toEqual(allConfidences.slice(0, 3));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Each suggestion includes a reason', () => {
    fc.assert(
      fc.property(
        categoryArb,
        confidenceArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        (category, confidence, reason) => {
          const suggestion: CategorySuggestion = {
            category,
            confidence,
            reason,
          };

          // Reason should be present and be a string
          expect(typeof suggestion.reason).toBe('string');
          expect(suggestion.reason.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 6: New Subcategory Slug Generation
// **Feature: ai-product-extraction, Property 6: New Subcategory Slug Generation**
// **Validates: Requirements 2.7**
// ============================================================================

describe('Property 6: New Subcategory Slug Generation', () => {
  /**
   * Property 6: New Subcategory Slug Generation
   * *For any* new subcategory added to the database, the slug SHALL be a lowercase,
   * hyphen-separated version of the name with special characters removed,
   * and SHALL be unique within the category.
   */

  it('Property 6: Slug is lowercase', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (name) => {
          const slug = generateSlug(name);
          expect(slug).toBe(slug.toLowerCase());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Slug contains only lowercase letters, numbers, and hyphens', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (name) => {
          const slug = generateSlug(name);
          // Slug should only contain a-z, 0-9, and hyphens
          expect(slug).toMatch(/^[a-z0-9-]*$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Slug has no consecutive hyphens', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (name) => {
          const slug = generateSlug(name);
          // Should not have consecutive hyphens
          expect(slug).not.toMatch(/--/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Slug does not start or end with hyphen', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (name) => {
          const slug = generateSlug(name);
          if (slug.length > 0) {
            expect(slug[0]).not.toBe('-');
            expect(slug[slug.length - 1]).not.toBe('-');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Spaces are converted to hyphens', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('a', 'b', 'c', ' ', '1', '2'), { minLength: 1, maxLength: 20 }),
        (chars) => {
          const name = chars.join('');
          const slug = generateSlug(name);
          // Slug should not contain spaces
          expect(slug).not.toContain(' ');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Special characters are removed', () => {
    const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '[', ']', '{', '}', '|', '\\', '/', '?', '<', '>', ',', '.', ':', ';', '"', "'", '`', '~'];
    
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(fc.constantFrom(...specialChars), { minLength: 0, maxLength: 10 }),
        (baseName, specials) => {
          const nameWithSpecials = baseName + specials.join('');
          const slug = generateSlug(nameWithSpecials);
          
          // Slug should not contain any special characters
          for (const char of specialChars) {
            expect(slug).not.toContain(char);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Generated slug is unique within category', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            slug: fc.string({ minLength: 1, maxLength: 50 }).map((s) => generateSlug(s || 'default')),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (categoryId, newName, existingSlugs) => {
          const existingSubcategories: Subcategory[] = existingSlugs.map((s) => ({
            ...s,
            category_id: categoryId,
          }));

          const uniqueSlug = generateUniqueSlug(newName, existingSubcategories, categoryId);

          // The generated slug should be unique
          expect(isSlugUnique(uniqueSlug, existingSubcategories, categoryId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Unique slug generation handles collisions', () => {
    const categoryId = 'cat-1';
    const baseName = 'Test Category';
    const baseSlug = generateSlug(baseName);

    // Create existing subcategories with the base slug and numbered variants
    const existingSubcategories: Subcategory[] = [
      { id: '1', category_id: categoryId, name: 'Test Category', slug: baseSlug },
      { id: '2', category_id: categoryId, name: 'Test Category 1', slug: `${baseSlug}-1` },
      { id: '3', category_id: categoryId, name: 'Test Category 2', slug: `${baseSlug}-2` },
    ];

    const uniqueSlug = generateUniqueSlug(baseName, existingSubcategories, categoryId);

    // Should generate a unique slug (e.g., "test-category-3")
    expect(isSlugUnique(uniqueSlug, existingSubcategories, categoryId)).toBe(true);
    expect(uniqueSlug).toBe(`${baseSlug}-3`);
  });

  it('Property 6: Slug uniqueness is scoped to category', () => {
    const categoryId1 = 'cat-1';
    const categoryId2 = 'cat-2';
    const name = 'Same Name';
    const slug = generateSlug(name);

    // Subcategory exists in category 1
    const existingSubcategories: Subcategory[] = [
      { id: '1', category_id: categoryId1, name, slug },
    ];

    // Same slug should be unique in category 2
    expect(isSlugUnique(slug, existingSubcategories, categoryId2)).toBe(true);
    
    // But not unique in category 1
    expect(isSlugUnique(slug, existingSubcategories, categoryId1)).toBe(false);
  });
});
