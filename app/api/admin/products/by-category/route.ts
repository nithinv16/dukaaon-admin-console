import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * GET /api/admin/products/by-category
 * Fetches products filtered by category and/or subcategory
 * 
 * Query parameters:
 * - category: string (optional) - Filter by category name
 * - subcategory: string (optional) - Filter by subcategory name
 * - limit: number (optional) - Limit number of results (default: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const supabase = getAdminSupabaseClient();
    let query = supabase
      .from('products')
      .select('id, name, category, subcategory, image_url, price, stock_available, status')
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    if (subcategory) {
      query = query.eq('subcategory', subcategory);
    }

    const { data: products, error: productsError } = await query.order('name', { ascending: true });

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch products', details: productsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      products: products || [],
      count: products?.length || 0
    });
  } catch (error: any) {
    console.error('Error in products by-category GET:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

