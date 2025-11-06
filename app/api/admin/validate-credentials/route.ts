import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      console.warn('⚠️  Validation attempt with missing email or password');
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    console.log('🔐 Attempting admin credentials validation for:', email);

    // This will throw an error if environment variables are not set
    const supabase = getAdminSupabaseClient();

    // Call the admin credentials validation RPC function
    const { data, error } = await supabase.rpc('validate_admin_credentials', {
      input_email: email,
      input_password: password
    });

    if (error) {
      console.error('❌ Admin credentials validation RPC error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('✅ Admin credentials validated successfully for:', email);
    console.log('📤 Data received from RPC:', JSON.stringify(data, null, 2));
    console.log('📤 Data type:', typeof data);
    console.log('📤 Data is null?', data === null);
    console.log('📤 Data is undefined?', data === undefined);
    
    // Check if data exists
    if (data === null || data === undefined) {
      console.error('❌ RPC returned null/undefined data');
      return NextResponse.json(
        { 
          success: false, 
          message: 'No data returned from authentication',
          debug: {
            dataWasNull: data === null,
            dataWasUndefined: data === undefined,
          }
        },
        { status: 500 }
      );
    }
    
    console.log('📤 Data keys:', Object.keys(data));
    console.log('📤 data.success:', data.success);
    console.log('📤 data.admin:', data.admin);
    console.log('📤 Returning response...');
    
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('❌ Admin credentials validation error:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    
    // Provide more helpful error message
    const errorMessage = error?.message?.includes('not configured')
      ? 'Server configuration error. Please check environment variables in AWS Amplify.'
      : 'Internal server error';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}