// Configuration file to explicitly expose environment variables
export const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
};

// Validate that required environment variables are present
if (typeof window !== 'undefined') {
  if (!config.supabase.url) {
    console.error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }
  if (!config.supabase.anonKey) {
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
  }
}