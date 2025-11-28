/**
 * AI Categorization API Route
 * 
 * Accepts products, returns category suggestions with batch categorization support.
 * 
 * Requirements: 2.1, 2.2, 2.8
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  batchCategorize, 
  suggestCategories,
  prepareNewSubcategory,
  type Category,
  type Subcategory,
  type CategorizedProduct,
  type CategorySuggestion,
  type SubcategorySuggestion,
} from '@/lib/aiCategorizationService';
import type { AIExtractedProduct } from '@/lib/aiExtractionService';

// ============================================================================
// Types
// ============================================================================

export interface ProductForCategorization {
  name: string;
  price?: number;
  quantity?: number;
  unit?: string;
  brand?: string;
  confidence?: {
    name: number;
    price: number;
    quantity: number;
    brand: number;
    overall: number;
  };
  needsReview?: boolean;
}

export interface AICategorizeRequest {
  products: ProductForCategorization[];
  batch?: boolean; // If true, categorize all products at once
}

export interface SingleCategorizeResponse {
  categorySuggestions: CategorySuggestion[];
  subcategorySuggestions: SubcategorySuggestion[];
}

export interface AICategorizeResponse {
  success: boolean;
  data?: {
    products: CategorizedProduct[];
    categories: Category[];
    subcategories: Subcategory[];
  };
  error?: string;
}

export interface AddSubcategoryRequest {
  name: string;
  categoryId: string;
}

export interface AddSubcategoryResponse {
  success: boolean;
  data?: Subcategory;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert ProductForCategorization to AIExtractedProduct
 */
function toAIExtractedProduct(product: ProductForCategorization): AIExtractedProduct {
  return {
    name: product.name,
    price: product.price ?? 0,
    quantity: product.quantity ?? 1,
    unit: product.unit,
    brand: product.brand,
    confidence: product.confidence ?? {
      name: 0.8,
      price: product.price ? 0.8 : 0.3,
      quantity: product.quantity ? 0.8 : 0.5,
      brand: product.brand ? 0.8 : 0,
      overall: 0.6,
    },
    needsReview: product.needsReview ?? true,
  };
}

/**
 * Fetch categories from database
 */
async function fetchCategories(): Promise<Category[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not configured');
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error connecting to database:', error);
    return [];
  }
}

/**
 * Fetch subcategories from database
 */
async function fetchSubcategories(): Promise<Subcategory[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not configured');
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('subcategories')
      .select('id, category_id, name, slug')
      .order('name');

    if (error) {
      console.error('Error fetching subcategories:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error connecting to database:', error);
    return [];
  }
}

/**
 * Add a new subcategory to the database
 * Requirements: 2.6, 2.7
 */
async function addSubcategory(name: string, categoryId: string, existingSubcategories: Subcategory[]): Promise<Subcategory | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not configured');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Prepare new subcategory data with unique slug
    const newSubcategoryData = prepareNewSubcategory(name, categoryId, existingSubcategories);

    const { data, error } = await supabase
      .from('subcategories')
      .insert({
        name: newSubcategoryData.name,
        slug: newSubcategoryData.slug,
        category_id: newSubcategoryData.category_id,
      })
      .select('id, category_id, name, slug')
      .single();

    if (error) {
      console.error('Error adding subcategory:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return null;
  }
}

// ============================================================================
// API Routes
// ============================================================================

/**
 * POST /api/admin/ai-categorize
 * 
 * Categorize products using AI
 * 
 * Request body:
 * - products: Array of products to categorize
 * - batch: boolean (optional) - If true, categorize all products at once
 * 
 * Response:
 * - success: boolean
 * - data: Object with categorized products and available categories/subcategories
 * - error: string (if failed)
 */
