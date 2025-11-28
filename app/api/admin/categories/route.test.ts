import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateSlug } from '@/lib/categoryUtils';

/**
 * **Feature: category-inventory-improvements, Property 3: Slug Generation Consistency**
 * **Validates: Requirements 1.5, 1.6**
 * 
 * For any category or subcategory name, the generated slug SHALL be a lowercase,
 * hyphen-separated version of the name with special characters removed.
 */
describe('Slug Generation Property Tests', () => {
  it('Property 3: Slug is always lowercase', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (name) => {
        const slug = generateSlug(name);
        // Slug should be lowercase
        expect(slug).toBe(slug.toLowerCase());
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3: Slug contains only valid characters (lowercase letters, numbers, hyphens)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (name) => {
        const slug = generateSlug(name);
        // Slug should only contain lowercase letters, numbers, and hyphens
        expect(slug).toMatch(/^[a-z0-9-]*$/);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3: Slug has no consecutive hyphens', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (name) => {
        const slug = generateSlug(name);
        // Slug should not have consecutive hyphens
        expect(slug).not.toMatch(/--/);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3: Slug does not start or end with hyphen', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (name) => {
        const slug = generateSlug(name);
        if (slug.length > 0) {
          // Slug should not start or end with hyphen
          expect(slug).not.toMatch(/^-/);
          expect(slug).not.toMatch(/-$/);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3: Same input always produces same slug (deterministic)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (name) => {
        const slug1 = generateSlug(name);
        const slug2 = generateSlug(name);
        // Same input should always produce same output
        expect(slug1).toBe(slug2);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3: Spaces are converted to hyphens', () => {
    // Generate words using lowercase letters only
    const wordArb = fc.stringMatching(/^[a-z]{1,10}$/);
    fc.assert(
      fc.property(
        fc.array(wordArb, { minLength: 2, maxLength: 5 }),
        (words) => {
          const name = words.join(' ');
          const slug = generateSlug(name);
          // Spaces should become hyphens
          expect(slug).not.toContain(' ');
          // The slug should contain hyphens if there were spaces between non-empty words
          const nonEmptyWords = words.filter(w => w.length > 0);
          if (nonEmptyWords.length > 1) {
            expect(slug).toContain('-');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3: Alphanumeric content is preserved', () => {
    // Generate strings with only lowercase alphanumeric characters
    const alphanumericArb = fc.stringMatching(/^[a-z0-9]{1,50}$/);
    fc.assert(
      fc.property(alphanumericArb, (name) => {
        const slug = generateSlug(name);
        // For purely alphanumeric lowercase input, slug should equal input
        expect(slug).toBe(name.toLowerCase());
      }),
      { numRuns: 100 }
    );
  });
});
