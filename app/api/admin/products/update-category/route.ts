import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * PUT /api/admin/products/update-category
 * Updates category and/or subcategory for one or more products
 * Also updates category_id and subcategory_id by looking up IDs from names
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

    // If category is provided, look up category_id
    if (category !== undefined) {
      updateData.category = category;

      if (category) {
        // Look up category ID by name (case-insensitive)
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('id')
          .ilike('name', category)
          .single();

        if (categoryError || !categoryData) {
          return NextResponse.json(
            { error: `Category "${category}" not found in database` },
            { status: 404 }
          );
        }

        updateData.category_id = categoryData.id;
      } else {
        // If category is empty/null, clear both category and category_id
        updateData.category_id = null;
      }
    }

    // If subcategory is provided, look up subcategory_id
    if (subcategory !== undefined) {
      updateData.subcategory = subcategory;

      if (subcategory && updateData.category_id) {
        // Look up subcategory ID by name AND category_id (case-insensitive)
        const { data: subcategoryData, error: subcategoryError } = await supabase
          .from('subcategories')
          .select('id, category_id')
          .ilike('name', subcategory)
          .eq('category_id', updateData.category_id)
          .single();

        if (subcategoryError || !subcategoryData) {
          return NextResponse.json(
            { error: `Subcategory "${subcategory}" not found under category "${category}"` },
            { status: 404 }
          );
        }

        updateData.subcategory_id = subcategoryData.id;
      } else {
        // If subcategory is empty/null, clear subcategory_id
        updateData.subcategory_id = null;
      }
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
      .select('id, name, category, subcategory, category_id, subcategory_id');

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

