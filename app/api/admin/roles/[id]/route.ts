import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roleId = params.id;
    const updates = await request.json();

    const supabase = getAdminSupabaseClient();

    // Check if role is system role
    const { data: existingRole } = await supabase
      .from('admin_roles')
      .select('is_system')
      .eq('id', roleId)
      .single();

    if (existingRole?.is_system) {
      return NextResponse.json(
        { error: 'Cannot modify system roles' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('admin_roles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roleId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update role' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roleId = params.id;

    const supabase = getAdminSupabaseClient();

    // Check if role is system role
    const { data: existingRole } = await supabase
      .from('admin_roles')
      .select('is_system')
      .eq('id', roleId)
      .single();

    if (existingRole?.is_system) {
      return NextResponse.json(
        { error: 'Cannot delete system roles' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('admin_roles')
      .delete()
      .eq('id', roleId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete role' },
      { status: 500 }
    );
  }
}

