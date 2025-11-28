/**
 * API Route: /api/admin/scrape-image
 *
 * Handles product image scraping requests using the Python web scraper.
 * Supports both single and batch scraping operations.
 * Includes image upload to Supabase storage.
 *
 * **Feature: ai-product-extraction**
 * **Validates: Requirements 5.2, 5.5, 5.8, 5.9**
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

// ============================================================================
// Types
// ============================================================================

interface ScrapeImageRequest {
  productName: string;
  brandName?: string;
  productId?: string;
}

interface BatchScrapeRequest {
  products: Array<{
    id: string;
    name: string;
    brand?: string;
  }>;
}

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
 * Invoke the Python image scraper script.
 */
async function invokePythonScraper(
  productName: string,
  brandName: string = '',
  download: boolean = false,
  productId?: string
): Promise<ScrapeResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'image_scraper.py');
    const outputDir = path.join(process.cwd(), 'scraped_images');

    const args = [scriptPath, '--product', productName, '--json', '--output-dir', outputDir];

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

    // Set timeout for the process
    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error('Scraper process timed out'));
    }, 60000); // 60 second timeout
  });
}

/**
 * Delay utility for rate limiting.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload a local image file to Supabase storage.
 *
 * **Validates: Requirements 5.5, 5.8**
 */
async function uploadImageToStorage(
  localPath: string,
  productId?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Check if file exists
    if (!fs.existsSync(localPath)) {
      return { success: false, error: 'Local file not found' };
    }

    const supabase = getAdminSupabaseClient();

    // Read file
    const fileBuffer = fs.readFileSync(localPath);
    const fileName = path.basename(localPath);
    const fileExt = path.extname(localPath).slice(1) || 'jpg';

    // Generate storage path
    const storagePath = `product-images/${productId || 'scraped'}_${Date.now()}.${fileExt}`;

    // Determine content type
    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    const contentType = contentTypeMap[fileExt.toLowerCase()] || 'image/jpeg';

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('products')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { success: false, error: uploadError.message || 'Failed to upload image' };
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('products').getPublicUrl(storagePath);

    // Clean up local file after successful upload
    try {
      fs.unlinkSync(localPath);
    } catch (cleanupError) {
      console.warn('Failed to clean up local file:', cleanupError);
    }

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    console.error('Error uploading to storage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    };
  }
}

/**
 * Update product record with new image URL.
 */
async function updateProductImageUrl(productId: string, imageUrl: string): Promise<boolean> {
  try {
    const supabase = getAdminSupabaseClient();

    const { error } = await supabase
      .from('products')
      .update({ image_url: imageUrl })
      .eq('id', productId);

    if (error) {
      console.error('Error updating product image URL:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating product:', error);
    return false;
  }
}

// ============================================================================
// POST Handler - Single or Batch Scraping
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a batch request
    if (body.products && Array.isArray(body.products)) {
      return handleBatchScrape(body as BatchScrapeRequest);
    }

    // Single scrape request
    return handleSingleScrape(body as ScrapeImageRequest);
  } catch (error) {
    console.error('Error in scrape-image API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle single image scrape request.
 */
async function handleSingleScrape(request: ScrapeImageRequest) {
  const { productName, brandName, productId } = request;

  if (!productName) {
    return NextResponse.json(
      {
        success: false,
        error: 'Product name is required',
      },
      { status: 400 }
    );
  }

  try {
    const result = await invokePythonScraper(productName, brandName || '', true, productId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to scrape image',
        },
        { status: 404 }
      );
    }

    // Upload to storage if we have a local file
    let storageUrl: string | undefined;
    if (result.local_path) {
      const uploadResult = await uploadImageToStorage(result.local_path, productId);
      if (uploadResult.success) {
        storageUrl = uploadResult.url;

        // Update product record if productId provided
        if (productId && storageUrl) {
          await updateProductImageUrl(productId, storageUrl);
        }
      } else {
        console.warn('Failed to upload to storage:', uploadResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl: storageUrl || result.best_image?.url,
      localPath: result.local_path,
      source: result.best_image?.source || '',
      quality: result.best_image?.quality_score || 0,
      sourcesSearched: result.sources_searched,
      uploadedToStorage: !!storageUrl,
    });
  } catch (error) {
    console.error('Error scraping image:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scrape image',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle batch image scrape request.
 */
async function handleBatchScrape(request: BatchScrapeRequest) {
  const { products } = request;

  if (!products || products.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'Products array is required',
      },
      { status: 400 }
    );
  }

  const results: Array<{
    productId: string;
    success: boolean;
    imageUrl?: string;
    localPath?: string;
    uploadedToStorage?: boolean;
    error?: string;
  }> = [];

  let successful = 0;
  let failed = 0;

  // Process products sequentially to avoid rate limiting
  for (const product of products) {
    try {
      const result = await invokePythonScraper(product.name, product.brand || '', true, product.id);

      if (result.success && result.best_image) {
        // Upload to storage
        let storageUrl: string | undefined;
        let uploadedToStorage = false;

        if (result.local_path) {
          const uploadResult = await uploadImageToStorage(result.local_path, product.id);
          if (uploadResult.success) {
            storageUrl = uploadResult.url;
            uploadedToStorage = true;

            // Update product record
            if (storageUrl) {
              await updateProductImageUrl(product.id, storageUrl);
            }
          }
        }

        successful++;
        results.push({
          productId: product.id,
          success: true,
          imageUrl: storageUrl || result.best_image.url,
          localPath: result.local_path || undefined,
          uploadedToStorage,
        });
      } else {
        failed++;
        results.push({
          productId: product.id,
          success: false,
          error: result.error || 'No suitable image found',
        });
      }

      // Add delay between requests to avoid rate limiting
      await delay(1500);
    } catch (error) {
      failed++;
      results.push({
        productId: product.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    success: true,
    results,
    successful,
    failed,
    total: products.length,
  });
}

// ============================================================================
// GET Handler - Check scraper status
// ============================================================================

export async function GET() {
  try {
    // Check if Python is available
    const pythonAvailable = await checkPythonAvailable();

    return NextResponse.json({
      success: true,
      pythonAvailable,
      message: pythonAvailable
        ? 'Image scraper is ready'
        : 'Python is not available. Please install Python and required packages.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Check if Python and required packages are available.
 */
async function checkPythonAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const pythonCmd = process.platform === 'win32' ? 'py' : 'python3';
    const pythonProcess = spawn(pythonCmd, ['-c', 'import requests, bs4, PIL; print("OK")']);

    pythonProcess.on('close', (code) => {
      resolve(code === 0);
    });

    pythonProcess.on('error', () => {
      resolve(false);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      pythonProcess.kill();
      resolve(false);
    }, 5000);
  });
}
