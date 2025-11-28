import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

/**
 * Check if a product with the same name already exists for a seller
 * POST /api/admin/products/check-duplicate
 */
export async function POST(request: NextRequest) {
  try {
    const { name, seller_id } = await request.json();

    if (!name || !seller_id) {
      return NextResponse.json(
        { error: 'Product name and seller_id are required' },
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
    const normalizedName = name.toLowerCase().trim();

    // Check for exact match (case-insensitive)
    const exactMatch = existingProducts.find((p: any) => 
      p.name.toLowerCase().trim() === normalizedName
    );

    if (exactMatch) {
      return NextResponse.json({
        isDuplicate: true,
        reason: `Product "${name}" already exists for this seller`,
        existingProduct: {
          id: exactMatch.id,
          name: exactMatch.name,
          price: exactMatch.price,
          seller_id: exactMatch.seller_id,
        },
      });
    }

    // Check for fuzzy match (similar names)
    const fuzzyMatch = existingProducts.find((p: any) => {
      const existingName = p.name.toLowerCase().trim();
      // Check if names are very similar (one contains the other or vice versa)
      if (normalizedName.length > 3 && existingName.length > 3) {
        const similarity = calculateSimilarity(normalizedName, existingName);
        return similarity > 0.85; // 85% similarity threshold
      }
      return false;
    });

    if (fuzzyMatch) {
      return NextResponse.json({
        isDuplicate: true,
        reason: `Product "${name}" is very similar to existing product "${fuzzyMatch.name}"`,
        existingProduct: {
          id: fuzzyMatch.id,
          name: fuzzyMatch.name,
          price: fuzzyMatch.price,
          seller_id: fuzzyMatch.seller_id,
        },
      });
    }

    return NextResponse.json({
      isDuplicate: false,
    });
  } catch (error: any) {
    console.error('Error checking for duplicate:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check for duplicates' },
      { status: 500 }
    );
  }
}

/**
 * Calculate similarity between two strings (simple Levenshtein-based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  // Check if one string contains the other
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }

  // Simple word-based similarity
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));
  const totalWords = Math.max(words1.length, words2.length);

  return commonWords.length / totalWords;
}


