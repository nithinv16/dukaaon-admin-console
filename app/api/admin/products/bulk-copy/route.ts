import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * POST /api/admin/products/bulk-copy
 * Copies multiple products to a new category/subcategory
 * 
 * Request body:
 * - productIds: string[] (required) - Array of product IDs to copy
 * - targetCategory: string (required) - Target category name
 * - targetSubcategory: string (optional) - Target subcategory name
 * 
 * Response:
 * - success: boolean
 * - copiedCount: number - Count of successfully copied products
 * - failedProducts: Array<{ id: string; error: string }> - Products that failed to copy
 * 
 * Requirements: 5.8, 5.9
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
    let copiedCount = 0;

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

    // Prepare category/subcategory data
    let subcategoryData: any = null;
    if (targetSubcategory) {
      const { data: subData, error: subcategoryError } = await supabase
        .from('subcategories')
        .select('id, name')
        .ilike('name', targetSubcategory)
        .eq('category_id', categoryData.id)
        .single();

      if (subcategoryError || !subData) {
        return NextResponse.json(
          { error: `Subcategory "${targetSubcategory}" not found under category "${targetCategory}"` },
          { status: 404 }
        );
      }
      subcategoryData = subData;
    }

    // Fetch the original products
    const { data: originalProducts, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (fetchError) {
      console.error('Error fetching products for copy:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch products for copying' },
        { status: 500 }
      );
    }

    if (!originalProducts || originalProducts.length === 0) {
      return NextResponse.json(
        { error: 'No products found with the provided IDs' },
        { status: 404 }
      );
    }

    // Track which products were found
    const foundIds = new Set(originalProducts.map((p: any) => p.id));
    for (const productId of productIds) {
      if (!foundIds.has(productId)) {
        failedProducts.push({
          id: productId,
          error: 'Product not found'
        });
      }
    }

    // Create copies of each product with new category
    for (const product of originalProducts) {
      try {
        // Create a copy without the id (let database generate new one)
        const { id, created_at, updated_at, ...productData } = product;
        
        const newProduct = {
          ...productData,
          category: categoryData.name,
          subcategory: subcategoryData?.name || null,
          category_id: categoryData.id,
          subcategory_id: subcategoryData?.id || null,
          // Update timestamps
          created_at: new Date().toISOString()
        };

        const { data: insertedProduct, error: insertError } = await supabase
          .from('products')
          .insert(newProduct)
          .select('id')
          .single();

        if (insertError) {
          failedProducts.push({
            id: product.id,
            error: insertError.message || 'Failed to copy product'
          });
        } else {
          copiedCount++;
        }
      } catch (err: any) {
        failedProducts.push({
          id: product.id,
          error: err.message || 'Failed to copy product'
        });
      }
    }

    return NextResponse.json({
      success: failedProducts.length === 0,
      copiedCount,
      failedProducts
    });
  } catch (error: any) {
    console.error('Error in bulk copy API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to copy products' },
      { status: 500 }
    );
  }
}
