/**
 * VariantService
 * Service for managing product variants
 */

export interface ProductVariant {
  id?: string;
  product_id: string;
  sku: string;
  variant_type: 'size' | 'flavor' | 'color' | 'weight' | 'pack';
  variant_value: string;
  price: number;
  mrp?: number;
  stock_quantity: number;
  image_url?: string;
  is_default?: boolean;
  display_order?: number;
  is_active?: boolean;
}

export interface CreateVariantInput {
  product_id: string;
  sku: string;
  variant_type: 'size' | 'flavor' | 'color' | 'weight' | 'pack';
  variant_value: string;
  price: number;
  mrp?: number;
  stock_quantity: number;
  image_url?: string;
  is_default?: boolean;
  display_order?: number;
}

export class VariantService {
  /**
   * Create multiple variants for a product
   */
  static async createVariants(variants: CreateVariantInput[]): Promise<ProductVariant[]> {
    if (!variants || variants.length === 0) {
      return [];
    }

    try {
      const response = await fetch('/api/admin/products/variants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variants }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create variants');
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error creating variants:', error);
      throw error;
    }
  }

  /**
   * Get all variants for a product
   */
  static async getVariants(productId: string): Promise<ProductVariant[]> {
    try {
      const response = await fetch(`/api/admin/products/${productId}/variants`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch variants');
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error fetching variants:', error);
      throw error;
    }
  }

  /**
   * Update a variant
   */
  static async updateVariant(variantId: string, updates: Partial<ProductVariant>): Promise<ProductVariant> {
    try {
      const response = await fetch(`/api/admin/products/variants/${variantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update variant');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error updating variant:', error);
      throw error;
    }
  }

  /**
   * Delete a variant
   */
  static async deleteVariant(variantId: string): Promise<void> {
    try {
      const response = await fetch(`/api/admin/products/variants/${variantId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete variant');
      }
    } catch (error) {
      console.error('Error deleting variant:', error);
      throw error;
    }
  }

  /**
   * Generate a unique SKU for a variant
   */
  static generateSKU(productName: string, variantType: string, variantValue: string): string {
    const productPrefix = productName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 8);
    
    const variantPrefix = variantType.toUpperCase().substring(0, 2);
    const valueSuffix = variantValue
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 6);
    
    return `${productPrefix}-${variantPrefix}-${valueSuffix}`;
  }
}

