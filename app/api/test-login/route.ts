import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * Test endpoint to directly test the login flow
 * DELETE AFTER TESTING!
 */
export async function GET() {
  try {
    const supabase = getAdminSupabaseClient();
    
    // Test with actual admin credentials
    const { data, error } = await supabase.rpc('validate_admin_credentials', {
      input_email: 'admin@dukaaon.in',
      input_password: 'dukaaon#28',
    });

    console.log('Direct RPC test result:', { data, error });

    if (error) {
      return NextResponse.json(
        {
          test: 'FAILED',
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      test: 'SUCCESS',
      rpcData: data,
      expectedFormat: {
        success: data?.success,
        hasAdmin: !!data?.admin,
        adminEmail: data?.admin?.email,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        test: 'ERROR',
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Test POST endpoint (simulates the actual login)
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    console.log('Test login POST received:', { email });
    
    const supabase = getAdminSupabaseClient();
    
    const { data, error } = await supabase.rpc('validate_admin_credentials', {
      input_email: email,
      input_password: password,
    });

    console.log('POST RPC result:', { data, error });

    if (error) {
      console.error('RPC error:', error);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('Returning data:', data);
    
    // Return the exact same format as validate-credentials endpoint
    return NextResponse.json(data, { status: 200 });
    
  } catch (error: any) {
    console.error('Test login error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

