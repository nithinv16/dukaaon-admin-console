import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';
import { getClientIP } from '@/lib/employeeTracking';

/**
 * Track time spent editing a product card
 * This is called when an employee spends time editing a product extracted from scan receipts or bulk uploads
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { admin_id, session_id, product_id, product_name, duration_seconds, duration_ms } = body;

        if (!admin_id || !product_id) {
            return NextResponse.json(
                { error: 'admin_id and product_id are required' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabaseClient();
        const ipAddress = getClientIP(request);

        // Record the edit activity with duration
        const { error } = await supabase
            .from('admin_activity_metrics')
            .insert({
                admin_id,
                session_id,
                action_type: 'edit_product_card',
                entity_type: 'product',
                entity_id: product_id,
                operation_start_time: new Date(Date.now() - duration_ms).toISOString(),
                operation_end_time: new Date().toISOString(),
                duration_ms,
                duration_seconds,
                items_processed: 1,
                operation_status: 'success',
                metadata: {
                    product_name,
                    card_edit: true,
                },
                ip_address: ipAddress,
            });

        if (error) {
            console.error('Error tracking product edit time:', error);
            return NextResponse.json(
                { error: 'Failed to track edit time' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in track-product-edit-time API:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
