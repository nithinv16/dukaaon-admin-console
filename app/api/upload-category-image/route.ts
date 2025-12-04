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
    const categoryName = formData.get('categoryName') as string;
    const categoryId = formData.get('categoryId') as string;
    const type = formData.get('type') as string; // 'category' or 'subcategory'
    const currentImageUrl = formData.get('currentImageUrl') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!categoryId || !type) {
      return NextResponse.json(
        { error: 'Category ID and type are required' },
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

    // Determine folder based on type
    const folder = type === 'category' ? 'categories-icon' : 'subcategories';
    const bucketName = 'category-images';

    // Create a consistent filename based on category name
    const sanitizedName = (categoryName || 'category')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase()
      .substring(0, 50);
    
    const fileExtension = file.name.split('.').pop() || 'jpg';
    // Use timestamp + random string to ensure unique filenames
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const fileName = `${sanitizedName}_${uniqueId}.${fileExtension}`;
    const filePath = `${folder}/${fileName}`;

    // If there's a current image, try to delete it first (only if it's different from the new one)
    if (currentImageUrl && currentImageUrl.includes(`${folder}/`)) {
      try {
        // Extract the old file path from the URL
        const urlParts = currentImageUrl.split('/');
        const oldFileName = urlParts[urlParts.length - 1];
        const oldFilePath = `${folder}/${oldFileName}`;
        
        // Only delete if it's a different file
        if (oldFilePath !== filePath) {
          const { error: deleteError } = await supabase.storage
            .from(bucketName)
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
      .from(bucketName)
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
      .from(bucketName)
      .getPublicUrl(filePath);

    const imageUrl = publicUrl;

    // Update the appropriate table with new image URL
    try {
      if (type === 'category') {
        const { error: updateError } = await supabase
          .from('categories')
          .update({ 
            image_url: imageUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', categoryId);

        if (updateError) {
          console.error('Error updating categories table:', updateError);
          return NextResponse.json(
            { error: 'Failed to update category image URL', details: updateError.message },
            { status: 500 }
          );
        }
      } else {
        const { error: updateError } = await supabase
          .from('subcategories')
          .update({ 
            image_url: imageUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', categoryId);

        if (updateError) {
          console.error('Error updating subcategories table:', updateError);
          return NextResponse.json(
            { error: 'Failed to update subcategory image URL', details: updateError.message },
            { status: 500 }
          );
        }
      }
    } catch (dbError) {
      console.error('Database update error:', dbError);
      return NextResponse.json(
        { error: 'Failed to update database', details: dbError instanceof Error ? dbError.message : 'Unknown error' },
        { status: 500 }
      );
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


