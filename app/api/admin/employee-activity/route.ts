import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * GET /api/admin/employee-activity
 * Get employee activity summary and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('admin_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const summaryOnly = searchParams.get('summary_only') === 'true';

    if (!adminId) {
      return NextResponse.json(
        { error: 'admin_id is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    // Default to last 30 days if no dates provided
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    if (summaryOnly) {
      // Get summary using the function
      const { data: summary, error: summaryError } = await supabase.rpc(
        'get_employee_activity_summary',
        {
          p_admin_id: adminId,
          p_start_date: start.toISOString(),
          p_end_date: end.toISOString(),
        }
      );

      if (summaryError) {
        console.error('Error getting activity summary:', summaryError);
        throw summaryError;
      }

      return NextResponse.json({
        success: true,
        summary: summary || {},
      });
    }

    // Get detailed activity data
    // Sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('admin_id', adminId)
      .gte('login_time', start.toISOString())
      .lte('login_time', end.toISOString())
      .order('login_time', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw sessionsError;
    }

    // Activity metrics
    const { data: activities, error: activitiesError } = await supabase
      .from('admin_activity_metrics')
      .select('*')
      .eq('admin_id', adminId)
      .gte('operation_start_time', start.toISOString())
      .lte('operation_start_time', end.toISOString())
      .order('operation_start_time', { ascending: false });

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      throw activitiesError;
    }

    // Calculate summary
    const totalTimeWorked = sessions
      ?.filter((s) => s.duration_minutes)
      .reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;

    const productsCreated =
      activities?.filter(
        (a) =>
          a.action_type === 'create_product' && a.entity_type === 'product'
      ).length || 0;

    const productsUpdated =
      activities?.filter(
        (a) =>
          a.action_type === 'update_product' && a.entity_type === 'product'
      ).length || 0;

    const masterProductsCreated =
      activities?.filter(
        (a) =>
          a.action_type === 'create_product' &&
          a.entity_type === 'master_product'
      ).length || 0;

    const masterProductsUpdated =
      activities?.filter(
        (a) =>
          a.action_type === 'update_product' &&
          a.entity_type === 'master_product'
      ).length || 0;

    const bulkUploads =
      activities?.filter((a) => a.action_type === 'bulk_upload').length || 0;

    const receiptScans =
      activities?.filter((a) => a.action_type === 'scan_receipt').length || 0;

    const totalItemsProcessed =
      activities?.reduce((sum, a) => sum + (a.items_processed || 0), 0) || 0;

    // Calculate average time per item
    const productCreateActivities = activities?.filter(
      (a) =>
        a.action_type === 'create_product' &&
        a.entity_type === 'product' &&
        a.duration_seconds &&
        a.items_processed
    ) || [];

    const avgTimePerProduct =
      productCreateActivities.length > 0
        ? productCreateActivities.reduce(
            (sum, a) =>
              sum +
              (a.duration_seconds || 0) / (a.items_processed || 1),
            0
          ) / productCreateActivities.length
        : null;

    const avgTimePerItem =
      activities &&
      activities.filter((a) => a.duration_seconds && a.items_processed).length >
        0
        ? activities
            .filter((a) => a.duration_seconds && a.items_processed)
            .reduce(
              (sum, a) =>
                sum +
                (a.duration_seconds || 0) / (a.items_processed || 1),
              0
            ) /
          activities.filter((a) => a.duration_seconds && a.items_processed)
            .length
        : null;

    return NextResponse.json({
      success: true,
      summary: {
        total_sessions: sessions?.length || 0,
        total_time_worked_minutes: totalTimeWorked,
        products_created: productsCreated,
        products_updated: productsUpdated,
        master_products_created: masterProductsCreated,
        master_products_updated: masterProductsUpdated,
        bulk_uploads: bulkUploads,
        scan_receipts: receiptScans,
        total_items_processed: totalItemsProcessed,
        avg_time_per_product_seconds: avgTimePerProduct,
        avg_time_per_item_seconds: avgTimePerItem,
      },
      sessions: sessions || [],
      activities: activities || [],
    });
  } catch (error: any) {
    console.error('Error fetching employee activity:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch employee activity' },
      { status: 500 }
    );
  }
}

