import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing Supabase environment variables');
    return createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
};

export async function GET(request: NextRequest) {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    try {
        if (action === 'list') {
            const { data, error } = await supabase
                .from('delivery_partners')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ partners: data });
        }

        if (action === 'nearby') {
            const lat = parseFloat(searchParams.get('lat') || '0');
            const lng = parseFloat(searchParams.get('lng') || '0');
            const radius = parseFloat(searchParams.get('radius') || '10');

            const { data, error } = await supabase.rpc('get_nearby_delivery_partners', {
                target_lat: lat,
                target_lng: lng,
                radius_km: radius
            });

            if (error) throw error;
            return NextResponse.json({ partners: data });
        }

        if (action === 'tracking') {
            const partnerId = searchParams.get('id');
            if (!partnerId) return NextResponse.json({ error: 'Missing partner ID' }, { status: 400 });

            // Get recent logs (last 24h)
            const { data, error } = await supabase
                .from('delivery_partner_location_logs')
                .select('*')
                .eq('delivery_partner_id', partnerId)
                .order('timestamp', { ascending: false })
                .limit(100);

            if (error) throw error;
            return NextResponse.json({ logs: data });
        }

        if (action === 'assignments') {
            const partnerId = searchParams.get('id');
            if (!partnerId) return NextResponse.json({ error: 'Missing partner ID' }, { status: 400 });

            // Try to fetch assignments from delivery_batches
            // We select basic fields assuming the table exists as described
            const { data, error } = await supabase
                .from('delivery_batches')
                .select('*')
                .eq('delivery_partner_id', partnerId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Error fetching assignments:', error);
                // Return empty if table doesn't exist or other error, handled gracefully
                return NextResponse.json({ assignments: [], error: 'Could not fetch assignments' });
            }
            return NextResponse.json({ assignments: data });
        }

        if (action === 'rejections') {
            const partnerId = searchParams.get('id');
            if (!partnerId) return NextResponse.json({ error: 'Missing partner ID' }, { status: 400 });

            const { data, error } = await supabase
                .from('delivery_assignment_rejections')
                .select('*')
                .eq('delivery_partner_id', partnerId)
                .order('rejected_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ rejections: data });
        }

        if (action === 'stats') {
            const { count: total } = await supabase.from('delivery_partners').select('*', { count: 'exact', head: true });
            const { count: active } = await supabase.from('delivery_partners').select('*', { count: 'exact', head: true }).eq('is_active', true);
            const { count: online } = await supabase.from('delivery_partners').select('*', { count: 'exact', head: true }).eq('is_online', true);

            let pending = 0;
            try {
                const { count, error } = await supabase.from('delivery_batches').select('*', { count: 'exact', head: true }).eq('status', 'pending');
                if (!error) pending = count || 0;
            } catch (e) {
                console.log('delivery_batches check failed', e);
            }

            return NextResponse.json({
                total: total || 0,
                active: active || 0,
                online: online || 0,
                pending: pending
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    try {
        const body = await request.json();

        if (action === 'create_partner') {
            const { data, error } = await supabase
                .from('delivery_partners')
                .insert([body])
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ partner: data });
        }

        if (action === 'update_partner') {
            const { id, ...updates } = body;
            const { data, error } = await supabase
                .from('delivery_partners')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ partner: data });
        }

        if (action === 'log_rejection') {
            const { data, error } = await supabase
                .from('delivery_assignment_rejections')
                .insert([body])
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ rejection: data });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
