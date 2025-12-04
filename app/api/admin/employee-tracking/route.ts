import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('admin_id');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');

        if (!adminId) {
            return NextResponse.json(
                { error: 'admin_id is required' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabaseClient();

        // Call the SQL function to get activity summary
        const { data: summary, error: summaryError } = await supabase.rpc(
            'get_employee_activity_summary',
            {
                p_admin_id: adminId,
                p_start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                p_end_date: endDate || new Date().toISOString(),
            }
        );

        if (summaryError) {
            console.error('Error fetching activity summary:', summaryError);
            return NextResponse.json(
                { error: 'Failed to fetch activity summary' },
                { status: 500 }
            );
        }

        // Get detailed session history
        const { data: sessions, error: sessionsError } = await supabase
            .from('admin_sessions')
            .select('*')
            .eq('admin_id', adminId)
            .order('login_time', { ascending: false })
            .limit(50);

        if (sessionsError) {
            console.error('Error fetching sessions:', sessionsError);
        }

        // Get recent activity timeline
        const { data: activities, error: activitiesError } = await supabase
            .from('admin_activity_metrics')
            .select('*')
            .eq('admin_id', adminId)
            .order('operation_start_time', { ascending: false })
            .limit(100);

        if (activitiesError) {
            console.error('Error fetching activities:', activitiesError);
        }

        // Get daily breakdown
        const { data: dailyBreakdown, error: dailyError } = await supabase.rpc(
            'get_daily_work_breakdown',
            {
                p_admin_id: adminId,
                p_start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                p_end_date: endDate || new Date().toISOString(),
            }
        );

        if (dailyError) {
            console.error('Error fetching daily breakdown:', dailyError);
        }

        // Get activity breakdown by action type
        const { data: activityBreakdown, error: breakdownError } = await supabase
            .from('admin_activity_metrics')
            .select('action_type, entity_type')
            .eq('admin_id', adminId);

        if (breakdownError) {
            console.error('Error fetching activity breakdown:', breakdownError);
        }

        // Calculate activity breakdown
        const breakdown: Record<string, number> = {};
        activityBreakdown?.forEach((activity) => {
            const key = `${activity.action_type}_${activity.entity_type}`;
            breakdown[key] = (breakdown[key] || 0) + 1;
        });

        // Get page visit statistics (table might not exist yet)
        let pageVisits: any[] = [];
        try {
            const { data, error } = await supabase
                .from('admin_page_visits')
                .select('*')
                .eq('admin_id', adminId)
                .gte('entry_time', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                .lte('entry_time', endDate || new Date().toISOString())
                .order('entry_time', { ascending: false });
            if (!error) pageVisits = data || [];
        } catch (e) {
            console.log('Page visits table not available yet');
        }

        // Calculate page visit stats
        const pageStats: Record<string, { 
            page_name: string;
            visit_count: number; 
            total_duration_seconds: number;
            avg_duration_seconds: number;
        }> = {};

        pageVisits?.forEach((visit) => {
            const key = visit.page_path;
            if (!pageStats[key]) {
                pageStats[key] = {
                    page_name: visit.page_name,
                    visit_count: 0,
                    total_duration_seconds: 0,
                    avg_duration_seconds: 0,
                };
            }
            pageStats[key].visit_count++;
            pageStats[key].total_duration_seconds += visit.duration_seconds || 0;
        });

        // Calculate averages
        Object.keys(pageStats).forEach((key) => {
            if (pageStats[key].visit_count > 0) {
                pageStats[key].avg_duration_seconds = Math.round(
                    pageStats[key].total_duration_seconds / pageStats[key].visit_count
                );
            }
        });

        // Sort by total time spent
        const sortedPageStats = Object.entries(pageStats)
            .map(([path, stats]) => ({ page_path: path, ...stats }))
            .sort((a, b) => b.total_duration_seconds - a.total_duration_seconds);

        // Get active targets for this employee (table might not exist yet)
        let activeTargets: any[] = [];
        try {
            const { data, error } = await supabase
                .from('employee_targets')
                .select('*')
                .eq('admin_id', adminId)
                .eq('status', 'active');
            if (!error) activeTargets = data || [];
        } catch (e) {
            console.log('Employee targets table not available yet');
        }

        return NextResponse.json({
            summary: summary || {},
            sessions: sessions || [],
            activities: activities || [],
            breakdown,
            dailyBreakdown: dailyBreakdown || [],
            pageStats: sortedPageStats,
            recentPageVisits: pageVisits?.slice(0, 20) || [],
            activeTargets: activeTargets || [],
        });
    } catch (error: any) {
        console.error('Error in employee tracking API:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
