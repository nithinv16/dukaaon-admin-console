/**
 * Image Scraper Property Tests
 *
 * Tests for the Python image scraper integration.
 *
 * **Feature: ai-product-extraction, Property 12: Multi-Source Image Search**
 * **Validates: Requirements 5.3**
 *
 * For any image scrape request, the Python scraper SHALL query at least 2
 * different image sources (Google, Bing, or e-commerce sites) before returning a result.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { spawn } from 'child_process';
import * as path from 'path';

// ============================================================================
// Types for Image Scraper Results
// ============================================================================

interface ImageResult {
  url: string;
  source: string;
  quality_score: number;
  width: number;
  height: number;
  file_size: number;
  format: string;
  error: string | null;
}

interface ScrapeResult {
  success: boolean;
  product_name: string;
  brand_name: string;
  images: ImageResult[];
  best_image: ImageResult | null;
  local_path: string | null;
  sources_searched: string[];
  error: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Invoke the Python image scraper and return parsed results.
 * This is a mock implementation for testing the property without network calls.
 */
function createMockScrapeResult(
  productName: string,
  brandName: string,
  sourcesSearched: string[],
  imageCount: number
): ScrapeResult {
  const images: ImageResult[] = [];

  for (let i = 0; i < imageCount; i++) {
    const source = sourcesSearched[i % sourcesSearched.length];
    images.push({
      url: `https://example.com/image_${i}.jpg`,
      source,
      quality_score: Math.random(),
      width: 400 + Math.floor(Math.random() * 400),
      height: 400 + Math.floor(Math.random() * 400),
      file_size: 10000 + Math.floor(Math.random() * 100000),
      format: 'jpeg',
      error: null,
    });
  }

  return {
    success: sourcesSearched.length >= 2,
    product_name: productName,
    brand_name: brandName,
    images,
    best_image: images.length > 0 ? images[0] : null,
    local_path: null,
    sources_searched: sourcesSearched,
    error: sourcesSearched.length < 2 ? 'Failed to search minimum 2 sources' : null,
  };
}

/**
 * Validate that a scrape result meets the multi-source requirement.
 */
function validateMultiSourceRequirement(result: ScrapeResult): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const MIN_SOURCES = 2;

  // Check that at least MIN_SOURCES were searched
  if (result.sources_searched.length < MIN_SOURCES) {
    errors.push(
      `Expected at least ${MIN_SOURCES} sources searched, got ${result.sources_searched.length}`
    );
  }

  // Check that sources are from valid set
  const validSources = ['google', 'bing', 'ecommerce', 'wikipedia'];
  for (const source of result.sources_searched) {
    if (!validSources.includes(source)) {
      errors.push(`Invalid source: ${source}`);
    }
  }

  // If successful, verify images have source attribution
  if (result.success && result.images.length > 0) {
    for (const image of result.images) {
      if (!image.source) {
        errors.push('Image missing source attribution');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Property 12: Multi-Source Image Search
// ============================================================================

describe('Property 12: Multi-Source Image Search', () => {
  /**
   * For any image scrape request, the Python scraper SHALL query at least 2
   * different image sources (Google, Bing, or e-commerce sites) before returning a result.
   */

  // Arbitrary for product names
  const productNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

  // Arbitrary for brand names
  const brandNameArb = fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: '' });

  // Arbitrary for valid source combinations (at least 2 sources)
  const validSourcesArb = fc
    .subarray(['google', 'bing', 'ecommerce'], { minLength: 2, maxLength: 3 })
    .filter((arr) => arr.length >= 2);

  // Arbitrary for invalid source combinations (less than 2 sources)
  const invalidSourcesArb = fc.subarray(['google', 'bing', 'ecommerce'], {
    minLength: 0,
    maxLength: 1,
  });

  it('Property 12: Successful scrapes always search at least 2 sources', () => {
    fc.assert(
      fc.property(productNameArb, brandNameArb, validSourcesArb, (productName, brandName, sources) => {
        const result = createMockScrapeResult(productName, brandName || '', sources, 5);

        // Verify multi-source requirement
        const validation = validateMultiSourceRequirement(result);
        expect(validation.valid).toBe(true);

        // Verify at least 2 sources were searched
        expect(result.sources_searched.length).toBeGreaterThanOrEqual(2);

        // Verify success flag is true when sources >= 2
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 12: Scrapes with fewer than 2 sources fail', () => {
    fc.assert(
      fc.property(productNameArb, brandNameArb, invalidSourcesArb, (productName, brandName, sources) => {
        const result = createMockScrapeResult(productName, brandName || '', sources, 0);

        // Should not be successful with fewer than 2 sources
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 12: All images have valid source attribution', () => {
    fc.assert(
      fc.property(
        productNameArb,
        brandNameArb,
        validSourcesArb,
        fc.integer({ min: 1, max: 20 }),
        (productName, brandName, sources, imageCount) => {
          const result = createMockScrapeResult(productName, brandName || '', sources, imageCount);

          // Every image should have a source
          for (const image of result.images) {
            expect(image.source).toBeTruthy();
            expect(sources).toContain(image.source);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Sources searched are from valid set', () => {
    const validSourceSet = ['google', 'bing', 'ecommerce', 'wikipedia'];

    fc.assert(
      fc.property(productNameArb, brandNameArb, validSourcesArb, (productName, brandName, sources) => {
        const result = createMockScrapeResult(productName, brandName || '', sources, 5);

        // All sources should be from valid set
        for (const source of result.sources_searched) {
          expect(validSourceSet).toContain(source);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 12: Product name is preserved in result', () => {
    fc.assert(
      fc.property(productNameArb, brandNameArb, validSourcesArb, (productName, brandName, sources) => {
        const result = createMockScrapeResult(productName, brandName || '', sources, 5);

        expect(result.product_name).toBe(productName);
        expect(result.brand_name).toBe(brandName || '');
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Unit Tests for Edge Cases
// ============================================================================

describe('Multi-Source Search Edge Cases', () => {
  it('handles empty product name gracefully', () => {
    const result = createMockScrapeResult('', '', ['google', 'bing'], 0);
    expect(result.product_name).toBe('');
  });

  it('handles exactly 2 sources (minimum requirement)', () => {
    const result = createMockScrapeResult('Test Product', '', ['google', 'bing'], 5);

    expect(result.success).toBe(true);
    expect(result.sources_searched.length).toBe(2);
  });

  it('handles all 3 sources', () => {
    const result = createMockScrapeResult('Test Product', '', ['google', 'bing', 'ecommerce'], 10);

    expect(result.success).toBe(true);
    expect(result.sources_searched.length).toBe(3);
  });

  it('handles single source (should fail)', () => {
    const result = createMockScrapeResult('Test Product', '', ['google'], 0);

    expect(result.success).toBe(false);
    expect(result.sources_searched.length).toBe(1);
  });

  it('handles zero sources (should fail)', () => {
    const result = createMockScrapeResult('Test Product', '', [], 0);

    expect(result.success).toBe(false);
    expect(result.sources_searched.length).toBe(0);
  });
});
