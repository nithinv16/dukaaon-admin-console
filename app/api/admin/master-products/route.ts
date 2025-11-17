import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const options = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 12,
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
    };

    const result = await adminQueries.getMasterProducts(options);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching master products:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch master products' },
      { status: 500 }
    );
  }
}

