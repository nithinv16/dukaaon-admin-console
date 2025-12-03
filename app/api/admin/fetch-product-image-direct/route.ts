/**
 * API Route: /api/admin/fetch-product-image-direct
 * 
 * Alternative implementation that calls Google/Bing APIs directly (no Lambda required)
 * Use this if you don't want to set up AWS Lambda
 */

import { NextRequest, NextResponse } from 'next/server';

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

    // Build search query
    const searchQuery = brand 
      ? `${brand} ${productName}`.trim()
      : productName.trim();

    console.log(`Fetching image for: "${searchQuery}"`);

    // Try Google Custom Search API first
    const googleImage = await searchGoogleImages(searchQuery);
    if (googleImage) {
      return NextResponse.json({
        success: true,
        imageUrl: googleImage,
        source: 'google',
        query: searchQuery,
      });
    }

    // Fallback to Bing Image Search API
    const bingImage = await searchBingImages(searchQuery);
    if (bingImage) {
      return NextResponse.json({
        success: true,
        imageUrl: bingImage,
        source: 'bing',
        query: searchQuery,
      });
    }

    // No image found
    return NextResponse.json(
      {
        success: false,
        error: 'No image found for this product',
        query: searchQuery,
      },
      { status: 404 }
    );

  } catch (error: any) {
    console.error('Error fetching product image:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch product image',
      },
      { status: 500 }
    );
  }
}

/**
 * Search Google Images using Custom Search API
 */
async function searchGoogleImages(query: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    console.warn('Google Custom Search API credentials not configured');
    return null;
  }

  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodedQuery}&searchType=image&num=5&safe=active`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      // Filter for product images (prefer images with good dimensions)
      const validImages = data.items.filter((item: any) => {
        const width = item.image?.width || 0;
        const height = item.image?.height || 0;
        // Prefer images that are at least 200x200 and not too large
        return width >= 200 && height >= 200 && width <= 2000 && height <= 2000;
      });

      if (validImages.length > 0) {
        return validImages[0].link;
      }

      // If no valid images, return first result
      return data.items[0].link;
    }

    return null;
  } catch (error) {
    console.error('Google Images search error:', error);
    return null;
  }
}

/**
 * Search Bing Images using Bing Image Search API
 */
async function searchBingImages(query: string): Promise<string | null> {
  const apiKey = process.env.BING_IMAGE_SEARCH_API_KEY;

  if (!apiKey) {
    console.warn('Bing Image Search API key not configured');
    return null;
  }

  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.bing.microsoft.com/v7.0/images/search?q=${encodedQuery}&count=5&safeSearch=Strict&imageType=Photo`;

    const response = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Bing API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.value && data.value.length > 0) {
      // Filter for product images with good dimensions
      const validImages = data.value.filter((item: any) => {
        const width = item.width || 0;
        const height = item.height || 0;
        return width >= 200 && height >= 200 && width <= 2000 && height <= 2000;
      });

      if (validImages.length > 0) {
        return validImages[0].contentUrl;
      }

      // If no valid images, return first result
      return data.value[0].contentUrl;
    }

    return null;
  } catch (error) {
    console.error('Bing Images search error:', error);
    return null;
  }
}

