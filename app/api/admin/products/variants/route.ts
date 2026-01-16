import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * POST /api/admin/products/variants
 * Create multiple variants for products
 */
export async function POST(request: NextRequest) {
  try {
    const { variants } = await request.json();

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json(
        { error: 'Variants array is required' },
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

    // Validate all variants
    for (const variant of variants) {
      if (!variant.product_id || !variant.sku || !variant.variant_type || !variant.variant_value || variant.price === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields: product_id, sku, variant_type, variant_value, price' },
          { status: 400 }
        );
      }

      if (!['size', 'flavor', 'color', 'weight', 'pack'].includes(variant.variant_type)) {
        return NextResponse.json(
          { error: `Invalid variant_type: ${variant.variant_type}. Must be one of: size, flavor, color, weight, pack` },
          { status: 400 }
        );
      }
    }

    // Insert variants
    const { data, error } = await supabase
      .from('product_variants')
      .insert(variants.map(v => ({
        product_id: v.product_id,
        sku: v.sku,
        variant_type: v.variant_type,
        variant_value: v.variant_value,
        price: v.price,
        mrp: v.mrp || null,
        stock_quantity: v.stock_quantity || 0,
        image_url: v.image_url || null,
        is_default: v.is_default || false,
        display_order: v.display_order || 0,
        is_active: true,
      })))
      .select();

    if (error) {
      console.error('Error creating variants:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create variants' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, success: true });
  } catch (error: any) {
    console.error('Error in POST /api/admin/products/variants:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create variants' },
      { status: 500 }
    );
  }
}

