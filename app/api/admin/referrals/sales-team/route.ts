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

// GET - Fetch all sales team codes with performance data
export async function GET() {
    try {
        const supabase = getAdminSupabase();

        const { data, error } = await supabase
            .from('referral_codes')
            .select(`
        id,
        code,
        metadata,
        current_uses,
        max_uses,
        is_active,
        custom_reward,
        expires_at,
        created_at,
        referrals:referrals(
          id,
          status,
          created_at
        )
      `)
            .eq('code_type', 'sales_team')
            .order('current_uses', { ascending: false });

        if (error) {
            console.error('Error fetching sales team codes:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Process data to get stats per sales person
        const performance = data?.map((code) => ({
            id: code.id,
            code: code.code,
            salesPersonName: code.metadata?.sales_person_name || 'Unknown',
            totalSignups: code.current_uses || 0,
            maxUses: code.max_uses,
            pendingReferrals: code.referrals?.filter((r: any) => r.status === 'pending').length || 0,
            verifiedReferrals: code.referrals?.filter((r: any) => r.status === 'verified').length || 0,
            successfulReferrals: code.referrals?.filter((r: any) => r.status === 'rewarded').length || 0,
            customReward: code.custom_reward,
            isActive: code.is_active,
            expiresAt: code.expires_at,
            createdAt: code.created_at,
        }));

        return NextResponse.json({ data: performance });
    } catch (error: any) {
        console.error('Error in sales team API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create or update sales team code
export async function POST(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const body = await request.json();
        const { action, codeId, code, salesPersonName, customReward, maxUses, expiresAt } = body;

        if (action === 'create') {
            if (!code || !salesPersonName) {
                return NextResponse.json(
                    { error: 'Code and sales person name are required' },
                    { status: 400 }
                );
            }

            const { data: result, error } = await supabase
                .from('referral_codes')
                .insert({
                    code: code.toUpperCase(),
                    code_type: 'sales_team',
                    is_active: true,
                    max_uses: maxUses || null,
                    custom_reward: customReward || null,
                    expires_at: expiresAt || null,
                    metadata: {
                        sales_person_name: salesPersonName,
                        created_at: new Date().toISOString(),
                    },
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    return NextResponse.json({ error: 'Code already exists' }, { status: 400 });
                }
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, data: result });
        }

        if (action === 'deactivate') {
            if (!codeId) {
                return NextResponse.json({ error: 'Code ID is required' }, { status: 400 });
            }

            const { error } = await supabase
                .from('referral_codes')
                .update({
                    is_active: false,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', codeId);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, message: 'Code deactivated' });
        }

        if (action === 'activate') {
            if (!codeId) {
                return NextResponse.json({ error: 'Code ID is required' }, { status: 400 });
            }

            const { error } = await supabase
                .from('referral_codes')
                .update({
                    is_active: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', codeId);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, message: 'Code activated' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Error processing sales team action:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
