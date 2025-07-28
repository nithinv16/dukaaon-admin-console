import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'DukaaOn-Admin-Console/1.0.0',
    },
  },
});

// Database types
export interface Profile {
  id: string;
  phone_number: string;
  role: 'retailer' | 'wholesaler' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  kyc_status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
  profile_image_url?: string;
  business_details?: {
    shopName: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  documents?: Array<{
    type: 'id_proof' | 'address_proof' | 'business_proof';
    url: string;
    status: 'pending' | 'verified' | 'rejected';
  }>;
}

export interface Order {
  id: string;
  retailer_id: string;
  seller_id: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: number;
  created_at: string;
  updated_at: string;
  delivery_address: string;
  items: Array<{
    product_id: string;
    quantity: number;
    price: number;
    product_name: string;
  }>;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subcategory: string;
  seller_id: string;
  status: 'active' | 'inactive' | 'out_of_stock';
  created_at: string;
  updated_at: string;
  // Database fields
  image_url?: string;
  stock_available?: number;
  min_order_quantity?: number;
  min_quantity?: number;
  unit?: string;
  brand?: string;
  base_quantity?: number;
  quantity?: number;
  // Computed fields for UI
  images?: string[];
  stock_quantity?: number;
  seller_name?: string;
  seller_type?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'system' | 'promotion';
  status: 'sent' | 'delivered' | 'failed';
  created_at: string;
  read_at?: string;
}

export interface PaymentConfig {
  id: string;
  config_type: 'upi' | 'bank_account';
  is_active: boolean;
  upi_id?: string;
  merchant_name?: string;
  account_number?: string;
  ifsc_code?: string;
  bank_name?: string;
  account_holder_name?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Admin credentials validation
export const validateAdminCredentials = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.rpc('validate_admin_credentials', {
      input_email: email,
      input_password: password
    });

    if (error) {
      console.error('Admin validation error:', error);
      return { success: false, message: 'Authentication failed' };
    }

    return data;
  } catch (err) {
    console.error('Admin validation exception:', err);
    return { success: false, message: 'Authentication error' };
  }
};

