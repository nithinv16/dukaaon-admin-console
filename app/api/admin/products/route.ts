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

    // Convert image_url to images array if provided (for compatibility)
    // The addProduct function expects images array, not image_url
    const processedData = { ...productData };
    if (productData.image_url && !productData.images) {
      processedData.images = [productData.image_url];
    }
    // Remove image_url from the data since addProduct expects images array
    delete processedData.image_url;

    // Convert stock_level to stock_available if provided (for compatibility)
    // The addProduct function expects stock_available, not stock_level
    if (productData.stock_level !== undefined && productData.stock_available === undefined) {
      processedData.stock_available = productData.stock_level;
    }
    // Remove stock_level from the data since addProduct expects stock_available
    delete processedData.stock_level;

    const product = await adminQueries.addProduct(processedData);
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

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');
    const productIds = searchParams.get('ids'); // For bulk delete

    // Support both single and bulk delete
    if (productIds) {
      const ids = productIds.split(',').filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json(
          { error: 'No product IDs provided' },
          { status: 400 }
        );
      }
      const results = await adminQueries.deleteProducts(ids);
      return NextResponse.json({ data: results, success: true });
    } else if (productId) {
      const result = await adminQueries.deleteProduct(productId);
      return NextResponse.json({ data: result, success: true });
    } else {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete product' },
      { status: 500 }
    );
  }
}

