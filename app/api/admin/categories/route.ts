import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';
import { generateSlug } from '@/lib/categoryUtils';

/**
 * GET /api/admin/categories
 * Fetches all categories and subcategories from the database with product counts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminSupabaseClient();

    // Fetch categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, slug, created_at')
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
      .select('id, category_id, name, slug, created_at')
      .order('name', { ascending: true });

    if (subcategoriesError) {
      console.error('Error fetching subcategories:', subcategoriesError);
      return NextResponse.json(
        { error: 'Failed to fetch subcategories', details: subcategoriesError.message },
        { status: 500 }
      );
    }

    // Count products per category and subcategory
    // Products are linked by matching the category/subcategory name (text field)
    const { data: allProducts } = await supabase
      .from('products')
      .select('category, subcategory');

    // Helper function for case-insensitive comparison
    const normalizeName = (name: string) => name?.toLowerCase().trim() || '';

    // Calculate product counts for categories (case-insensitive)
    const categoryCounts: { [key: string]: number } = {};
    if (allProducts) {
      allProducts.forEach((product: any) => {
        if (product.category) {
          const normalizedCategory = normalizeName(product.category);
          categoryCounts[normalizedCategory] = (categoryCounts[normalizedCategory] || 0) + 1;
        }
      });
    }

    // Calculate product counts for subcategories (case-insensitive)
    const subcategoryCounts: { [key: string]: { [key: string]: number } } = {};
    if (allProducts) {
      allProducts.forEach((product: any) => {
        if (product.category && product.subcategory) {
          const normalizedCategory = normalizeName(product.category);
          const normalizedSubcategory = normalizeName(product.subcategory);
          if (!subcategoryCounts[normalizedCategory]) {
            subcategoryCounts[normalizedCategory] = {};
          }
          subcategoryCounts[normalizedCategory][normalizedSubcategory] = 
            (subcategoryCounts[normalizedCategory][normalizedSubcategory] || 0) + 1;
        }
      });
    }

    // Nest subcategories under categories and add product counts (case-insensitive matching)
    const categoriesWithSubcategories = (categories || []).map((category: any) => {
      const normalizedCategoryName = normalizeName(category.name);
      
      const categorySubcategories = (subcategories || [])
        .filter((sub: any) => sub.category_id === category.id)
        .map((sub: any) => {
          const normalizedSubcategoryName = normalizeName(sub.name);
          return {
            ...sub,
            product_count: subcategoryCounts[normalizedCategoryName]?.[normalizedSubcategoryName] || 0,
            description: '',
            status: 'active' as const,
            parent_id: category.id,
          };
        });

      return {
        ...category,
        description: '',
        status: 'active' as const,
        product_count: categoryCounts[normalizedCategoryName] || 0,
        subcategories: categorySubcategories,
      };
    });

    return NextResponse.json({
      categories: categoriesWithSubcategories,
      subcategories: subcategories || []
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
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

/**
 * PUT /api/admin/categories
 * Updates an existing category or subcategory
 * 
 * Request body:
 * - id: string (required) - The ID of the category/subcategory to update
 * - type: 'category' | 'subcategory' (required) - The type to update
 * - name: string (optional) - The new name
 * - category_id: string (optional for subcategory) - New parent category ID
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, type, name, category_id } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    if (!type || !['category', 'subcategory'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be either "category" or "subcategory"' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    if (type === 'category') {
      const updateData: any = {};
      
      if (name && typeof name === 'string' && name.trim().length > 0) {
        const slug = generateSlug(name.trim());
        
        // Check if another category with same slug exists
        const { data: existing } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', slug)
          .neq('id', id)
          .single();

        if (existing) {
          return NextResponse.json(
            { error: 'A category with this name already exists' },
            { status: 409 }
          );
        }

        updateData.name = name.trim();
        updateData.slug = slug;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: 'No valid fields to update' },
          { status: 400 }
        );
      }

      const { data: category, error: updateError } = await supabase
        .from('categories')
        .update(updateData)
        .eq('id', id)
        .select('id, name, slug')
        .single();

      if (updateError) {
        console.error('Error updating category:', updateError);
        return NextResponse.json(
          { error: 'Failed to update category', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: category
      });
    } else {
      // Update subcategory
      const updateData: any = {};
      
      if (name && typeof name === 'string' && name.trim().length > 0) {
        updateData.name = name.trim();
        updateData.slug = generateSlug(name.trim());
      }

      if (category_id) {
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

        updateData.category_id = category_id;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: 'No valid fields to update' },
          { status: 400 }
        );
      }

      // Check for duplicate slug if name is being updated
      if (updateData.slug) {
        const { data: currentSubcategory } = await supabase
          .from('subcategories')
          .select('category_id')
          .eq('id', id)
          .single();

        const parentCategoryId = updateData.category_id || currentSubcategory?.category_id;

        if (parentCategoryId) {
          const { data: existing } = await supabase
            .from('subcategories')
            .select('id')
            .eq('category_id', parentCategoryId)
            .eq('slug', updateData.slug)
            .neq('id', id)
            .single();

          if (existing) {
            return NextResponse.json(
              { error: 'A subcategory with this name already exists in this category' },
              { status: 409 }
            );
          }
        }
      }

      const { data: subcategory, error: updateError } = await supabase
        .from('subcategories')
        .update(updateData)
        .eq('id', id)
        .select('id, category_id, name, slug')
        .single();

      if (updateError) {
        console.error('Error updating subcategory:', updateError);
        return NextResponse.json(
          { error: 'Failed to update subcategory', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: subcategory
      });
    }
  } catch (error: any) {
    console.error('Error in categories PUT:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update category' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/categories
 * Deletes a category or subcategory and handles orphaned products
 * 
 * Request body:
 * - id: string (required) - The ID of the category/subcategory to delete
 * - type: 'category' | 'subcategory' (required) - The type to delete
 * 
 * For categories: Sets category and subcategory to null for all products in that category
 * For subcategories: Sets only subcategory to null, preserves parent category
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, type } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    if (!type || !['category', 'subcategory'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be either "category" or "subcategory"' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    if (type === 'category') {
      // Get the category first
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('id', id)
        .single();

      if (categoryError || !category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }

      // Count products that reference this category by category_id
      const { count: productCount, error: countError } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id);

      if (countError) {
        console.error('Error counting products:', countError);
      }

      const orphanedCount = productCount || 0;

      // Update products to set category_id and subcategory_id to null
      // This removes the foreign key constraint so we can delete the category
      if (orphanedCount > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            category_id: null, 
            subcategory_id: null
          })
          .eq('category_id', id);

        if (updateError) {
          console.error('Error orphaning products:', updateError);
          return NextResponse.json(
            { error: 'Failed to update products before deletion', details: updateError.message },
            { status: 500 }
          );
        }
      }

      // Delete all subcategories for this category
      const { error: subDeleteError } = await supabase
        .from('subcategories')
        .delete()
        .eq('category_id', id);

      if (subDeleteError) {
        console.error('Error deleting subcategories:', subDeleteError);
        return NextResponse.json(
          { error: 'Failed to delete subcategories', details: subDeleteError.message },
          { status: 500 }
        );
      }

      // Delete category
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting category:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete category', details: deleteError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Category deleted successfully',
        orphanedProducts: orphanedCount
      });
    } else {
      // Get the subcategory details first
      const { data: subcategory, error: subcategoryError } = await supabase
        .from('subcategories')
        .select('id, name, category_id')
        .eq('id', id)
        .single();

      if (subcategoryError || !subcategory) {
        return NextResponse.json(
          { error: 'Subcategory not found' },
          { status: 404 }
        );
      }

      // Count products that reference this subcategory by subcategory_id
      const { count: productCount, error: countError } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('subcategory_id', id);

      if (countError) {
        console.error('Error counting products:', countError);
      }

      const affectedCount = productCount || 0;

      // Update products to set only subcategory_id to null, preserve category_id
      // This removes the foreign key constraint so we can delete the subcategory
      if (affectedCount > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ subcategory_id: null })
          .eq('subcategory_id', id);

        if (updateError) {
          console.error('Error updating products:', updateError);
          return NextResponse.json(
            { error: 'Failed to update products before deletion', details: updateError.message },
            { status: 500 }
          );
        }
      }

      // Delete subcategory
      const { error: deleteError } = await supabase
        .from('subcategories')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting subcategory:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete subcategory', details: deleteError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Subcategory deleted successfully',
        affectedProducts: affectedCount
      });
    }
  } catch (error: any) {
    console.error('Error in categories DELETE:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete category' },
      { status: 500 }
    );
  }
}
