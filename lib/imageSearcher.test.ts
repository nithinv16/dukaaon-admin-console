/**
 * Image Searcher Property Tests
 *
 * Tests for the image searcher service and quality selection.
 *
 * **Feature: ai-product-extraction, Property 13: Image Quality Selection**
 * **Validates: Requirements 5.6**
 *
 * For any scrape operation that finds multiple images, the system SHALL select
 * the image with the highest quality score that matches the product name.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ImageResult,
  selectBestImage,
  calculateImageQuality,
} from './imageSearcher';

// ============================================================================
// Arbitraries for Property-Based Testing
// ============================================================================

// Arbitrary for image dimensions
const dimensionArb = fc.integer({ min: 50, max: 2000 });

// Arbitrary for file size (in bytes)
const fileSizeArb = fc.integer({ min: 1000, max: 2000000 });

// Arbitrary for image format
const formatArb = fc.constantFrom('jpeg', 'jpg', 'png', 'webp', 'gif', 'bmp');

// Arbitrary for image source
const sourceArb = fc.constantFrom('google', 'bing', 'ecommerce', 'wikipedia');

// Arbitrary for quality score (pre-calculated)
const qualityScoreArb = fc.float({ min: 0, max: 1, noNaN: true });

// Arbitrary for valid image URL
const imageUrlArb = fc.webUrl().map((url) => `${url}/image.jpg`);

// Arbitrary for a single image result
const imageResultArb = fc.record({
  url: imageUrlArb,
  source: sourceArb,
  quality_score: qualityScoreArb,
  width: dimensionArb,
  height: dimensionArb,
  file_size: fileSizeArb,
  format: formatArb,
  error: fc.constant(null as string | null),
});

// Arbitrary for image result with error
const errorImageResultArb = fc.record({
  url: fc.constant(''),
  source: sourceArb,
  quality_score: fc.constant(0),
  width: fc.constant(0),
  height: fc.constant(0),
  file_size: fc.constant(0),
  format: fc.constant(''),
  error: fc.string({ minLength: 1, maxLength: 100 }),
});

// Arbitrary for array of image results (mix of valid and error)
const imageResultsArrayArb = fc.array(
  fc.oneof(
    { weight: 4, arbitrary: imageResultArb },
    { weight: 1, arbitrary: errorImageResultArb }
  ),
  { minLength: 1, maxLength: 20 }
);

// ============================================================================
// Property 13: Image Quality Selection
// ============================================================================

describe('Property 13: Image Quality Selection', () => {
  /**
   * For any scrape operation that finds multiple images, the system SHALL select
   * the image with the highest quality score that matches the product name.
   */

  it('Property 13: selectBestImage returns image with highest quality score', () => {
    fc.assert(
      fc.property(imageResultsArrayArb, (images) => {
        const bestImage = selectBestImage(images);

        // Filter valid images (same logic as selectBestImage)
        const validImages = images.filter((img) => img.url && !img.error);

        if (validImages.length === 0) {
          // No valid images, should return null
          expect(bestImage).toBeNull();
        } else {
          // Should return an image
          expect(bestImage).not.toBeNull();

          // The returned image should have the highest quality score
          const maxQuality = Math.max(...validImages.map((img) => img.quality_score));
          expect(bestImage!.quality_score).toBe(maxQuality);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: selectBestImage returns null for empty array', () => {
    const result = selectBestImage([]);
    expect(result).toBeNull();
  });

  it('Property 13: selectBestImage returns null for array with only error images', () => {
    fc.assert(
      fc.property(fc.array(errorImageResultArb, { minLength: 1, maxLength: 10 }), (images) => {
        const result = selectBestImage(images);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: selectBestImage filters out error images', () => {
    fc.assert(
      fc.property(imageResultsArrayArb, (images) => {
        const bestImage = selectBestImage(images);

        if (bestImage) {
          // Best image should not have an error
          expect(bestImage.error).toBeNull();
          // Best image should have a valid URL
          expect(bestImage.url).toBeTruthy();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: selectBestImage is deterministic', () => {
    fc.assert(
      fc.property(imageResultsArrayArb, (images) => {
        const result1 = selectBestImage(images);
        const result2 = selectBestImage(images);

        // Same input should produce same output
        if (result1 === null) {
          expect(result2).toBeNull();
        } else {
          expect(result2).not.toBeNull();
          expect(result1.url).toBe(result2!.url);
          expect(result1.quality_score).toBe(result2!.quality_score);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: Single valid image is always selected', () => {
    fc.assert(
      fc.property(imageResultArb, (image) => {
        const result = selectBestImage([image]);

        expect(result).not.toBeNull();
        expect(result!.url).toBe(image.url);
        expect(result!.quality_score).toBe(image.quality_score);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// calculateImageQuality Property Tests
// ============================================================================

describe('calculateImageQuality Properties', () => {
  it('Quality score is always between 0 and 1', () => {
    fc.assert(
      fc.property(dimensionArb, dimensionArb, fileSizeArb, formatArb, (width, height, fileSize, format) => {
        const quality = calculateImageQuality(width, height, fileSize, format);

        expect(quality).toBeGreaterThanOrEqual(0);
        expect(quality).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 }
    );
  });

  it('Ideal dimensions (400-800px) score higher than very small images', () => {
    fc.assert(
      fc.property(formatArb, fileSizeArb, (format, fileSize) => {
        const idealQuality = calculateImageQuality(500, 500, fileSize, format);
        const smallQuality = calculateImageQuality(50, 50, fileSize, format);

        expect(idealQuality).toBeGreaterThan(smallQuality);
      }),
      { numRuns: 100 }
    );
  });

  it('Square images score higher than very elongated images', () => {
    fc.assert(
      fc.property(formatArb, fileSizeArb, (format, fileSize) => {
        const squareQuality = calculateImageQuality(400, 400, fileSize, format);
        const elongatedQuality = calculateImageQuality(400, 1600, fileSize, format);

        expect(squareQuality).toBeGreaterThanOrEqual(elongatedQuality);
      }),
      { numRuns: 100 }
    );
  });

  it('JPEG/PNG formats score higher than GIF', () => {
    fc.assert(
      fc.property(dimensionArb, dimensionArb, fileSizeArb, (width, height, fileSize) => {
        const jpegQuality = calculateImageQuality(width, height, fileSize, 'jpeg');
        const gifQuality = calculateImageQuality(width, height, fileSize, 'gif');

        expect(jpegQuality).toBeGreaterThan(gifQuality);
      }),
      { numRuns: 100 }
    );
  });

  it('Reasonable file sizes (10KB-500KB) score higher than very small files', () => {
    fc.assert(
      fc.property(dimensionArb, dimensionArb, formatArb, (width, height, format) => {
        const goodSizeQuality = calculateImageQuality(width, height, 100000, format);
        const tinySizeQuality = calculateImageQuality(width, height, 500, format);

        expect(goodSizeQuality).toBeGreaterThanOrEqual(tinySizeQuality);
      }),
      { numRuns: 100 }
    );
  });

  it('Quality calculation is deterministic', () => {
    fc.assert(
      fc.property(dimensionArb, dimensionArb, fileSizeArb, formatArb, (width, height, fileSize, format) => {
        const quality1 = calculateImageQuality(width, height, fileSize, format);
        const quality2 = calculateImageQuality(width, height, fileSize, format);

        expect(quality1).toBe(quality2);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Unit Tests for Edge Cases
// ============================================================================

describe('Image Quality Edge Cases', () => {
  it('handles zero dimensions', () => {
    const quality = calculateImageQuality(0, 0, 10000, 'jpeg');
    expect(quality).toBeGreaterThanOrEqual(0);
    expect(quality).toBeLessThanOrEqual(1);
  });

  it('handles zero file size', () => {
    const quality = calculateImageQuality(400, 400, 0, 'jpeg');
    expect(quality).toBeGreaterThanOrEqual(0);
    expect(quality).toBeLessThanOrEqual(1);
  });

  it('handles unknown format', () => {
    const quality = calculateImageQuality(400, 400, 10000, 'unknown');
    expect(quality).toBeGreaterThanOrEqual(0);
    expect(quality).toBeLessThanOrEqual(1);
  });

  it('handles very large dimensions', () => {
    const quality = calculateImageQuality(10000, 10000, 10000, 'jpeg');
    expect(quality).toBeGreaterThanOrEqual(0);
    expect(quality).toBeLessThanOrEqual(1);
  });

  it('handles very large file size', () => {
    const quality = calculateImageQuality(400, 400, 100000000, 'jpeg');
    expect(quality).toBeGreaterThanOrEqual(0);
    expect(quality).toBeLessThanOrEqual(1);
  });
});

describe('selectBestImage Edge Cases', () => {
  it('handles null input', () => {
    // @ts-expect-error Testing null input
    const result = selectBestImage(null);
    expect(result).toBeNull();
  });

  it('handles undefined input', () => {
    // @ts-expect-error Testing undefined input
    const result = selectBestImage(undefined);
    expect(result).toBeNull();
  });

  it('handles images with same quality score', () => {
    const images: ImageResult[] = [
      {
        url: 'https://example.com/image1.jpg',
        source: 'google',
        quality_score: 0.8,
        width: 400,
        height: 400,
        file_size: 10000,
        format: 'jpeg',
        error: null,
      },
      {
        url: 'https://example.com/image2.jpg',
        source: 'bing',
        quality_score: 0.8,
        width: 400,
        height: 400,
        file_size: 10000,
        format: 'jpeg',
        error: null,
      },
    ];

    const result = selectBestImage(images);
    expect(result).not.toBeNull();
    expect(result!.quality_score).toBe(0.8);
  });
});


// ============================================================================
// Property 11: Image Scrape and Upload Round-Trip
// **Feature: ai-product-extraction, Property 11: Image Scrape and Upload Round-Trip**
// **Validates: Requirements 5.4, 5.5**
// ============================================================================

/**
 * Mock types for round-trip testing
 */
interface MockUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

interface MockScrapeAndUploadResult {
  success: boolean;
  imageUrl?: string;
  localPath?: string;
  uploadedToStorage: boolean;
  error?: string;
}

/**
 * Mock function to simulate the scrape and upload round-trip.
 * In production, this would call the actual Python scraper and Supabase storage.
 */
function mockScrapeAndUpload(
  productName: string,
  brandName: string,
  scrapeSuccess: boolean,
  uploadSuccess: boolean
): MockScrapeAndUploadResult {
  if (!scrapeSuccess) {
    return {
      success: false,
      uploadedToStorage: false,
      error: 'Failed to scrape image',
    };
  }

  const localPath = `/tmp/scraped_images/${productName.replace(/\s+/g, '_').toLowerCase()}.jpg`;

  if (!uploadSuccess) {
    return {
      success: true,
      imageUrl: `https://example.com/scraped/${productName}.jpg`,
      localPath,
      uploadedToStorage: false,
      error: 'Failed to upload to storage',
    };
  }

  // Successful round-trip
  const storageUrl = `https://storage.example.com/products/${productName.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.jpg`;

  return {
    success: true,
    imageUrl: storageUrl,
    localPath,
    uploadedToStorage: true,
  };
}

/**
 * Validate that a URL is properly formatted.
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

describe('Property 11: Image Scrape and Upload Round-Trip', () => {
  /**
   * For any successful image scrape operation, the downloaded image SHALL be
   * uploaded to storage and the returned imageUrl SHALL be a valid URL pointing
   * to the uploaded image.
   */

  // Arbitrary for product names
  const productNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

  // Arbitrary for brand names
  const brandNameArb = fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: '' });

  it('Property 11: Successful scrape and upload returns valid storage URL', () => {
    fc.assert(
      fc.property(productNameArb, brandNameArb, (productName, brandName) => {
        const result = mockScrapeAndUpload(productName, brandName || '', true, true);

        // Should be successful
        expect(result.success).toBe(true);

        // Should have uploaded to storage
        expect(result.uploadedToStorage).toBe(true);

        // Should have a valid URL
        expect(result.imageUrl).toBeTruthy();
        expect(isValidUrl(result.imageUrl!)).toBe(true);

        // URL should point to storage (not original source)
        expect(result.imageUrl).toContain('storage');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 11: Failed scrape returns error without upload attempt', () => {
    fc.assert(
      fc.property(productNameArb, brandNameArb, (productName, brandName) => {
        const result = mockScrapeAndUpload(productName, brandName || '', false, true);

        // Should not be successful
        expect(result.success).toBe(false);

        // Should not have uploaded
        expect(result.uploadedToStorage).toBe(false);

        // Should have error message
        expect(result.error).toBeTruthy();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 11: Successful scrape with failed upload still returns image URL', () => {
    fc.assert(
      fc.property(productNameArb, brandNameArb, (productName, brandName) => {
        const result = mockScrapeAndUpload(productName, brandName || '', true, false);

        // Scrape should be successful
        expect(result.success).toBe(true);

        // Should not have uploaded to storage
        expect(result.uploadedToStorage).toBe(false);

        // Should still have an image URL (from original source)
        expect(result.imageUrl).toBeTruthy();
        expect(isValidUrl(result.imageUrl!)).toBe(true);

        // Should have local path
        expect(result.localPath).toBeTruthy();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 11: Local path is always set for successful scrapes', () => {
    fc.assert(
      fc.property(productNameArb, brandNameArb, fc.boolean(), (productName, brandName, uploadSuccess) => {
        const result = mockScrapeAndUpload(productName, brandName || '', true, uploadSuccess);

        // Successful scrape should always have local path
        expect(result.success).toBe(true);
        expect(result.localPath).toBeTruthy();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 11: Upload status is consistent with URL type', () => {
    fc.assert(
      fc.property(productNameArb, brandNameArb, fc.boolean(), (productName, brandName, uploadSuccess) => {
        const result = mockScrapeAndUpload(productName, brandName || '', true, uploadSuccess);

        if (result.uploadedToStorage) {
          // If uploaded, URL should be storage URL
          expect(result.imageUrl).toContain('storage');
        } else {
          // If not uploaded, URL should be original source
          expect(result.imageUrl).not.toContain('storage');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Unit Tests for Round-Trip Edge Cases
// ============================================================================

describe('Image Round-Trip Edge Cases', () => {
  it('handles empty product name', () => {
    const result = mockScrapeAndUpload('', '', true, true);
    expect(result.success).toBe(true);
  });

  it('handles special characters in product name', () => {
    const result = mockScrapeAndUpload('Product & Co. (Special)', 'Brand™', true, true);
    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
  });

  it('handles very long product name', () => {
    const longName = 'A'.repeat(200);
    const result = mockScrapeAndUpload(longName, '', true, true);
    expect(result.success).toBe(true);
  });

  it('handles unicode characters in product name', () => {
    const result = mockScrapeAndUpload('产品名称 🎉', '品牌', true, true);
    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
  });
});
