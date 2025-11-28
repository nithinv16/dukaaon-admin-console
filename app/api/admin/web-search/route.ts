import { NextRequest, NextResponse } from 'next/server';

/**
 * Web Search API Route
 * Provides server-side web search using Google Custom Search API
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, type } = body; // type: 'product' | 'brand'

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const WEB_SEARCH_API_KEY = process.env.WEB_SEARCH_API_KEY;
    const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

    if (!WEB_SEARCH_API_KEY || !GOOGLE_CSE_ID) {
      // Return empty result if web search is not configured (graceful degradation)
      return NextResponse.json({
        success: true,
        results: [],
        message: 'Web search not configured'
      });
    }

    // Build search query based on type
    let searchQuery = query;
    if (type === 'product') {
      searchQuery = `${query} product category ecommerce`;
    } else if (type === 'brand') {
      searchQuery = `${query} brand manufacturer company`;
    }

    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${WEB_SEARCH_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(searchQuery)}&num=3`;

    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.warn('Web search API request failed:', response.statusText);
      return NextResponse.json({
        success: true,
        results: [],
        message: 'Web search temporarily unavailable'
      });
    }

    const data = await response.json();
    const results = data.items || [];

    // Extract snippets from search results
    const snippets = results
      .slice(0, 3)
      .map((item: any) => item.snippet || item.title)
      .filter(Boolean)
      .join('\n\n');

    return NextResponse.json({
      success: true,
      results: snippets ? [snippets] : [],
      raw: results
    });

  } catch (error: any) {
    console.error('Error in web search API:', error);
    // Return empty result on error (graceful degradation)
    return NextResponse.json({
      success: true,
      results: [],
      error: error.message
    });
  }
}


