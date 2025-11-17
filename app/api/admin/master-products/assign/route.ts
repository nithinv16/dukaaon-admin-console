import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // Validate required fields
    if (!payload.master_product_id || !payload.seller_id || !payload.price) {
      return NextResponse.json(
        { error: 'Missing required fields: master_product_id, seller_id, price' },
        { status: 400 }
      );
    }

    const product = await adminQueries.addMasterProductToSeller(payload);
    return NextResponse.json({ data: product, success: true });
  } catch (error: any) {
    console.error('Error adding master product to seller:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add master product to seller' },
      { status: 500 }
    );
  }
}

