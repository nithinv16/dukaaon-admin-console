import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * GET /api/admin/live-status
 * Get real-time status of all employees
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = getAdminSupabaseClient();
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes - consider active if heartbeat within this time
        const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes - consider idle if no heartbeat within this time

        // Get all admin users
        const { data: admins, error: adminsError } = await supabase
            .from('admin_credentials')
            .select('id, name, email, role, status')
            .eq('status', 'active');

        if (adminsError) {
            console.error('Error fetching admins:', adminsError);
            return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
        }

        // Get active sessions with last activity
        const { data: activeSessions, error: sessionsError } = await supabase
            .from('admin_sessions')
            .select('*')
            .eq('is_active', true);

        if (sessionsError) {
            console.error('Error fetching sessions:', sessionsError);
        }

        // Get today's activity metrics for each admin
        const { data: todayMetrics, error: metricsError } = await supabase
            .from('admin_activity_metrics')
            .select('admin_id, action_type, entity_type, items_processed, operation_start_time')
            .gte('operation_start_time', todayStart);

        if (metricsError) {
            console.error('Error fetching metrics:', metricsError);
        }

        // Get today's active time from activity periods
        const { data: todayPeriods, error: periodsError } = await supabase
            .from('admin_activity_periods')
            .select('admin_id, duration_minutes, period_start, period_end, is_active')
            .gte('period_start', todayStart);

        if (periodsError) {
            console.error('Error fetching periods:', periodsError);
        }

        // Get recent page visits
        const { data: recentPageVisits, error: pageVisitsError } = await supabase
            .from('admin_page_visits')
            .select('admin_id, page_name, page_path, entry_time')
            .gte('entry_time', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
            .order('entry_time', { ascending: false });

        if (pageVisitsError) {
            console.error('Error fetching page visits:', pageVisitsError);
        }

        // Build live status for each admin
        const liveStatus = admins?.map((admin) => {
            // Find active session
            const session = activeSessions?.find((s) => s.admin_id === admin.id);
            
            // Calculate status
            let status: 'active' | 'idle' | 'offline' = 'offline';
            let lastActivityTime = null;
            
            if (session) {
                const lastActivity = new Date(session.last_activity).getTime();
                const timeSinceActivity = now.getTime() - lastActivity;
                
                if (timeSinceActivity < ACTIVE_THRESHOLD_MS) {
                    status = 'active';
                } else if (timeSinceActivity < IDLE_THRESHOLD_MS) {
                    status = 'idle';
                } else {
                    status = 'offline';
                }
                lastActivityTime = session.last_activity;
            }

            // Calculate today's metrics
            const adminMetrics = todayMetrics?.filter((m) => m.admin_id === admin.id) || [];
            const productsCreated = adminMetrics.filter(
                (m) => m.action_type === 'create_product' && m.entity_type === 'product'
            ).length;
            const productsUpdated = adminMetrics.filter(
                (m) => m.action_type === 'update_product' && m.entity_type === 'product'
            ).length;
            const masterProductsCreated = adminMetrics.filter(
                (m) => m.action_type === 'create_product' && m.entity_type === 'master_product'
            ).length;
            const bulkUploads = adminMetrics.filter((m) => m.action_type === 'bulk_upload').length;
            const receiptScans = adminMetrics.filter((m) => m.action_type === 'scan_receipt').length;
            const totalItemsProcessed = adminMetrics.reduce(
                (sum, m) => sum + (m.items_processed || 0),
                0
            );

            // Calculate today's active time
            const adminPeriods = todayPeriods?.filter((p) => p.admin_id === admin.id) || [];
            let todayActiveMinutes = adminPeriods
                .filter((p) => p.is_active && p.duration_minutes)
                .reduce((sum, p) => sum + (p.duration_minutes || 0), 0);
            
            // Add time from open periods
            const openPeriod = adminPeriods.find((p) => p.is_active && !p.period_end);
            if (openPeriod && status !== 'offline') {
                const openDuration = Math.round(
                    (now.getTime() - new Date(openPeriod.period_start).getTime()) / 60000
                );
                todayActiveMinutes += openDuration;
            }

            // Get current page
            const recentVisit = recentPageVisits?.find((v) => v.admin_id === admin.id);
            const currentPage = recentVisit?.page_name || null;

            // Determine current action based on recent activity
            let currentAction = null;
            if (status === 'active') {
                const recentMetric = adminMetrics
                    .sort((a, b) => new Date(b.operation_start_time).getTime() - new Date(a.operation_start_time).getTime())[0];
                if (recentMetric) {
                    const actionMap: Record<string, string> = {
                        'create_product': 'Creating product',
                        'update_product': 'Updating product',
                        'bulk_upload': 'Bulk uploading',
                        'scan_receipt': 'Scanning receipt',
                    };
                    currentAction = actionMap[recentMetric.action_type] || recentMetric.action_type.replace(/_/g, ' ');
                }
            }

            return {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                status,
                last_activity: lastActivityTime,
                current_page: currentPage,
                current_action: currentAction,
                session_id: session?.id || null,
                login_time: session?.login_time || null,
                today_stats: {
                    active_time_minutes: todayActiveMinutes,
                    products_created: productsCreated,
                    products_updated: productsUpdated,
                    master_products_created: masterProductsCreated,
                    bulk_uploads: bulkUploads,
                    receipt_scans: receiptScans,
                    total_items_processed: totalItemsProcessed,
                },
            };
        }) || [];

        // Summary stats
        const activeCount = liveStatus.filter((s) => s.status === 'active').length;
        const idleCount = liveStatus.filter((s) => s.status === 'idle').length;
        const offlineCount = liveStatus.filter((s) => s.status === 'offline').length;

        const teamTodayStats = {
            total_active_time_minutes: liveStatus.reduce((sum, s) => sum + s.today_stats.active_time_minutes, 0),
            total_products_created: liveStatus.reduce((sum, s) => sum + s.today_stats.products_created, 0),
            total_products_updated: liveStatus.reduce((sum, s) => sum + s.today_stats.products_updated, 0),
            total_items_processed: liveStatus.reduce((sum, s) => sum + s.today_stats.total_items_processed, 0),
        };

        return NextResponse.json({
            employees: liveStatus,
            summary: {
                total: liveStatus.length,
                active: activeCount,
                idle: idleCount,
                offline: offlineCount,
            },
            team_today_stats: teamTodayStats,
            last_updated: now.toISOString(),
        });
    } catch (error: any) {
        console.error('Error in live status:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

