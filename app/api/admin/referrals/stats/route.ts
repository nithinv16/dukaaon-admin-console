import { NextResponse } from 'next/server';
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

// GET - Fetch referral dashboard stats
export async function GET() {
    try {
        const supabase = getAdminSupabase();

        // Total referrals
        const { count: totalReferrals } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true });

        // Pending referrals
        const { count: pendingReferrals } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        // Verified referrals
        const { count: verifiedReferrals } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'verified');

        // Successful (rewarded) referrals
        const { count: successfulReferrals } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rewarded');

        // Invalid referrals
        const { count: invalidReferrals } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'invalid');

        // Total rewards paid
        const { data: rewardData } = await supabase
            .from('referral_rewards')
            .select('amount')
            .eq('status', 'credited');

        const totalRewardsPaid = rewardData?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;

        // Total link clicks
        const { count: totalClicks } = await supabase
            .from('referral_link_clicks')
            .select('*', { count: 'exact', head: true });

        // Converted clicks
        const { count: convertedClicks } = await supabase
            .from('referral_link_clicks')
            .select('*', { count: 'exact', head: true })
            .eq('converted', true);

        // Conversion rate
        const conversionRate = totalClicks
            ? ((successfulReferrals || 0) / totalClicks * 100).toFixed(2)
            : 0;

        // Sales team codes count
        const { count: salesTeamCodes } = await supabase
            .from('referral_codes')
            .select('*', { count: 'exact', head: true })
            .eq('code_type', 'sales_team');

        // Active sales team codes
        const { count: activeSalesTeamCodes } = await supabase
            .from('referral_codes')
            .select('*', { count: 'exact', head: true })
            .eq('code_type', 'sales_team')
            .eq('is_active', true);

        return NextResponse.json({
            data: {
                totalReferrals: totalReferrals || 0,
                pendingReferrals: pendingReferrals || 0,
                verifiedReferrals: verifiedReferrals || 0,
                successfulReferrals: successfulReferrals || 0,
                invalidReferrals: invalidReferrals || 0,
                totalRewardsPaid,
                totalClicks: totalClicks || 0,
                convertedClicks: convertedClicks || 0,
                conversionRate: `${conversionRate}%`,
                salesTeamCodes: salesTeamCodes || 0,
                activeSalesTeamCodes: activeSalesTeamCodes || 0,
            },
        });
    } catch (error: any) {
        console.error('Error fetching referral stats:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
