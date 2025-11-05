import { NextResponse } from 'next/server';

/**
 * Temporary API route to verify environment variables are properly set
 * 
 * IMPORTANT: Delete this file after verifying your deployment!
 * 
 * Visit: https://your-app.amplifyapp.com/api/test-env
 */
export async function GET() {
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Show partial values for debugging (safe to expose partial public values)
  const supabaseUrlPreview = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) + '...'
    : 'NOT SET';

  const anonKeyPreview = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20) + '...'
    : 'NOT SET';

  const serviceKeyPreview = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...'
    : 'NOT SET';

  const allConfigured = hasSupabaseUrl && hasAnonKey && hasServiceKey;

  return NextResponse.json({
    status: allConfigured ? 'OK' : 'MISSING_VARIABLES',
    environment: process.env.NODE_ENV,
    variables: {
      NEXT_PUBLIC_SUPABASE_URL: {
        configured: hasSupabaseUrl,
        preview: supabaseUrlPreview,
      },
      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        configured: hasAnonKey,
        preview: anonKeyPreview,
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        configured: hasServiceKey,
        preview: serviceKeyPreview,
      },
    },
    message: allConfigured
      ? 'All required environment variables are configured!'
      : 'Some environment variables are missing. Check the details above.',
    warning: '⚠️  DELETE THIS API ROUTE AFTER TESTING! ⚠️',
  });
}

