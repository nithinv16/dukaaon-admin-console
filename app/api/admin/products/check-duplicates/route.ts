import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

/**
 * Check multiple products for duplicates
 * POST /api/admin/products/check-duplicates
 */
export async function POST(request: NextRequest) {
  try {
    const { products, seller_id } = await request.json();

    if (!products || !Array.isArray(products) || !seller_id) {
      return NextResponse.json(
        { error: 'Products array and seller_id are required' },
        { status: 400 }
      );
    }

    // Get all products for this seller
    const result = await adminQueries.getProducts({
      page: 1,
      limit: 10000, // Get all products for duplicate checking
      seller_id: seller_id,
    });

    const existingProducts = result.products || [];
    const results: Array<{ name: string; duplicate: any }> = [];

    for (const product of products) {
      const productName = product.name?.trim();
      if (!productName) continue;

      const normalizedName = productName.toLowerCase().trim();

      // Check for exact match
      const exactMatch = existingProducts.find((p: any) => 
        p.name.toLowerCase().trim() === normalizedName
      );

      if (exactMatch) {
        results.push({
          name: productName,
          duplicate: {
            isDuplicate: true,
            reason: `Product "${productName}" already exists for this seller`,
            existingProduct: {
              id: exactMatch.id,
              name: exactMatch.name,
              price: exactMatch.price,
              seller_id: exactMatch.seller_id,
            },
          },
        });
        continue;
      }

      // Check for fuzzy match
      const fuzzyMatch = existingProducts.find((p: any) => {
        const existingName = p.name.toLowerCase().trim();
        if (normalizedName.length > 3 && existingName.length > 3) {
          const similarity = calculateSimilarity(normalizedName, existingName);
          return similarity > 0.85;
        }
        return false;
      });

      if (fuzzyMatch) {
        results.push({
          name: productName,
          duplicate: {
            isDuplicate: true,
            reason: `Product "${productName}" is very similar to existing product "${fuzzyMatch.name}"`,
            existingProduct: {
              id: fuzzyMatch.id,
              name: fuzzyMatch.name,
              price: fuzzyMatch.price,
              seller_id: fuzzyMatch.seller_id,
            },
          },
        });
        continue;
      }

      // No duplicate found
      results.push({
        name: productName,
        duplicate: {
          isDuplicate: false,
        },
      });
    }

    return NextResponse.json({
      results,
    });
  } catch (error: any) {
    console.error('Error checking for duplicates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check for duplicates' },
      { status: 500 }
    );
  }
}

/**
 * Calculate similarity between two strings
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }

  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));
  const totalWords = Math.max(words1.length, words2.length);

  return commonWords.length / totalWords;
}


