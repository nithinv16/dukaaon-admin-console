import { createClient } from '@supabase/supabase-js';
import { format, subDays, subWeeks, subMonths, subYears, startOfWeek, startOfMonth, startOfYear } from 'date-fns';

let adminSupabaseClient: any = null;

export function getAdminSupabaseClient() {
  // Don't use cached client in production to avoid stale connections
  // Create fresh client each time

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('🔧 Creating Supabase admin client...');
  console.log('🔧 URL exists:', !!supabaseUrl);
  console.log('🔧 Service key exists:', !!supabaseServiceRoleKey);
  console.log('🔧 URL preview:', supabaseUrl?.substring(0, 30) + '...');
  console.log('🔧 Service key length:', supabaseServiceRoleKey?.length);

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

  try {
    const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('✅ Admin Supabase client created successfully');
    return client;
  } catch (error: any) {
    console.error('❌ Error creating Supabase client:', error);
    throw error;
  }
}

// Admin queries for server-side use
export const adminQueries = {
  async getAllUsers() {
    const supabase = getAdminSupabaseClient();

    // Step 1: Fetch all profiles from the profiles table
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) return [];

    // Step 2: Identify sellers based on role column
    // Sellers have role = 'seller' or role in ['wholesaler', 'manufacturer']
    const sellerProfiles = profiles.filter((p: any) =>
      p.role === 'seller' ||
      p.role === 'wholesaler' ||
      p.role === 'manufacturer'
    );

    console.log('getAllUsers - Profiles:', {
      total: profiles.length,
      sellers: sellerProfiles.length,
      sellerRoles: Array.from(new Set(sellerProfiles.map((p: any) => p.role)))
    });

    // Step 3: Fetch seller_details for those sellers using user_id (foreign key)
    let sellersDetailsMap: Map<string, any> = new Map();

    if (sellerProfiles.length > 0) {
      const sellerIds = sellerProfiles.map((p: any) => p.id).filter(Boolean);

      const { data: sellersData, error: sellersError } = await supabase
        .from('seller_details')
        .select('user_id, business_name, owner_name, seller_type')
        .in('user_id', sellerIds);

      if (sellersError) {
        console.error('Error fetching seller_details:', sellersError);
      } else if (sellersData && sellersData.length > 0) {
        // Create a map for quick lookup: user_id -> seller_details
        sellersDetailsMap = new Map(sellersData.map((s: any) => [s.user_id, s]));

        console.log('getAllUsers - seller_details:', {
          fetched: sellersData.length,
          sample: sellersData[0] ? {
            user_id: sellersData[0].user_id,
            business_name: sellersData[0].business_name,
            seller_type: sellersData[0].seller_type
          } : null
        });
      }
    }

    // Step 4 & 5: Process users and set business_name from seller_details.business_name
    const processedUsers = profiles.map((user: any) => {
      // Parse business_details if it's a string
      const businessDetails = typeof user.business_details === 'string'
        ? JSON.parse(user.business_details || '{}')
        : user.business_details || {};

      // Check if this user is a seller
      const isSeller = user.role === 'seller' ||
        user.role === 'wholesaler' ||
        user.role === 'manufacturer';

      if (isSeller) {
        // Step 5: Get seller_details for this seller
        const sellerDetail = sellersDetailsMap.get(user.id);

        if (sellerDetail && sellerDetail.business_name) {
          // Set business_name from seller_details.business_name (primary source)
          return {
            ...user,
            business_name: sellerDetail.business_name, // From seller_details table
            owner_name: sellerDetail.owner_name,
            seller_type: sellerDetail.seller_type, // wholesaler or manufacturer from seller_details
            business_details: {
              ...businessDetails,
              business_name: sellerDetail.business_name, // Also add to business_details for compatibility
              shopName: sellerDetail.business_name,
            },
            seller_details: sellerDetail // Keep for reference
          };
        } else {
          // Seller but no seller_details entry found
          console.warn(`Seller ${user.id} (role: ${user.role}) has no seller_details entry`);
          return {
            ...user,
            business_details: businessDetails,
            business_name: businessDetails.business_name || businessDetails.shopName || null
          };
        }
      } else {
        // Not a seller (e.g., retailer) - use business_details as before
        return {
          ...user,
          business_details: businessDetails
        };
      }
    });

    // Debug: Log sample seller data
    const sellers = processedUsers.filter((u: any) =>
      u.role === 'seller' || u.role === 'wholesaler' || u.role === 'manufacturer'
    );
    if (sellers.length > 0) {
      console.log('Sample processed seller:', {
        id: sellers[0].id,
        role: sellers[0].role,
        business_name: sellers[0].business_name,
        seller_type: sellers[0].seller_type,
        has_seller_detail: !!sellers[0].seller_details
      });
    }

    return processedUsers;
  },

  async getSellersWithDetails() {
    const supabase = getAdminSupabaseClient();

    // Step 1: Fetch all profiles from the profiles table
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) return [];

    // Step 2: Identify sellers based on role column
    // Sellers have role = 'seller' or role in ['wholesaler', 'manufacturer']
    const sellerProfiles = profiles.filter((p: any) =>
      p.role === 'seller' ||
      p.role === 'wholesaler' ||
      p.role === 'manufacturer'
    );

    console.log('getSellersWithDetails - Profiles:', {
      total: profiles.length,
      sellers: sellerProfiles.length,
      sellerRoles: Array.from(new Set(sellerProfiles.map((p: any) => p.role))),
      allRoles: Array.from(new Set(profiles.map((p: any) => p.role))),
      sampleProfile: profiles[0] ? { id: profiles[0].id, role: profiles[0].role } : null
    });

    if (sellerProfiles.length === 0) {
      console.warn('No sellers found with roles: seller, wholesaler, or manufacturer');
      console.log('Available roles in profiles:', Array.from(new Set(profiles.map((p: any) => p.role))));
      return [];
    }

    // Step 3: Fetch seller_details for those sellers using user_id (foreign key)
    let sellersDetailsMap: Map<string, any> = new Map();

    if (sellerProfiles.length > 0) {
      const sellerIds = sellerProfiles.map((p: any) => p.id).filter(Boolean);

      const { data: sellersData, error: sellersError } = await supabase
        .from('seller_details')
        .select('user_id, business_name, owner_name, seller_type')
        .in('user_id', sellerIds);

      if (sellersError) {
        console.error('Error fetching seller_details:', sellersError);
      } else if (sellersData && sellersData.length > 0) {
        // Create a map for quick lookup: user_id -> seller_details
        sellersDetailsMap = new Map(sellersData.map((s: any) => [s.user_id, s]));

        console.log('getSellersWithDetails - seller_details:', {
          fetched: sellersData.length,
          requested: sellerIds.length,
          sample: sellersData[0] ? {
            user_id: sellersData[0].user_id,
            business_name: sellersData[0].business_name,
            seller_type: sellersData[0].seller_type
          } : null
        });
      } else {
        console.warn('No seller_details found for seller IDs:', sellerIds);
      }
    }

    // Step 4 & 5: Process sellers and set business_name from seller_details.business_name
    const enrichedSellers = sellerProfiles.map((profile: any) => {
      // Parse business_details if it's a string
      const businessDetails = typeof profile.business_details === 'string'
        ? JSON.parse(profile.business_details || '{}')
        : profile.business_details || {};

      // Step 5: Get seller_details for this seller
      const sellerDetail = sellersDetailsMap.get(profile.id);

      if (sellerDetail && sellerDetail.business_name) {
        // Set business_name from seller_details.business_name (primary source)
        return {
          ...profile,
          business_name: sellerDetail.business_name, // From seller_details table
          owner_name: sellerDetail.owner_name,
          seller_type: sellerDetail.seller_type, // wholesaler or manufacturer from seller_details
          business_details: {
            ...businessDetails,
            business_name: sellerDetail.business_name, // Also add to business_details for compatibility
            shopName: sellerDetail.business_name,
          },
          // display_name should be seller_details.business_name (direct)
          display_name: sellerDetail.business_name,
          // business_info object for compatibility
          business_info: {
            business_name: sellerDetail.business_name,
            owner_name: sellerDetail.owner_name || businessDetails.ownerName || businessDetails.owner_name || null,
          },
          seller_details: sellerDetail // Keep for reference
        };
      } else {
        // Seller but no seller_details entry found
        console.warn(`Seller ${profile.id} (role: ${profile.role}) has no seller_details entry`);
        return {
          ...profile,
          business_details: businessDetails,
          business_name: businessDetails.business_name || businessDetails.shopName || null,
          display_name: businessDetails.business_name ||
            businessDetails.shopName ||
            businessDetails.shop_name ||
            businessDetails.name ||
            profile.phone_number ||
            'Unknown Seller',
        };
      }
    });

    // Debug: Log sample seller data
    if (enrichedSellers.length > 0) {
      console.log('getSellersWithDetails - Sample processed seller:', {
        id: enrichedSellers[0].id,
        role: enrichedSellers[0].role,
        business_name: enrichedSellers[0].business_name,
        seller_type: enrichedSellers[0].seller_type,
        display_name: enrichedSellers[0].display_name,
        has_seller_detail: !!enrichedSellers[0].seller_details,
        phone_number: enrichedSellers[0].phone_number
      });
    } else {
      console.warn('getSellersWithDetails - No enriched sellers returned');
    }

    // Ensure all sellers have valid IDs
    const validSellers = enrichedSellers.filter((s: any) => s && s.id);
    if (validSellers.length !== enrichedSellers.length) {
      console.warn(`Filtered out ${enrichedSellers.length - validSellers.length} sellers without valid IDs`);
    }

    console.log('getSellersWithDetails - Returning sellers:', {
      total: validSellers.length,
      with_business_name: validSellers.filter((s: any) => s.business_name).length,
      with_display_name: validSellers.filter((s: any) => s.display_name).length
    });

    return validSellers;
  },

  // Fallback method: fetch separately and join manually
  async getSellersWithDetailsFallback() {
    const supabase = getAdminSupabaseClient();

    // Get all sellers (wholesalers and manufacturers) from profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['wholesaler', 'manufacturer'])
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) return [];

    // Get seller_ids
    const sellerIds = profiles.map((p: any) => p.id).filter(Boolean);

    // Fetch seller_details for all sellers using the foreign key (user_id -> profiles.id)
    let sellersDetailsMap: Record<string, any> = {};
    if (sellerIds.length > 0) {
      const { data: sellersData, error: sellersError } = await supabase
        .from('seller_details')
        .select('user_id, business_name, owner_name, seller_type')
        .in('user_id', sellerIds);

      if (!sellersError && sellersData) {
        sellersData.forEach((seller: any) => {
          sellersDetailsMap[seller.user_id] = seller;
        });
      }
    }

    // Enrich profiles with seller_details data
    const enrichedSellers = profiles.map((profile: any) => {
      // Get seller_details via foreign key (user_id -> profiles.id)
      const sellerDetail = sellersDetailsMap[profile.id];

      // Parse business_details if it's a string
      const businessDetails = typeof profile.business_details === 'string'
        ? JSON.parse(profile.business_details || '{}')
        : profile.business_details || {};

      // Get business_name from seller_details.business_name (PRIMARY SOURCE via FK)
      const businessName = sellerDetail?.business_name || null;
      const ownerName = sellerDetail?.owner_name || null;

      return {
        ...profile,
        // Set business_name from seller_details.business_name (primary source via FK)
        business_name: businessName,
        owner_name: ownerName,
        seller_type: sellerDetail?.seller_type || null,
        // display_name should prioritize seller_details.business_name (from FK)
        display_name: businessName ||
          businessDetails.business_name ||
          businessDetails.shopName ||
          businessDetails.shop_name ||
          businessDetails.name ||
          profile.phone_number ||
          'Unknown Seller',
        business_info: {
          business_name: businessName || businessDetails.business_name || null,
          owner_name: ownerName || businessDetails.ownerName || businessDetails.owner_name || null,
        }
      };
    });

    return enrichedSellers;
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

    // Use Supabase foreign key joins to get retailer and seller info, plus master_orders
    // This matches the test file approach
    let ordersQuery = supabase
      .from('orders')
      .select(`
        *,
        retailer:profiles!orders_retailer_id_fkey(
          id,
          phone_number,
          business_details,
          role
        ),
        seller:profiles!orders_seller_id_fkey(
          id,
          phone_number,
          business_details,
          role
        ),
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
            updated_at
          )
        )
      `, { count: 'exact' });

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

    // Process orders to format retailer and seller data
    // Also fetch retailer profiles from master_orders.user_id if needed
    let ordersWithDetails = orders || [];
    if (orders && orders.length > 0) {
      // Collect all user_ids from master_orders that we need to fetch
      const masterOrderUserIds = orders
        .map((order: any) => order.master_order?.user_id)
        .filter(Boolean)
        .filter((id: string, index: number, self: string[]) => self.indexOf(id) === index); // unique

      // Fetch profiles for master_order user_ids
      let masterOrderProfiles: any[] = [];
      if (masterOrderUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, phone_number, business_details, role')
          .in('id', masterOrderUserIds);

        if (!profilesError && profilesData) {
          masterOrderProfiles = profilesData;
        }
      }

      // Fetch seller_details FIRST for all seller_ids (primary source for seller business_name)
      const sellerIds = orders
        .map((order: any) => order.seller_id)
        .filter(Boolean)
        .filter((id: string, index: number, self: string[]) => self.indexOf(id) === index); // unique IDs

      let sellersDetailsMap: Record<string, any> = {};
      if (sellerIds.length > 0) {
        const { data: sellersData, error: sellersError } = await supabase
          .from('seller_details')
          .select('user_id, business_name, owner_name, seller_type')
          .in('user_id', sellerIds);

        if (!sellersError && sellersData) {
          // Create a map for quick lookup
          sellersData.forEach((seller: any) => {
            sellersDetailsMap[seller.user_id] = seller;
          });
        }
      }

      ordersWithDetails = orders.map((order: any) => {
        // Format retailer data - prefer from direct retailer_id, fallback to master_order user_id
        let retailerData = null;

        // First try direct retailer_id join
        if (order.retailer) {
          const businessDetails = order.retailer.business_details || {};
          retailerData = {
            id: order.retailer.id,
            phone: order.retailer.phone_number || null,
            phone_number: order.retailer.phone_number || null,
            shopName: businessDetails.shopName || null,
            business_name: businessDetails.business_name || null,
            owner_name: businessDetails.ownerName || businessDetails.owner_name || null,
            address: businessDetails.address || null,
            role: order.retailer.role || null,
            business_details: businessDetails
          };
        }
        // Fallback to master_order's user_id (retailer profile from profiles table)
        else if (order.master_order?.user_id) {
          const masterOrderProfile = masterOrderProfiles.find(
            (p: any) => p.id === order.master_order.user_id
          );
          if (masterOrderProfile) {
            const businessDetails = masterOrderProfile.business_details || {};
            retailerData = {
              id: masterOrderProfile.id,
              phone: masterOrderProfile.phone_number || null,
              phone_number: masterOrderProfile.phone_number || null,
              shopName: businessDetails.shopName || null,
              business_name: businessDetails.business_name || null,
              owner_name: businessDetails.ownerName || businessDetails.owner_name || null,
              address: businessDetails.address || null,
              role: masterOrderProfile.role || null,
              business_details: businessDetails
            };
          }
        }

        // Format seller data from seller join
        // PRIORITY: seller_details.business_name > business_details fields
        let sellerData = null;
        if (order.seller) {
          // First, check if we have seller_details for this seller (PRIMARY SOURCE)
          const sellerDetail = sellersDetailsMap[order.seller_id || order.seller.id];

          // Use seller_details.business_name as PRIMARY source
          let businessName = null;
          let ownerName = null;

          if (sellerDetail && sellerDetail.business_name) {
            businessName = sellerDetail.business_name;
            ownerName = sellerDetail.owner_name || null;
          } else {
            // Fallback to business_details if seller_details doesn't have business_name
            const businessDetails = order.seller.business_details || {};
            businessName = businessDetails.business_name ||
              businessDetails.shopName ||
              businessDetails.shop_name ||
              businessDetails.name ||
              null;
            ownerName = businessDetails.ownerName || businessDetails.owner_name || null;
          }

          sellerData = {
            user_id: order.seller.id,
            business_name: businessName,
            owner_name: ownerName,
            phone: order.seller.phone_number || null,
            seller_type: sellerDetail?.seller_type || null
          };
        }

        return {
          ...order,
          retailer: retailerData,
          seller: sellerData
        };
      });

      console.log('Orders with details processed:', ordersWithDetails.length);
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

    // Get pending orders count
    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get delivered orders count (changed from completed)
    const { count: deliveredOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'delivered');

    // Get cancelled orders count
    const { count: cancelledOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'cancelled');

    // Get total revenue from delivered orders (changed from completed)
    const { data: revenueData, error: revenueError } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('status', 'delivered');

    if (revenueError) {
      console.error('Error fetching revenue:', revenueError);
    }

    const totalRevenue = revenueData?.reduce((sum: number, order: any) => {
      const amount = Number(order.total_amount) || 0;
      return sum + amount;
    }, 0) || 0;

    // Get total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    return {
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      deliveredOrders: deliveredOrders || 0,
      cancelledOrders: cancelledOrders || 0,
      totalRevenue,
      totalUsers: totalUsers || 0
    };
  },

  async getDashboardStats() {
    const supabase = getAdminSupabaseClient();

    try {
      // Get recent orders with retailer info
      const { data: recentOrders } = await supabase
        .from('orders')
        .select(`
          *,
          retailer:profiles!orders_retailer_id_fkey(
            id,
            phone_number,
            business_details
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
        .eq('status', 'delivered');

      // Calculate monthly revenue (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: monthlyOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'delivered')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const monthlyRevenue = monthlyOrders?.reduce((sum: number, order: any) => {
        return sum + (Number(order.total_amount) || 0);
      }, 0) || 0;

      return {
        recentOrders: recentOrders || [],
        stats: {
          totalOrders: totalOrders || 0,
          pendingOrders: pendingOrders || 0,
          completedOrders: completedOrders || 0,
          monthlyRevenue: monthlyRevenue
        }
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  async getChartData(timeFilter: string) {
    const supabase = getAdminSupabaseClient();

    try {
      let startDate: Date;
      let dateFormat: string;
      let groupBy: 'day' | 'week' | 'month' | 'year';

      const now = new Date();

      switch (timeFilter) {
        case '7days':
          startDate = subDays(now, 6);
          dateFormat = 'MMM dd';
          groupBy = 'day';
          break;
        case '4weeks':
          startDate = subWeeks(now, 4);
          dateFormat = 'Week';
          groupBy = 'week';
          break;
        case '12months':
          startDate = subMonths(now, 12);
          dateFormat = 'MMM yyyy';
          groupBy = 'month';
          break;
        case '5years':
          startDate = subYears(now, 5);
          dateFormat = 'yyyy';
          groupBy = 'year';
          break;
        default:
          startDate = subDays(now, 6);
          dateFormat = 'MMM dd';
          groupBy = 'day';
      }

      // Fetch all orders in the date range
      const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at, total_amount, status')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group orders by date period
      const chartDataMap = new Map<string, { orders: number; revenue: number }>();

      orders?.forEach((order: any) => {
        const orderDate = new Date(order.created_at);
        let key: string;

        switch (groupBy) {
          case 'day':
            key = format(orderDate, 'yyyy-MM-dd');
            break;
          case 'week':
            const weekStart = startOfWeek(orderDate);
            key = `Week ${Math.ceil((orderDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))}`;
            break;
          case 'month':
            key = format(startOfMonth(orderDate), 'yyyy-MM');
            break;
          case 'year':
            key = format(startOfYear(orderDate), 'yyyy');
            break;
          default:
            key = format(orderDate, 'yyyy-MM-dd');
        }

        if (!chartDataMap.has(key)) {
          chartDataMap.set(key, { orders: 0, revenue: 0 });
        }

        const data = chartDataMap.get(key)!;
        data.orders += 1;
        data.revenue += Number(order.total_amount) || 0;
      });

      // Convert to array and format dates
      const chartData = Array.from(chartDataMap.entries()).map(([key, data]) => {
        let displayDate: string;

        switch (groupBy) {
          case 'day':
            displayDate = format(new Date(key), dateFormat);
            break;
          case 'week':
            displayDate = key;
            break;
          case 'month':
            displayDate = format(new Date(key + '-01'), dateFormat);
            break;
          case 'year':
            displayDate = key;
            break;
          default:
            displayDate = key;
        }

        return {
          date: displayDate,
          orders: data.orders,
          revenue: data.revenue
        };
      });

      // Sort by date
      chartData.sort((a, b) => {
        if (groupBy === 'week') {
          const aWeek = parseInt(a.date.replace('Week ', ''));
          const bWeek = parseInt(b.date.replace('Week ', ''));
          return aWeek - bWeek;
        }
        return a.date.localeCompare(b.date);
      });

      return chartData;
    } catch (error) {
      console.error('Error fetching chart data:', error);
      throw error;
    }
  },

  // Product Management
  async getProducts(options: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
    seller_id?: string;
  } = {}) {
    const supabase = getAdminSupabaseClient();
    const { page = 1, limit = 25, search, category, status, seller_id } = options;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (status && status !== 'all') {
      if (status === 'active') {
        // Active products are those with status 'available' and not 'out_of_stock'
        query = query.eq('status', 'available');
      } else if (status === 'inactive') {
        query = query.eq('status', 'inactive');
      } else {
        query = query.eq('status', status);
      }
    }
    if (seller_id && seller_id !== 'all') {
      query = query.eq('seller_id', seller_id);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    // Map product fields and fetch seller names
    if (data && data.length > 0) {
      // Always map stock_available for all products (image_url is already in the database)
      data.forEach((product: any) => {
        product.stock_available = product.stock_available ?? 0; // Use stock_available directly
        // image_url is already in the database, no mapping needed
        product.seller_name = 'Unknown'; // Default value
      });

      // Fetch seller names for products using seller_details.business_name
      const sellerIds = Array.from(new Set(data.map((p: any) => p.seller_id).filter(Boolean)));
      if (sellerIds.length > 0) {
        // Fetch seller_details for these sellers
        const { data: sellerDetails } = await supabase
          .from('seller_details')
          .select('user_id, business_name, owner_name')
          .in('user_id', sellerIds);

        // Create a map of user_id -> business_name
        const sellerMap = new Map(sellerDetails?.map((sd: any) => {
          return [sd.user_id, sd.business_name || sd.owner_name || 'Unknown'];
        }) || []);

        // Also fetch profiles as fallback
        const { data: sellers } = await supabase
          .from('profiles')
          .select('id, phone_number')
          .in('id', sellerIds);

        const profileMap = new Map(sellers?.map((s: any) => {
          return [s.id, s.phone_number || 'Unknown'];
        }) || []);

        // Update seller names - prioritize seller_details.business_name
        data.forEach((product: any) => {
          if (product.seller_id) {
            product.seller_name = sellerMap.get(product.seller_id) || profileMap.get(product.seller_id) || 'Unknown';
          }
        });
      }
    }

    return {
      products: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  // Helper function to generate slug from name
  generateSlug(name: string, existingSlugs: string[] = []): string {
    // Create base slug: lowercase, replace spaces and special chars with hyphens
    let slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')      // Replace spaces with hyphens
      .replace(/-+/g, '-')       // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens

    // If slug already exists, append number
    if (existingSlugs.includes(slug)) {
      let counter = 1;
      let newSlug = `${slug}-${counter}`;
      while (existingSlugs.includes(newSlug)) {
        counter++;
        newSlug = `${slug}-${counter}`;
      }
      return newSlug;
    }

    return slug;
  },

  // Helper function to get category and subcategory IDs from names
  // Enhanced to create missing categories/subcategories automatically
  async getCategoryAndSubcategoryIds(
    categoryName: string,
    subcategoryName?: string,
    createIfMissing: boolean = true
  ): Promise<{ category_id: string | null; subcategory_id: string | null }> {
    const supabase = getAdminSupabaseClient();

    let categoryId: string | null = null;
    let subcategoryId: string | null = null;

    // Get category ID by name (case-insensitive)
    if (categoryName && categoryName.trim()) {
      const normalizedCategoryName = categoryName.trim();

      // First try to find existing category
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', normalizedCategoryName)
        .limit(1)
        .maybeSingle();

      if (!categoryError && categoryData) {
        categoryId = categoryData.id;
        console.log(`Found existing category "${categoryName}" with ID:`, categoryId);
      } else if (categoryError) {
        console.warn(`Error finding category "${categoryName}":`, categoryError.message);
      } else if (createIfMissing) {
        // Category not found, create it
        console.log(`Category "${categoryName}" not found, creating new category...`);

        try {
          // Get existing slugs to avoid conflicts
          const { data: existingCategories } = await supabase
            .from('categories')
            .select('slug');

          const existingSlugs = (existingCategories || []).map((cat: any) => cat.slug);
          const newSlug = this.generateSlug(normalizedCategoryName, existingSlugs);

          // Insert new category
          const { data: newCategory, error: insertError } = await supabase
            .from('categories')
            .insert({
              name: normalizedCategoryName,
              slug: newSlug,
              description: `Auto-created category for ${normalizedCategoryName}`,
              is_active: true
            })
            .select('id')
            .single();

          if (insertError) {
            // Check if error is due to duplicate (race condition)
            if (insertError.code === '23505') {
              console.warn(`Race condition detected for category "${categoryName}", fetching existing...`);
              // Another process created it, fetch the existing one
              const { data: existingCategory } = await supabase
                .from('categories')
                .select('id')
                .ilike('name', normalizedCategoryName)
                .limit(1)
                .maybeSingle();

              if (existingCategory) {
                categoryId = existingCategory.id;
                console.log(`Using existing category "${categoryName}" with ID:`, categoryId);
              }
            } else {
              console.error(`Error creating category "${categoryName}":`, insertError);
            }
          } else if (newCategory) {
            categoryId = newCategory.id;
            console.log(`Created new category "${categoryName}" with ID:`, categoryId);
          }
        } catch (error: any) {
          console.error(`Exception creating category "${categoryName}":`, error);
        }
      } else {
        console.warn(`Category "${categoryName}" not found in categories table`);
      }
    }

    // Get subcategory ID by name and category_id (case-insensitive)
    if (subcategoryName && subcategoryName.trim() && categoryId) {
      const normalizedSubcategoryName = subcategoryName.trim();

      // First try to find existing subcategory
      const { data: subcategoryData, error: subcategoryError } = await supabase
        .from('subcategories')
        .select('id')
        .eq('category_id', categoryId)
        .ilike('name', normalizedSubcategoryName)
        .limit(1)
        .maybeSingle();

      if (!subcategoryError && subcategoryData) {
        subcategoryId = subcategoryData.id;
        console.log(`Found existing subcategory "${subcategoryName}" with ID:`, subcategoryId);
      } else if (subcategoryError) {
        console.warn(`Error finding subcategory "${subcategoryName}" for category "${categoryName}":`, subcategoryError.message);
      } else if (createIfMissing) {
        // Subcategory not found, create it
        console.log(`Subcategory "${subcategoryName}" not found for category "${categoryName}", creating new subcategory...`);

        try {
          // Get existing slugs for this category to avoid conflicts
          const { data: existingSubcategories } = await supabase
            .from('subcategories')
            .select('slug')
            .eq('category_id', categoryId);

          const existingSlugs = (existingSubcategories || []).map((sub: any) => sub.slug);
          const newSlug = this.generateSlug(normalizedSubcategoryName, existingSlugs);

          // Insert new subcategory
          const { data: newSubcategory, error: insertError } = await supabase
            .from('subcategories')
            .insert({
              category_id: categoryId,
              name: normalizedSubcategoryName,
              slug: newSlug,
              description: `Auto-created subcategory for ${normalizedSubcategoryName}`,
              is_active: true
            })
            .select('id')
            .single();

          if (insertError) {
            // Check if error is due to duplicate (race condition)
            if (insertError.code === '23505') {
              console.warn(`Race condition detected for subcategory "${subcategoryName}", fetching existing...`);
              // Another process created it, fetch the existing one
              const { data: existingSubcategory } = await supabase
                .from('subcategories')
                .select('id')
                .eq('category_id', categoryId)
                .ilike('name', normalizedSubcategoryName)
                .limit(1)
                .maybeSingle();

              if (existingSubcategory) {
                subcategoryId = existingSubcategory.id;
                console.log(`Using existing subcategory "${subcategoryName}" with ID:`, subcategoryId);
              }
            } else {
              console.error(`Error creating subcategory "${subcategoryName}":`, insertError);
            }
          } else if (newSubcategory) {
            subcategoryId = newSubcategory.id;
            console.log(`Created new subcategory "${subcategoryName}" with ID:`, subcategoryId);
          }
        } catch (error: any) {
          console.error(`Exception creating subcategory "${subcategoryName}":`, error);
        }
      } else {
        console.warn(`Subcategory "${subcategoryName}" not found in subcategories table for category "${categoryName}"`);
      }
    }
    return { category_id: categoryId, subcategory_id: subcategoryId };
  },

  /**
   * Add a new product to the database
   * 
   * This function automatically creates missing categories and subcategories:
   * - If the category doesn't exist, it will be created with a generated slug
   * - If the subcategory doesn't exist (and category is valid), it will be created
   * - Both category_id and subcategory_id are automatically populated
   * - Text fields (category, subcategory) are kept for backward compatibility
   * 
   * @param productData Product information including category/subcategory names
   * @returns The created product data
   */
  async addProduct(productData: {
    name: string;
    description: string;
    price: number;
    category: string;
    subcategory?: string;
    brand?: string;
    seller_id: string;
    stock_available?: number;
    unit?: string;
    min_order_quantity?: number;
    images?: string[];
    status?: string;
  }) {
    const supabase = getAdminSupabaseClient();

    // Get category and subcategory IDs from names (auto-creates if missing)
    const { category_id, subcategory_id } = await this.getCategoryAndSubcategoryIds(
      productData.category,
      productData.subcategory
    );

    // Prepare insert data with both IDs and text fields (for backward compatibility)
    const insertData: any = {
      name: productData.name,
      description: productData.description,
      price: productData.price,
      category: productData.category, // Keep text field for backward compatibility
      subcategory: productData.subcategory || null, // Keep text field for backward compatibility
      brand: productData.brand,
      seller_id: productData.seller_id,
      stock_available: productData.stock_available || 0,
      unit: productData.unit || 'piece',
      min_quantity: productData.min_order_quantity || 1,
      image_url: productData.images?.[0] || null,
      status: productData.status || 'available'
    };

    // Add category_id and subcategory_id if they exist (columns may or may not exist in table)
    if (category_id !== null) {
      insertData.category_id = category_id;
    }
    if (subcategory_id !== null) {
      insertData.subcategory_id = subcategory_id;
    }

    const { data, error } = await supabase
      .from('products')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // If error is due to missing category_id/subcategory_id columns, try without them
      if (error.message?.includes('category_id') || error.message?.includes('subcategory_id')) {
        console.warn('category_id/subcategory_id columns not found, using text fields only');
        delete insertData.category_id;
        delete insertData.subcategory_id;

        const { data: retryData, error: retryError } = await supabase
          .from('products')
          .insert(insertData)
          .select()
          .single();

        if (retryError) throw retryError;
        return retryData;
      }
      throw error;
    }

    return data;
  },

  async updateProduct(productId: string, updates: {
    name?: string;
    description?: string;
    price?: number;
    category?: string;
    subcategory?: string;
    brand?: string;
    stock_available?: number;
    unit?: string;
    min_order_quantity?: number;
    images?: string[];
    status?: string;
  }) {
    const supabase = getAdminSupabaseClient();

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.price !== undefined) updateData.price = updates.price;

    // Handle category and subcategory updates - convert names to IDs
    if (updates.category !== undefined) {
      updateData.category = updates.category; // Keep text field for backward compatibility

      // Get category ID from name
      const { category_id } = await this.getCategoryAndSubcategoryIds(updates.category, updates.subcategory);
      if (category_id !== null) {
        updateData.category_id = category_id;
      }
    }

    if (updates.subcategory !== undefined) {
      updateData.subcategory = updates.subcategory; // Keep text field for backward compatibility

      // Get subcategory ID from name (need category name for lookup)
      const categoryName = updates.category || updateData.category;
      if (categoryName) {
        const { subcategory_id } = await this.getCategoryAndSubcategoryIds(categoryName, updates.subcategory);
        if (subcategory_id !== null) {
          updateData.subcategory_id = subcategory_id;
        }
      }
    }

    if (updates.brand !== undefined) updateData.brand = updates.brand;
    if (updates.stock_available !== undefined) updateData.stock_available = updates.stock_available;
    if (updates.unit !== undefined) updateData.unit = updates.unit;
    if (updates.min_order_quantity !== undefined) updateData.min_quantity = updates.min_order_quantity;
    if (updates.images !== undefined) {
      // If images is an array, take the first one; otherwise use the value directly
      updateData.image_url = Array.isArray(updates.images) ? updates.images[0] || null : updates.images;
    }
    if (updates.status !== undefined) updateData.status = updates.status;

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      // If error is due to missing category_id/subcategory_id columns, try without them
      if (error.message?.includes('category_id') || error.message?.includes('subcategory_id')) {
        console.warn('category_id/subcategory_id columns not found, using text fields only');
        delete updateData.category_id;
        delete updateData.subcategory_id;

        const { data: retryData, error: retryError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', productId)
          .select()
          .single();

        if (retryError) throw retryError;
        return retryData;
      }
      throw error;
    }

    return data;
  },

  async deleteProduct(productId: string) {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProducts(productIds: string[]) {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase
      .from('products')
      .delete()
      .in('id', productIds)
      .select();

    if (error) throw error;
    return data;
  },

  // Master Products Management
  async getMasterProducts(options: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
  } = {}) {
    const supabase = getAdminSupabaseClient();
    const { page = 1, limit = 12, search, category, status } = options;

    let query = supabase
      .from('master_products')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      products: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  async addMasterProductToSeller(payload: {
    master_product_id: string;
    seller_id: string;
    price: number;
    stock_available: number;
    min_order_quantity: number;
    unit: string;
    description?: string;
  }) {
    const supabase = getAdminSupabaseClient();

    // First, get the master product
    const { data: masterProduct, error: masterError } = await supabase
      .from('master_products')
      .select('*')
      .eq('id', payload.master_product_id)
      .single();

    if (masterError) throw masterError;
    if (!masterProduct) throw new Error('Master product not found');

    // Create product from master product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        seller_id: payload.seller_id,
        name: masterProduct.name,
        description: payload.description || masterProduct.description,
        price: payload.price,
        category: masterProduct.category,
        subcategory: masterProduct.subcategory,
        brand: masterProduct.brand,
        stock_available: payload.stock_available,
        unit: payload.unit,
        min_quantity: payload.min_order_quantity,
        image_url: masterProduct.images?.[0] || null,
        status: 'available',
        sku: masterProduct.sku,
        barcode: masterProduct.barcode
      })
      .select()
      .single();

    if (productError) throw productError;
    return product;
  },

  // User Management Extensions
  async updateUser(userId: string, updates: {
    phone_number?: string;
    status?: string;
    kyc_status?: string;
    business_details?: any;
  }) {
    const supabase = getAdminSupabaseClient();

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.phone_number !== undefined) updateData.phone_number = updates.phone_number;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.kyc_status !== undefined) updateData.kyc_status = updates.kyc_status;
    if (updates.business_details !== undefined) {
      updateData.business_details = typeof updates.business_details === 'string'
        ? updates.business_details
        : JSON.stringify(updates.business_details);
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteUser(userId: string) {
    const supabase = getAdminSupabaseClient();

    // Note: This will cascade delete related records if foreign keys are set up
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    return { success: true };
  },

  async updateOrderStatus(orderId: string, status: string, notes?: string) {
    const supabase = getAdminSupabaseClient();

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (notes) {
      updateData.notes = notes;
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // App Configuration Management
  async getConfigs(scope?: string) {
    const supabase = getAdminSupabaseClient();

    let query = supabase
      .from('app_configs')
      .select('*')
      .order('key');

    if (scope) {
      query = query.eq('scope', scope);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getConfig(key: string) {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase
      .from('app_configs')
      .select('*')
      .eq('key', key)
      .single();

    if (error) throw error;
    return data;
  },

  async saveConfig(key: string, value: any, description?: string, scope: string = 'global', scopeValue?: string) {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase
      .from('app_configs')
      .upsert({
        key,
        value: typeof value === 'string' ? JSON.parse(value) : value,
        description,
        scope,
        scope_value: scopeValue,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteConfig(key: string) {
    const supabase = getAdminSupabaseClient();

    const { error } = await supabase
      .from('app_configs')
      .delete()
      .eq('key', key);

    if (error) throw error;
    return { success: true };
  },

  // Feature Flags Management
  async getFeatureFlags() {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getFeatureFlag(id: string) {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createFeatureFlag(flagData: {
    name: string;
    description?: string;
    enabled?: boolean;
    rollout_type?: string;
    config?: any;
  }) {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase
      .from('feature_flags')
      .insert({
        name: flagData.name,
        description: flagData.description,
        enabled: flagData.enabled || false,
        rollout_type: flagData.rollout_type || 'global',
        config: flagData.config || {}
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateFeatureFlag(id: string, updates: {
    enabled?: boolean;
    rollout_type?: string;
    config?: any;
    description?: string;
  }) {
    const supabase = getAdminSupabaseClient();

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.rollout_type !== undefined) updateData.rollout_type = updates.rollout_type;
    if (updates.config !== undefined) updateData.config = updates.config;
    if (updates.description !== undefined) updateData.description = updates.description;

    const { data, error } = await supabase
      .from('feature_flags')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteFeatureFlag(id: string) {
    const supabase = getAdminSupabaseClient();

    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  },

  // Dynamic Content Management
  async getContentSlots() {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase
      .from('dynamic_content_slots')
      .select('*')
      .order('code');

    if (error) throw error;
    return data || [];
  },

  async getContentItems(slotId?: string, options: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}) {
    const supabase = getAdminSupabaseClient();
    const { page = 1, limit = 25, search } = options;

    let query = supabase
      .from('dynamic_content_items')
      .select('*, dynamic_content_slots(code, name)', { count: 'exact' });

    if (slotId) {
      query = query.eq('slot_id', slotId);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,subtitle.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      items: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  async upsertContentItem(itemData: {
    id?: string;
    slot_id: string;
    type: string;
    title?: string;
    subtitle?: string;
    image_url?: string;
    deeplink?: string;
    payload?: any;
    targeting?: any;
    start_at?: string;
    end_at?: string;
    priority?: number;
    is_active?: boolean;
  }) {
    const supabase = getAdminSupabaseClient();

    const insertData: any = {
      slot_id: itemData.slot_id,
      type: itemData.type,
      title: itemData.title,
      subtitle: itemData.subtitle,
      image_url: itemData.image_url,
      deeplink: itemData.deeplink,
      payload: itemData.payload || {},
      targeting: itemData.targeting || {},
      start_at: itemData.start_at,
      end_at: itemData.end_at,
      priority: itemData.priority || 0,
      is_active: itemData.is_active !== undefined ? itemData.is_active : true,
      updated_at: new Date().toISOString()
    };

    if (itemData.id) {
      // Update existing
      const { data, error } = await supabase
        .from('dynamic_content_items')
        .update(insertData)
        .eq('id', itemData.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('dynamic_content_items')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async deleteContentItem(itemId: string) {
    const supabase = getAdminSupabaseClient();

    const { error } = await supabase
      .from('dynamic_content_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
    return { success: true };
  },

  // Admin Messages Management
  async getAdminMessages(options: {
    page?: number;
    limit?: number;
    target_role?: string;
    severity?: string;
    type?: string;
  } = {}) {
    const supabase = getAdminSupabaseClient();
    const { page = 1, limit = 25, target_role, severity, type } = options;

    // First, get the count without the join to avoid FK issues
    let countQuery = supabase
      .from('admin_messages')
      .select('*', { count: 'exact', head: true });

    if (target_role) {
      countQuery = countQuery.eq('target_role', target_role);
    }
    if (severity) {
      countQuery = countQuery.eq('severity', severity);
    }
    if (type) {
      countQuery = countQuery.eq('type', type);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    // Now fetch the messages without the join
    let query = supabase
      .from('admin_messages')
      .select('*');

    if (target_role) {
      query = query.eq('target_role', target_role);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (type) {
      query = query.eq('type', type);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data: messages, error } = await query;
    if (error) throw error;

    // Batch fetch admin credentials for all messages
    const adminIds = Array.from(new Set((messages || [])
      .map((m: any) => m.created_by)
      .filter(Boolean)));

    let adminMap: Record<string, any> = {};
    if (adminIds.length > 0) {
      const { data: adminData } = await supabase
        .from('admin_credentials')
        .select('id, name, email')
        .in('id', adminIds);

      if (adminData) {
        adminMap = adminData.reduce((acc: any, admin: any) => {
          acc[admin.id] = { name: admin.name, email: admin.email };
          return acc;
        }, {});
      }
    }

    // Map admin credentials to messages
    const messagesWithAdmin = (messages || []).map((message: any) => ({
      ...message,
      admin_credentials: message.created_by ? (adminMap[message.created_by] || null) : null
    }));

    return {
      messages: messagesWithAdmin,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  async createAdminMessage(messageData: {
    target_user_id?: string;
    target_role?: string;
    target_region?: string;
    severity: string;
    type: string;
    title: string;
    message: string;
    metadata?: any;
    requires_ack?: boolean;
    send_via_whatsapp?: boolean;
    send_via_sms?: boolean;
    send_via_push?: boolean;
  }) {
    const supabase = getAdminSupabaseClient();

    const { data: message, error: messageError } = await supabase
      .from('admin_messages')
      .insert({
        target_user_id: messageData.target_user_id,
        target_role: messageData.target_role,
        target_region: messageData.target_region,
        severity: messageData.severity,
        type: messageData.type,
        title: messageData.title,
        message: messageData.message,
        metadata: messageData.metadata || {},
        requires_ack: messageData.requires_ack || false,
        send_via_whatsapp: messageData.send_via_whatsapp || false,
        send_via_sms: messageData.send_via_sms || false,
        send_via_push: messageData.send_via_push || false
      })
      .select()
      .single();

    if (messageError) throw messageError;

    // Create status records for targeted users
    if (messageData.target_user_id) {
      // Single user
      await supabase
        .from('admin_message_statuses')
        .insert({
          message_id: message.id,
          user_id: messageData.target_user_id
        });
    } else if (messageData.target_role) {
      // All users with this role
      const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', messageData.target_role);

      if (users && users.length > 0) {
        const statusRecords = users.map(user => ({
          message_id: message.id,
          user_id: user.id
        }));
        await supabase
          .from('admin_message_statuses')
          .insert(statusRecords);
      }
    }

    return message;
  },

  async getMessageStats(messageId: string) {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase
      .from('admin_message_statuses')
      .select('*')
      .eq('message_id', messageId);

    if (error) throw error;

    const total = data?.length || 0;
    const delivered = data?.filter(s => s.delivered_at).length || 0;
    const read = data?.filter(s => s.read_at).length || 0;
    const acknowledged = data?.filter(s => s.acknowledged_at).length || 0;

    return {
      total,
      delivered,
      read,
      acknowledged,
      pending: total - delivered
    };
  },

  // Audit Log
  async getAuditLog(options: {
    page?: number;
    limit?: number;
    admin_id?: string;
    action?: string;
    entity_type?: string;
  } = {}) {
    const supabase = getAdminSupabaseClient();
    const { page = 1, limit = 50, admin_id, action, entity_type } = options;

    let query = supabase
      .from('admin_audit_log')
      .select(`
        *,
        admin_credentials(
          name,
          email
        )
      `, { count: 'exact' });

    if (admin_id) {
      query = query.eq('admin_id', admin_id);
    }
    if (action) {
      query = query.eq('action', action);
    }
    if (entity_type) {
      query = query.eq('entity_type', entity_type);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      logs: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  // Product Stats - Efficient stats calculation using database queries
  async getProductStats() {
    const supabase = getAdminSupabaseClient();

    try {
      // Get total products count - fetch all IDs and count them directly
      // This ensures we get the actual count even if count queries are affected by RLS
      console.log('🔍 Fetching product stats with service role...');

      // First try to get count, but if it seems wrong, fetch all and count
      const { count: totalCount, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Also fetch all product IDs to verify the count
      const { data: allProductIds, error: fetchError } = await supabase
        .from('products')
        .select('id');

      if (fetchError) {
        console.error('Error fetching product IDs:', fetchError);
        console.error('Error details:', JSON.stringify(fetchError, null, 2));
        throw fetchError;
      }

      // Use the actual array length as the source of truth
      const actualCount = allProductIds?.length ?? totalCount ?? 0;

      console.log('Total products count query result:', actualCount);
      console.log('Count from count query:', totalCount, 'Actual array length:', allProductIds?.length);

      if (countError) {
        console.warn('Count query had error, using array length:', countError);
      }

      // Get active products count (status = 'available')
      const { count: activeCount, error: activeError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'available');

      if (activeError) {
        console.error('Error counting active products:', activeError);
        throw activeError;
      }

      // Get out of stock products count (stock_available = 0 or null)
      // Use separate queries for null and zero values for better reliability
      const { count: outOfStockNull, error: outOfStockNullError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('stock_available', null);

      const { count: outOfStockZero, error: outOfStockZeroError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('stock_available', 0);

      if (outOfStockNullError) {
        console.error('Error counting out of stock (null) products:', outOfStockNullError);
        throw outOfStockNullError;
      }
      if (outOfStockZeroError) {
        console.error('Error counting out of stock (zero) products:', outOfStockZeroError);
        throw outOfStockZeroError;
      }

      const outOfStockCount = (outOfStockNull ?? 0) + (outOfStockZero ?? 0);

      // Get low stock products count (stock_available > 0 and <= 10)
      const { count: lowStockCount, error: lowStockError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .gt('stock_available', 0)
        .lte('stock_available', 10);

      if (lowStockError) {
        console.error('Error counting low stock products:', lowStockError);
        throw lowStockError;
      }

      // Ensure we have valid numbers (handle null/undefined)
      const stats = {
        totalProducts: Number(actualCount) || 0,
        activeProducts: Number(activeCount) || 0,
        outOfStock: Number(outOfStockCount) || 0,
        lowStock: Number(lowStockCount) || 0,
      };

      console.log('Product stats fetched:', stats);
      console.log('Raw counts - total:', actualCount, 'active:', activeCount, 'outOfStock:', outOfStockCount, 'lowStock:', lowStockCount);
      return stats;
    } catch (error) {
      console.error('Error fetching product stats:', error);
      throw error;
    }
  },
};