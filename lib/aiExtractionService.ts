/**
 * AI Extraction Service
 * 
 * Implements AI-enhanced text extraction from product images using AWS Textract OCR
 * combined with AWS Bedrock AI models for intelligent parsing.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 3.1, 3.2, 3.4, 3.5, 3.6, 3.7
 */

import { extractTextFromImageAWS, analyzeReceiptStructureAWS, parseReceiptTextAWS } from './awsTextract';
import { invokeModel, parseBedrockJSON, validateBedrockConfig } from './awsBedrock';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type ImageType = 'receipt' | 'product_list' | 'name_only_list' | 'invoice' | 'unknown';

export interface FieldConfidence {
  name: number;
  price: number;
  quantity: number;
  brand: number;
  overall: number;
}

export interface MasterProductMatch {
  id: string;
  name: string;
  price: number;
  description: string;
  brand: string;
  matchConfidence: number;
}

export interface AIExtractedProduct {
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  confidence: FieldConfidence;
  needsReview: boolean;
  masterProductMatch?: MasterProductMatch;
}

export interface AIExtractionResult {
  success: boolean;
  products: AIExtractedProduct[];
  imageType: ImageType;
  rawText: string;
  confidence: number;
  usedFallback: boolean;
  error?: string;
}


// AI response structure from Bedrock
interface AIParsingResponse {
  imageType: ImageType;
  products: Array<{
    name: string;
    price: number;
    quantity: number;
    unit?: string;
    confidence: number;
  }>;
}

// ============================================================================
// Prompt Templates
// ============================================================================

const PRODUCT_PARSING_PROMPT = `
You are a product data extraction assistant specializing in parsing handwritten and printed product lists. Parse the following text extracted from an image and identify products.

IMPORTANT INSTRUCTIONS:
1. This text may be from a HANDWRITTEN list, so expect OCR errors and misspellings
2. Each line typically represents ONE product - treat each line as a separate product
3. Common Indian/FMCG brands include: Unibic, Malkist, Bournvita, Horlicks, Sunfeast, Parle, Cadbury, Kellogg's, Maggi, Amul, Amulya, Maxo, Dettol, Lux, Chandrika, Vivel, Medimix, Pears, Fiama, Dove, Santoor, Lifebuoy, Britannia, Nestle, HUL, ITC, etc.
4. Fix obvious OCR errors in product names (e.g., "Unibic" not "Unibic", "Kellogg's" not "Kellogg's")
5. If a product has a size/weight mentioned (like "110g", "2kg"), include it in the name

For each product, extract:
- name: The corrected product name (required) - fix spelling errors and format properly
- price: The price as a number (0 if not found - this is common for handwritten lists)
- quantity: The quantity as a number (1 if not found)
- unit: The unit of measurement (pieces, kg, g, l, ml, pack, etc.)
- confidence: Your confidence in the extraction (0-1)

First, determine the image type:
- "receipt": A store receipt with itemized products and prices
- "product_list": A list of products with prices and/or quantities
- "name_only_list": A list containing only product names without prices (MOST COMMON for handwritten lists)
- "invoice": A business invoice with product details
- "unknown": Cannot determine the format

CRITICAL: If the text contains mostly product names without prices (like a shopping list or inventory list), set imageType to "name_only_list" and extract ALL product names with price: 0.

Text to parse:
{rawText}

Respond with only valid JSON in this format:
{
  "imageType": "receipt|product_list|name_only_list|invoice|unknown",
  "products": [
    {"name": "Product Name", "price": 0, "quantity": 1, "unit": "pieces", "confidence": 0.95}
  ]
}
`;

// ============================================================================
// Confidence Threshold Constants
// ============================================================================

const CONFIDENCE_THRESHOLD_REVIEW = 0.7;
const MASTER_PRODUCT_MATCH_THRESHOLD = 0.8;

// ============================================================================
// Name-Only List Processing Types
// ============================================================================

