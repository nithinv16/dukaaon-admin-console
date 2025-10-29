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

  async getDashboardStats() {
    const response = await fetch('/api/admin/dashboard');
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard stats');
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

    if (!response.ok) {
      throw new Error('Failed to validate admin credentials');
    }

    return response.json();
  } catch (error) {
    console.error('Admin credentials validation error:', error);
    throw error;
  }
}