export async function POST(request: NextRequest): Promise<NextResponse<AICategorizeResponse | AddSubcategoryResponse>> {
  try {
    const body = await request.json();

    // Check if this is an add subcategory request
    if (body.action === 'add-subcategory') {
      return handleAddSubcategory(body as AddSubcategoryRequest);
    }

    // Handle categorization request
    const categorizeRequest = body as AICategorizeRequest;

    if (!categorizeRequest.products || !Array.isArray(categorizeRequest.products)) {
      return NextResponse.json(
        { success: false, error: 'Products array is required' },
        { status: 400 }
      );
    }

    if (categorizeRequest.products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one product is required' },
        { status: 400 }
      );
    }

    // Validate products have names
    const invalidProducts = categorizeRequest.products.filter(p => !p.name || p.name.trim() === '');
    if (invalidProducts.length > 0) {
      return NextResponse.json(
        { success: false, error: 'All products must have a name' },
        { status: 400 }
      );
    }

    // Fetch categories and subcategories from database
    const [categories, subcategories] = await Promise.all([
      fetchCategories(),
      fetchSubcategories(),
    ]);

    if (categories.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No categories found in database' },
        { status: 500 }
      );
    }

    // Convert products to AIExtractedProduct format
    const aiProducts = categorizeRequest.products.map(toAIExtractedProduct);

    // Categorize products (Requirements 2.1, 2.2, 2.8)
    let categorizedProducts: CategorizedProduct[];

    if (categorizeRequest.batch !== false && aiProducts.length > 1) {
      // Batch categorization for multiple products
      categorizedProducts = await batchCategorize(aiProducts, categories, subcategories);
    } else {
      // Single product categorization
      categorizedProducts = await Promise.all(
        aiProducts.map(async (product) => {
          const suggestions = await suggestCategories(product, categories, subcategories);
          return {
            ...product,
            categorySuggestions: suggestions.categorySuggestions,
            subcategorySuggestions: suggestions.subcategorySuggestions,
            selectedCategory: suggestions.categorySuggestions[0]?.category.name,
            selectedSubcategory: suggestions.subcategorySuggestions[0]?.subcategory?.name,
          };
        })
      );
    }

    // Auto-create new subcategories if suggested by AI (Requirements 2.5, 2.6, 2.7)
    let updatedSubcategories = [...subcategories];
    const newSubcategoriesCreated: Subcategory[] = [];
    
    for (const product of categorizedProducts) {
      const topSubcatSuggestion = product.subcategorySuggestions?.[0];
      const topCatSuggestion = product.categorySuggestions?.[0];
      
      // If AI suggested a new subcategory with high confidence, create it
      if (topSubcatSuggestion?.isNew && 
          topSubcatSuggestion.suggestedName && 
          topSubcatSuggestion.confidence >= 0.7 &&
          topCatSuggestion?.category) {
        
        const categoryId = topCatSuggestion.category.id;
        const suggestedName = topSubcatSuggestion.suggestedName;
        
        // Check if we already created this subcategory in this batch
        const alreadyCreated = newSubcategoriesCreated.find(
          s => s.category_id === categoryId && 
               s.name.toLowerCase() === suggestedName.toLowerCase()
        );
        
        if (!alreadyCreated) {
          // Check if it exists in the database
          const existsInDb = updatedSubcategories.find(
            s => s.category_id === categoryId && 
                 s.name.toLowerCase() === suggestedName.toLowerCase()
          );
          
          if (!existsInDb) {
            // Create the new subcategory
            const newSubcat = await addSubcategory(suggestedName, categoryId, updatedSubcategories);
            if (newSubcat) {
              newSubcategoriesCreated.push(newSubcat);
              updatedSubcategories.push(newSubcat);
              console.log(`Created new subcategory: ${newSubcat.name} in category ${categoryId}`);
              
              // Update the product's selected subcategory
              product.selectedSubcategory = newSubcat.name;
              product.subcategory = newSubcat.name;
            }
          } else {
            // Use existing subcategory
            product.selectedSubcategory = existsInDb.name;
            product.subcategory = existsInDb.name;
          }
        } else {
          // Use the one we already created
          product.selectedSubcategory = alreadyCreated.name;
          product.subcategory = alreadyCreated.name;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        products: categorizedProducts,
        categories,
        subcategories: updatedSubcategories,
        newSubcategoriesCreated: newSubcategoriesCreated.length > 0 ? newSubcategoriesCreated : undefined,
      },
    });

  } catch (error) {
    console.error('Error in AI categorization API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Handle add subcategory request
 * Requirements: 2.6, 2.7
 */
async function handleAddSubcategory(body: AddSubcategoryRequest): Promise<NextResponse<AddSubcategoryResponse>> {
  if (!body.name || body.name.trim() === '') {
    return NextResponse.json(
      { success: false, error: 'Subcategory name is required' },
      { status: 400 }
    );
  }

  if (!body.categoryId) {
    return NextResponse.json(
      { success: false, error: 'Category ID is required' },
      { status: 400 }
    );
  }

  // Fetch existing subcategories to ensure unique slug
  const existingSubcategories = await fetchSubcategories();

  // Add new subcategory
  const newSubcategory = await addSubcategory(body.name, body.categoryId, existingSubcategories);

  if (!newSubcategory) {
    return NextResponse.json(
      { success: false, error: 'Failed to add subcategory' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: newSubcategory,
  });
}

/**
 * GET /api/admin/ai-categorize
 * 
 * Get available categories and subcategories
 */
export async function GET(): Promise<NextResponse> {
  try {
    const [categories, subcategories] = await Promise.all([
      fetchCategories(),
      fetchSubcategories(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        categories,
        subcategories,
      },
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