export interface NameOnlyProduct {
  name: string;
  price: number;
  quantity: number;
  unit: string;
  needsUserInput: {
    price: boolean;
    quantity: boolean;
    brand: boolean;
    category: boolean;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate field-level confidence scores for an extracted product
 */
export function calculateFieldConfidence(
  product: { name: string; price: number; quantity: number; unit?: string; confidence: number }
): FieldConfidence {
  const baseConfidence = product.confidence;
  
  // Name confidence: based on length and content
  const nameConfidence = product.name.length > 2 ? baseConfidence : baseConfidence * 0.5;
  
  // Price confidence: higher if price > 0, lower if 0
  const priceConfidence = product.price > 0 ? baseConfidence : baseConfidence * 0.3;
  
  // Quantity confidence: higher if explicitly set
  const quantityConfidence = product.quantity >= 1 ? baseConfidence : baseConfidence * 0.5;
  
  // Brand confidence: starts at 0, will be populated by brand identification service
  const brandConfidence = 0;
  
  // Overall confidence: weighted average
  const overall = (nameConfidence * 0.4 + priceConfidence * 0.3 + quantityConfidence * 0.2 + brandConfidence * 0.1);
  
  return {
    name: Math.min(1, Math.max(0, nameConfidence)),
    price: Math.min(1, Math.max(0, priceConfidence)),
    quantity: Math.min(1, Math.max(0, quantityConfidence)),
    brand: brandConfidence,
    overall: Math.min(1, Math.max(0, overall)),
  };
}

/**
 * Determine if a product needs review based on confidence scores
 */
export function needsReview(confidence: FieldConfidence): boolean {
  return (
    confidence.name < CONFIDENCE_THRESHOLD_REVIEW ||
    confidence.price < CONFIDENCE_THRESHOLD_REVIEW ||
    confidence.quantity < CONFIDENCE_THRESHOLD_REVIEW ||
    confidence.overall < CONFIDENCE_THRESHOLD_REVIEW
  );
}

/**
 * Check if an image type is a name-only list
 * Requirements: 3.1, 3.7
 */
export function isNameOnlyList(imageType: ImageType): boolean {
  return imageType === 'name_only_list';
}

/**
 * Process products from a name-only list by setting default values
 * Requirements: 3.1, 3.2, 3.6
 * 
 * For name-only lists:
 * - Price is set to 0 (needs user input)
 * - Quantity is set to 1 (default)
 * - Fields that need user input are marked
 */
export function processNameOnlyProducts(
  products: Array<{ name: string; confidence: number }>
): NameOnlyProduct[] {
  return products.map((product) => ({
    name: product.name,
    price: 0, // Default price for name-only lists (Requirement 3.2)
    quantity: 1, // Default quantity for name-only lists (Requirement 3.2)
    unit: 'pieces',
    needsUserInput: {
      price: true, // Price needs user input (Requirement 3.6)
      quantity: false, // Quantity has default value
      brand: true, // Brand needs identification
      category: true, // Category needs suggestion
    },
  }));
}

/**
 * Convert name-only products to AIExtractedProduct format
 * Requirements: 3.1, 3.2, 3.6
 */
export function convertNameOnlyToAIExtractedProducts(
  nameOnlyProducts: NameOnlyProduct[]
): AIExtractedProduct[] {
  return nameOnlyProducts.map((product) => {
    // For name-only products, confidence is lower for price since it's a default
    const confidence: FieldConfidence = {
      name: 0.8, // Name was extracted from the image
      price: 0.1, // Price is a default value, very low confidence
      quantity: 0.5, // Quantity is a default value
      brand: 0, // Brand not yet identified
      overall: 0.35, // Low overall confidence due to missing data
    };

    return {
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      unit: product.unit,
      confidence,
      needsReview: true, // Name-only products always need review
    };
  });
}

// ============================================================================
// Master Product Matching
// Requirements: 3.4, 3.5
// ============================================================================

/**
 * Database master product record
 */
export interface MasterProductRecord {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subcategory?: string;
  brand?: string;
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 and 1, where 1 is an exact match
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check if one string contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return minLen / maxLen;
  }

  // Levenshtein distance calculation
  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
}

/**
 * Find the best matching master product for a given product name
 * Requirements: 3.4, 3.5
 */
export function findBestMasterProductMatch(
  productName: string,
  masterProducts: MasterProductRecord[]
): MasterProductMatch | null {
  if (!productName || masterProducts.length === 0) {
    return null;
  }

  let bestMatch: MasterProductMatch | null = null;
  let bestScore = 0;

  for (const masterProduct of masterProducts) {
    const similarity = calculateStringSimilarity(productName, masterProduct.name);
    
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = {
        id: masterProduct.id,
        name: masterProduct.name,
        price: masterProduct.price,
        description: masterProduct.description,
        brand: masterProduct.brand || '',
        matchConfidence: similarity,
      };
    }
  }

