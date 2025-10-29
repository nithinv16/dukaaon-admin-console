import { NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const analytics = await adminQueries.getAnalytics();
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}