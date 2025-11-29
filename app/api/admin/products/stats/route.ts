import { NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

/**
 * GET /api/admin/products/stats
 * Fetches product statistics (total, active, out of stock, low stock)
 */
export async function GET() {
  try {
    const stats = await adminQueries.getProductStats();
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    console.error('Error fetching product stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch product stats' },
      { status: 500 }
    );
  }
}

