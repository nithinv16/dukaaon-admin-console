import { NextRequest, NextResponse } from 'next/server';
import { categorizeProductWithWebSearch, batchCategorizeWithWebSearch } from '@/lib/awsBedrockEnhanced';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products, categories, subcategories, batch } = body;

    // Validate input
    if (!products || !Array.isArray(products)) {
      return NextResponse.json(
        { error: 'Products array is required' },
        { status: 400 }
      );
    }

    if (!categories || !Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'Categories array is required' },
        { status: 400 }
      );
    }

    if (!subcategories || typeof subcategories !== 'object') {
      return NextResponse.json(
        { error: 'Subcategories object is required' },
        { status: 400 }
      );
    }

    // Handle batch categorization
    if (batch === true && products.length > 1) {
      const results = await batchCategorizeWithWebSearch(
        products.map((p: any) => ({ name: p.name, brand: p.brand })),
        categories,
        subcategories
      );

      return NextResponse.json({
        success: true,
        results,
      });
    }

    // Handle single product categorization
    const product = products[0];
    if (!product || !product.name) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    const result = await categorizeProductWithWebSearch(
      product.name,
      product.brand,
      categories,
      subcategories
    );

    return NextResponse.json({
      ...result,
    });
  } catch (error: any) {
    console.error('Error in enhanced categorization API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to categorize products' },
      { status: 500 }
    );
  }
}


