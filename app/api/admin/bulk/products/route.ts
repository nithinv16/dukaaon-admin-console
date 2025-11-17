import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { product_ids, operation, value } = await request.json();

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json(
        { error: 'Product IDs array is required' },
        { status: 400 }
      );
    }

    if (!operation) {
      return NextResponse.json(
        { error: 'Operation is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();
    let updated = 0;

    switch (operation) {
      case 'update_status':
        if (!value) {
          return NextResponse.json(
            { error: 'Status value is required' },
            { status: 400 }
          );
        }
        const { error: statusError } = await supabase
          .from('products')
          .update({ status: value })
          .in('id', product_ids);
        if (statusError) throw statusError;
        updated = product_ids.length;
        break;

      case 'update_price':
        if (!value) {
          return NextResponse.json(
            { error: 'Price percentage is required' },
            { status: 400 }
          );
        }
        const percentage = parseFloat(value);
        // First get current prices
        const { data: products } = await supabase
          .from('products')
          .select('id, price')
          .in('id', product_ids);

        if (products) {
          const updates = products.map((p) => ({
            id: p.id,
            price: p.price * (1 + percentage / 100),
          }));

          for (const update of updates) {
            const { error } = await supabase
              .from('products')
              .update({ price: update.price })
              .eq('id', update.id);
            if (error) throw error;
          }
          updated = updates.length;
        }
        break;

      case 'update_stock':
        if (!value) {
          return NextResponse.json(
            { error: 'Stock value is required' },
            { status: 400 }
          );
        }
        const stock = parseInt(value);
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock_available: stock })
          .in('id', product_ids);
        if (stockError) throw stockError;
        updated = product_ids.length;
        break;

      case 'update_category':
        if (!value) {
          return NextResponse.json(
            { error: 'Category value is required' },
            { status: 400 }
          );
        }
        const { error: categoryError } = await supabase
          .from('products')
          .update({ category_name: value })
          .in('id', product_ids);
        if (categoryError) throw categoryError;
        updated = product_ids.length;
        break;

      case 'activate':
        const { error: activateError } = await supabase
          .from('products')
          .update({ is_active: true, status: 'available' })
          .in('id', product_ids);
        if (activateError) throw activateError;
        updated = product_ids.length;
        break;

      case 'deactivate':
        const { error: deactivateError } = await supabase
          .from('products')
          .update({ is_active: false, status: 'discontinued' })
          .in('id', product_ids);
        if (deactivateError) throw deactivateError;
        updated = product_ids.length;
        break;

      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      updated,
      message: `Successfully updated ${updated} products`,
    });
  } catch (error: any) {
    console.error('Error performing bulk product operation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform bulk operation' },
      { status: 500 }
    );
  }
}

