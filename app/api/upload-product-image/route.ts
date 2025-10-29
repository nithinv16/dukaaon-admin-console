import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Storage service unavailable' },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;
    const productName = formData.get('productName') as string;
    const currentImageUrl = formData.get('currentImageUrl') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Create a consistent filename based on product name (no timestamp)
    const sanitizedProductName = productName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase()
      .substring(0, 50);
    
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${sanitizedProductName}.${fileExtension}`;
    const filePath = `master-products/${fileName}`;

    // If there's a current image, try to delete it first (only if it's different from the new one)
    if (currentImageUrl && currentImageUrl.includes('master-products/')) {
      try {
        // Extract the old file path from the URL
        const urlParts = currentImageUrl.split('/');
        const oldFileName = urlParts[urlParts.length - 1];
        const oldFilePath = `master-products/${oldFileName}`;
        
        // Only delete if it's a different file
        if (oldFilePath !== filePath) {
          const { error: deleteError } = await supabase.storage
            .from('product-images')
            .remove([oldFilePath]);
          
          if (deleteError) {
            console.warn('Could not delete old image:', deleteError);
          } else {
            console.log('Old image deleted:', oldFilePath);
          }
        }
      } catch (deleteErr) {
        console.warn('Error deleting old image:', deleteErr);
      }
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase storage (upsert will replace if file exists)
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true // This will replace the file if it exists
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload image to storage' },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    const imageUrl = publicUrl;

    // Update master_products table with new image URL
    const productId = formData.get('productId') as string;
    if (productId) {
      try {
        // Get current master product to preserve existing images
        const { data: currentProduct } = await supabase
          .from('master_products')
          .select('images')
          .eq('id', productId)
          .single();

        // Update images array - replace or add the new image URL
        const currentImages = currentProduct?.images || [];
        const updatedImages = currentImages.length > 0 
          ? [imageUrl, ...currentImages.filter((img: string) => img !== imageUrl)] // Replace first image or add new one
          : [imageUrl];

        // Update master_products table
        const { error: updateError } = await supabase
          .from('master_products')
          .update({ 
            images: updatedImages,
            image_url: imageUrl, // For backward compatibility
            updated_at: new Date().toISOString()
          })
          .eq('id', productId);

        if (updateError) {
          console.error('Error updating master_products:', updateError);
        }

        // Also update any products table entries that reference this master product
        const { error: productsUpdateError } = await supabase
          .from('products')
          .update({ 
            image_url: imageUrl,
            updated_at: new Date().toISOString()
          })
          .eq('name', productName); // Match by product name

        if (productsUpdateError) {
          console.error('Error updating products table:', productsUpdateError);
        }

      } catch (dbError) {
        console.error('Database update error:', dbError);
        // Don't fail the entire request if DB update fails
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      fileName,
      message: 'Image uploaded and database updated successfully'
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}