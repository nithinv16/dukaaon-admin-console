import { NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

/**
 * Debug endpoint to test Supabase connection and configuration
 * 
 * IMPORTANT: Delete this file after debugging!
 * 
 * Visit: https://your-app.amplifyapp.com/api/debug/supabase-connection
 */
export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {},
  };

  // Check 1: Environment variables
  results.checks.envVars = {
    NEXT_PUBLIC_SUPABASE_URL: {
      set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      preview: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      preview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...',
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      preview: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...',
    },
  };

  // Check 2: Can we create Supabase client?
  try {
    const supabase = getAdminSupabaseClient();
    results.checks.clientCreation = {
      success: true,
      message: 'Supabase client created successfully',
    };

    // Check 3: Can we connect to Supabase?
    try {
      const { data, error } = await supabase
        .from('admin_credentials')
        .select('count')
        .limit(1)
        .single();

      if (error) {
        results.checks.tableAccess = {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          },
        };
      } else {
        results.checks.tableAccess = {
          success: true,
          message: 'Successfully accessed admin_credentials table',
        };
      }
    } catch (tableError: any) {
      results.checks.tableAccess = {
        success: false,
        error: tableError.message,
      };
    }

    // Check 4: Does the RPC function exist?
    try {
      const { data, error } = await supabase.rpc('validate_admin_credentials', {
        input_email: 'test@test.com',
        input_password: 'test',
      });

      if (error) {
        results.checks.rpcFunction = {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          },
          diagnosis: error.code === '42883' 
            ? 'RPC function does not exist - run create_admin_credentials_table.sql'
            : 'RPC function exists but returned an error',
        };
      } else {
        results.checks.rpcFunction = {
          success: true,
          message: 'RPC function exists and is callable',
          testResult: data,
        };
      }
    } catch (rpcError: any) {
      results.checks.rpcFunction = {
        success: false,
        error: rpcError.message,
      };
    }

    // Check 5: Test with actual admin credentials
    try {
      const { data, error } = await supabase.rpc('validate_admin_credentials', {
        input_email: 'admin@dukaaon.in',
        input_password: 'dukaaon#28',
      });

      if (error) {
        results.checks.actualCredentials = {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          },
        };
      } else {
        results.checks.actualCredentials = {
          success: data?.success || false,
          message: data?.message || 'Unknown response',
          hasAdminData: !!data?.admin,
        };
      }
    } catch (credError: any) {
      results.checks.actualCredentials = {
        success: false,
        error: credError.message,
      };
    }

  } catch (clientError: any) {
    results.checks.clientCreation = {
      success: false,
      error: clientError.message,
      stack: clientError.stack,
    };
  }

  // Overall diagnosis
  const allPassed = Object.values(results.checks).every((check: any) => check.success);
  results.overall = {
    status: allPassed ? 'HEALTHY' : 'ISSUES_FOUND',
    summary: allPassed 
      ? 'All checks passed! The issue might be elsewhere.'
      : 'Found issues that need to be resolved. See details above.',
  };

  return NextResponse.json(results, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

