const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testOrdersFetching() {
  console.log('Testing updated orders fetching...');
  
  try {
    // Test the enhanced getOrders function with joins
    console.log('\n1. Testing orders with master_orders and delivery_batches joins...');
    
    const { data: orders, error, count } = await adminSupabase
      .from('orders')
      .select(`
        *,
        retailer:profiles!orders_retailer_id_fkey(id, phone_number, business_details, role),
        seller:profiles!orders_seller_id_fkey(id, phone_number, business_details, role),
        master_order:master_orders!orders_master_order_id_fkey(
          id,
          order_number,
          user_id,
          total_amount,
          delivery_fee,
          grand_total,
          status,
          payment_status,
          payment_method,
          delivery_address,
          delivery_instructions,
          estimated_delivery_time,
          actual_delivery_time,
          created_at,
          updated_at,
          delivery_batches(
            id,
            batch_number,
            master_order_id,
            delivery_partner_id,
            status,
            pickup_locations,
            delivery_address,
            total_amount,
            delivery_fee,
            distance_km,
            estimated_pickup_time,
            estimated_delivery_time,
            actual_pickup_time,
            actual_delivery_time,
            assigned_at,
            accepted_at,
            notes,
            created_at,
            updated_at,
            delivery_otp,
            otp_verified,
            user_id
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching orders:', error.message);
      if (error.details) console.error('Details:', error.details);
      if (error.hint) console.error('Hint:', error.hint);
      return;
    }
    
    if (orders && orders.length > 0) {
      console.log('✅ Orders fetched successfully');
      console.log('Total orders:', count);
      console.log('Orders returned:', orders.length);
      
      // Check first order structure
      const firstOrder = orders[0];
      console.log('\nFirst order structure:');
      console.log('- Order ID:', firstOrder.id);
      console.log('- Order Number:', firstOrder.order_number);
      console.log('- Master Order ID:', firstOrder.master_order_id);
      console.log('- Has Master Order:', !!firstOrder.master_order);
      console.log('- Has Delivery Batches:', !!firstOrder.master_order?.delivery_batches);
      console.log('- Delivery Batches Count:', firstOrder.master_order?.delivery_batches?.length || 0);
      
      if (firstOrder.retailer) {
        console.log('- Retailer Phone:', firstOrder.retailer.phone_number);
        console.log('- Retailer Shop:', firstOrder.retailer.business_details?.shopName);
      }
      
      if (firstOrder.seller) {
        console.log('- Seller Phone:', firstOrder.seller.phone_number);
        console.log('- Seller Shop:', firstOrder.seller.business_details?.shopName);
      }
      
      if (firstOrder.master_order) {
        const masterOrder = firstOrder.master_order;
        console.log('\nMaster Order Details:');
        console.log('- Master Order Number:', masterOrder.order_number);
        console.log('- Total Amount:', masterOrder.total_amount);
        console.log('- Delivery Fee:', masterOrder.delivery_fee);
        console.log('- Grand Total:', masterOrder.grand_total);
        console.log('- Payment Status:', masterOrder.payment_status);
        console.log('- Payment Method:', masterOrder.payment_method);
        console.log('- Status:', masterOrder.status);
        
        if (masterOrder.delivery_batches && masterOrder.delivery_batches.length > 0) {
          const batch = masterOrder.delivery_batches[0];
          console.log('\nDelivery Batch Details:');
          console.log('- Batch ID:', batch.id);
          console.log('- Batch Number:', batch.batch_number);
          console.log('- Status:', batch.status);
          console.log('- Estimated Delivery:', batch.estimated_delivery_time);
          console.log('- Actual Delivery:', batch.actual_delivery_time);
          console.log('- Delivery OTP:', batch.delivery_otp);
          console.log('- OTP Verified:', batch.otp_verified);
          console.log('- Delivery Partner ID:', batch.delivery_partner_id);
        }
      }
      
      console.log('\n✅ Test completed successfully! The joins are working correctly.');
      console.log('📊 Summary:');
      console.log(`- Found ${count} total orders`);
      console.log(`- ${orders.filter(o => o.master_order).length} orders have master_order data`);
      console.log(`- ${orders.filter(o => o.master_order?.delivery_batches?.length > 0).length} orders have delivery_batches data`);
      
    } else {
      console.log('⚠️ No orders found or empty result');
    }
    
  } catch (error) {
    console.error('❌ Error testing orders fetching:', error.message);
    console.error('Stack:', error.stack);
  }
}

testOrdersFetching();