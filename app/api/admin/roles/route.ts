import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase
      .from('admin_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ roles: data || [] });
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const roleData = await request.json();

    if (!roleData.name) {
      return NextResponse.json(
        { error: 'Role name is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase
      .from('admin_roles')
      .insert({
        name: roleData.name,
        description: roleData.description || '',
        permissions: roleData.permissions || [],
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create role' },
      { status: 500 }
    );
  }
}

