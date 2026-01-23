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

// GET - Fetch all profile change requests
export async function GET(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'pending';
        const role = searchParams.get('role'); // 'seller' or 'retailer'

        let query = supabase
            .from('profile_change_requests')
            .select(`
        id,
        user_id,
        user_role,
        current_values,
        requested_changes,
        status,
        processed_by,
        processed_at,
        rejection_reason,
        created_at,
        updated_at
      `)
            .order('created_at', { ascending: false });

        // Filter by status
        if (status !== 'all') {
            query = query.eq('status', status);
        }

        // Filter by role if specified
        if (role) {
            query = query.eq('user_role', role);
        }

        const { data: requests, error } = await query;

        if (error) {
            console.error('Error fetching profile change requests:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Fetch user details for each request
        const userIds = Array.from(new Set(requests?.map(r => r.user_id) || []));

        let usersData: any[] = [];
        if (userIds.length > 0) {
            const { data: users, error: usersError } = await supabase
                .from('profiles')
                .select('id, phone_number, email, role')
                .in('id', userIds);

            if (!usersError && users) {
                usersData = users;
            }
        }

        // Fetch seller details for seller requests
        const sellerUserIds = requests?.filter(r => r.user_role === 'seller').map(r => r.user_id) || [];
        let sellerDetailsData: any[] = [];
        if (sellerUserIds.length > 0) {
            const { data: sellerDetails, error: sellerError } = await supabase
                .from('seller_details')
                .select('user_id, business_name, owner_name')
                .in('user_id', sellerUserIds);

            if (!sellerError && sellerDetails) {
                sellerDetailsData = sellerDetails;
            }
        }

        // Merge user data with requests
        const enrichedRequests = requests?.map(request => {
            const user = usersData.find(u => u.id === request.user_id);
            const sellerDetail = sellerDetailsData.find(s => s.user_id === request.user_id);

            return {
                ...request,
                user_phone: user?.phone_number || 'N/A',
                user_email: user?.email || 'N/A',
                business_name: sellerDetail?.business_name || request.current_values?.shopName || request.current_values?.business_name || 'N/A',
                owner_name: sellerDetail?.owner_name || request.current_values?.ownerName || request.current_values?.owner_name || 'N/A',
            };
        }) || [];

        return NextResponse.json({
            data: enrichedRequests,
            count: enrichedRequests.length,
        });
    } catch (error: any) {
        console.error('Error in profile change requests API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Process a profile change request (approve/reject)
export async function POST(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const body = await request.json();
        const { requestId, action, rejectionReason, adminUserId } = body;

        if (!requestId || !action) {
            return NextResponse.json(
                { error: 'Request ID and action are required' },
                { status: 400 }
            );
        }

        if (!['approve', 'reject'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Must be "approve" or "reject"' },
                { status: 400 }
            );
        }

        if (action === 'reject' && !rejectionReason) {
            return NextResponse.json(
                { error: 'Rejection reason is required when rejecting a request' },
                { status: 400 }
            );
        }

        // Update the request status
        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        // processed_by now references admin_users table (after running migration SQL)
        const { error: updateError } = await supabase
            .from('profile_change_requests')
            .update({
                status: newStatus,
                processed_by: adminUserId || null,
                processed_at: new Date().toISOString(),
                rejection_reason: action === 'reject' ? rejectionReason : null,
            })
            .eq('id', requestId)
            .eq('status', 'pending'); // Only update if still pending

        if (updateError) {
            console.error('Error updating profile change request:', updateError);
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // If approved, apply the changes using the database function
        if (action === 'approve') {
            const { data: applyResult, error: applyError } = await supabase.rpc(
                'apply_profile_change_request',
                { request_id: requestId }
            );

            if (applyError) {
                console.error('Error applying profile changes:', applyError);
                // Rollback the status update
                await supabase
                    .from('profile_change_requests')
                    .update({
                        status: 'pending',
                        processed_by: null,
                        processed_at: null,
                    })
                    .eq('id', requestId);

                return NextResponse.json(
                    { error: 'Failed to apply changes: ' + applyError.message },
                    { status: 500 }
                );
            }

            if (!applyResult) {
                return NextResponse.json(
                    { error: 'Failed to apply changes. The request may not exist or was already processed.' },
                    { status: 400 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: action === 'approve'
                ? 'Profile changes approved and applied successfully'
                : 'Profile change request rejected',
        });
    } catch (error: any) {
        console.error('Error processing profile change request:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
