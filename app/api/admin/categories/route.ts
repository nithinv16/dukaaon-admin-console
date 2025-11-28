import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';
import { generateSlug } from '@/lib/categoryUtils';

/**
 * GET /api/admin/categories
 * Fetches all categories and subcategories from the database
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminSupabaseClient();

    // Fetch categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, slug')
      .order('name', { ascending: true });

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return NextResponse.json(
        { error: 'Failed to fetch categories', details: categoriesError.message },
        { status: 500 }
      );
    }

    // Fetch subcategories
    const { data: subcategories, error: subcategoriesError } = await supabase
      .from('subcategories')
      .select('id, category_id, name, slug')
      .order('name', { ascending: true });

    if (subcategoriesError) {
      console.error('Error fetching subcategories:', subcategoriesError);
      return NextResponse.json(
        { error: 'Failed to fetch subcategories', details: subcategoriesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      categories: categories || [],
      subcategories: subcategories || []
    });
  } catch (error: any) {
    console.error('Error in categories GET:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}


/**
 * POST /api/admin/categories
 * Creates a new category or subcategory
 * 
 * Request body:
 * - name: string (required) - The name of the category/subcategory
 * - type: 'category' | 'subcategory' (required) - The type to create
 * - category_id: string (required for subcategory) - Parent category ID
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, category_id } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!type || !['category', 'subcategory'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be either "category" or "subcategory"' },
        { status: 400 }
      );
    }

    if (type === 'subcategory' && !category_id) {
      return NextResponse.json(
        { error: 'category_id is required for subcategories' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();
    const slug = generateSlug(name);

    if (type === 'category') {
      // Check if category with same slug already exists
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', slug)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 }
        );
      }

      // Insert new category
      const { data: category, error: insertError } = await supabase
        .from('categories')
        .insert({ name: name.trim(), slug })
        .select('id, name, slug')
        .single();

      if (insertError) {
        console.error('Error creating category:', insertError);
        return NextResponse.json(
          { error: 'Failed to create category', details: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: category
      });
    } else {
      // Verify parent category exists
      const { data: parentCategory, error: parentError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', category_id)
        .single();

      if (parentError || !parentCategory) {
        return NextResponse.json(
          { error: 'Parent category not found' },
          { status: 404 }
        );
      }

      // Check if subcategory with same slug already exists for this category
      const { data: existing } = await supabase
        .from('subcategories')
        .select('id')
        .eq('category_id', category_id)
        .eq('slug', slug)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'A subcategory with this name already exists in this category' },
          { status: 409 }
        );
      }

      // Insert new subcategory
      const { data: subcategory, error: insertError } = await supabase
        .from('subcategories')
        .insert({ 
          name: name.trim(), 
          slug, 
          category_id 
        })
        .select('id, category_id, name, slug')
        .single();

      if (insertError) {
        console.error('Error creating subcategory:', insertError);
        return NextResponse.json(
          { error: 'Failed to create subcategory', details: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: subcategory
      });
    }
  } catch (error: any) {
    console.error('Error in categories POST:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}
