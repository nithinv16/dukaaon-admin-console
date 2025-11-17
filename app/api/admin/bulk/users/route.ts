import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { user_ids, operation, value } = await request.json();

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json(
        { error: 'User IDs array is required' },
        { status: 400 }
      );
    }

    if (!operation) {
      return NextResponse.json(
        { error: 'Operation is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();
    let updated = 0;

    switch (operation) {
      case 'update_status':
        if (!value) {
          return NextResponse.json(
            { error: 'Status value is required' },
            { status: 400 }
          );
        }
        const { error: statusError } = await supabase
          .from('profiles')
          .update({ status: value })
          .in('id', user_ids);
        if (statusError) throw statusError;
        updated = user_ids.length;
        break;

      case 'update_role':
        if (!value) {
          return NextResponse.json(
            { error: 'Role value is required' },
            { status: 400 }
          );
        }
        const { error: roleError } = await supabase
          .from('profiles')
          .update({ role: value })
          .in('id', user_ids);
        if (roleError) throw roleError;
        updated = user_ids.length;
        break;

      case 'update_kyc_status':
        if (!value) {
          return NextResponse.json(
            { error: 'KYC status value is required' },
            { status: 400 }
          );
        }
        const { error: kycError } = await supabase
          .from('profiles')
          .update({ kyc_status: value })
          .in('id', user_ids);
        if (kycError) throw kycError;
        updated = user_ids.length;
        break;

      case 'block':
        const { error: blockError } = await supabase
          .from('profiles')
          .update({ status: 'suspended' })
          .in('id', user_ids);
        if (blockError) throw blockError;
        updated = user_ids.length;
        break;

      case 'unblock':
        const { error: unblockError } = await supabase
          .from('profiles')
          .update({ status: 'active' })
          .in('id', user_ids);
        if (unblockError) throw unblockError;
        updated = user_ids.length;
        break;

      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      updated,
      message: `Successfully updated ${updated} users`,
    });
  } catch (error: any) {
    console.error('Error performing bulk user operation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform bulk operation' },
      { status: 500 }
    );
  }
}

