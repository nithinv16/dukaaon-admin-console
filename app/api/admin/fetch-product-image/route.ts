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

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online', // Online model for real-time web search
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that finds product images. Extract image URLs from web search results and return them as a JSON array.',
          },
          {
            role: 'user',
            content: `Find product images for: ${finalQuery}

Search the web for this product and extract DIRECT image URLs from:
- Amazon India (amazon.in)
- Flipkart (flipkart.com)
- Meesho (meesho.com)
- Manufacturer websites
- E-commerce product pages

Return ONLY a JSON array of image URLs (direct links to .jpg, .png, .webp files):
["https://image-url-1.com/image.jpg", "https://image-url-2.com/image.jpg", ...]

Extract at least 5-10 image URLs from the search results. Only include URLs that are direct links to image files.`,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Perplexity API error: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      console.warn('⚠️ Perplexity returned empty response');
      return [];
    }

    console.log(`📥 Perplexity response: ${content.substring(0, 200)}...`);

    // Extract image URLs from response
    // Perplexity might return JSON array or text with URLs
    const imageUrls: string[] = [];

    // Try to parse as JSON array first
    try {
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          imageUrls.push(...parsed.filter((url: any) => typeof url === 'string' && url.startsWith('http')));
        }
      }
    } catch (e) {
      // Not JSON, try extracting URLs from text
    }

    // Extract URLs from text using regex
    const urlRegex = /https?:\/\/[^\s"<>]+\.(jpg|jpeg|png|webp|gif)/gi;
    const matches = content.match(urlRegex);
    if (matches) {
      imageUrls.push(...matches);
    }

    // Also look for URLs in markdown format
    const markdownUrlRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/gi;
    let match;
    while ((match = markdownUrlRegex.exec(content)) !== null) {
      if (match[1] && match[1].startsWith('http')) {
        imageUrls.push(match[1]);
      }
    }

    // Remove duplicates and filter valid URLs
    const uniqueUrls = Array.from(new Set(imageUrls))
      .filter((url: string) => url && url.startsWith('http') && (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp') || url.includes('.gif') || url.match(/\/images?\//i)));

    console.log(`✅ Perplexity found ${uniqueUrls.length} image URL(s)`);
    return uniqueUrls.slice(0, 10); // Return up to 10 URLs
  } catch (error: any) {
    console.error('❌ Perplexity AI search error:', error.message);
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
  } catch (error: any) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return {
        success: false,
        error: 'Download timeout',
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to download image',
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
      } catch (downloadError: any) {
        console.error(`❌ Error downloading image ${i + 1}:`, downloadError.message);
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

  } catch (error: any) {
    console.error('❌ Error fetching product image:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch product image' 
      },
      { status: 500 }
    );
  }
}
