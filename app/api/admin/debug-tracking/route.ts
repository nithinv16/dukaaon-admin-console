import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * GET /api/admin/debug-tracking
 * Debug endpoint to check tracking status for a specific admin
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('admin_id');

        if (!adminId) {
            return NextResponse.json(
                { error: 'admin_id is required' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabaseClient();
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        // Check if admin exists
        const { data: admin, error: adminError } = await supabase
            .from('admin_credentials')
            .select('id, name, email, role, status')
            .eq('id', adminId)
            .single();

        // Get all sessions for this admin (active and inactive)
        const { data: sessions, error: sessionsError } = await supabase
            .from('admin_sessions')
            .select('*')
            .eq('admin_id', adminId)
            .order('login_time', { ascending: false })
            .limit(10);

        // Get active sessions
        const { data: activeSessions, error: activeSessionsError } = await supabase
            .from('admin_sessions')
            .select('*')
            .eq('admin_id', adminId)
            .eq('is_active', true);

        // Get today's activity periods
        const { data: todayPeriods, error: periodsError } = await supabase
            .from('admin_activity_periods')
            .select('*')
            .eq('admin_id', adminId)
            .gte('period_start', todayStart)
            .order('period_start', { ascending: false });

        // Get today's activity metrics
        const { data: todayMetrics, error: metricsError } = await supabase
            .from('admin_activity_metrics')
            .select('*')
            .eq('admin_id', adminId)
            .gte('operation_start_time', todayStart)
            .order('operation_start_time', { ascending: false })
            .limit(20);

        // Get recent page visits
        const { data: pageVisits, error: pageVisitsError } = await supabase
            .from('admin_page_visits')
            .select('*')
            .eq('admin_id', adminId)
            .order('entry_time', { ascending: false })
            .limit(10);

        // Calculate stats
        const totalActiveTimeToday = todayPeriods?.reduce((sum, p) => sum + (p.duration_minutes || 0), 0) || 0;

        // Check for open activity periods
        const openPeriod = todayPeriods?.find(p => !p.period_end);

        return NextResponse.json({
            debug: {
                now: now.toISOString(),
                todayStart,
                adminId,
            },
            admin: admin || null,
            adminError: adminError?.message || null,
            sessions: {
                count: sessions?.length || 0,
                data: sessions || [],
                error: sessionsError?.message || null,
            },
            activeSessions: {
                count: activeSessions?.length || 0,
                data: activeSessions || [],
                error: activeSessionsError?.message || null,
            },
            todayActivityPeriods: {
                count: todayPeriods?.length || 0,
                data: todayPeriods || [],
                error: periodsError?.message || null,
                totalActiveMinutes: totalActiveTimeToday,
                hasOpenPeriod: !!openPeriod,
                openPeriod: openPeriod || null,
            },
            todayMetrics: {
                count: todayMetrics?.length || 0,
                data: todayMetrics || [],
                error: metricsError?.message || null,
            },
            pageVisits: {
                count: pageVisits?.length || 0,
                data: pageVisits || [],
                error: pageVisitsError?.message || null,
            },
            issues: [] as string[],
        });
    } catch (error: any) {
        console.error('Error in debug tracking:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
