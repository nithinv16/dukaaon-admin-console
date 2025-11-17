import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const options = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 25,
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      status: searchParams.get('status') || undefined,
      seller_id: searchParams.get('seller_id') || undefined,
    };

    const result = await adminQueries.getProducts(options);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const productData = await request.json();
    
    // Validate required fields
    if (!productData.name || !productData.description || !productData.price || !productData.seller_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, description, price, seller_id' },
        { status: 400 }
      );
    }

    const product = await adminQueries.addProduct(productData);
    return NextResponse.json({ data: product, success: true });
  } catch (error: any) {
    console.error('Error adding product:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add product' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { productId, updates } = await request.json();
    
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const product = await adminQueries.updateProduct(productId, updates);
    return NextResponse.json({ data: product, success: true });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update product' },
      { status: 500 }
    );
  }
}

