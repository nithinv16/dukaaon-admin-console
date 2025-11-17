import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const options = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      admin_id: searchParams.get('admin_id') || undefined,
      action: searchParams.get('action') || undefined,
      entity_type: searchParams.get('entity_type') || undefined,
    };

    const result = await adminQueries.getAuditLog(options);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch audit log' },
      { status: 500 }
    );
  }
}

