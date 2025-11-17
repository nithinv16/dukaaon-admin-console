import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const stats = await adminQueries.getMessageStats(params.id);
    return NextResponse.json({ data: stats });
  } catch (error: any) {
    console.error('Error fetching message stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch message stats' },
      { status: 500 }
    );
  }
}

