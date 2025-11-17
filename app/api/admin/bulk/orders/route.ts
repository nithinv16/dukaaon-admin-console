import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { order_ids, operation, value } = await request.json();

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { error: 'Order IDs array is required' },
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
          .from('orders')
          .update({ status: value })
          .in('id', order_ids);
        if (statusError) throw statusError;
        updated = order_ids.length;
        break;

      case 'add_note':
        if (!value) {
          return NextResponse.json(
            { error: 'Note text is required' },
            { status: 400 }
          );
        }
        // Get existing notes and append
        const { data: orders } = await supabase
          .from('orders')
          .select('id, notes')
          .in('id', order_ids);

        if (orders) {
          for (const order of orders) {
            const existingNotes = order.notes || [];
            const newNotes = Array.isArray(existingNotes)
              ? [...existingNotes, { note: value, created_at: new Date().toISOString() }]
              : [{ note: value, created_at: new Date().toISOString() }];

            const { error } = await supabase
              .from('orders')
              .update({ notes: newNotes })
              .eq('id', order.id);
            if (error) throw error;
          }
          updated = orders.length;
        }
        break;

      case 'assign_seller':
        if (!value) {
          return NextResponse.json(
            { error: 'Seller ID is required' },
            { status: 400 }
          );
        }
        const { error: sellerError } = await supabase
          .from('orders')
          .update({ seller_id: value })
          .in('id', order_ids);
        if (sellerError) throw sellerError;
        updated = order_ids.length;
        break;

      case 'cancel':
        const { error: cancelError } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .in('id', order_ids);
        if (cancelError) throw cancelError;
        updated = order_ids.length;
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
      message: `Successfully updated ${updated} orders`,
    });
  } catch (error: any) {
    console.error('Error performing bulk order operation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform bulk operation' },
      { status: 500 }
    );
  }
}

