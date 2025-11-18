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

export interface DeliveryAddress {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
}

export interface Order {
  id: string;
  user_id: string;
  retailer_id?: string;
  seller_id?: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'failed';
  total_amount: number;
  created_at: string;
  updated_at: string;
  shipping_address?: string;
  delivery_address?: string | DeliveryAddress;
  delivery_contact_name?: string;
  delivery_contact_phone?: string;
  delivery_instructions?: string;
  payment_method?: string;
  payment_status?: string;
  notes?: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
  retailer?: {
    id: string;
    email?: string;
    phone?: string;
    shopName?: string;
    address?: string;
    owner_name?: string;
  };
  seller?: {
    user_id: string;
    business_name?: string;
    phone?: string;
    owner_name?: string;
    seller_type?: string;
  };
  customer?: {
    id: string;
    email?: string;
    phone?: string;
    shopName?: string;
    address?: string;
  };
  items?: any[];
}

export interface MasterProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  subcategory?: string;
  brand?: string;
  sku?: string;
  barcode?: string;
  weight?: number;
  dimensions?: string;
  material?: string;
  color?: string;
  size?: string;
  specifications?: any;
  image_url?: string;
  status: 'active' | 'draft' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subcategory?: string;
  brand?: string;
  image_url?: string;
  stock_available?: number;
  unit?: string;
  min_order_quantity?: number;
  min_quantity?: number;
  status: string;
}
