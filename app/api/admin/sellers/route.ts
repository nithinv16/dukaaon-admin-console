import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const sellers = await adminQueries.getSellersWithDetails();
    return NextResponse.json({ data: sellers });
  } catch (error: any) {
    console.error('Error fetching sellers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sellers' },
      { status: 500 }
    );
  }
}

