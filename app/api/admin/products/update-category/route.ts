import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * PUT /api/admin/products/update-category
 * Updates category and/or subcategory for one or more products
 * 
 * Request body:
 * - productIds: string[] (required) - Array of product IDs to update
 * - category: string (optional) - New category name
 * - subcategory: string | null (optional) - New subcategory name (null to remove)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds, category, subcategory } = body;

    // Validate required fields
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();
    const updateData: any = {};

    if (category !== undefined) {
      updateData.category = category;
    }

    if (subcategory !== undefined) {
      updateData.subcategory = subcategory;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'At least one of category or subcategory must be provided' },
        { status: 400 }
      );
    }

    // Update products
    const { data: updatedProducts, error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .in('id', productIds)
      .select('id, name, category, subcategory');

    if (updateError) {
      console.error('Error updating products:', updateError);
      return NextResponse.json(
        { error: 'Failed to update products', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedCount: updatedProducts?.length || 0,
      products: updatedProducts
    });
  } catch (error: any) {
    console.error('Error in products update-category PUT:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update product category' },
      { status: 500 }
    );
  }
}

