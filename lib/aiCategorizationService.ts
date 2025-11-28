/**
 * AI Categorization Service
 * 
 * Implements automated category and subcategory tagging using AWS Bedrock AI.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 */

import { invokeModel, parseBedrockJSON, validateBedrockConfig } from './awsBedrock';
import type { AIExtractedProduct } from './aiExtractionService';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
}

export interface CategorySuggestion {
  category: Category;
  confidence: number;
  reason: string;
}

export interface SubcategorySuggestion {
  subcategory?: Subcategory;
  suggestedName?: string;
  isNew: boolean;
  confidence: number;
  reason: string;
}

export interface CategorizedProduct extends AIExtractedProduct {
  categorySuggestions: CategorySuggestion[];
  subcategorySuggestions: SubcategorySuggestion[];
  selectedCategory?: string;
  selectedSubcategory?: string;
}

// AI response structure for category suggestions
interface AICategoryResponse {
  categorizations: Array<{
    productName: string;
    categories: Array<{
      name: string;
      confidence: number;
      reason: string;
    }>;
    subcategories: Array<{
      name: string;
      isNew: boolean;
      confidence: number;
      reason: string;
    }>;
  }>;
}


// ============================================================================
// Constants
// ============================================================================

const CATEGORY_CONFIDENCE_THRESHOLD = 0.7;
const MAX_CATEGORY_SUGGESTIONS = 3;

// ============================================================================
// Prompt Templates
// ============================================================================

const CATEGORY_SUGGESTION_PROMPT = `
You are a product categorization assistant for an Indian FMCG/grocery store. Categorize each product into the most appropriate category and subcategory.

Available categories: {categories}
Available subcategories by category: {subcategories}

IMPORTANT RULES:
1. Match products to the MOST SPECIFIC subcategory available
2. If no existing subcategory fits well, suggest a NEW subcategory name (set isNew: true)
3. Common product types and their categories:
   - Biscuits, Cookies, Wafers → Food/Snacks > Biscuits
   - Cereals (Chocos, Cornflakes) → Food > Breakfast Cereals
   - Soaps (Lux, Dove, Lifebuoy) → Personal Care > Soaps/Bath
   - Detergents, Cleaners → Home Care > Cleaning
   - Dairy (Milk, Cream, Ghee) → Dairy > specific type
   - Noodles, Pasta → Food > Instant Food
   - Air Fresheners (Aer) → Home Care > Air Fresheners
   - Adhesives (M-Seal) → Hardware > Adhesives
   - Antiseptics (Dettol) → Personal Care > Health & Hygiene
   - Hair Dye → Personal Care > Hair Care

For each product, provide:
- The best matching category name (from available categories)
- The best matching subcategory name (existing or new)
- Whether the subcategory is new (isNew: true/false)
- Confidence score (0-1)

Products to categorize:
{products}

Respond with only valid JSON:
{
  "categorizations": [
    {
      "productName": "...",
      "categories": [
        {"name": "...", "confidence": 0.9, "reason": "..."}
      ],
      "subcategories": [
        {"name": "...", "isNew": false, "confidence": 0.85, "reason": "..."}
      ]
    }
  ]
}

CRITICAL: Return categorization for EVERY product in the input list. Do not skip any products.
`;

// ============================================================================
// Slug Generation
// ============================================================================

/**
 * Generate a URL-friendly slug from a name
 * Requirements: 2.7
 * 
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 * - Trims hyphens from start and end
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace consecutive hyphens with single hyphen
    .replace(/^-|-$/g, '');        // Trim hyphens from start and end
}

/**
 * Check if a slug is unique within a category's subcategories
 * Requirements: 2.7
 */
export function isSlugUnique(slug: string, existingSubcategories: Subcategory[], categoryId: string): boolean {
  return !existingSubcategories.some(
    (sub) => sub.category_id === categoryId && sub.slug === slug
  );
}

/**
 * Generate a unique slug for a new subcategory
 * Requirements: 2.7
 */
