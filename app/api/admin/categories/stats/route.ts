import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * GET /api/admin/categories/stats
 * Fetches category statistics from the database
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminSupabaseClient();

    // Get total categories count
    const { count: totalCategories, error: categoriesCountError } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true });

    if (categoriesCountError) {
      console.error('Error counting categories:', categoriesCountError);
    }

    // Get active categories (assuming all categories are active by default)
    // If there's a status field, filter by it
    const { count: activeCategories, error: activeCategoriesError } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true });

    if (activeCategoriesError) {
      console.error('Error counting active categories:', activeCategoriesError);
    }

    // Get total subcategories count
    const { count: totalSubcategories, error: subcategoriesCountError } = await supabase
      .from('subcategories')
      .select('*', { count: 'exact', head: true });

    if (subcategoriesCountError) {
      console.error('Error counting subcategories:', subcategoriesCountError);
    }

    // Get total products count
    const { count: totalProducts, error: productsCountError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    if (productsCountError) {
      console.error('Error counting products:', productsCountError);
    }

    return NextResponse.json({
      totalCategories: totalCategories || 0,
      activeCategories: activeCategories || 0,
      totalSubcategories: totalSubcategories || 0,
      totalProducts: totalProducts || 0,
    });
  } catch (error: any) {
    console.error('Error in categories stats GET:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch category statistics' },
      { status: 500 }
    );
  }
}