  return bestMatch;
}

/**
 * Enrich extracted products with master product data
 * Requirements: 3.4, 3.5
 * 
 * If a match is found with confidence >= 0.8, pre-populate price and description
 */
export function enrichProductsWithMasterData(
  products: AIExtractedProduct[],
  masterProducts: MasterProductRecord[]
): AIExtractedProduct[] {
  return products.map((product) => {
    const match = findBestMasterProductMatch(product.name, masterProducts);

    if (match && match.matchConfidence >= MASTER_PRODUCT_MATCH_THRESHOLD) {
      // Pre-populate price and description from master product (Requirement 3.5)
      return {
        ...product,
        price: match.price,
        brand: match.brand || product.brand,
        masterProductMatch: match,
        confidence: {
          ...product.confidence,
          price: match.matchConfidence, // Higher confidence since we have master data
          brand: match.brand ? match.matchConfidence : product.confidence.brand,
        },
        needsReview: product.confidence.name < CONFIDENCE_THRESHOLD_REVIEW, // May not need review if matched
      };
    }

    // No match or low confidence match - keep original product
    if (match) {
      return {
        ...product,
        masterProductMatch: match, // Still attach the match for reference
      };
    }

    return product;
  });
}

/**
 * Fetch master products from database
 * Requirements: 3.4
 */
export async function fetchMasterProducts(
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<MasterProductRecord[]> {
  const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('Supabase credentials not configured, skipping master product fetch');
    return [];
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('master_products')
      .select('id, name, description, price, category, subcategory, brand')
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching master products:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error connecting to database:', error);
    return [];
  }
}

/**
 * Match extracted products against master products database
 * Requirements: 3.4, 3.5
 */
export async function matchProductsWithMasterData(
  products: AIExtractedProduct[],
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<AIExtractedProduct[]> {
  const masterProducts = await fetchMasterProducts(supabaseUrl, supabaseKey);
  
  if (masterProducts.length === 0) {
    console.log('No master products found, skipping enrichment');
    return products;
  }

  return enrichProductsWithMasterData(products, masterProducts);
}

/**
 * Convert AI parsing response to AIExtractedProduct array
 * Handles both regular products and name-only lists
 * Requirements: 3.1, 3.2, 3.6
 */
export function convertToAIExtractedProducts(
  aiResponse: AIParsingResponse
): AIExtractedProduct[] {
  const isNameOnly = isNameOnlyList(aiResponse.imageType);

  if (isNameOnly) {
    // For name-only lists, use special processing with default values
    const nameOnlyProducts = processNameOnlyProducts(
      aiResponse.products.map((p) => ({ name: p.name, confidence: p.confidence }))
    );
    return convertNameOnlyToAIExtractedProducts(nameOnlyProducts);
  }

  // Regular product processing
  return aiResponse.products.map((product) => {
    const confidence = calculateFieldConfidence(product);
    return {
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      unit: product.unit,
      confidence,
      needsReview: needsReview(confidence),
    };
  });
}


// ============================================================================
// Core Extraction Functions
// ============================================================================

/**
 * Parse raw text using AWS Bedrock AI
 * Requirements: 1.2, 1.3
 */
export async function parseWithAI(rawText: string): Promise<{
  success: boolean;
  response?: AIParsingResponse;
  error?: string;
}> {
  if (!validateBedrockConfig()) {
    return {
      success: false,
      error: 'AWS Bedrock is not configured. Please check your AWS credentials.',
    };
  }

  const prompt = PRODUCT_PARSING_PROMPT.replace('{rawText}', rawText);
  const response = await invokeModel(prompt);

  if (!response.success) {
    return {
      success: false,
      error: response.error || 'Failed to invoke Bedrock model',
    };
  }

  console.log('AI response content:', response.content.substring(0, 1000));
  
  const parsed = parseBedrockJSON<AIParsingResponse>(response.content);
  if (!parsed) {
    console.error('Failed to parse AI response. Raw content:', response.content);
    return {
      success: false,
      error: 'Failed to parse AI response as JSON',
    };
  }

  console.log('Parsed AI response - imageType:', parsed.imageType, 'products count:', parsed.products?.length || 0);

  // Validate and normalize the response
  const normalizedResponse: AIParsingResponse = {
    imageType: parsed.imageType || 'unknown',
    products: (parsed.products || []).map((p) => ({
      name: p.name || '',
      price: typeof p.price === 'number' ? Math.max(0, p.price) : 0,
      quantity: typeof p.quantity === 'number' ? Math.max(1, p.quantity) : 1,
      unit: p.unit,
      confidence: typeof p.confidence === 'number' ? Math.min(1, Math.max(0, p.confidence)) : 0.5,
    })).filter(p => p.name.trim().length > 0), // Filter out empty product names
  };

  console.log('Normalized products:', normalizedResponse.products.length);
  if (normalizedResponse.products.length > 0) {
    console.log('First 3 products:', normalizedResponse.products.slice(0, 3).map(p => p.name));
  }

  return {
    success: true,
    response: normalizedResponse,
  };
}

/**
 * Identify image type using AI
 * Requirements: 3.7
 */
export async function identifyImageType(rawText: string): Promise<{
  imageType: ImageType;
  confidence: number;
}> {
  // If text is very short or empty, return unknown
  if (!rawText || rawText.trim().length < 10) {
    return { imageType: 'unknown', confidence: 0.1 };
  }

  // Use AI to parse and get image type
  const result = await parseWithAI(rawText);
  
  if (result.success && result.response) {
    // Calculate confidence based on product extraction success
    const productCount = result.response.products.length;
    const avgConfidence = productCount > 0
      ? result.response.products.reduce((sum, p) => sum + p.confidence, 0) / productCount
      : 0.3;
    
    return {
      imageType: result.response.imageType,
      confidence: avgConfidence,
    };
  }

  return { imageType: 'unknown', confidence: 0.2 };
}

/**
 * Preprocess OCR text lines to clean up common issues with handwritten text
 * Returns cleaned lines as an array (preserving each line as a potential product)
 */
function preprocessOCRTextLines(textLines: string[]): string[] {
  return textLines
    .map(line => line.trim())
    .filter(line => line.length > 0)
    // Remove lines that are just numbers or special characters
    .filter(line => /[a-zA-Z]/.test(line))
    // Remove very short lines that are likely noise (less than 3 chars)
    .filter(line => line.length >= 3)
    // Remove common header/footer lines
    .filter(line => {
      const lower = line.toLowerCase();
      return !lower.includes('date:') && 
             !lower.includes('page') && 
             !lower.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/);
    });
}

