import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing Supabase environment variables');
    return createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
};

// GET - Fetch sales personnel list with stats
export async function GET(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'list';

        if (action === 'attendance') {
            // Get today's attendance
            const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
            const { data, error } = await supabase.rpc('get_sales_team_attendance', { p_date: date });
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ data });
        }

        if (action === 'performance') {
            // Get performance for a specific sales person
            const salesPersonId = searchParams.get('salesPersonId');
            if (!salesPersonId) return NextResponse.json({ error: 'salesPersonId required' }, { status: 400 });

            const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

            const { data, error } = await supabase.rpc('get_sales_person_performance', {
                p_sales_person_id: salesPersonId,
                p_start_date: startDate,
                p_end_date: endDate
            });
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ data });
        }

        if (action === 'visits') {
            // Get visits for a sales person
            const salesPersonId = searchParams.get('salesPersonId');
            const date = searchParams.get('date');

            let query = supabase
                .from('sales_visits')
                .select('*')
                .order('check_in_time', { ascending: false })
                .limit(50);

            if (salesPersonId) query = query.eq('sales_person_id', salesPersonId);
            if (date) query = query.eq('visit_date', date);

            const { data, error } = await query;
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ data });
        }

        if (action === 'routes') {
            // Get routes for a sales person
            const salesPersonId = searchParams.get('salesPersonId');
            const date = searchParams.get('date');

            let query = supabase
                .from('sales_routes')
                .select('*')
                .order('route_date', { ascending: false })
                .limit(50);

            if (salesPersonId) query = query.eq('sales_person_id', salesPersonId);
            if (date) query = query.eq('route_date', date);

            const { data, error } = await query;
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ data });
        }

        if (action === 'targets') {
            // Get targets for a sales person
            const salesPersonId = searchParams.get('salesPersonId');

            let query = supabase
                .from('sales_targets')
                .select('*')
                .eq('status', 'active')
                .order('period_start', { ascending: false });

            if (salesPersonId) query = query.eq('sales_person_id', salesPersonId);

            const { data, error } = await query;
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ data });
        }

        if (action === 'referral_stats') {
            // Get referral stats for a sales person
            const salesPersonId = searchParams.get('salesPersonId');
            if (!salesPersonId) return NextResponse.json({ error: 'salesPersonId required' }, { status: 400 });

            const { data, error } = await supabase.rpc('get_sales_person_referral_stats', {
                p_sales_person_id: salesPersonId
            });
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ data });
        }

        if (action === 'location_logs') {
            // Get location logs for a sales person (last 100)
            const salesPersonId = searchParams.get('salesPersonId');
            const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

            if (!salesPersonId) return NextResponse.json({ error: 'salesPersonId required' }, { status: 400 });

            const { data, error } = await supabase
                .from('sales_location_logs')
                .select('*')
                .eq('sales_person_id', salesPersonId)
                .gte('logged_at', `${date}T00:00:00`)
                .lte('logged_at', `${date}T23:59:59`)
                .order('logged_at', { ascending: true })
                .limit(500);

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ data });
        }

        // Default: List all sales personnel
        const { data, error } = await supabase
            .from('sales_personnel')
            .select(`
        *,
        admin:admin_credentials(id, name, email, last_login)
      `)
            .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create/Update sales personnel, routes, visits, targets
export async function POST(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const body = await request.json();
        const { action } = body;

        if (action === 'create_personnel') {
            const { adminId, employeeCode, phone, territory, hireDate } = body;
            const { data, error } = await supabase
                .from('sales_personnel')
                .insert({ admin_id: adminId, employee_code: employeeCode, phone, territory, hire_date: hireDate })
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, data });
        }

        if (action === 'update_personnel') {
            const { id, ...updates } = body;
            const { data, error } = await supabase
                .from('sales_personnel')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, data });
        }

        if (action === 'create_route') {
            const { salesPersonId, routeName, routeDate, plannedVisits, notes } = body;
            const { data, error } = await supabase
                .from('sales_routes')
                .insert({ sales_person_id: salesPersonId, route_name: routeName, route_date: routeDate, planned_visits: plannedVisits, notes })
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, data });
        }

        if (action === 'update_route') {
            const { id, ...updates } = body;
            const { data, error } = await supabase
                .from('sales_routes')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, data });
        }

        if (action === 'create_target') {
            const { salesPersonId, targetPeriod, periodStart, periodEnd, targetVisits, targetOrders, targetRevenue, targetNewCustomers, targetReferrals } = body;
            const { data, error } = await supabase
                .from('sales_targets')
                .insert({
                    sales_person_id: salesPersonId,
                    target_period: targetPeriod,
                    period_start: periodStart,
                    period_end: periodEnd,
                    target_visits: targetVisits,
                    target_orders: targetOrders,
                    target_revenue: targetRevenue,
                    target_new_customers: targetNewCustomers,
                    target_referrals: targetReferrals
                })
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, data });
        }

        if (action === 'update_target') {
            const { id, ...updates } = body;
            const { data, error } = await supabase
                .from('sales_targets')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, data });
        }

        if (action === 'create_referral_code') {
            // Create referral code for sales person
            const { salesPersonId, customCode } = body;
            if (!salesPersonId) return NextResponse.json({ error: 'salesPersonId required' }, { status: 400 });

            const { data, error } = await supabase.rpc('create_sales_personnel_referral_code', {
                p_sales_person_id: salesPersonId,
                p_custom_code: customCode || null
            });
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, data });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
