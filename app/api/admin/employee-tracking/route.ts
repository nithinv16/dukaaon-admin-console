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

        return NextResponse.json({
            summary: summary || {},
            sessions: sessions || [],
            activities: activities || [],
            breakdown,
            dailyBreakdown: dailyBreakdown || [],
        });
    } catch (error: any) {
        console.error('Error in employee tracking API:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