/**
 * AI prompt for cleaning and formatting product names from OCR text
 */
const PRODUCT_NAME_CLEANUP_PROMPT = `
You are a product name correction assistant. I have a list of product names extracted from a handwritten list using OCR. 
The OCR may have made errors. Please correct each product name and return them as a JSON array.

IMPORTANT RULES:
1. Each line in the input is ONE product - preserve ALL products
2. Fix OCR spelling errors (e.g., "Unibic" should stay "Unibic", "Kellogg's" should be "Kellogg's")
3. Common Indian/FMCG brands: Unibic, Malkist, Bournvita, Horlicks, Sunfeast, Parle, Cadbury, Kellogg's, Maggi, Amul, Amulya, Maxo, Dettol, Lux, Chandrika, Vivel, Medimix, Pears, Fiama, Dove, Santoor, Lifebuoy, Britannia, Nestle, Aer, M-Seal
4. Keep size/weight info (110g, 2kg, etc.) in the name
5. Format properly with correct capitalization
6. DO NOT skip any products - return ALL of them

OCR Text (one product per line):
{rawText}

Return ONLY a JSON array of corrected product names, nothing else:
["Product Name 1", "Product Name 2", ...]
`;

/**
 * Clean up product names using AI
 */
async function cleanupProductNamesWithAI(productLines: string[]): Promise<string[]> {
  if (!validateBedrockConfig()) {
    console.warn('Bedrock not configured, returning original product names');
    return productLines;
  }

  const rawText = productLines.join('\n');
  const prompt = PRODUCT_NAME_CLEANUP_PROMPT.replace('{rawText}', rawText);
  
  try {
    const response = await invokeModel(prompt);
    
    if (!response.success) {
      console.warn('AI cleanup failed:', response.error);
      return productLines;
    }

    console.log('AI cleanup response:', response.content.substring(0, 500));
    
    // Parse the JSON array response
    const parsed = parseBedrockJSON<string[]>(response.content);
    
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log('AI cleaned', parsed.length, 'product names');
      return parsed.filter(name => typeof name === 'string' && name.trim().length > 0);
    }
    
    console.warn('AI returned invalid format, using original names');
    return productLines;
  } catch (error) {
    console.error('Error in AI cleanup:', error);
    return productLines;
  }
}

