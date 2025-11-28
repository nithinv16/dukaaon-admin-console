/**
 * AI Brand Identification API Route
 * 
 * Accepts product names, returns brand identifications with batch processing support.
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { identifyBrands, validateBedrockConfig, parseBedrockJSON } from '@/lib/awsBedrock';

// ============================================================================
// Types
// ============================================================================

export interface ProductForBrandIdentification {
  id?: string;
  name: string;
}

export interface AIBrandRequest {
  products: ProductForBrandIdentification[];
}

export interface BrandIdentificationResult {
  productId?: string;
  productName: string;
  identifiedBrand?: string;
  confidence: number;
  isExistingBrand: boolean;
  alternatives: string[];
  needsReview: boolean;
}

export interface AIBrandResponse {
  success: boolean;
  data?: {
    results: BrandIdentificationResult[];
    existingBrands: string[];
  };
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const BRAND_CONFIDENCE_THRESHOLD = 0.6;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch existing brands from master_products table
 * Requirements: 4.4
 */
async function fetchExistingBrands(): Promise<string[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not configured');
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get distinct brands from master_products
    const { data, error } = await supabase
      .from('master_products')
      .select('brand')
      .not('brand', 'is', null)
      .not('brand', 'eq', '');

    if (error) {
      console.error('Error fetching brands:', error);
      return [];
    }

    // Extract unique brand names
    const brands = new Set<string>();
    for (const row of data || []) {
      if (row.brand && row.brand.trim()) {
        brands.add(row.brand.trim());
      }
    }

    return Array.from(brands).sort();
  } catch (error) {
    console.error('Error connecting to database:', error);
    return [];
  }
}

/**
 * Check if a brand exists in the existing brands list (case-insensitive)
 */
function findExistingBrand(brandName: string, existingBrands: string[]): string | undefined {
  const normalizedBrand = brandName.toLowerCase().trim();
  return existingBrands.find(b => b.toLowerCase().trim() === normalizedBrand);
}

/**
 * Process brand identification results
 * Requirements: 4.3, 4.4, 4.6
 */
function processBrandResults(
  products: ProductForBrandIdentification[],
  aiResults: Array<{
    productName: string;
    brand: string;
    confidence: number;
    isExisting: boolean;
  }>,
  existingBrands: string[]
): BrandIdentificationResult[] {
  return products.map((product, index) => {
    // Find matching AI result
    const aiResult = aiResults.find(
      r => r.productName.toLowerCase() === product.name.toLowerCase()
    ) || aiResults[index];

    if (!aiResult) {
      return {
        productId: product.id,
        productName: product.name,
        identifiedBrand: undefined,
        confidence: 0,
        isExistingBrand: false,
        alternatives: [],
        needsReview: true,
      };
    }

    // Check if brand exists in database (use existing format if found)
    const existingBrand = findExistingBrand(aiResult.brand, existingBrands);
    const brandToUse = existingBrand || aiResult.brand;
    const isExisting = !!existingBrand;

    // Apply confidence threshold (Requirement 4.6)
    const meetsThreshold = aiResult.confidence >= BRAND_CONFIDENCE_THRESHOLD;

    return {
      productId: product.id,
      productName: product.name,
      identifiedBrand: meetsThreshold ? brandToUse : undefined,
      confidence: aiResult.confidence,
      isExistingBrand: isExisting,
      alternatives: [], // Could be populated with similar brands
      needsReview: !meetsThreshold || !isExisting,
    };
  });
}

// ============================================================================
// API Routes
// ============================================================================

/**
 * POST /api/admin/ai-brand
 * 
 * Identify brands from product names using AI
 * 
 * Request body:
 * - products: Array of products with names to identify brands for
 * 
 * Response:
 * - success: boolean
 * - data: Object with brand identification results and existing brands
 * - error: string (if failed)
 */
export async function POST(request: NextRequest): Promise<NextResponse<AIBrandResponse>> {
  try {
    const body = await request.json() as AIBrandRequest;

    if (!body.products || !Array.isArray(body.products)) {
      return NextResponse.json(
        { success: false, error: 'Products array is required' },
        { status: 400 }
      );
    }

    if (body.products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one product is required' },
        { status: 400 }
      );
    }

    // Validate products have names
    const invalidProducts = body.products.filter(p => !p.name || p.name.trim() === '');
    if (invalidProducts.length > 0) {
      return NextResponse.json(
        { success: false, error: 'All products must have a name' },
        { status: 400 }
      );
    }

    // Check if Bedrock is configured
    if (!validateBedrockConfig()) {
      return NextResponse.json(
        { success: false, error: 'AWS Bedrock is not configured. Please check your AWS credentials.' },
        { status: 500 }
      );
    }

    // Fetch existing brands from database (Requirement 4.4)
    const existingBrands = await fetchExistingBrands();

    // Extract product names for AI processing
    const productNames = body.products.map(p => p.name);

    // Identify brands using AI (Requirements 4.1, 4.2)
    const aiResponse = await identifyBrands(productNames, existingBrands);

    if (!aiResponse.success) {
      return NextResponse.json(
        { success: false, error: aiResponse.error || 'Failed to identify brands' },
        { status: 500 }
      );
    }

    // Parse AI response
    const parsedResponse = aiResponse.parsed;
    if (!parsedResponse || !parsedResponse.brands) {
      return NextResponse.json(
        { success: false, error: 'Invalid AI response format' },
        { status: 500 }
      );
    }

    // Process results (Requirements 4.3, 4.4, 4.6)
    const results = processBrandResults(body.products, parsedResponse.brands, existingBrands);

    return NextResponse.json({
      success: true,
      data: {
        results,
        existingBrands,
      },
    });

  } catch (error) {
    console.error('Error in AI brand identification API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/ai-brand
 * 
 * Get list of existing brands in the system
 */
export async function GET(): Promise<NextResponse> {
  try {
    const existingBrands = await fetchExistingBrands();

    return NextResponse.json({
      success: true,
      data: {
        brands: existingBrands,
        count: existingBrands.length,
      },
    });

  } catch (error) {
    console.error('Error fetching brands:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
