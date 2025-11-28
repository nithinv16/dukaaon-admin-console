/**
 * Image Searcher Service
 *
 * TypeScript wrapper for the Python image scraper that provides
 * multi-source image search with quality scoring.
 *
 * **Feature: ai-product-extraction**
 * **Validates: Requirements 5.2, 5.3, 5.4, 5.6**
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Types
// ============================================================================

export interface ImageResult {
  url: string;
  source: string;
  quality_score: number;
  width: number;
  height: number;
  file_size: number;
  format: string;
  error: string | null;
}

export interface ScrapeResult {
  success: boolean;
  product_name: string;
  brand_name: string;
  images: ImageResult[];
  best_image: ImageResult | null;
  local_path: string | null;
  sources_searched: string[];
  error: string | null;
}

export interface ScrapeImageRequest {
  productName: string;
  brandName?: string;
  productId?: string;
  download?: boolean;
}

export interface ScrapeImageResponse {
  success: boolean;
  imageUrl?: string;
  localPath?: string;
  source: string;
  quality: number;
  error?: string;
}

export interface BatchScrapeRequest {
  products: Array<{
    id: string;
    name: string;
    brand?: string;
  }>;
}

export interface BatchScrapeResponse {
  results: Array<{
    productId: string;
    success: boolean;
    imageUrl?: string;
    error?: string;
  }>;
  successful: number;
  failed: number;
}

// ============================================================================
// Image Searcher Service
// ============================================================================

/**
 * Service for searching and downloading product images using the Python scraper.
 */
export class ImageSearcherService {
  private pythonScript: string;
  private outputDir: string;

  constructor(outputDir: string = 'scraped_images') {
    this.pythonScript = path.join(process.cwd(), 'scripts', 'image_scraper.py');
    this.outputDir = outputDir;
  }

  /**
   * Search for product images using the Python scraper.
   *
   * @param request - The scrape request parameters
   * @returns Promise resolving to scrape response
   */
  async scrapeImage(request: ScrapeImageRequest): Promise<ScrapeImageResponse> {
    try {
      const result = await this.invokePythonScraper(
        request.productName,
        request.brandName || '',
        request.download || false,
        request.productId
      );

      if (!result.success) {
        return {
          success: false,
          source: '',
          quality: 0,
          error: result.error || 'Failed to scrape image',
        };
      }

      if (!result.best_image) {
        return {
          success: false,
          source: '',
          quality: 0,
          error: 'No suitable image found',
        };
      }

      return {
        success: true,
        imageUrl: result.best_image.url,
        localPath: result.local_path || undefined,
        source: result.best_image.source,
        quality: result.best_image.quality_score,
      };
    } catch (error) {
      return {
        success: false,
        source: '',
        quality: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch scrape images for multiple products.
   *
   * @param request - Batch scrape request with product list
   * @returns Promise resolving to batch scrape response
   */
  async batchScrapeImages(request: BatchScrapeRequest): Promise<BatchScrapeResponse> {
    const results: BatchScrapeResponse['results'] = [];
    let successful = 0;
    let failed = 0;

    // Process products sequentially to avoid rate limiting
    for (const product of request.products) {
      try {
        const response = await this.scrapeImage({
          productName: product.name,
          brandName: product.brand,
          productId: product.id,
          download: true,
        });

        if (response.success) {
          successful++;
          results.push({
            productId: product.id,
            success: true,
            imageUrl: response.imageUrl,
          });
        } else {
          failed++;
          results.push({
            productId: product.id,
            success: false,
            error: response.error,
          });
        }

        // Add delay between requests to avoid rate limiting
        await this.delay(1000);
      } catch (error) {
        failed++;
        results.push({
          productId: product.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      results,
      successful,
      failed,
    };
  }

  /**
   * Invoke the Python scraper script.
   */
  private invokePythonScraper(
    productName: string,
    brandName: string,
    download: boolean,
    productId?: string
  ): Promise<ScrapeResult> {
    return new Promise((resolve, reject) => {
      const args = [this.pythonScript, '--product', productName, '--json', '--output-dir', this.outputDir];

      if (brandName) {
        args.push('--brand', brandName);
      }

      if (download) {
        args.push('--download');
      }

      if (productId) {
        args.push('--product-id', productId);
      }

      // Use 'py' on Windows, 'python3' on Unix
      const pythonCmd = process.platform === 'win32' ? 'py' : 'python3';
      const pythonProcess = spawn(pythonCmd, args);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout) as ScrapeResult;
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse scraper output: ${stdout}`));
          }
        } else {
          reject(new Error(`Python scraper failed with code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  /**
   * Utility delay function.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if Python and required packages are installed.
   */
  async checkSetup(): Promise<boolean> {
    return new Promise((resolve) => {
      const pythonCmd = process.platform === 'win32' ? 'py' : 'python3';
      const pythonProcess = spawn(pythonCmd, ['--version']);

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          // Check if required packages are installed
          const pipProcess = spawn(pythonCmd, ['-c', 'import requests, bs4, PIL; print("OK")']);

          pipProcess.on('close', (pipCode) => {
            resolve(pipCode === 0);
          });

          pipProcess.on('error', () => {
            resolve(false);
          });
        } else {
          resolve(false);
        }
      });

      pythonProcess.on('error', () => {
        resolve(false);
      });
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Select the highest quality image from a list of results.
 *
 * **Property 13: Image Quality Selection**
 * For any scrape operation that finds multiple images, the system SHALL select
 * the image with the highest quality score that matches the product name.
 *
 * @param images - Array of image results
 * @returns The highest quality image or null
 */
export function selectBestImage(images: ImageResult[]): ImageResult | null {
  if (!images || images.length === 0) {
    return null;
  }

  // Filter out images with errors
  const validImages = images.filter((img) => img.url && !img.error);

  if (validImages.length === 0) {
    return null;
  }

  // Sort by quality score descending
  validImages.sort((a, b) => b.quality_score - a.quality_score);

  return validImages[0];
}

/**
 * Calculate image quality score based on dimensions and format.
 *
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param fileSize - File size in bytes
 * @param format - Image format (jpeg, png, webp, etc.)
 * @returns Quality score between 0 and 1
 */
export function calculateImageQuality(
  width: number,
  height: number,
  fileSize: number,
  format: string
): number {
  let score = 0;

  // Resolution score (40% weight)
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);

  if (minDim >= 400 && maxDim <= 1200) {
    score += 0.4;
  } else if (minDim >= 200 && maxDim <= 2000) {
    score += 0.3;
  } else if (minDim >= 100) {
    score += 0.15;
  }

  // Aspect ratio score (20% weight)
  if (width > 0 && height > 0) {
    const aspectRatio = maxDim / minDim;
    if (aspectRatio <= 1.5) {
      score += 0.2;
    } else if (aspectRatio <= 2.0) {
      score += 0.1;
    }
  }

  // File size score (20% weight)
  if (fileSize > 0) {
    if (fileSize >= 10000 && fileSize <= 500000) {
      score += 0.2;
    } else if (fileSize >= 5000 && fileSize <= 1000000) {
      score += 0.1;
    }
  }

  // Format score (20% weight)
  const formatScores: Record<string, number> = {
    jpeg: 0.2,
    jpg: 0.2,
    png: 0.18,
    webp: 0.15,
    gif: 0.05,
  };
  score += formatScores[format.toLowerCase()] || 0.05;

  return Math.min(score, 1.0);
}

// Export singleton instance
export const imageSearcher = new ImageSearcherService();