export function generateUniqueSlug(
  name: string,
  existingSubcategories: Subcategory[],
  categoryId: string
): string {
  let baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;

  while (!isSlugUnique(slug, existingSubcategories, categoryId)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}


// ============================================================================
// Category Matching Functions
// ============================================================================

/**
 * Find a category by name (case-insensitive)
 */
export function findCategoryByName(name: string, categories: Category[]): Category | undefined {
  const normalizedName = name.toLowerCase().trim();
  return categories.find((cat) => cat.name.toLowerCase().trim() === normalizedName);
}

/**
 * Find a subcategory by name within a category (case-insensitive)
 */
export function findSubcategoryByName(
  name: string,
  categoryId: string,
  subcategories: Subcategory[]
): Subcategory | undefined {
  const normalizedName = name.toLowerCase().trim();
  return subcategories.find(
    (sub) =>
      sub.category_id === categoryId &&
      sub.name.toLowerCase().trim() === normalizedName
  );
}

/**
 * Get subcategories for a specific category
 */
export function getSubcategoriesForCategory(
  categoryId: string,
  subcategories: Subcategory[]
): Subcategory[] {
  return subcategories.filter((sub) => sub.category_id === categoryId);
}

// ============================================================================
// AI Categorization Functions
// ============================================================================

/**
 * Suggest categories for a single product using rule-based matching first, then AI
 * Requirements: 2.1, 2.2, 2.8
 */
export async function suggestCategories(
  product: AIExtractedProduct,
  categories: Category[],
  subcategories: Subcategory[]
): Promise<{
  categorySuggestions: CategorySuggestion[];
  subcategorySuggestions: SubcategorySuggestion[];
}> {
  // Try rule-based matching first
  const { getCategoryForProduct } = await import('./productCategoryMapping');
  const ruleMatch = getCategoryForProduct(product.name);
  
  if (ruleMatch && ruleMatch.confidence >= 0.7) {
    // Find matching category and subcategory in database
    const matchedCategory = categories.find(c => 
      c.name.toLowerCase() === ruleMatch.category.toLowerCase()
    );
    
    if (matchedCategory) {
      const matchedSubcategory = subcategories.find(s => 
        s.category_id === matchedCategory.id &&
        s.name.toLowerCase() === ruleMatch.subcategory.toLowerCase()
      );
      
      const categorySuggestions: CategorySuggestion[] = [{
        category: matchedCategory,
        confidence: ruleMatch.confidence,
        reason: 'Rule-based match'
      }];
      
      const subcategorySuggestions: SubcategorySuggestion[] = matchedSubcategory ? [{
        subcategory: matchedSubcategory,
        isNew: false,
        confidence: ruleMatch.confidence,
        reason: 'Rule-based match'
      }] : [{
        suggestedName: ruleMatch.subcategory,
        isNew: true,
        confidence: ruleMatch.confidence,
        reason: 'Rule-based match - new subcategory'
      }];
      
      return { categorySuggestions, subcategorySuggestions };
    }
  }
  
  // Fall back to AI if rule-based matching didn't work
  const subcategoriesMap: Record<string, string[]> = {};
  for (const cat of categories) {
    const subs = getSubcategoriesForCategory(cat.id, subcategories);
    subcategoriesMap[cat.name] = subs.map((s) => s.name);
  }

  const result = await suggestCategoriesWithAI(
    [product.name],
    categories,
    subcategoriesMap
  );

  if (!result.success || !result.categorizations || result.categorizations.length === 0) {
    return {
      categorySuggestions: [],
      subcategorySuggestions: [],
    };
  }

  const categorization = result.categorizations[0];
  return processCategorization(categorization, categories, subcategories);
}

/**
 * Process AI categorization response into typed suggestions
 */
function processCategorization(
  categorization: AICategoryResponse['categorizations'][0],
  categories: Category[],
  subcategories: Subcategory[]
): {
  categorySuggestions: CategorySuggestion[];
  subcategorySuggestions: SubcategorySuggestion[];
} {
  // Process category suggestions
  const categorySuggestions: CategorySuggestion[] = categorization.categories
    .map((catSuggestion) => {
      const category = findCategoryByName(catSuggestion.name, categories);
      if (!category) return null;
      return {
        category,
        confidence: Math.min(1, Math.max(0, catSuggestion.confidence)),
        reason: catSuggestion.reason,
      };
    })
    .filter((s): s is CategorySuggestion => s !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_CATEGORY_SUGGESTIONS);

  // Process subcategory suggestions
  const topCategory = categorySuggestions[0]?.category;
  const subcategorySuggestions: SubcategorySuggestion[] = categorization.subcategories
    .map((subSuggestion) => {
      if (subSuggestion.isNew) {
        return {
          suggestedName: subSuggestion.name,
          isNew: true,
          confidence: Math.min(1, Math.max(0, subSuggestion.confidence)),
          reason: subSuggestion.reason,
        };
      }

      // Try to find existing subcategory
      const subcategory = topCategory
        ? findSubcategoryByName(subSuggestion.name, topCategory.id, subcategories)
        : undefined;

      if (subcategory) {
        return {
          subcategory,
          isNew: false,
          confidence: Math.min(1, Math.max(0, subSuggestion.confidence)),
          reason: subSuggestion.reason,
        };
      }

      // Subcategory not found, treat as new suggestion
      return {
        suggestedName: subSuggestion.name,
        isNew: true,
        confidence: Math.min(1, Math.max(0, subSuggestion.confidence)),
        reason: subSuggestion.reason,
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_CATEGORY_SUGGESTIONS);

  return { categorySuggestions, subcategorySuggestions };
}


/**
 * Call AWS Bedrock to get category suggestions
 * Requirements: 2.1, 2.2
 */
async function suggestCategoriesWithAI(
  productNames: string[],
  categories: Category[],
  subcategoriesMap: Record<string, string[]>
): Promise<{
  success: boolean;
  categorizations?: AICategoryResponse['categorizations'];
  error?: string;
}> {
  if (!validateBedrockConfig()) {
    return {
      success: false,
      error: 'AWS Bedrock is not configured. Please check your AWS credentials.',
    };
  }

  const categoryNames = categories.map((c) => c.name).join(', ');
  const subcategoriesStr = Object.entries(subcategoriesMap)
    .map(([cat, subs]) => `${cat}: ${subs.join(', ') || 'None'}`)
    .join('\n');

  const prompt = CATEGORY_SUGGESTION_PROMPT
    .replace('{categories}', categoryNames || 'None')
    .replace('{subcategories}', subcategoriesStr || 'None')
    .replace('{products}', productNames.join('\n'));

  const response = await invokeModel(prompt);

  if (!response.success) {
    return {
      success: false,
      error: response.error || 'Failed to invoke Bedrock model',
    };
  }

  const parsed = parseBedrockJSON<AICategoryResponse>(response.content);
  if (!parsed || !parsed.categorizations) {
    return {
      success: false,
      error: 'Failed to parse AI response as JSON',
    };
  }

  return {
    success: true,
    categorizations: parsed.categorizations,
  };
}

// ============================================================================
// Auto-Population Functions
// Requirements: 2.3, 2.4
// ============================================================================

/**
 * Auto-populate category for a product based on AI suggestions
 * Requirements: 2.3
 * 
 * Auto-populates when confidence >= 0.7
 */
export function autoPopulateCategory(
  categorySuggestions: CategorySuggestion[]
): string | undefined {
  if (categorySuggestions.length === 0) {
    return undefined;
  }

  const topSuggestion = categorySuggestions[0];
  if (topSuggestion.confidence >= CATEGORY_CONFIDENCE_THRESHOLD) {
    return topSuggestion.category.name;
  }

  return undefined;
}

/**
 * Auto-populate subcategory for a product based on AI suggestions
 * Requirements: 2.4
 * 
 * Auto-populates when a matching subcategory is found with confidence >= 0.7
 */
export function autoPopulateSubcategory(
  subcategorySuggestions: SubcategorySuggestion[]
): string | undefined {
  if (subcategorySuggestions.length === 0) {
    return undefined;
  }

  const topSuggestion = subcategorySuggestions[0];
  
  // Only auto-populate if it's an existing subcategory with high confidence
  if (
    !topSuggestion.isNew &&
    topSuggestion.subcategory &&
    topSuggestion.confidence >= CATEGORY_CONFIDENCE_THRESHOLD
  ) {
    return topSuggestion.subcategory.name;
  }

  return undefined;
}

/**
 * Apply auto-population to a categorized product
 * Requirements: 2.3, 2.4
 */
export function applyAutoPopulation(
  product: AIExtractedProduct,
  categorySuggestions: CategorySuggestion[],
  subcategorySuggestions: SubcategorySuggestion[]
): CategorizedProduct {
  const selectedCategory = autoPopulateCategory(categorySuggestions);
  const selectedSubcategory = autoPopulateSubcategory(subcategorySuggestions);

  return {
    ...product,
    categorySuggestions,
    subcategorySuggestions,
    selectedCategory,
    selectedSubcategory,
    category: selectedCategory || product.category,
    subcategory: selectedSubcategory || product.subcategory,
  };
}


// ============================================================================
// Batch Categorization
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.8
// ============================================================================

/**
 * Batch categorize multiple products using rule-based matching first, then AI
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.8
 */
export async function batchCategorize(
  products: AIExtractedProduct[],
  categories: Category[],
  subcategories: Subcategory[]
): Promise<CategorizedProduct[]> {
  if (products.length === 0) {
    return [];
  }

  // Try rule-based matching for all products first
  const { batchCategorizeWithRules } = await import('./productCategoryMapping');
  const ruleResults = batchCategorizeWithRules(products.map(p => p.name));
  
  const categorizedProducts: CategorizedProduct[] = [];
  const productsNeedingAI: AIExtractedProduct[] = [];
  const productsNeedingAIIndices: number[] = [];
  
  // Process rule-based results
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const ruleResult = ruleResults[i];
    
    if (ruleResult.confidence >= 0.7 && ruleResult.category) {
      // Find matching category and subcategory in database
      const matchedCategory = categories.find(c => 
        c.name.toLowerCase() === ruleResult.category.toLowerCase()
      );
      
      if (matchedCategory) {
        const matchedSubcategory = subcategories.find(s => 
          s.category_id === matchedCategory.id &&
          s.name.toLowerCase() === ruleResult.subcategory.toLowerCase()
        );
        
        const categorySuggestions: CategorySuggestion[] = [{
          category: matchedCategory,
          confidence: ruleResult.confidence,
          reason: 'Rule-based match'
        }];
        
        const subcategorySuggestions: SubcategorySuggestion[] = matchedSubcategory ? [{
          subcategory: matchedSubcategory,
          isNew: false,
          confidence: ruleResult.confidence,
          reason: 'Rule-based match'
        }] : [{
          suggestedName: ruleResult.subcategory,
          isNew: true,
          confidence: ruleResult.confidence,
          reason: 'Rule-based match - new subcategory'
        }];
        
        categorizedProducts[i] = applyAutoPopulation(product, categorySuggestions, subcategorySuggestions);
        continue;
      }
    }
    
    // Product needs AI categorization
    productsNeedingAI.push(product);
    productsNeedingAIIndices.push(i);
  }
  
  // Use AI for products that didn't match rules
  if (productsNeedingAI.length > 0) {
    console.log(`Using AI for ${productsNeedingAI.length} products that didn't match rules`);
    
    const subcategoriesMap: Record<string, string[]> = {};
    for (const cat of categories) {
      const subs = getSubcategoriesForCategory(cat.id, subcategories);
      subcategoriesMap[cat.name] = subs.map((s) => s.name);
    }

    const productNames = productsNeedingAI.map((p) => p.name);
    const result = await suggestCategoriesWithAI(productNames, categories, subcategoriesMap);

    if (result.success && result.categorizations) {
      // Map AI categorizations to products
      for (let i = 0; i < productsNeedingAI.length; i++) {
        const product = productsNeedingAI[i];
        const originalIndex = productsNeedingAIIndices[i];
        
        const categorization = result.categorizations.find(
          (c) => c.productName.toLowerCase() === product.name.toLowerCase()
        ) || result.categorizations[i];

        if (categorization) {
          const { categorySuggestions, subcategorySuggestions } = processCategorization(
            categorization,
            categories,
            subcategories
          );

          categorizedProducts[originalIndex] = applyAutoPopulation(product, categorySuggestions, subcategorySuggestions);
        } else {
          categorizedProducts[originalIndex] = {
            ...product,
            categorySuggestions: [],
            subcategorySuggestions: [],
          };
        }
      }
    } else {
      // AI failed, return products without categorization
      for (let i = 0; i < productsNeedingAI.length; i++) {
        const product = productsNeedingAI[i];
        const originalIndex = productsNeedingAIIndices[i];
        categorizedProducts[originalIndex] = {
          ...product,
          categorySuggestions: [],
          subcategorySuggestions: [],
        };
      }
    }
  }
  
  return categorizedProducts;
}

// ============================================================================
// New Subcategory Creation
// Requirements: 2.5, 2.6, 2.7
// ============================================================================

export interface NewSubcategoryData {
  name: string;
  slug: string;
  category_id: string;
}

/**
 * Prepare data for creating a new subcategory
 * Requirements: 2.5, 2.6, 2.7
 */
export function prepareNewSubcategory(
  suggestedName: string,
  categoryId: string,
  existingSubcategories: Subcategory[]
): NewSubcategoryData {
  const slug = generateUniqueSlug(suggestedName, existingSubcategories, categoryId);
  
  return {
    name: suggestedName.trim(),
    slug,
    category_id: categoryId,
  };
}

/**
 * Check if a subcategory suggestion is for a new subcategory
 * Requirements: 2.5
 */
export function isNewSubcategorySuggestion(suggestion: SubcategorySuggestion): boolean {
  return suggestion.isNew && !!suggestion.suggestedName;
}

/**
 * Get all new subcategory suggestions from a list
 * Requirements: 2.5
 */
export function getNewSubcategorySuggestions(
  suggestions: SubcategorySuggestion[]
): SubcategorySuggestion[] {
  return suggestions.filter(isNewSubcategorySuggestion);
}

// ============================================================================
// Exports
// ============================================================================

export const CATEGORY_CONFIDENCE_THRESHOLD_EXPORT = CATEGORY_CONFIDENCE_THRESHOLD;
export const MAX_CATEGORY_SUGGESTIONS_EXPORT = MAX_CATEGORY_SUGGESTIONS;

export default {
  suggestCategories,
  batchCategorize,
  autoPopulateCategory,
  autoPopulateSubcategory,
  applyAutoPopulation,
  generateSlug,
  generateUniqueSlug,
  isSlugUnique,
  findCategoryByName,
  findSubcategoryByName,
  getSubcategoriesForCategory,
  prepareNewSubcategory,
  isNewSubcategorySuggestion,
  getNewSubcategorySuggestions,
  CATEGORY_CONFIDENCE_THRESHOLD,
  MAX_CATEGORY_SUGGESTIONS,
};
