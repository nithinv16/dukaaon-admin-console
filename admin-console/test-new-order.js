const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestOrder() {
  try {
    console.log('Creating a test order to trigger notification...');
    
    // First, get a random retailer (user) to place the order
    const { data: retailers, error: retailerError } = await supabase
      .from('profiles')
      .select('id, phone_number, business_details')
      .eq('role', 'retailer')
      .limit(1);
    
    if (retailerError || !retailers || retailers.length === 0) {
      console.error('Error fetching retailer:', retailerError);
      return;
    }
    
    // Get a random seller
    const { data: sellers, error: sellerError } = await supabase
      .from('seller_details')
      .select('user_id, business_name')
      .limit(1);
    
    if (sellerError || !sellers || sellers.length === 0) {
      console.error('Error fetching seller:', sellerError);
      return;
    }
    
    const retailer = retailers[0];
    const seller = sellers[0];
    
    // Generate a random order number
    const orderNumber = `ORD${Date.now()}`;
    const totalAmount = Math.floor(Math.random() * 5000) + 500; // Random amount between 500-5500
    
    // Create the test order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          order_number: orderNumber,
          user_id: retailer.id,
          seller_id: seller.user_id,
          total_amount: totalAmount,
          status: 'pending',
          delivery_address: '123 Test Street, Test City',
          items: [
            {
              product_id: 'test-product-1',
              product_name: 'Test Product',
              quantity: 2,
              price: totalAmount / 2
            }
          ],
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();
    
    if (orderError) {
      console.error('Error creating order:', orderError);
      return;
    }
    
    console.log('✅ Test order created successfully!');
    console.log('Order Details:');
    console.log(`- Order Number: ${orderNumber}`);
    console.log(`- Customer: ${retailer.business_details?.shopName || retailer.phone_number}`);
    console.log(`- Seller: ${seller.business_name}`);
    console.log(`- Amount: ₹${totalAmount}`);
    console.log(`- Order ID: ${newOrder.id}`);
    console.log('\n🔔 Check the admin dashboard for the notification!');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the test
createTestOrder();