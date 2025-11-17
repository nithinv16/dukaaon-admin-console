import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminId = params.id;
    const updates = await request.json();

    const supabase = getAdminSupabaseClient();

    // Only allow updating role_id
    const allowedFields = ['role_id'];
    const filteredUpdates: any = {};
    
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field] || null; // Allow null to unassign role
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('admin_credentials')
      .update({
        ...filteredUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating admin user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update admin user' },
      { status: 500 }
    );
  }
}

