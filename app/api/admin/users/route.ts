import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    if (role) {
      const users = await adminQueries.getUsersByRole(role);
      return NextResponse.json({ data: users });
    } else {
      const users = await adminQueries.getAllUsers();
      // getAllUsers returns users array directly, wrap it in data
      return NextResponse.json({ data: Array.isArray(users) ? users : [] });
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, status, ...updates } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // If only status is provided, use the old method for backward compatibility
    if (status && Object.keys(updates).length === 0) {
      const result = await adminQueries.updateUserStatus(userId, status);
      return NextResponse.json(result);
    }

    // Otherwise, use the full update method
    const updatePayload: any = {};
    if (status) updatePayload.status = status;
    if (updates.phone_number) updatePayload.phone_number = updates.phone_number;
    if (updates.kyc_status) updatePayload.kyc_status = updates.kyc_status;
    if (updates.business_details) updatePayload.business_details = updates.business_details;

    const result = await adminQueries.updateUser(userId, updatePayload);
    return NextResponse.json({ data: result, success: true });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const result = await adminQueries.deleteUser(userId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}