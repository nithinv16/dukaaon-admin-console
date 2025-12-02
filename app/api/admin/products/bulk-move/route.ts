import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * POST /api/admin/products/bulk-move
 * Moves multiple products to a new category/subcategory
 * Also updates category_id and subcategory_id by looking up IDs from names
 * 
 * Request body:
 * - productIds: string[] (required) - Array of product IDs to move
 * - targetCategory: string (required) - Target category name
 * - targetSubcategory: string (optional) - Target subcategory name
 * 
 * Response:
 * - success: boolean
 * - movedCount: number - Count of successfully moved products
 * - failedProducts: Array<{ id: string; error: string }> - Products that failed to move
 * 
 * Requirements: 5.6, 5.7
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds, targetCategory, targetSubcategory } = body;

    // Validate required fields
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!targetCategory) {
      return NextResponse.json(
        { error: 'targetCategory is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();
    const failedProducts: Array<{ id: string; error: string }> = [];
    let movedCount = 0;

    // Look up category ID by name (case-insensitive)
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id, name')
      .ilike('name', targetCategory)
      .single();

    if (categoryError || !categoryData) {
      return NextResponse.json(
        { error: `Category "${targetCategory}" not found in database` },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: {
      category: string;
      subcategory: string | null;
      category_id: string;
      subcategory_id: string | null;
    } = {
      category: categoryData.name, // Use the exact name from database
      subcategory: targetSubcategory || null,
      category_id: categoryData.id,
      subcategory_id: null
    };

    // If subcategory is provided, look it up
    if (targetSubcategory) {
      const { data: subcategoryData, error: subcategoryError } = await supabase
        .from('subcategories')
        .select('id, name')
        .ilike('name', targetSubcategory)
        .eq('category_id', categoryData.id)
        .single();

      if (subcategoryError || !subcategoryData) {
        return NextResponse.json(
          { error: `Subcategory "${targetSubcategory}" not found under category "${targetCategory}"` },
          { status: 404 }
        );
      }

      updateData.subcategory = subcategoryData.name; // Use exact name from database
      updateData.subcategory_id = subcategoryData.id;
    }

    // Update all products in a single query for atomicity
    const { data: updatedProducts, error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .in('id', productIds)
      .select('id, name, category, subcategory, category_id, subcategory_id');

    if (updateError) {
      console.error('Error in bulk move operation:', updateError);
      // If the bulk update fails, try individual updates to identify which products failed
      for (const productId of productIds) {
        const { error: individualError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', productId);

        if (individualError) {
          failedProducts.push({
            id: productId,
            error: individualError.message || 'Failed to move product'
          });
        } else {
          movedCount++;
        }
      }
    } else {
      // All products updated successfully
      movedCount = updatedProducts?.length || 0;

      // Check if any products were not found (not in the result)
      const updatedIds = new Set(updatedProducts?.map((p: any) => p.id) || []);
      for (const productId of productIds) {
        if (!updatedIds.has(productId)) {
          failedProducts.push({
            id: productId,
            error: 'Product not found'
          });
        }
      }
    }

    return NextResponse.json({
      success: failedProducts.length === 0,
      movedCount,
      failedProducts
    });
  } catch (error: any) {
    console.error('Error in bulk move API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to move products' },
      { status: 500 }
    );
  }
}
