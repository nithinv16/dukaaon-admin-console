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

// GET - Fetch top referrers leaderboard
export async function GET(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');

        const { data, error } = await supabase
            .from('profiles')
            .select('id, phone_number, business_details, total_referrals, total_referral_earnings, wallet_balance')
            .gt('total_referrals', 0)
            .order('total_referrals', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching leaderboard:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Process data
        const leaderboard = data?.map((user, index) => ({
            rank: index + 1,
            id: user.id,
            phoneNumber: user.phone_number,
            businessName: user.business_details?.shopName || user.business_details?.business_name || 'N/A',
            totalReferrals: user.total_referrals || 0,
            totalEarnings: user.total_referral_earnings || 0,
            walletBalance: user.wallet_balance || 0,
        }));

        return NextResponse.json({ data: leaderboard });
    } catch (error: any) {
        console.error('Error in leaderboard API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
