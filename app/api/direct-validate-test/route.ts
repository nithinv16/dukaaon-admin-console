import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Direct validation test - bypasses all our custom logic
 * Tests the raw Supabase connection and RPC call
 * DELETE AFTER DEBUGGING!
 */
export async function GET() {
  const logs: string[] = [];
  
  try {
    logs.push('1. Starting direct validation test');
    
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    logs.push(`2. Env vars check:`);
    logs.push(`   - URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
    logs.push(`   - Service Key: ${serviceRoleKey ? 'SET (length: ' + serviceRoleKey.length + ')' : 'MISSING'}`);
    
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        error: 'Environment variables not set',
        logs,
      }, { status: 500 });
    }
    
    logs.push('3. Creating Supabase client directly...');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    logs.push('4. Supabase client created');
    
    logs.push('5. Calling RPC with admin credentials...');
    const { data, error } = await supabase.rpc('validate_admin_credentials', {
      input_email: 'admin@dukaaon.in',
      input_password: 'dukaaon#28',
    });
    
    logs.push(`6. RPC call completed`);
    logs.push(`   - Error: ${error ? JSON.stringify(error) : 'null'}`);
    logs.push(`   - Data: ${data ? JSON.stringify(data) : 'null'}`);
    logs.push(`   - Data type: ${typeof data}`);
    
    if (error) {
      logs.push(`7. RPC returned error`);
      return NextResponse.json({
        test: 'FAILED',
        reason: 'RPC error',
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
        logs,
      }, { status: 500 });
    }
    
    if (!data) {
      logs.push(`7. RPC returned null/undefined data`);
      return NextResponse.json({
        test: 'FAILED',
        reason: 'No data returned from RPC',
        logs,
      }, { status: 500 });
    }
    
    logs.push(`7. Checking data structure...`);
    logs.push(`   - Has 'success' field: ${'success' in data}`);
    logs.push(`   - success value: ${data.success}`);
    logs.push(`   - Has 'admin' field: ${'admin' in data}`);
    logs.push(`   - Has 'message' field: ${'message' in data}`);
    
    if (!data.success) {
      logs.push(`8. Login failed: ${data.message || 'Unknown reason'}`);
      return NextResponse.json({
        test: 'FAILED',
        reason: 'RPC returned success=false',
        data,
        logs,
      }, { status: 401 });
    }
    
    logs.push(`8. SUCCESS! Admin data received`);
    return NextResponse.json({
      test: 'SUCCESS',
      data,
      logs,
    }, { status: 200 });
    
  } catch (error: any) {
    logs.push(`ERROR CAUGHT: ${error.message}`);
    logs.push(`Stack: ${error.stack}`);
    
    return NextResponse.json({
      test: 'ERROR',
      error: error.message,
      stack: error.stack,
      logs,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const logs: string[] = [];
  
  try {
    logs.push('1. Starting POST validation test');
    
    const body = await request.json();
    const { email, password } = body;
    
    logs.push(`2. Received credentials: ${email}`);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      logs.push('3. Environment variables missing!');
      return NextResponse.json({
        error: 'Environment variables not set',
        logs,
      }, { status: 500 });
    }
    
    logs.push('3. Creating Supabase client...');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    logs.push('4. Calling RPC...');
    const { data, error } = await supabase.rpc('validate_admin_credentials', {
      input_email: email,
      input_password: password,
    });
    
    logs.push(`5. RPC completed. Error: ${!!error}, Data: ${!!data}`);
    
    if (error) {
      logs.push(`6. Error details: ${JSON.stringify(error)}`);
      return NextResponse.json({
        success: false,
        error: 'Authentication failed',
        logs,
      }, { status: 401 });
    }
    
    if (!data) {
      logs.push('6. No data returned');
      return NextResponse.json({
        success: false,
        error: 'No data returned',
        logs,
      }, { status: 500 });
    }
    
    logs.push(`6. Returning data: ${JSON.stringify(data)}`);
    
    // Return the exact data from RPC
    return NextResponse.json({
      ...data,
      _logs: logs,
    }, { status: 200 });
    
  } catch (error: any) {
    logs.push(`ERROR: ${error.message}`);
    return NextResponse.json({
      error: error.message,
      logs,
    }, { status: 500 });
  }
}

