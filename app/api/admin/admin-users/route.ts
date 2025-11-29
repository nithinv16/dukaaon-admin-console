import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminSupabaseClient();

    // Get admin users with their assigned roles
    const { data, error } = await supabase
      .from('admin_credentials')
      .select(`
        *,
        admin_roles:role_id (
          id,
          name,
          description
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform data to include role name
    const admins = (data || []).map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      role_name: user.admin_roles?.name || user.role,
      role_id: user.role_id,
      status: user.status,
      created_at: user.created_at,
    }));

    return NextResponse.json({ admins });
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin users' },
      { status: 500 }
    );
  }
}

