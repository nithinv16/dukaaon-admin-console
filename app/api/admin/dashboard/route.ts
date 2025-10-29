import { NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const stats = await adminQueries.getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}