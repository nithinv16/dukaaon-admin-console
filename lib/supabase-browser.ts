'use client';

import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;
let adminSupabaseClient: any = null;

// Get regular Supabase client (client-side only)
export function getSupabaseClient() {
  // Only run on client side
  if (typeof window === 'undefined') {
    console.error('getSupabaseClient called on server side');
    return null;
  }

  // Return existing client if available
  if (supabaseClient) {
    return supabaseClient;
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables:', {
        url: !!supabaseUrl,
        key: !!supabaseAnonKey
      });
      return null;
    }

    // Create client synchronously
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

// Get admin Supabase client (deprecated - use API routes instead)
export function getAdminSupabaseClient() {
  console.warn('getAdminSupabaseClient is deprecated. Use API routes for admin operations.');
  return null;
}

// Admin queries object using API routes
export const adminQueries = {
  async getAllUsers() {
    const response = await fetch('/api/admin/users');
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    return response.json();
  },

  async getSellersWithDetails() {
    try {
      const response = await fetch('/api/admin/sellers');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch sellers: ${response.status}`);
      }
      const result = await response.json();
      const sellers = result.data || result;
      console.log('getSellersWithDetails response:', { result, sellers, isArray: Array.isArray(sellers), count: Array.isArray(sellers) ? sellers.length : 'N/A' });
      return Array.isArray(sellers) ? sellers : [];
    } catch (error) {
      console.error('getSellersWithDetails error:', error);
      throw error;
    }
  },

  async getUsersByRole(role: string) {
    const response = await fetch(`/api/admin/users?role=${role}`);
    if (!response.ok) {
      throw new Error('Failed to fetch users by role');
    }
    return response.json();
  },

  async updateUserStatus(userId: string, status: string) {
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, status }),
    });
    if (!response.ok) {
      throw new Error('Failed to update user status');
    }
    return response.json();
  },

  async getOrders(options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {}) {
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.search) params.append('search', options.search);
    if (options.status) params.append('status', options.status);

    const response = await fetch(`/api/admin/orders?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch orders');
    }
    return response.json();
  },

  async getAnalytics() {
    const response = await fetch('/api/admin/analytics');
    if (!response.ok) {
      throw new Error('Failed to fetch analytics');
    }
    return response.json();
  },

  async getDashboardStats(timeFilter?: string) {
    const url = timeFilter 
      ? `/api/admin/dashboard?timeFilter=${timeFilter}`
      : '/api/admin/dashboard';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard stats');
    }
    return response.json();
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
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.search) params.append('search', options.search);
    if (options.category) params.append('category', options.category);
    if (options.status) params.append('status', options.status);
    if (options.seller_id) params.append('seller_id', options.seller_id);

    const response = await fetch(`/api/admin/products?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    return response.json();
  },

  async addProduct(productData: any) {
    const response = await fetch('/api/admin/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add product');
    }
    return response.json();
  },

  async updateProduct(productId: string, updates: any) {
    const response = await fetch('/api/admin/products', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId, updates }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update product');
    }
    return response.json();
  },

  async getProductStats() {
    const response = await fetch('/api/admin/products/stats');
    if (!response.ok) {
      throw new Error('Failed to fetch product stats');
    }
    return response.json();
  },

  // Master Products
  async getMasterProducts(options: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
  } = {}) {
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.search) params.append('search', options.search);
    if (options.category) params.append('category', options.category);
    if (options.status) params.append('status', options.status);

    const response = await fetch(`/api/admin/master-products?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch master products');
    }
    return response.json();
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
    const response = await fetch('/api/admin/master-products/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add master product to seller');
    }
    return response.json();
  },

  // User Management Extensions
  async updateUser(userId: string, updates: {
    phone_number?: string;
    status?: string;
    kyc_status?: string;
    business_details?: any;
  }) {
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, ...updates }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user');
    }
    return response.json();
  },

  async deleteUser(userId: string) {
    const response = await fetch(`/api/admin/users?userId=${userId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }
    return response.json();
  },

  // Order Management Extensions
  async updateOrderStatus(orderId: string, status: string, notes?: string) {
    const response = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId, status, notes }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update order status');
    }
    return response.json();
  },

  // App Configuration
  async getConfigs(scope?: string) {
    const params = new URLSearchParams();
    if (scope) params.append('scope', scope);
    const response = await fetch(`/api/admin/configs?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch configs');
    return response.json();
  },

  async saveConfig(key: string, value: any, description?: string, scope?: string, scopeValue?: string) {
    const response = await fetch('/api/admin/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, description, scope, scopeValue }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save config');
    }
    return response.json();
  },

  async deleteConfig(key: string) {
    const response = await fetch(`/api/admin/configs?key=${key}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete config');
    }
    return response.json();
  },

  // Feature Flags
  async getFeatureFlags() {
    const response = await fetch('/api/admin/feature-flags');
    if (!response.ok) throw new Error('Failed to fetch feature flags');
    return response.json();
  },

  async createFeatureFlag(flagData: any) {
    const response = await fetch('/api/admin/feature-flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flagData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create feature flag');
    }
    return response.json();
  },

  async updateFeatureFlag(id: string, updates: any) {
    const response = await fetch('/api/admin/feature-flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update feature flag');
    }
    return response.json();
  },

  async deleteFeatureFlag(id: string) {
    const response = await fetch(`/api/admin/feature-flags?id=${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete feature flag');
    }
    return response.json();
  },

  // Dynamic Content
  async getContentSlots() {
    const response = await fetch('/api/admin/dynamic-content/slots');
    if (!response.ok) throw new Error('Failed to fetch content slots');
    return response.json();
  },

  async getContentItems(slotId?: string, options?: any) {
    const params = new URLSearchParams();
    if (slotId) params.append('slot_id', slotId);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);
    const response = await fetch(`/api/admin/dynamic-content/items?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch content items');
    return response.json();
  },

  async upsertContentItem(itemData: any) {
    const response = await fetch('/api/admin/dynamic-content/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save content item');
    }
    return response.json();
  },

  async deleteContentItem(id: string) {
    const response = await fetch(`/api/admin/dynamic-content/items?id=${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete content item');
    }
    return response.json();
  },

  // Admin Messages
  async getAdminMessages(options?: any) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.target_role) params.append('target_role', options.target_role);
    if (options?.severity) params.append('severity', options.severity);
    if (options?.type) params.append('type', options.type);
    const response = await fetch(`/api/admin/messages?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch messages');
    return response.json();
  },

  async createAdminMessage(messageData: any) {
    const response = await fetch('/api/admin/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create message');
    }
    return response.json();
  },

  async getMessageStats(messageId: string) {
    const response = await fetch(`/api/admin/messages/${messageId}/stats`);
    if (!response.ok) throw new Error('Failed to fetch message stats');
    return response.json();
  },

  // Audit Log
  async getAuditLog(options?: any) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.admin_id) params.append('admin_id', options.admin_id);
    if (options?.action) params.append('action', options.action);
    if (options?.entity_type) params.append('entity_type', options.entity_type);
    const response = await fetch(`/api/admin/audit-log?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch audit log');
    return response.json();
  },

  // Categories
  async getCategories(): Promise<{ categories: any[]; subcategories: any[] }> {
    const response = await fetch('/api/admin/categories');
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch categories');
    }
    return response.json();
  },

  async createCategory(name: string): Promise<any> {
    const response = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: 'category' }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create category');
    }
    return response.json();
  },

  async createSubcategory(name: string, categoryId: string): Promise<any> {
    const response = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: 'subcategory', category_id: categoryId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create subcategory');
    }
    return response.json();
  },

  async updateCategory(id: string, name: string): Promise<any> {
    const response = await fetch('/api/admin/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'category', name }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update category');
    }
    return response.json();
  },

  async updateSubcategory(id: string, name: string, categoryId?: string): Promise<any> {
    const body: any = { id, type: 'subcategory', name };
    if (categoryId) body.category_id = categoryId;
    
    const response = await fetch('/api/admin/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update subcategory');
    }
    return response.json();
  },

  async deleteCategory(id: string): Promise<any> {
    const response = await fetch('/api/admin/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'category' }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete category');
    }
    return response.json();
  },

  async deleteSubcategory(id: string): Promise<any> {
    const response = await fetch('/api/admin/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'subcategory' }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete subcategory');
    }
    return response.json();
  },

  async getCategoryStats(): Promise<any> {
    const response = await fetch('/api/admin/categories/stats');
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch category stats');
    }
    return response.json();
  },

  async updateProductCategory(productIds: string[], category?: string, subcategory?: string | null): Promise<any> {
    const response = await fetch('/api/admin/products/update-category', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds, category, subcategory }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update product category');
    }
    return response.json();
  },

  async moveSubcategory(subcategoryId: string, newCategoryId: string): Promise<any> {
    const response = await fetch('/api/admin/categories/move-subcategory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subcategoryId, newCategoryId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to move subcategory');
    }
    return response.json();
  },

  async getProductsByCategory(category?: string, subcategory?: string, limit?: number): Promise<any> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (subcategory) params.append('subcategory', subcategory);
    if (limit) params.append('limit', limit.toString());
    
    const response = await fetch(`/api/admin/products/by-category?${params.toString()}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch products');
    }
    return response.json();
  }
};

// Regular queries object with async functions
export const queries = {
  async getProducts() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getCategories() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  }
};

// Admin credentials validation function
export async function validateAdminCredentials(email: string, password: string) {
  try {
    console.log('🔐 validateAdminCredentials called with:', email);
    
    const response = await fetch('/api/admin/validate-credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password
      }),
    });

    console.log('📡 API Response status:', response.status);
    console.log('📡 API Response ok:', response.ok);

    if (!response.ok) {
      console.error('❌ Response not OK:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Error data:', errorData);
      throw new Error(`Failed to validate admin credentials: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Response data received:', data);
    console.log('✅ data.success:', data?.success);
    console.log('✅ data.admin:', data?.admin);
    
    return data;
  } catch (error) {
    console.error('❌ Admin credentials validation error:', error);
    throw error;
  }
}