import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * PATCH /api/admin/products/variants/[variantId]
 * Update a variant
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { variantId: string } }
) {
  try {
    const { variantId } = params;
    const updates = await request.json();

    if (!variantId) {
      return NextResponse.json(
        { error: 'Variant ID is required' },
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

    // Validate variant_type if provided
    if (updates.variant_type && !['size', 'flavor', 'color', 'weight', 'pack'].includes(updates.variant_type)) {
      return NextResponse.json(
        { error: `Invalid variant_type: ${updates.variant_type}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('product_variants')
      .update(updates)
      .eq('id', variantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating variant:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update variant' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, success: true });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/products/variants/[variantId]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update variant' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/products/variants/[variantId]
 * Delete a variant (soft delete by setting is_active to false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { variantId: string } }
) {
  try {
    const { variantId } = params;

    if (!variantId) {
      return NextResponse.json(
        { error: 'Variant ID is required' },
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

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('product_variants')
      .update({ is_active: false })
      .eq('id', variantId);

    if (error) {
      console.error('Error deleting variant:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to delete variant' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/products/variants/[variantId]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete variant' },
      { status: 500 }
    );
  }
}

