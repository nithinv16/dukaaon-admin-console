import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * Test endpoint that mimics EXACTLY what happens during login
 * DELETE AFTER DEBUGGING!
 */
export async function POST(request: NextRequest) {
  console.log('=== Test Login Started ===');
  
  try {
    const body = await request.json();
    console.log('Request body:', body);
    
    const { email, password } = body;
    
    if (!email || !password) {
      console.log('Missing credentials');
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    console.log('Creating Supabase client...');
    const supabase = getAdminSupabaseClient();
    console.log('Supabase client created');

    console.log('Calling RPC function...');
    const { data, error } = await supabase.rpc('validate_admin_credentials', {
      input_email: email,
      input_password: password,
    });

    console.log('RPC Response:', { data, error });

    if (error) {
      console.error('RPC Error:', error);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('Success! Returning data:', JSON.stringify(data, null, 2));
    console.log('Data type:', typeof data);
    console.log('Data keys:', data ? Object.keys(data) : 'null');
    console.log('data.success:', data?.success);
    console.log('data.admin:', data?.admin);
    
    return NextResponse.json(data, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
  } catch (error: any) {
    console.error('Caught error:', error);
    return NextResponse.json(
      { 
        error: 'Server error',
        message: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to test login',
    testCredentials: {
      email: 'admin@dukaaon.in',
      password: 'dukaaon#28',
    },
  });
}

