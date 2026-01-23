import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const getAdminSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
};

// GET - Fetch link click analytics
export async function GET(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await supabase
            .from('referral_link_clicks')
            .select('*')
            .gte('clicked_at', startDate.toISOString())
            .order('clicked_at', { ascending: false });

        if (error) {
            console.error('Error fetching link click analytics:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Group by date
        const clicksByDate: { [date: string]: number } = {};
        const clicksBySource: { [source: string]: number } = {};
        const clicksByPlatform: { [platform: string]: number } = {};

        data?.forEach((click) => {
            const date = click.clicked_at.split('T')[0];
            clicksByDate[date] = (clicksByDate[date] || 0) + 1;

            const source = click.click_source || 'unknown';
            clicksBySource[source] = (clicksBySource[source] || 0) + 1;

            const platform = click.platform || 'unknown';
            clicksByPlatform[platform] = (clicksByPlatform[platform] || 0) + 1;
        });

        // Convert to array format for charts
        const clicksByDateArray = Object.entries(clicksByDate)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const clicksBySourceArray = Object.entries(clicksBySource)
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count);

        const clicksByPlatformArray = Object.entries(clicksByPlatform)
            .map(([platform, count]) => ({ platform, count }))
            .sort((a, b) => b.count - a.count);

        return NextResponse.json({
            data: {
                totalClicks: data?.length || 0,
                convertedClicks: data?.filter((c) => c.converted).length || 0,
                conversionRate: data?.length
                    ? ((data.filter((c) => c.converted).length / data.length) * 100).toFixed(2)
                    : 0,
                clicksByDate: clicksByDateArray,
                clicksBySource: clicksBySourceArray,
                clicksByPlatform: clicksByPlatformArray,
            },
        });
    } catch (error: any) {
        console.error('Error in analytics API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
