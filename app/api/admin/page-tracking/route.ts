import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * POST /api/admin/page-tracking
 * Track page visits for employees
 */
export async function POST(request: NextRequest) {
    try {
        // Handle both JSON and text (from sendBeacon)
        const contentType = request.headers.get('content-type');
        let body;
        
        if (contentType?.includes('application/json')) {
            body = await request.json();
        } else {
            const text = await request.text();
            body = JSON.parse(text);
        }

        const {
            session_id,
            admin_id,
            page_path,
            page_name,
            entry_time,
            exit_time,
            duration_seconds,
        } = body;

        if (!session_id || !admin_id || !page_path) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabaseClient();

        // Insert page visit record
        try {
            const { error } = await supabase
                .from('admin_page_visits')
                .insert({
                    session_id,
                    admin_id,
                    page_path,
                    page_name,
                    entry_time,
                    exit_time,
                    duration_seconds,
                });

            if (error) {
                // Table might not exist yet - don't break the user experience
                console.log('Page tracking: Table may not exist yet or insert failed:', error.message);
                return NextResponse.json({ success: false, error: error.message });
            }
        } catch (e) {
            // Gracefully handle if table doesn't exist
            console.log('Page tracking: Could not insert record');
            return NextResponse.json({ success: false });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in page tracking:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/admin/page-tracking
 * Get page visit statistics for an employee
 */
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

        // Get page visit summary
        const { data: visits, error: visitsError } = await supabase
            .from('admin_page_visits')
            .select('*')
            .eq('admin_id', adminId)
            .gte('entry_time', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .lte('entry_time', endDate || new Date().toISOString())
            .order('entry_time', { ascending: false });

        if (visitsError) {
            console.error('Error fetching page visits:', visitsError);
            return NextResponse.json(
                { error: 'Failed to fetch page visits' },
                { status: 500 }
            );
        }

        // Calculate statistics
        const pageStats: Record<string, { 
            page_name: string;
            visit_count: number; 
            total_duration_seconds: number;
            avg_duration_seconds: number;
        }> = {};

        visits?.forEach((visit) => {
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
        const sortedStats = Object.entries(pageStats)
            .map(([path, stats]) => ({ page_path: path, ...stats }))
            .sort((a, b) => b.total_duration_seconds - a.total_duration_seconds);

        return NextResponse.json({
            page_stats: sortedStats,
            recent_visits: visits?.slice(0, 50) || [],
            total_visits: visits?.length || 0,
            total_time_seconds: sortedStats.reduce((sum, s) => sum + s.total_duration_seconds, 0),
        });
    } catch (error: any) {
        console.error('Error in page tracking GET:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

