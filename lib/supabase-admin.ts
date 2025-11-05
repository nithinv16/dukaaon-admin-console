import { createClient } from '@supabase/supabase-js';

let adminSupabaseClient: any = null;

export function getAdminSupabaseClient() {
  if (adminSupabaseClient) {
    return adminSupabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const errorDetails = {
      url: !!supabaseUrl,
      serviceKey: !!supabaseServiceRoleKey,
      urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT SET',
      nodeEnv: process.env.NODE_ENV,
    };
    console.error('❌ Missing admin Supabase environment variables:', errorDetails);
    console.error('💡 Fix: Set SUPABASE_SERVICE_ROLE_KEY in AWS Amplify Console → Environment Variables');
    throw new Error('Admin Supabase client not configured - Check SUPABASE_SERVICE_ROLE_KEY in Amplify');
  }

  adminSupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('✅ Admin Supabase client initialized successfully');
  return adminSupabaseClient;
}

// Admin queries for server-side use
export const adminQueries = {
  async getAllUsers() {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    return data.users;
  },

  async getUsersByRole(role: string) {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', role);
    if (error) throw error;
    return data;
  },

  async updateUserStatus(userId: string, status: string) {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { status }
    });
    if (error) throw error;
    return data;
  },

  async getOrders(options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {}) {
    const supabase = getAdminSupabaseClient();
    const { page = 1, limit = 25, search, status } = options;
    
    // First, get the orders with count
    let ordersQuery = supabase
      .from('orders')
      .select('*', { count: 'exact' });

    // Apply status filter
    if (status && status !== 'all') {
      ordersQuery = ordersQuery.eq('status', status);
    }

    // Apply search filter for order ID only (we'll handle profile search separately)
    if (search) {
      ordersQuery = ordersQuery.ilike('id', `%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    ordersQuery = ordersQuery
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data: orders, error: ordersError, count } = await ordersQuery;
    if (ordersError) throw ordersError;

    // If we have orders, fetch the associated profiles and seller details
    let ordersWithDetails = orders || [];
    if (orders && orders.length > 0) {
      const userIds = orders.map((order: any) => order.user_id).filter(Boolean);
      const retailerIds = orders.map((order: any) => order.retailer_id).filter(Boolean);
      const sellerIds = orders.map((order: any) => order.seller_id).filter(Boolean);
      console.log('User IDs from orders:', userIds);
      console.log('Retailer IDs from orders:', retailerIds);
      console.log('Seller IDs from orders:', sellerIds);
      
      // Fetch user profiles (customer details)
      let userProfiles = [];
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, business_details, email, phone')
          .in('id', userIds);

        console.log('User profiles query result:', { profilesData, profilesError });

        if (profilesError) {
          console.warn('Error fetching user profiles:', profilesError);
        } else {
          userProfiles = profilesData || [];
        }
      }

      // Fetch retailer profiles
      let retailerProfiles = [];
      if (retailerIds.length > 0) {
        const { data: retailerData, error: retailerError } = await supabase
          .from('profiles')
          .select('id, business_details, email, phone')
          .in('id', retailerIds);

        console.log('Retailer profiles query result:', { retailerData, retailerError });

        if (retailerError) {
          console.warn('Error fetching retailer profiles:', retailerError);
        } else {
          retailerProfiles = retailerData || [];
        }
      }

      // Fetch seller details
      let sellerDetails = [];
      if (sellerIds.length > 0) {
        const { data: sellersData, error: sellersError } = await supabase
          .from('seller_details')
          .select('user_id, business_name, phone')
          .in('user_id', sellerIds);

        console.log('Seller details query result:', { sellersData, sellersError });

        if (sellersError) {
          console.warn('Error fetching seller details:', sellersError);
        } else {
          sellerDetails = sellersData || [];
        }
      }

      // Map profiles and seller details to orders
      ordersWithDetails = orders.map((order: any) => {
        const userProfile = userProfiles.find((p: any) => p.id === order.user_id);
        const retailerProfile = retailerProfiles.find((p: any) => p.id === order.retailer_id);
        const seller = sellerDetails.find((s: any) => s.user_id === order.seller_id);
        
        // Helper function to safely parse business_details
        const parseBusinessDetails = (businessDetails: any) => {
          if (!businessDetails) return {};
          if (typeof businessDetails === 'string') {
            try {
              return JSON.parse(businessDetails);
            } catch (e) {
              console.warn('Failed to parse business_details:', e);
              return {};
            }
          }
          return businessDetails;
        };
        
        const customerData = userProfile ? {
          id: userProfile.id,
          email: userProfile.email,
          phone: userProfile.phone || null,
          shopName: parseBusinessDetails(userProfile.business_details)?.shopName || null,
          address: parseBusinessDetails(userProfile.business_details)?.address || null
        } : null;

        const retailerData = retailerProfile ? {
          id: retailerProfile.id,
          email: retailerProfile.email,
          phone: retailerProfile.phone || null,
          shopName: parseBusinessDetails(retailerProfile.business_details)?.shopName || null,
          address: parseBusinessDetails(retailerProfile.business_details)?.address || null
        } : null;

        const sellerData = seller ? {
          user_id: seller.user_id,
          business_name: seller.business_name,
          phone: seller.phone || null
        } : null;

        console.log(`Order ${order.id} mapping:`, {
          retailer_id: order.retailer_id,
          seller_id: order.seller_id,
          retailerData,
          sellerData
        });

        return {
          ...order,
          customer: customerData,
          retailer: retailerData,
          seller: sellerData
        };
      });
      console.log('Orders with details mapped:', ordersWithDetails.length);
    }
    
    return {
      orders: ordersWithDetails,
      totalCount: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  async getAnalytics() {
    const supabase = getAdminSupabaseClient();
    
    // Get total orders
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    // Get total revenue
    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('status', 'completed');

    const totalRevenue = revenueData?.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0;

    // Get total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    return {
      totalOrders: totalOrders || 0,
      totalRevenue,
      totalUsers: totalUsers || 0
    };
  },

  async getDashboardStats() {
    const supabase = getAdminSupabaseClient();
    
    try {
      // Get recent orders
      const { data: recentOrders } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get order stats
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      const { count: pendingOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: completedOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      return {
        recentOrders: recentOrders || [],
        stats: {
          totalOrders: totalOrders || 0,
          pendingOrders: pendingOrders || 0,
          completedOrders: completedOrders || 0
        }
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }
};