/**
 * Extract products from image using AWS Textract OCR then AWS Bedrock AI
 * NEW APPROACH: Extract each line as a product, then use AI to clean up names
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7
 */
export async function extractFromImage(imageBuffer: Buffer): Promise<AIExtractionResult> {
  let rawText = '';
  let usedFallback = false;

  try {
    // Step 1: Extract raw text using AWS Textract (Requirement 1.1)
    console.log('Starting OCR extraction with AWS Textract...');
    const textLines = await extractTextFromImageAWS(imageBuffer);
    
    // Log raw OCR output for debugging
    console.log('Raw OCR text lines:', textLines.length, 'lines');
    console.log('All OCR lines:', textLines);
    
    // Preprocess the OCR text lines
    const cleanedLines = preprocessOCRTextLines(textLines);
    rawText = cleanedLines.join('\n');
    
    console.log('Preprocessed lines count:', cleanedLines.length);
    console.log('Preprocessed lines:', cleanedLines);

    if (cleanedLines.length === 0) {
      return {
        success: false,
        products: [],
        imageType: 'unknown',
        rawText: '',
        confidence: 0,
        usedFallback: false,
        error: 'No text detected in the image',
      };
    }

    // Step 2: Use AI to clean up product names (fix OCR errors)
    console.log('Cleaning up product names with AI...');
    const cleanedProductNames = await cleanupProductNamesWithAI(cleanedLines);
    
    console.log('Cleaned product names:', cleanedProductNames.length);
    console.log('Products:', cleanedProductNames);

    // Step 3: Convert to AIExtractedProduct format
    // Since this is a name-only list, set default values
    const products: AIExtractedProduct[] = cleanedProductNames.map((name) => {
      const confidence: FieldConfidence = {
        name: 0.85, // High confidence since AI cleaned the name
        price: 0.1, // Low confidence - price is default
        quantity: 0.5, // Medium confidence - quantity is default
        brand: 0, // Brand not yet identified
        overall: 0.35, // Low overall due to missing price/brand
      };

      return {
        name: name.trim(),
        price: 0, // Default price for name-only lists
        quantity: 1, // Default quantity
        unit: 'pieces',
        confidence,
        needsReview: true, // All name-only products need review
      };
    });

    // Filter out any empty products
    const validProducts = products.filter(p => p.name.length > 0);

    console.log('Final products count:', validProducts.length);

    return {
      success: true,
      products: validProducts,
      imageType: 'name_only_list',
      rawText,
      confidence: 0.7,
      usedFallback: false,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in extractFromImage:', errorMessage);

    // Fallback: Try to use the raw OCR lines as products
    if (rawText) {
      console.log('Using fallback: treating each OCR line as a product');
      usedFallback = true;
      
      const fallbackLines = rawText.split('\n').filter(line => line.trim().length >= 3);
      const fallbackProducts: AIExtractedProduct[] = fallbackLines.map((name) => ({
        name: name.trim(),
        price: 0,
        quantity: 1,
        unit: 'pieces',
        confidence: {
          name: 0.6,
          price: 0.1,
          quantity: 0.5,
          brand: 0,
          overall: 0.3,
        },
        needsReview: true,
      }));

      return {
        success: true,
        products: fallbackProducts,
        imageType: 'name_only_list',
        rawText,
        confidence: 0.5,
        usedFallback: true,
        error: `AI processing failed: ${errorMessage}. Using raw OCR text.`,
      };
    }

    return {
      success: false,
      products: [],
      imageType: 'unknown',
      rawText,
      confidence: 0,
      usedFallback,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  extractFromImage,
  parseWithAI,
  identifyImageType,
  calculateFieldConfidence,
  needsReview,
  convertToAIExtractedProducts,
  isNameOnlyList,
  processNameOnlyProducts,
  convertNameOnlyToAIExtractedProducts,
  calculateStringSimilarity,
  findBestMasterProductMatch,
  enrichProductsWithMasterData,
  fetchMasterProducts,
  matchProductsWithMasterData,
  CONFIDENCE_THRESHOLD_REVIEW,
  MASTER_PRODUCT_MATCH_THRESHOLD,
};
