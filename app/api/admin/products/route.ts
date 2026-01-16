import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';
import { hasPermission } from '@/lib/permissions';
import {
  startActivityTracking,
  endActivityTracking,
  trackProductCreation,
  trackProductUpdate,
  getClientIP
} from '@/lib/employeeTracking';

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
  let trackingId: string | undefined;
  try {
    const productData = await request.json();
    const adminId = productData.admin_id; // Admin ID should be passed from client
    const sessionId = productData.session_id; // Session ID from login
    const ipAddress = getClientIP(request);

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

    // Create variants if provided
    if (product?.id && productData.variants && Array.isArray(productData.variants) && productData.variants.length > 0) {
      try {
        const supabase = getAdminSupabaseClient();
        if (supabase) {
          // Prepare variants with product_id
          const variantsToCreate = productData.variants.map((v: any) => ({
            product_id: product.id,
            sku: v.sku,
            variant_type: v.variant_type,
            variant_value: v.variant_value,
            price: v.price,
            mrp: v.mrp || null,
            stock_quantity: v.stock_quantity || 0,
            image_url: v.image_url || null,
            is_default: v.is_default || false,
            display_order: v.display_order || 0,
            is_active: true,
          }));

          const { error: variantError } = await supabase
            .from('product_variants')
            .insert(variantsToCreate);

          if (variantError) {
            console.error('Error creating variants:', variantError);
            // Don't fail the product creation if variants fail
          }
        }
      } catch (variantError) {
        console.error('Error creating variants:', variantError);
        // Don't fail the product creation if variants fail
      }
    }

    // Track product creation if admin_id is provided
    if (adminId && product?.id) {
      try {
        const tracking = await trackProductCreation(
          adminId,
          sessionId,
          [product.id],
          { product_name: product.name },
          ipAddress
        );
        trackingId = tracking.operationId;
        await endActivityTracking(trackingId, 'success');
      } catch (trackError) {
        console.error('Error tracking product creation:', trackError);
        // Don't fail the request if tracking fails
      }
    }

    return NextResponse.json({ data: product, success: true });
  } catch (error: any) {
    console.error('Error adding product:', error);
    if (trackingId) {
      await endActivityTracking(trackingId, 'failed', error.message);
    }
    return NextResponse.json(
      { error: error.message || 'Failed to add product' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  let trackingId: string | undefined;
  try {
    const { productId, updates, admin_id, session_id } = await request.json();
    const ipAddress = getClientIP(request);

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const product = await adminQueries.updateProduct(productId, updates);

    // Track product update if admin_id is provided
    if (admin_id && product?.id) {
      try {
        const tracking = await trackProductUpdate(
          admin_id,
          session_id,
          product.id,
          { updated_fields: Object.keys(updates) },
          ipAddress
        );
        trackingId = tracking.operationId;
        await endActivityTracking(trackingId, 'success');
      } catch (trackError) {
        console.error('Error tracking product update:', trackError);
      }
    }

    return NextResponse.json({ data: product, success: true });
  } catch (error: any) {
    console.error('Error updating product:', error);
    if (trackingId) {
      await endActivityTracking(trackingId, 'failed', error.message);
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  let trackingId: string | undefined;
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');
    const productIds = searchParams.get('ids'); // For bulk delete
    const adminId = searchParams.get('admin_id') ?? undefined;
    const sessionId = searchParams.get('session_id') ?? undefined;
    const ipAddress = getClientIP(request);

    // Check permission for delete operation
    if (adminId) {
      const canDelete = await hasPermission(adminId, 'products', 'delete');
      if (!canDelete) {
        return NextResponse.json(
          { error: 'Permission denied: You do not have permission to delete products' },
          { status: 403 }
        );
      }
    }

    // Support both single and bulk delete
    if (productIds) {
      const ids = productIds.split(',').filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json(
          { error: 'No product IDs provided' },
          { status: 400 }
        );
      }

      // Track bulk delete
      if (adminId) {
        const tracking = await startActivityTracking({
          admin_id: adminId,
          session_id: sessionId,
          action_type: 'delete_product',
          entity_type: 'product',
          items_processed: ids.length,
          metadata: { product_ids: ids },
          ip_address: ipAddress,
        });
        trackingId = tracking.operationId;
      }

      const results = await adminQueries.deleteProducts(ids);

      if (trackingId) {
        await endActivityTracking(trackingId, 'success', undefined, ids.length);
      }

      return NextResponse.json({ data: results, success: true });
    } else if (productId) {
      // Track single delete
      if (adminId) {
        const tracking = await startActivityTracking({
          admin_id: adminId,
          session_id: sessionId,
          action_type: 'delete_product',
          entity_type: 'product',
          entity_id: productId,
          items_processed: 1,
          ip_address: ipAddress,
        });
        trackingId = tracking.operationId;
      }

      const result = await adminQueries.deleteProduct(productId);

      if (trackingId) {
        await endActivityTracking(trackingId, 'success');
      }

      return NextResponse.json({ data: result, success: true });
    } else {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error deleting product:', error);
    if (trackingId) {
      await endActivityTracking(trackingId, 'failed', error.message);
    }
    return NextResponse.json(
      { error: error.message || 'Failed to delete product' },
      { status: 500 }
    );
  }
}

