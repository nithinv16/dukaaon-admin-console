import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sellers = await adminQueries.getSellersWithDetails();

    // Debug: Check if Ranni Traders is in the response
    const ranni = sellers.find((s: any) => s.id === '44c43fe9-d906-479d-868f-6c23ecc05cce');
    console.log('API /sellers - Ranni Traders found?', !!ranni);
    if (ranni) {
      console.log('API /sellers - Ranni Traders data:', JSON.stringify(ranni, null, 2));
    } else {
      console.log('API /sellers - Ranni Traders NOT found. Total sellers:', sellers.length);
    }

    return NextResponse.json({ data: sellers });
  } catch (error: any) {
    console.error('Error fetching sellers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sellers' },
      { status: 500 }
    );
  }
}

