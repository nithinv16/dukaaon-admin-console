import { createClient } from '@supabase/supabase-js';

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
    // Get users from profiles table instead of auth.users for better data
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
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
        let sellerData = null;
        if (order.seller) {
          const businessDetails = order.seller.business_details || {};
          sellerData = {
            user_id: order.seller.id,
            business_name: businessDetails.business_name || businessDetails.shopName || null,
            owner_name: businessDetails.ownerName || businessDetails.owner_name || null,
            phone: order.seller.phone_number || null
          };
          
          // Also try to get seller_details for additional info
          // This will be done separately if needed
        }

        // Fetch seller_details if seller_id exists for additional seller info
        // Note: This is done in a separate step to avoid blocking
        return {
          ...order,
          retailer: retailerData,
          seller: sellerData
        };
      });

      // Fetch seller_details for orders that have seller_id
      const sellerIds = orders
        .map((order: any) => order.seller_id)
        .filter(Boolean)
        .filter((id: string, index: number, self: string[]) => self.indexOf(id) === index); // unique IDs

      if (sellerIds.length > 0) {
        const { data: sellersData, error: sellersError } = await supabase
          .from('seller_details')
          .select('user_id, business_name, owner_name, seller_type')
          .in('user_id', sellerIds);

        if (!sellersError && sellersData) {
          // Merge seller_details into the orders
          ordersWithDetails = ordersWithDetails.map((order: any) => {
            if (order.seller_id && order.seller) {
              const sellerDetail = sellersData.find((s: any) => s.user_id === order.seller_id);
              if (sellerDetail) {
                // Enhance seller data with seller_details
                order.seller = {
                  ...order.seller,
                  business_name: sellerDetail.business_name || order.seller.business_name,
                  owner_name: sellerDetail.owner_name || order.seller.owner_name,
                  seller_type: sellerDetail.seller_type
                };
              }
            }
            return order;
          });
        }
      }

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
        query = query.eq('is_active', true).neq('status', 'out_of_stock');
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
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

    // Fetch seller names for products
    if (data && data.length > 0) {
      const sellerIds = Array.from(new Set(data.map((p: any) => p.seller_id).filter(Boolean)));
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('profiles')
          .select('id, business_details, phone_number')
          .in('id', sellerIds);

        const sellerMap = new Map(sellers?.map((s: any) => {
          const businessDetails = typeof s.business_details === 'string' 
            ? JSON.parse(s.business_details) 
            : s.business_details;
          return [s.id, businessDetails?.shopName || s.phone_number || 'Unknown'];
        }) || []);

        data.forEach((product: any) => {
          product.seller_name = sellerMap.get(product.seller_id) || 'Unknown';
          product.stock_available = product.stock_quantity || 0;
          product.image_url = product.images?.[0] || null;
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

  async addProduct(productData: {
    name: string;
    description: string;
    price: number;
    category: string;
    subcategory?: string;
    brand?: string;
    seller_id: string;
    stock_quantity?: number;
    unit_of_measure?: string;
    min_order_quantity?: number;
    images?: string[];
    status?: string;
  }) {
    const supabase = getAdminSupabaseClient();
    
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: productData.name,
        description: productData.description,
        price: productData.price,
        category: productData.category,
        category_name: productData.category,
        subcategory: productData.subcategory,
        brand: productData.brand,
        seller_id: productData.seller_id,
        stock_quantity: productData.stock_quantity || 0,
        unit_of_measure: productData.unit_of_measure || 'piece',
        minimum_stock_level: productData.min_order_quantity || 1,
        images: productData.images || [],
        status: productData.status || 'available',
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProduct(productId: string, updates: {
    name?: string;
    description?: string;
    price?: number;
    category?: string;
    subcategory?: string;
    brand?: string;
    stock_quantity?: number;
    unit_of_measure?: string;
    min_order_quantity?: number;
    images?: string[];
    status?: string;
    is_active?: boolean;
  }) {
    const supabase = getAdminSupabaseClient();
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.price !== undefined) updateData.price = updates.price;
    if (updates.category !== undefined) {
      updateData.category = updates.category;
      updateData.category_name = updates.category;
    }
    if (updates.subcategory !== undefined) updateData.subcategory = updates.subcategory;
    if (updates.brand !== undefined) updateData.brand = updates.brand;
    if (updates.stock_quantity !== undefined) updateData.stock_quantity = updates.stock_quantity;
    if (updates.unit_of_measure !== undefined) updateData.unit_of_measure = updates.unit_of_measure;
    if (updates.min_order_quantity !== undefined) updateData.minimum_stock_level = updates.min_order_quantity;
    if (updates.images !== undefined) updateData.images = updates.images;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Master Products Management
  async getMasterProducts(options: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
  } = {}) {
    const supabase = getAdminSupabaseClient();
    const { page = 1, limit = 12, search, category } = options;
    
    let query = supabase
      .from('master_products')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category);
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
        category_name: masterProduct.category,
        subcategory: masterProduct.subcategory,
        brand: masterProduct.brand,
        stock_quantity: payload.stock_available,
        unit_of_measure: payload.unit,
        minimum_stock_level: payload.min_order_quantity,
        images: masterProduct.images || [],
        status: 'available',
        is_active: true,
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
  }
};