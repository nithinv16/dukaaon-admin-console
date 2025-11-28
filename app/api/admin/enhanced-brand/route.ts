import { NextRequest, NextResponse } from 'next/server';
import { identifyBrandWithWebSearch, batchIdentifyBrandsWithWebSearch } from '@/lib/awsBedrockEnhanced';
import { createClient } from '@supabase/supabase-js';

/**
 * Enhanced Brand Mapping API Route with Web Search
 * Uses Claude 3.5 Sonnet + web search for better brand identification
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products, batch } = body;

    // Validate input
    if (!products || !Array.isArray(products)) {
      return NextResponse.json(
        { error: 'Products array is required' },
        { status: 400 }
      );
    }

    // Fetch existing brands from database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let existingBrands: string[] = [];
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase
          .from('master_products')
          .select('brand')
          .not('brand', 'is', null)
          .not('brand', 'eq', '');

        const brands = new Set<string>();
        for (const row of data || []) {
          if (row.brand && row.brand.trim()) {
            brands.add(row.brand.trim());
          }
        }
        existingBrands = Array.from(brands).sort();
      } catch (error) {
        console.warn('Failed to fetch existing brands, continuing without:', error);
      }
    }

    // Handle batch brand identification
    if (batch === true && products.length > 1) {
      const results = await batchIdentifyBrandsWithWebSearch(
        products.map((p: any) => ({ name: p.name })),
        existingBrands
      );

      return NextResponse.json({
        success: true,
        results,
      });
    }

    // Handle single product brand identification
    const product = products[0];
    if (!product || !product.name) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    const result = await identifyBrandWithWebSearch(product.name, existingBrands);

    return NextResponse.json({
      ...result,
    });
  } catch (error: any) {
    console.error('Error in enhanced brand mapping API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to identify brands' },
      { status: 500 }
    );
  }
}


