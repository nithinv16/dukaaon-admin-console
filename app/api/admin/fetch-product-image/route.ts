/**
 * API Route: /api/admin/fetch-product-image
 * 
 * Fetches product images using Perplexity AI
 * Perplexity AI searches the web in real-time and finds product images
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Check Perplexity AI configuration
 */
function checkPerplexityConfig() {
  const API_KEY = process.env.PERPLEXITY_API_KEY;

  return {
    hasConfig: !!API_KEY,
    apiKey: API_KEY,
  };
}

/**
 * Search for product images using Perplexity AI
 */
async function searchPerplexityForImages(productName: string, brand?: string): Promise<string[]> {
  const config = checkPerplexityConfig();
  if (!config.hasConfig || !config.apiKey) {
    console.warn('⚠️ Perplexity API key not configured');
    return [];
  }

  // Build search query
  const searchQuery = brand 
    ? `${brand} ${productName} product image`
    : `${productName} product image`;

  // Remove duplicate brand if already in product name
  const finalQuery = brand && productName.toLowerCase().includes(brand.toLowerCase())
    ? `${productName} product image`
    : searchQuery;

  try {
    console.log(`🔍 Searching Perplexity AI for: "${finalQuery}"`);

    // Try different Perplexity models (sonar models support online search)
    // If PERPLEXITY_MODEL is set, use that first, otherwise try common models
    const customModel = process.env.PERPLEXITY_MODEL;
    const modelsToTry = customModel 
      ? [customModel, 'sonar', 'sonar-pro', 'sonar-small-online', 'sonar-large-online']
      : [
          'sonar',                    // Standard sonar model (most common)
          'sonar-pro',                // Pro version
          'sonar-small-online',       // Small online model
          'sonar-large-online',       // Large online model
        ];

    let lastError: { error?: { message?: string; type?: string } } | Error | null = null;
    let response: Response | null = null;
    let workingModel = '';
    
    for (const model of modelsToTry) {
      try {
        console.log(`🔄 Trying Perplexity model: ${model}`);
        
        response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: 'You are a product image finder. When asked to find product images, you must search the web and return a JSON array of direct image URLs. Always return at least 5-10 image URLs if available.',
              },
              {
                role: 'user',
                content: `I need product images for: ${finalQuery}

Please search the web for this product and find DIRECT image URLs from e-commerce websites.

Search on:
- Amazon India (amazon.in) - look for product images
- Flipkart (flipkart.com) - look for product images  
- Meesho (meesho.com) - look for product images
- Any other e-commerce sites selling this product

After searching, extract the DIRECT image URLs (links that end in .jpg, .png, .webp or are from image CDNs like m.media-amazon.com, rukminim2.flipkart.com, etc.)

CRITICAL: You MUST return your response as a JSON array. Start your response with [ and end with ]. Include at least 5-10 image URLs if you find them.

Example format:
["https://m.media-amazon.com/images/I/81ABC123XYZ._SL1500_.jpg", "https://rukminim2.flipkart.com/image/400/400/abc123/xyz.jpg", "https://images.meesho.com/images/products/123456.jpg"]

Now search for "${finalQuery}" and return the image URLs as a JSON array:`,
              },
            ],
            temperature: 0.2,
            max_tokens: 2000,
          }),
        });

        if (response.ok) {
          workingModel = model;
          console.log(`✅ Model ${model} works!`);
          break;
        } else {
          const errorText = await response.text();
          try {
            const errorData = JSON.parse(errorText) as { error?: { message?: string; type?: string } };
            if (errorData.error?.type === 'invalid_model') {
              console.warn(`⚠️ Model ${model} not available, trying next...`);
              lastError = errorData;
              continue;
            } else {
              // Other error, break and return
              console.error(`❌ Perplexity API error: ${response.status} - ${errorText}`);
              return [];
            }
          } catch (parseError) {
            // If JSON parsing fails, treat as non-model error
            console.error(`❌ Perplexity API error (non-JSON): ${response.status} - ${errorText}`);
            return [];
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Error with model ${model}:`, errorMessage);
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    if (!response || !response.ok) {
      let errorMsg = 'All models failed';
      if (lastError) {
        if (lastError instanceof Error) {
          errorMsg = lastError.message;
        } else if (typeof lastError === 'object' && 'error' in lastError) {
          const err = lastError as { error?: { message?: string } };
          errorMsg = err.error?.message || errorMsg;
        }
      }
      console.error(`❌ All Perplexity models failed. Last error: ${errorMsg}`);
      console.error(`💡 Check available models at: https://docs.perplexity.ai/getting-started/models`);
      return [];
    }

    console.log(`✅ Using Perplexity model: ${workingModel}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      console.warn('⚠️ Perplexity returned empty response');
      return [];
    }

    console.log(`📥 Perplexity full response (first 500 chars): ${content.substring(0, 500)}`);
    console.log(`📥 Perplexity response length: ${content.length} chars`);

    // Extract image URLs from response
    // Perplexity might return JSON array or text with URLs
    const imageUrls: string[] = [];

    // Try to parse as JSON array first (most common case)
    try {
      // Look for JSON array in the response
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validUrls = parsed.filter((url: unknown): url is string => typeof url === 'string' && url.startsWith('http'));
          imageUrls.push(...validUrls);
          console.log(`✅ Found ${validUrls.length} URLs in JSON array`);
        }
      }
    } catch (e) {
      console.log('⚠️ Could not parse as JSON array, trying text extraction...');
    }

    // If no URLs found in JSON, extract from text
    if (imageUrls.length === 0) {
      // Extract URLs from text using regex - look for image URLs
      const urlRegex = /https?:\/\/[^\s"<>'\)]+\.(jpg|jpeg|png|webp|gif)(\?[^\s"<>'\)]*)?/gi;
      const matches = content.match(urlRegex);
      if (matches) {
        imageUrls.push(...matches);
        console.log(`✅ Found ${matches.length} URLs via regex`);
      }

      // Also look for URLs in markdown format
      const markdownUrlRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/gi;
      let match;
      while ((match = markdownUrlRegex.exec(content)) !== null) {
        if (match[1] && match[1].startsWith('http')) {
          imageUrls.push(match[1]);
        }
      }

      // Look for Amazon/Flipkart image URLs specifically
      const ecommerceUrlRegex = /https?:\/\/(m\.media-amazon\.com|rukminim2\.flipkart\.com|images\.meesho\.com)[^\s"<>'\)]+/gi;
      const ecommerceMatches = content.match(ecommerceUrlRegex);
      if (ecommerceMatches) {
        imageUrls.push(...ecommerceMatches);
        console.log(`✅ Found ${ecommerceMatches.length} e-commerce URLs`);
      }
    }

    // Remove duplicates and filter valid URLs
    const uniqueUrls = Array.from(new Set(imageUrls))
      .filter((url: string) => {
        if (!url || !url.startsWith('http')) return false;
        // Accept URLs with image extensions or from known image domains
        return url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i) || 
               url.match(/(amazon|flipkart|meesho|media|images?)\//i);
      })
      .map((url: string) => {
        // Clean up URLs (remove trailing characters that might break them)
        return url.replace(/[.,;!?)\]}]+$/, '');
      });

    console.log(`✅ Perplexity found ${uniqueUrls.length} image URL(s) after filtering`);
    return uniqueUrls.slice(0, 10); // Return up to 10 URLs
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Perplexity AI search error:', errorMessage);
    return [];
  }
}

/**
 * Download and validate an image from URL
 */
async function downloadAndValidateImage(imageUrl: string): Promise<{
  success: boolean;
  imageData?: string;
  error?: string;
}> {
  try {
    console.log(`📥 Downloading image from: ${imageUrl.substring(0, 100)}...`);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      return {
        success: false,
        error: `Invalid content type: ${contentType}`,
      };
    }

    // Download image as buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate it's actually an image by checking magic bytes
    const isValidImage = validateImageBuffer(buffer);
    if (!isValidImage) {
      return {
        success: false,
        error: 'File is not a valid image',
      };
    }

    // Convert to base64 data URL
    const base64 = buffer.toString('base64');
    const mimeType = contentType || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log(`✅ Image downloaded and validated (${Math.round(buffer.length / 1024)}KB)`);

    return {
      success: true,
      imageData: dataUrl,
    };
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      return {
        success: false,
        error: 'Download timeout',
      };
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage || 'Failed to download image',
    };
  }
}

/**
 * Validate image buffer by checking magic bytes
 */
function validateImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  // Check for common image formats
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  
  // WebP: Check for "RIFF" header and "WEBP" chunk
  if (buffer.length >= 12) {
    const header = buffer.toString('ascii', 0, 4);
    const webp = buffer.toString('ascii', 8, 12);
    if (header === 'RIFF' && webp === 'WEBP') return true;
  }
  
  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) return true;

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, brand } = body;

    if (!productName) {
      return NextResponse.json(
        { success: false, error: 'Product name is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Fetching image for: ${productName}${brand ? ` (Brand: ${brand})` : ''}`);

    // Check Perplexity configuration
    const config = checkPerplexityConfig();
    if (!config.hasConfig) {
      return NextResponse.json(
        {
          success: false,
          error: 'Perplexity AI not configured. Please set PERPLEXITY_API_KEY in .env.local',
        },
        { status: 500 }
      );
    }

    // Search Perplexity AI for product images
    const imageUrls = await searchPerplexityForImages(productName, brand);

    if (imageUrls.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No images found for this product. Please try manual upload.',
          query: productName,
        },
        { status: 404 }
      );
    }

    console.log(`✅ Found ${imageUrls.length} image URL(s) to try`);

    // Try each URL until one works
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      console.log(`📥 Trying image ${i + 1}/${imageUrls.length}: ${url.substring(0, 100)}...`);
      
      try {
        const imageResult = await downloadAndValidateImage(url);
        
        if (imageResult.success && imageResult.imageData) {
          // Success! Return the image
          console.log(`✅ Successfully downloaded image from URL ${i + 1}`);
          return NextResponse.json({
            success: true,
            imageUrl: imageResult.imageData, // base64 data URL
            source: 'perplexity_ai',
            query: productName,
            confidence: 0.9,
            originalUrl: url, // Keep original URL for reference
          });
        } else {
          console.warn(`⚠️ Image ${i + 1} validation failed: ${imageResult.error}`);
          // Try next URL
          continue;
        }
      } catch (downloadError) {
        const errorMessage = downloadError instanceof Error ? downloadError.message : String(downloadError);
        console.error(`❌ Error downloading image ${i + 1}:`, errorMessage);
        // Try next URL
        continue;
      }
    }
    
    // All URLs failed - return the first one anyway with warning
    console.warn(`⚠️ All ${imageUrls.length} image URL(s) failed validation`);
    return NextResponse.json({
      success: true,
      imageUrl: imageUrls[0],
      source: 'perplexity_ai',
      query: productName,
      confidence: 0.5, // Lower confidence since validation failed
      warning: 'All image URLs failed validation, using first URL directly',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error fetching product image:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage || 'Failed to fetch product image' 
      },
      { status: 500 }
    );
  }
}
