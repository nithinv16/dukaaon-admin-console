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

// GET - Fetch referrals with pagination and filters
export async function GET(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '20');
        const status = searchParams.get('status');
        const codeType = searchParams.get('codeType');
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('referrals')
            .select(`
        *,
        referrer:profiles!referrer_id(id, phone_number, business_details),
        referee:profiles!referee_id(id, phone_number, business_details),
        referral_code_data:referral_codes(code, code_type, metadata)
      `, { count: 'exact' })
            .range(from, to)
            .order('created_at', { ascending: false });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const { data, count, error } = await query;

        if (error) {
            console.error('Error fetching referrals:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            data,
            totalCount: count,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
        });
    } catch (error: any) {
        console.error('Error in referrals API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Manage referral actions (approve, reward, invalidate)
export async function POST(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const body = await request.json();
        const { action, referralId, reason } = body;

        if (!action || !referralId) {
            return NextResponse.json(
                { error: 'Action and referralId are required' },
                { status: 400 }
            );
        }

        switch (action) {
            case 'approve': {
                const { error } = await supabase
                    .from('referrals')
                    .update({
                        status: 'verified',
                        verified_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', referralId);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
                return NextResponse.json({ success: true, message: 'Referral approved' });
            }

            case 'reward': {
                // Get referral details
                const { data: referral } = await supabase
                    .from('referrals')
                    .select('*')
                    .eq('id', referralId)
                    .single();

                if (!referral) {
                    return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
                }

                // Update referral status
                const { error: updateError } = await supabase
                    .from('referrals')
                    .update({
                        status: 'rewarded',
                        rewarded_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', referralId);

                if (updateError) {
                    return NextResponse.json({ error: updateError.message }, { status: 500 });
                }

                // Create reward record
                await supabase.from('referral_rewards').insert({
                    referral_id: referralId,
                    user_id: referral.referrer_id,
                    reward_type: 'wallet_credit',
                    amount: referral.referrer_reward_amount,
                    status: 'credited',
                    credited_at: new Date().toISOString(),
                });

                // Update referrer's wallet using RPC
                await supabase.rpc('add_to_wallet', {
                    p_user_id: referral.referrer_id,
                    p_amount: referral.referrer_reward_amount,
                });

                return NextResponse.json({ success: true, message: 'Referral rewarded successfully' });
            }

            case 'invalidate': {
                if (!reason) {
                    return NextResponse.json({ error: 'Reason is required for invalidation' }, { status: 400 });
                }

                const { error } = await supabase
                    .from('referrals')
                    .update({
                        status: 'invalid',
                        reward_note: reason,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', referralId);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
                return NextResponse.json({ success: true, message: 'Referral invalidated' });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Error processing referral action:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
