import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase credentials');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const id = formData.get('id') as string;
        const type = formData.get('type') as 'category' | 'subcategory';

        if (!file || !id || !type) {
            return NextResponse.json(
                { error: 'Missing required fields: file, id, type' },
                { status: 400 }
            );
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, SVG' },
                { status: 400 }
            );
        }

        // Max file size: 2MB
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File size exceeds 2MB limit' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Determine folder based on type
        const folder = type === 'category' ? 'categories-icon' : 'subcategories';

        // Generate unique filename
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `${id}-${Date.now()}.${ext}`;
        const filePath = `${folder}/${fileName}`;

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('category-images')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true, // Overwrite if exists
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return NextResponse.json(
                { error: `Failed to upload image: ${uploadError.message}` },
                { status: 500 }
            );
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('category-images')
            .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        // Update database with new image URL
        const tableName = type === 'category' ? 'categories' : 'subcategories';
        const { data: updateData, error: updateError } = await supabase
            .from(tableName)
            .update({ image_url: publicUrl })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Database update error:', updateError);
            return NextResponse.json(
                { error: `Failed to update database: ${updateError.message}` },
                { status: 500 }
            );
        }

        console.log(`✅ ${type} image uploaded successfully:`, publicUrl);

        return NextResponse.json({
            success: true,
            data: {
                id,
                type,
                image_url: publicUrl,
                file_path: filePath,
            },
        });
    } catch (error: any) {
        console.error('Error uploading category image:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to upload image' },
            { status: 500 }
        );
    }
}
