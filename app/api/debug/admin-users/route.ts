import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const supabase = getAdminSupabaseClient();

        // Direct query with no RLS
        const { data, error, count } = await supabase
            .from('admin_credentials')
            .select('id, email, name, role, role_id, status', { count: 'exact' })
            .order('created_at', { ascending: false });

        return NextResponse.json({
            success: !error,
            count,
            data,
            error: error?.message,
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
        });
    }
}
