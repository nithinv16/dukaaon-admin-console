import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const slots = await adminQueries.getContentSlots();
    return NextResponse.json({ data: slots });
  } catch (error: any) {
    console.error('Error fetching content slots:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch content slots' },
      { status: 500 }
    );
  }
}

