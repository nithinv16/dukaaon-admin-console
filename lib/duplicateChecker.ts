/**
 * Duplicate Product Checker Utility
 * Checks for duplicate products by name for a specific seller
 */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  existingProduct?: {
    id: string;
    name: string;
    price: number;
    seller_id: string;
  };
}

/**
 * Check if a product with the same name already exists for a seller
 * Uses case-insensitive matching and fuzzy matching for better detection
 */
export async function checkProductDuplicate(
  productName: string,
  sellerId: string
): Promise<DuplicateCheckResult> {
  if (!productName || !sellerId) {
    return { isDuplicate: false };
  }

  try {
    const response = await fetch('/api/admin/products/check-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: productName.trim(),
        seller_id: sellerId,
      }),
    });

    if (!response.ok) {
      console.warn('Duplicate check failed, proceeding anyway');
      return { isDuplicate: false };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    // On error, don't block - allow the product to be added
    return { isDuplicate: false };
  }
}

/**
 * Check multiple products for duplicates
 * Returns a map of product names to duplicate check results
 */
export async function checkMultipleProductsForDuplicates(
  products: Array<{ name: string }>,
  sellerId: string
): Promise<Map<string, DuplicateCheckResult>> {
  const results = new Map<string, DuplicateCheckResult>();

  if (!sellerId || products.length === 0) {
    return results;
  }

  try {
    const response = await fetch('/api/admin/products/check-duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: products.map(p => ({ name: p.name.trim() })),
        seller_id: sellerId,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.results && Array.isArray(data.results)) {
        data.results.forEach((result: { name: string; duplicate: DuplicateCheckResult }) => {
          results.set(result.name, result.duplicate);
        });
      }
    }
  } catch (error) {
    console.error('Error checking multiple products for duplicates:', error);
  }

  return results;
}


