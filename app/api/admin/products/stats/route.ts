import { NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

/**
 * GET /api/admin/products/stats
 * Fetches product statistics (total, active, out of stock, low stock)
 */
export async function GET() {
  try {
    const stats = await adminQueries.getProductStats();
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching product stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch product stats' },
      { status: 500 }
    );
  }
}

