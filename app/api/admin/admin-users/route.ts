import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminSupabaseClient();

    // Get admin users without join
    const { data: users, error: usersError } = await supabase
      .from('admin_credentials')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    // Get all roles
    const { data: roles, error: rolesError } = await supabase
      .from('admin_roles')
      .select('id, name, description');

    if (rolesError) throw rolesError;

    // Create a map of roles by ID for quick lookup
    const rolesMap = new Map(roles?.map(role => [role.id, role]) || []);

    // Transform data to include role details
    const admins = (users || []).map((user: any) => {
      const roleDetails = user.role_id ? rolesMap.get(user.role_id) : null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        role_name: roleDetails?.name || user.role,
        role_id: user.role_id,
        status: user.status,
        created_at: user.created_at,
      };
    });

    return NextResponse.json({ admins });
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin users' },
      { status: 500 }
    );
  }
}

