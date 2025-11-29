import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * PUT /api/admin/categories/move-subcategory
 * Moves a subcategory to a different parent category
 * Also updates all products that belong to that subcategory
 * 
 * Request body:
 * - subcategoryId: string (required) - ID of the subcategory to move
 * - newCategoryId: string (required) - ID of the new parent category
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { subcategoryId, newCategoryId } = body;

    // Validate required fields
    if (!subcategoryId) {
      return NextResponse.json(
        { error: 'subcategoryId is required' },
        { status: 400 }
      );
    }

    if (!newCategoryId) {
      return NextResponse.json(
        { error: 'newCategoryId is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    // Verify subcategory exists
    const { data: subcategory, error: subError } = await supabase
      .from('subcategories')
      .select('id, name, category_id')
      .eq('id', subcategoryId)
      .single();

    if (subError || !subcategory) {
      return NextResponse.json(
        { error: 'Subcategory not found' },
        { status: 404 }
      );
    }

    // Verify new parent category exists
    const { data: newCategory, error: categoryError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('id', newCategoryId)
      .single();

    if (categoryError || !newCategory) {
      return NextResponse.json(
        { error: 'New parent category not found' },
        { status: 404 }
      );
    }

    // If moving to the same category, return early
    if (subcategory.category_id === newCategoryId) {
      return NextResponse.json({
        success: true,
        message: 'Subcategory is already in this category',
        subcategory,
        productsUpdated: 0
      });
    }

    // Get old category name for product updates
    const { data: oldCategory } = await supabase
      .from('categories')
      .select('name')
      .eq('id', subcategory.category_id)
      .single();

    // Update subcategory's parent category
    const { error: updateError } = await supabase
      .from('subcategories')
      .update({ category_id: newCategoryId })
      .eq('id', subcategoryId);

    if (updateError) {
      console.error('Error updating subcategory:', updateError);
      return NextResponse.json(
        { error: 'Failed to update subcategory', details: updateError.message },
        { status: 500 }
      );
    }

    // Update all products that belong to this subcategory
    // Products are matched by category name and subcategory name
    let productsUpdated = 0;
    if (oldCategory) {
      const { data: productsToUpdate, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('category', oldCategory.name)
        .eq('subcategory', subcategory.name);

      if (productsError) {
        console.error('Error finding products to update:', productsError);
      } else if (productsToUpdate && productsToUpdate.length > 0) {
        const { error: productsUpdateError } = await supabase
          .from('products')
          .update({ category: newCategory.name })
          .in('id', productsToUpdate.map(p => p.id));

        if (productsUpdateError) {
          console.error('Error updating products:', productsUpdateError);
        } else {
          productsUpdated = productsToUpdate.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Subcategory moved successfully',
      subcategory: {
        ...subcategory,
        category_id: newCategoryId
      },
      productsUpdated
    });
  } catch (error: any) {
    console.error('Error in move-subcategory PUT:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to move subcategory' },
      { status: 500 }
    );
  }
}

