import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

// List of allowed safe functions
const ALLOWED_FUNCTIONS = [
  'recalculate_user_stats',
  'rebuild_order_totals',
  'cleanup_old_notifications',
  'reindex_products',
  'sync_master_products',
];

export async function POST(request: NextRequest) {
  try {
    const { function_name, parameters } = await request.json();

    if (!function_name) {
      return NextResponse.json(
        { error: 'Function name is required' },
        { status: 400 }
      );
    }

    // Security check: Only allow pre-approved functions
    if (!ALLOWED_FUNCTIONS.includes(function_name)) {
      return NextResponse.json(
        { error: `Function "${function_name}" is not allowed. Only pre-approved functions can be executed.` },
        { status: 403 }
      );
    }

    const supabase = getAdminSupabaseClient();

    // Execute the function via RPC
    const { data, error } = await supabase.rpc(function_name, parameters || {});

    if (error) {
      console.error('Function execution error:', error);
      return NextResponse.json(
        { error: error.message || 'Function execution failed' },
        { status: 500 }
      );
    }

    // Log to audit log (if function execution is tracked)
    // This would be done automatically by database triggers in production

    return NextResponse.json({
      success: true,
      data,
      message: `Function ${function_name} executed successfully`,
    });
  } catch (error: any) {
    console.error('Error executing database function:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute function' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return list of available functions
  return NextResponse.json({
    functions: [
      {
        name: 'recalculate_user_stats',
        description: 'Recalculate statistics for a specific user',
        parameters: [{ name: 'user_id', type: 'uuid' }],
      },
      {
        name: 'rebuild_order_totals',
        description: 'Recalculate order totals',
        parameters: [{ name: 'order_id', type: 'uuid', optional: true }],
      },
      {
        name: 'cleanup_old_notifications',
        description: 'Delete old notifications',
        parameters: [{ name: 'days_old', type: 'integer' }],
      },
      {
        name: 'reindex_products',
        description: 'Rebuild product search indexes',
        parameters: [],
      },
      {
        name: 'sync_master_products',
        description: 'Sync master products catalog',
        parameters: [],
      },
    ],
  });
}

