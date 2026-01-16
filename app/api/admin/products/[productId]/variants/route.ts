import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * GET /api/admin/products/[productId]/variants
 * Get all variants for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { productId } = params;

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('variant_type', { ascending: true });

    if (error) {
      console.error('Error fetching variants:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch variants' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [], success: true });
  } catch (error: any) {
    console.error('Error in GET /api/admin/products/[productId]/variants:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch variants' },
      { status: 500 }
    );
  }
}

