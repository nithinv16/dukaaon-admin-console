// Test script to verify adminSupabase client is working
// Run this with: node test-admin-client.js

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testing Supabase Admin Client Configuration...\n');

console.log('Environment Variables:');
console.log('- SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('- SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '✅ Set' : '❌ Missing');
console.log('- SERVICE_ROLE_KEY Value:', supabaseServiceRoleKey?.substring(0, 20) + '...');

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.log('\n❌ Missing required environment variables');
  process.exit(1);
}

if (supabaseServiceRoleKey === 'your-actual-service-role-key-here') {
  console.log('\n⚠️  Service role key is still placeholder. Please update with actual key from Supabase dashboard.');
  console.log('📝 Go to: Supabase Dashboard > Project Settings > API > service_role key (secret)');
  process.exit(1);
}

// Create admin client
const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testAdminAccess() {
  console.log('\n🧪 Testing database access with service role...\n');

  try {
    // Test orders table access
    console.log('Testing orders table access...');
    const { data: orders, error: ordersError } = await adminSupabase
      .from('orders')
      .select('id, status, created_at')
      .limit(5);

    if (ordersError) {
      console.log('❌ Orders query failed:', ordersError.message);
    } else {
      console.log('✅ Orders query successful. Found', orders?.length || 0, 'orders');
    }

    // Test profiles table access
    console.log('Testing profiles table access...');
    const { data: profiles, error: profilesError } = await adminSupabase
      .from('profiles')
      .select('id, role, status')
      .limit(5);

    if (profilesError) {
      console.log('❌ Profiles query failed:', profilesError.message);
    } else {
      console.log('✅ Profiles query successful. Found', profiles?.length || 0, 'profiles');
    }

    // Test products table access
    console.log('Testing products table access...');
    const { data: products, error: productsError } = await adminSupabase
      .from('products')
      .select('id, name, status')
      .limit(5);

    if (productsError) {
      console.log('❌ Products query failed:', productsError.message);
    } else {
      console.log('✅ Products query successful. Found', products?.length || 0, 'products');
    }

  } catch (error) {
    console.log('❌ Test failed with error:', error.message);
  }
}

testAdminAccess().then(() => {
  console.log('\n🏁 Test completed');
});