// Helper functions for admin operations
export const adminQueries = {
  // User Management
  async getAllUsers(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    return { data, error, count };
  },

  async getUsersByRole(role: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', role)
      .order('created_at', { ascending: false });
    
    return { data, error };
  },

  async updateUserStatus(userId: string, status: string) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select();
    
    return { data, error };
  },

  // Order Management
  async getAllOrders(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const { data, error, count } = await supabase
      .from('orders')
      .select(`
        *,
        retailer:profiles!orders_retailer_id_fkey(id, phone_number, business_details),
        seller:profiles!orders_seller_id_fkey(id, phone_number, business_details)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    return { data, error, count };
  },

  async getOrdersByStatus(status: string) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        retailer:profiles!orders_retailer_id_fkey(id, phone_number, business_details),
        seller:profiles!orders_seller_id_fkey(id, phone_number, business_details)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });
    
    return { data, error };
  },

  // Analytics
  async getDashboardStats() {
    const [retailersResult, sellersResult, ordersResult, revenueResult] = await Promise.all([
      supabase.from('profiles').select('role, status', { count: 'exact' }).eq('role', 'retailer'),
      supabase.from('seller_details').select('seller_type, status', { count: 'exact' }),
      supabase.from('orders').select('status, total_amount', { count: 'exact' }),
      supabase.from('orders').select('total_amount, created_at').eq('status', 'delivered')
    ]);

    // Process user data to match the expected format
    const retailers = retailersResult.data || [];
    const sellers = sellersResult.data || [];
    
    // Create combined user data with proper role categorization
    const combinedUsers = [
      ...retailers.map(r => ({ role: 'retailer', status: r.status })),
      ...sellers.map(s => ({ role: s.seller_type || 'wholesaler', status: s.status }))
    ];

    return {
      users: {
        data: combinedUsers,
        count: (retailersResult.count || 0) + (sellersResult.count || 0),
        error: retailersResult.error || sellersResult.error
      },
      orders: ordersResult,
      revenue: revenueResult
    };
  },

  // Product Management
  async getAllProducts(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const { data, error, count } = await supabase
      .from('products')
      .select(`
        *,
        seller:profiles!products_seller_id_fkey(id, phone_number, business_details)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    return { data, error, count };
  },

  // Payment Configuration
  async getPaymentConfigs() {
    const { data, error } = await supabase
      .from('payment_config')
      .select('*')
      .order('created_at', { ascending: false });
    
    return { data, error };
  },

  // Enhanced User Management
  async getUsers(options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {}) {
    const { page = 0, limit = 25, search, status } = options;
    const offset = page * limit;
    
    try {
      // Get retailers from profiles table
      let retailersQuery = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('role', 'retailer')
        .order('created_at', { ascending: false });

      // Get sellers (wholesalers and manufacturers) from seller_details table with profiles
      let sellersQuery = supabase
        .from('seller_details')
        .select(`
          *,
          profiles!seller_details_user_id_fkey(
            id,
            phone_number,
            created_at,
            status,
            role,
            business_details
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply search filter for retailers
      if (search) {
        retailersQuery = retailersQuery.or(`phone_number.ilike.%${search}%,business_details->>shopName.ilike.%${search}%`);
      }

      // Apply search filter for sellers
      if (search) {
        sellersQuery = sellersQuery.or(`business_name.ilike.%${search}%,owner_name.ilike.%${search}%`);
      }

      // Apply status filter
      if (status && status !== 'all') {
        retailersQuery = retailersQuery.eq('status', status);
        sellersQuery = sellersQuery.eq('status', status);
      }

      // Apply pagination
      retailersQuery = retailersQuery.range(offset, offset + limit - 1);
      sellersQuery = sellersQuery.range(offset, offset + limit - 1);

      const [retailersResult, sellersResult] = await Promise.all([
        retailersQuery,
        sellersQuery
      ]);
      
      if (retailersResult.error) {
        console.error('Retailers query error:', retailersResult.error);
      }
      if (sellersResult.error) {
        console.error('Sellers query error:', sellersResult.error);
      }

      // Format retailers data
      const retailers = (retailersResult.data || []).map(user => ({
        ...user,
        user_type: 'retailer',
        display_name: user.business_details?.shopName || user.phone_number || 'Unknown Retailer',
        business_info: user.business_details,
        kyc_status: user.status || 'pending'
      }));

      // Format sellers data (wholesalers and manufacturers)
      const sellers = (sellersResult.data || []).map(seller => ({
        id: seller.profiles?.id || seller.user_id,
        phone_number: seller.profiles?.phone_number,
        created_at: seller.profiles?.created_at || seller.created_at,
        status: seller.status || 'pending',
        role: seller.seller_type || 'wholesaler', // Use seller_type from seller_details
        user_type: seller.seller_type === 'manufacturer' ? 'manufacturer' : 'wholesaler',
        display_name: seller.business_name || seller.owner_name || seller.profiles?.phone_number || 'Unknown Seller',
        business_info: {
          shopName: seller.business_name, // Map to shopName for consistency
          business_name: seller.business_name,
          owner_name: seller.owner_name,
          seller_type: seller.seller_type,
          gst_number: seller.gst_number,
          address: seller.location_address,
          years_in_business: seller.years_in_business
        },
        kyc_status: seller.status || 'pending',
        business_details: {
          shopName: seller.business_name
        }
      }));

      const allUsers = [...retailers, ...sellers];
      const totalCount = (retailersResult.count || 0) + (sellersResult.count || 0);

      return {
        data: allUsers,
        error: null,
        count: totalCount
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { data: null, error, count: 0 };
    }
  },

  // Enhanced Order Management
  async getOrders(options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {}) {
    const { page = 1, limit = 25, search = '', status = 'all' } = options;
    try {
      // First, get orders with basic filtering
      let query = supabase
        .from('orders')
        .select('*', { count: 'exact' });

      // Apply status filter
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      // Apply search filter on order fields only
      if (search) {
        query = query.ilike('order_number', `%${search}%`);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data: orders, error, count } = await query;
      
      if (error) throw error;

      // Manually fetch user profiles and seller details for each order
      const formattedOrders = await Promise.all((orders || []).map(async (order) => {
        let userProfile = null;
        let sellerProfile = null;
        let sellerDetails = null;
        
        // Fetch buyer profile
        if (order.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, phone_number, business_details, role')
            .eq('id', order.user_id)
            .single();
          
          userProfile = profile;
        }
        
        // Fetch seller profile and details
        if (order.seller_id) {
          const [profileResult, detailsResult] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, phone_number, business_details, role')
              .eq('id', order.seller_id)
              .single(),
            supabase
              .from('seller_details')
              .select('business_name, owner_name, seller_type')
              .eq('user_id', order.seller_id)
              .single()
          ]);
          
          sellerProfile = profileResult.data;
          sellerDetails = detailsResult.data;
        }
        
        return {
          ...order,
          buyer_name: userProfile?.business_details?.shopName || userProfile?.phone_number || 'Unknown',
          seller_name: sellerDetails?.business_name || sellerProfile?.business_details?.shopName || sellerProfile?.phone_number || 'Unknown',
          buyer_type: userProfile?.role || 'retailer',
          seller_type: sellerDetails?.seller_type || sellerProfile?.role || 'seller',
          profiles: userProfile // Keep for compatibility
        };
      }));

      // Apply search filter on user data if needed
      let filteredOrders = formattedOrders;
      if (search && !search.match(/^[A-Z0-9]+$/)) { // If search is not just order number
        filteredOrders = formattedOrders.filter(order => 
          order.order_number?.toLowerCase().includes(search.toLowerCase()) ||
          order.buyer_name?.toLowerCase().includes(search.toLowerCase()) ||
          order.profiles?.phone_number?.includes(search)
        );
      }

      return {
        orders: filteredOrders,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  },

  // Enhanced Analytics
  async getAnalytics() {
    try {
      const [retailersResult, sellersResult, ordersResult, revenueResult, productsResult] = await Promise.all([
        supabase.from('profiles').select('role, status', { count: 'exact' }).eq('role', 'retailer'),
        supabase.from('seller_details').select('seller_type, status', { count: 'exact' }),
        supabase.from('orders').select('status', { count: 'exact' }),
        supabase.from('orders').select('total_amount, status').eq('status', 'delivered'),
        supabase.from('products').select('status', { count: 'exact' })
      ]);

      const retailers = retailersResult.data || [];
      const sellers = sellersResult.data || [];
      const orders = ordersResult.data || [];
      const revenue = revenueResult.data || [];
      const products = productsResult.data || [];

      // Calculate user counts
      const retailerCount = retailersResult.count || 0;
      const wholesalerCount = sellers.filter(s => s.seller_type === 'wholesaler').length;
      const manufacturerCount = sellers.filter(s => s.seller_type === 'manufacturer').length;
      const adminCount = 0; // Admins are typically managed separately
      
      const totalUsers = retailerCount + wholesalerCount + manufacturerCount + adminCount;
      const activeRetailers = retailers.filter(u => u.status === 'active').length;
      const activeSellers = sellers.filter(s => s.status === 'active').length;
      const activeUsers = activeRetailers + activeSellers;
      
      const pendingRetailers = retailers.filter(u => u.status === 'pending').length;
      const pendingSellers = sellers.filter(s => s.status === 'pending').length;
      const pendingKyc = pendingRetailers + pendingSellers;
      
      const blockedRetailers = retailers.filter(u => u.status === 'suspended').length;
      const blockedSellers = sellers.filter(s => s.status === 'suspended').length;
      const blockedUsers = blockedRetailers + blockedSellers;

      // User distribution by role
      const retailersCount = retailerCount;
      const wholesalersCount = wholesalerCount;
      const manufacturersCount = manufacturerCount;
      const adminsCount = adminCount;

      const totalOrders = ordersResult.count || 0;
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      const completedOrders = orders.filter(o => o.status === 'delivered').length;
      const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;

      const totalRevenue = revenue.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;
      const conversionRate = totalUsers > 0 ? (completedOrders / totalUsers) * 100 : 0;
      const userGrowthRate = 12.5; // This would need historical data to calculate properly
      const revenueGrowthRate = 15.3; // This would need historical data to calculate properly
      
      const totalProducts = productsResult.count || 0;

      return {
        totalUsers,
        activeUsers,
        pendingKyc,
        blockedUsers,
        retailers: retailersCount,
        wholesalers: wholesalersCount,
        manufacturers: manufacturersCount,
        admins: adminsCount,
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue,
        averageOrderValue,
        conversionRate,
        userGrowthRate,
        revenueGrowthRate,
        totalProducts,
      };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return null;
    }
  },

  // Products
  async getProducts(page = 1, limit = 25, search = '', category = 'all', status = 'all') {
    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          seller:profiles!products_seller_id_fkey(
            id,
            phone_number,
            role,
            business_details
          )
        `, { count: 'exact' });

      // Apply search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`);
      }

      // Apply category filter
      if (category !== 'all') {
        query = query.eq('category', category);
      }

      // Apply status filter
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data, error, count } = await query;
      
      if (error) throw error;

      // Get unique seller IDs to fetch seller_details
      const sellerIds = Array.from(new Set((data || []).map(p => p.seller_id).filter(Boolean)));
      
      // Fetch seller_details for all sellers
      let sellerDetailsMap: any = {};
      if (sellerIds.length > 0) {
        const { data: sellerDetails } = await supabase
          .from('seller_details')
          .select('user_id, business_name, owner_name, seller_type')
          .in('user_id', sellerIds);
        
        sellerDetailsMap = (sellerDetails || []).reduce((acc: any, detail: any) => {
          acc[detail.user_id] = detail;
          return acc;
        }, {} as any);
      }

      // Format the data to include proper seller information and map database fields to interface
      const formattedProducts = (data || []).map(product => {
        const sellerDetail = sellerDetailsMap[product.seller_id];
        return {
          ...product,
          // Map database fields to expected interface fields
          images: product.image_url ? [product.image_url] : [],
          stock_quantity: product.stock_available || 0,
          seller_name: sellerDetail?.business_name || product.seller?.business_details?.shopName || product.seller?.phone_number || 'Unknown',
          seller_type: sellerDetail?.seller_type || product.seller?.role || 'wholesaler'
        };
      });

      return {
        products: formattedProducts,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  async addProduct(productData: {
    name: string;
    description: string;
    price: number;
    category: string;
    subcategory?: string;
    images: string[];
    seller_id: string;
    stock?: number;
    unit?: string;
    specifications?: any;
  }) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            ...productData,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  },

  async updateProduct(id: string, updates: any) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  async deleteProduct(id: string) {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  async uploadProductImage(file: File, productId?: string) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId || Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return { success: true, url: data.publicUrl };
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  },

  // Categories
  async getCategories(searchTerm = '', filterStatus = 'all') {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('category, subcategory, status')
        .order('category');
      
      if (error) throw error;

      // Group products by category
      const categoryMap = new Map();
      
      data?.forEach(product => {
        if (!product.category) return;
        
        if (!categoryMap.has(product.category)) {
          categoryMap.set(product.category, {
            id: product.category.toLowerCase().replace(/\s+/g, '-'),
            name: product.category,
            description: `${product.category} products`,
            status: 'active',
            product_count: 0,
            created_at: new Date().toISOString(),
            subcategories: new Map()
          });
        }
        
        const category = categoryMap.get(product.category);
        category.product_count++;
        
        // Add subcategory if it exists
        if (product.subcategory && !category.subcategories.has(product.subcategory)) {
          category.subcategories.set(product.subcategory, {
            id: `${category.id}-${product.subcategory.toLowerCase().replace(/\s+/g, '-')}`,
            name: product.subcategory,
            description: `${product.subcategory} products`,
            parent_id: category.id,
            status: 'active',
            product_count: 0,
            created_at: new Date().toISOString()
          });
        }
        
        if (product.subcategory) {
          const subcategory = category.subcategories.get(product.subcategory);
          if (subcategory) {
            subcategory.product_count++;
          }
        }
      });
      
      // Convert to array format expected by the UI
      const categories = Array.from(categoryMap.values()).map(category => ({
        ...category,
        subcategories: Array.from(category.subcategories.values())
      }));
      
      // Apply filters
      let filteredCategories = categories;
      
      if (searchTerm) {
        filteredCategories = categories.filter(cat => 
          cat.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      if (filterStatus !== 'all') {
        filteredCategories = filteredCategories.filter(cat => cat.status === filterStatus);
      }
      
      return filteredCategories;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  },

  async getCategoryStats() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('category, subcategory, status');
      
      if (error) throw error;

      // Calculate statistics
      const categories = Array.from(new Set(data?.map(p => p.category) || []));
      const subcategories = Array.from(new Set(data?.map(p => p.subcategory) || []));
      const activeCategories = Array.from(new Set(data?.filter(p => p.status === 'active').map(p => p.category) || []));
      const totalProducts = data?.length || 0;

      return {
        totalCategories: categories.length,
        activeCategories: activeCategories.length,
        totalSubcategories: subcategories.length,
        totalProducts: totalProducts
      };
    } catch (error) {
      console.error('Error fetching category stats:', error);
      throw error;
    }
  },

  async updatePaymentConfig(id: string, updates: Partial<PaymentConfig>) {
    const { data, error } = await supabase
      .from('payment_config')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    
    return { data, error };
  }
};