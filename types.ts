// TypeScript type definitions for the admin console

export interface User {
  id: string;
  email?: string;
  phone_number: string;
  role: 'retailer' | 'wholesaler' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  data: T;
  error: string | null;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

export interface Order {
  id: string;
  user_id: string;
  retailer_id?: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'failed';
  total_amount: number;
  created_at: string;
  updated_at: string;
  shipping_address?: string;
  payment_method?: string;
  payment_status?: string;
  notes?: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
}
