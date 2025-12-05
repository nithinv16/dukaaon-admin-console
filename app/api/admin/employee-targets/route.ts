import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * GET /api/admin/employee-targets
 * Get targets for employees
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('admin_id');
        const periodType = searchParams.get('period_type');
        const status = searchParams.get('status');

        const supabase = getAdminSupabaseClient();

        let query = supabase
            .from('employee_targets')
            .select(`
                *,
                admin:admin_id (id, name, email),
                creator:created_by (id, name)
            `)
            .order('period_start', { ascending: false });

        if (adminId) {
            query = query.eq('admin_id', adminId);
        }

        if (periodType) {
            query = query.eq('period_type', periodType);
        }

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const { data: targets, error } = await query;

        if (error) {
            console.error('Error fetching targets:', error);
            return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 });
        }

        // Update progress for active targets
        const activeTargets = targets?.filter(t => t.status === 'active') || [];
        for (const target of activeTargets) {
            await updateTargetProgress(supabase, target);
        }

        // Re-fetch to get updated data
        const { data: updatedTargets } = await query;

        return NextResponse.json({
            targets: updatedTargets || [],
            total: updatedTargets?.length || 0,
        });
    } catch (error: any) {
        console.error('Error in employee targets GET:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/employee-targets
 * Create a new target for an employee
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            admin_id,
            period_type,
            period_start,
            period_end,
            target_products_created,
            target_products_updated,
            target_master_products_created,
            target_receipts_scanned,
            target_active_hours,
            target_items_processed,
            notes,
            created_by,
        } = body;

        if (!admin_id || !period_type || !period_start || !period_end) {
            return NextResponse.json(
                { error: 'Missing required fields: admin_id, period_type, period_start, period_end' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabaseClient();

        // Check for overlapping targets
        const { data: existing } = await supabase
            .from('employee_targets')
            .select('id')
            .eq('admin_id', admin_id)
            .eq('period_type', period_type)
            .eq('status', 'active')
            .or(`period_start.lte.${period_end},period_end.gte.${period_start}`);

        if (existing && existing.length > 0) {
            return NextResponse.json(
                { error: 'An active target already exists for this period' },
                { status: 400 }
            );
        }

        const { data: newTarget, error } = await supabase
            .from('employee_targets')
            .insert({
                admin_id,
                period_type,
                period_start,
                period_end,
                target_products_created: target_products_created || 0,
                target_products_updated: target_products_updated || 0,
                target_master_products_created: target_master_products_created || 0,
                target_receipts_scanned: target_receipts_scanned || 0,
                target_active_hours: target_active_hours || 0,
                target_items_processed: target_items_processed || 0,
                notes,
                created_by,
                status: 'active',
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating target:', error);
            return NextResponse.json({ error: 'Failed to create target' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            target: newTarget,
        });
    } catch (error: any) {
        console.error('Error in employee targets POST:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/admin/employee-targets
 * Update a target
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Target ID is required' }, { status: 400 });
        }

        const supabase = getAdminSupabaseClient();

        const { data: updatedTarget, error } = await supabase
            .from('employee_targets')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating target:', error);
            return NextResponse.json({ error: 'Failed to update target' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            target: updatedTarget,
        });
    } catch (error: any) {
        console.error('Error in employee targets PUT:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/admin/employee-targets
 * Delete a target
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Target ID is required' }, { status: 400 });
        }

        const supabase = getAdminSupabaseClient();

        const { error } = await supabase
            .from('employee_targets')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting target:', error);
            return NextResponse.json({ error: 'Failed to delete target' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in employee targets DELETE:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// Helper function to update target progress
async function updateTargetProgress(supabase: any, target: any) {
    const { data: metrics } = await supabase
        .from('admin_activity_metrics')
        .select('action_type, entity_type, items_processed')
        .eq('admin_id', target.admin_id)
        .gte('operation_start_time', target.period_start)
        .lte('operation_start_time', target.period_end + 'T23:59:59Z');

    const { data: periods } = await supabase
        .from('admin_activity_periods')
        .select('duration_minutes')
        .eq('admin_id', target.admin_id)
        .eq('is_active', true)
        .gte('period_start', target.period_start)
        .lte('period_start', target.period_end + 'T23:59:59Z');

    const productsCreated = metrics?.filter(
        (m: any) => m.action_type === 'create_product' && m.entity_type === 'product'
    ).length || 0;
    const productsUpdated = metrics?.filter(
        (m: any) => m.action_type === 'update_product' && m.entity_type === 'product'
    ).length || 0;
    const masterProductsCreated = metrics?.filter(
        (m: any) => m.action_type === 'create_product' && m.entity_type === 'master_product'
    ).length || 0;
    const receiptsScanned = metrics?.filter(
        (m: any) => m.action_type === 'scan_receipt'
    ).length || 0;
    const itemsProcessed = metrics?.reduce(
        (sum: number, m: any) => sum + (m.items_processed || 0),
        0
    ) || 0;
    const activeHours = (periods?.reduce(
        (sum: number, p: any) => sum + (p.duration_minutes || 0),
        0
    ) || 0) / 60;

    // Calculate completion percentage
    let totalWeight = 0;
    let weightedCompletion = 0;

    if (target.target_products_created > 0) {
        totalWeight += 30;
        weightedCompletion += Math.min(30, (productsCreated / target.target_products_created) * 30);
    }
    if (target.target_master_products_created > 0) {
        totalWeight += 25;
        weightedCompletion += Math.min(25, (masterProductsCreated / target.target_master_products_created) * 25);
    }
    if (target.target_active_hours > 0) {
        totalWeight += 20;
        weightedCompletion += Math.min(20, (activeHours / target.target_active_hours) * 20);
    }
    if (target.target_items_processed > 0) {
        totalWeight += 15;
        weightedCompletion += Math.min(15, (itemsProcessed / target.target_items_processed) * 15);
    }
    if (target.target_receipts_scanned > 0) {
        totalWeight += 10;
        weightedCompletion += Math.min(10, (receiptsScanned / target.target_receipts_scanned) * 10);
    }

    const completionPercentage = totalWeight > 0 ? Math.round((weightedCompletion / totalWeight) * 100) : 0;

    // Determine status
    const today = new Date().toISOString().split('T')[0];
    let status = 'active';
    if (today > target.period_end) {
        if (completionPercentage >= 100) status = 'exceeded';
        else if (completionPercentage >= 80) status = 'completed';
        else status = 'missed';
    }

    await supabase
        .from('employee_targets')
        .update({
            actual_products_created: productsCreated,
            actual_products_updated: productsUpdated,
            actual_master_products_created: masterProductsCreated,
            actual_receipts_scanned: receiptsScanned,
            actual_active_hours: activeHours,
            actual_items_processed: itemsProcessed,
            completion_percentage: completionPercentage,
            status,
            updated_at: new Date().toISOString(),
        })
        .eq('id', target.id);
}

