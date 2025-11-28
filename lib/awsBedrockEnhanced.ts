/**
 * Enhanced AWS Bedrock Service with Web Search Integration
 * Uses Claude Sonnet 4.5 for better reasoning and tool use capabilities
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { parseBedrockJSON, validateBedrockConfig, getBedrockClient } from './awsBedrock';

// Enhanced Bedrock model configuration - Claude Sonnet 4.5 for advanced reasoning
// Using inference profile ID format for on-demand requests (required for Claude Sonnet 4.5)
const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';
const REGION_PREFIX = AWS_REGION.startsWith('us-') ? 'us' : AWS_REGION.startsWith('eu-') ? 'eu' : AWS_REGION.startsWith('ap-') ? 'ap' : 'us';

export const ENHANCED_BEDROCK_CONFIG = {
  // Claude Sonnet 4.5 model ID - MUST use inference profile format for on-demand requests
  // Error: "Invocation of model ID with on-demand throughput isn't supported. Retry your request with the ID or ARN of an inference profile"
  // Inference profile format: {region}.anthropic.claude-sonnet-4-5-20250929-v1:0
  // Example: us.anthropic.claude-sonnet-4-5-20250929-v1:0
  modelId: `${REGION_PREFIX}.anthropic.claude-sonnet-4-5-20250929-v1:0`,
  maxTokens: 4096,
  temperature: 0.1, // Lower temperature for consistent receipt extraction
  region: AWS_REGION,
};

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Yield control to browser to prevent freezing
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    // Use requestIdleCallback if available, otherwise use setTimeout
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => resolve(), { timeout: 10 });
    } else {
      setTimeout(() => resolve(), 0);
    }
  });
}

// Web search tool definition for Claude
const WEB_SEARCH_TOOL = {
  name: 'web_search',
  description: 'Search the web for current information about products, brands, categories, or companies. Use this when you need real-time information that you don\'t already know.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web'
      },
      search_type: {
        type: 'string',
        enum: ['product', 'brand', 'category'],
        description: 'Type of search: product for product information, brand for brand identification, category for category information'
      }
    },
    required: ['query', 'search_type']
  }
};

// Execute web search tool
async function executeWebSearchTool(query: string, searchType: 'product' | 'brand' | 'category'): Promise<string> {
  const WEB_SEARCH_API_KEY = process.env.WEB_SEARCH_API_KEY;
  const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

  if (!WEB_SEARCH_API_KEY || !GOOGLE_CSE_ID) {
    return '';
  }

  try {
    let searchQuery = query;
    if (searchType === 'product') {
      searchQuery = `${query} product category ecommerce`;
    } else if (searchType === 'brand') {
      searchQuery = `${query} brand manufacturer company`;
    } else if (searchType === 'category') {
      searchQuery = `${query} product category classification`;
    }

    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${WEB_SEARCH_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(searchQuery)}&num=3`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) {
      return '';
    }
    
    const data = await response.json();
    const results = data.items || [];
    
    const snippets = results
      .slice(0, 3)
      .map((item: any) => item.snippet || item.title)
      .filter(Boolean)
      .join('\n\n');
    
    return snippets || '';
  } catch (error) {
    console.warn('Web search tool execution failed:', error);
    return '';
  }
}

// Enhanced invoke function for Claude Sonnet 4.5 with tool use support
export async function invokeEnhancedModelWithTools(
  prompt: string,
  tools: any[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<{
  success: boolean;
  content: string;
  error?: string;
}> {
  const bedrockClient = getBedrockClient();
  
  if (!bedrockClient) {
    return {
      success: false,
      content: '',
      error: 'AWS Bedrock client is not initialized',
    };
  }

  const maxRetries = 3;
  const baseDelay = 1000;
  const maxIterations = 5; // Maximum tool use iterations to prevent infinite loops

  let messages: any[] = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let toolUsed = false;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const requestBody: any = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: options.maxTokens || ENHANCED_BEDROCK_CONFIG.maxTokens,
          temperature: options.temperature ?? ENHANCED_BEDROCK_CONFIG.temperature,
          messages: messages,
          tools: tools.length > 0 ? tools : undefined,
        };

        const input: InvokeModelCommandInput = {
          modelId: ENHANCED_BEDROCK_CONFIG.modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(requestBody),
        };

        const command = new InvokeModelCommand(input);
        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        // Check if model wants to use a tool
        const contentBlocks = responseBody.content || [];
        const toolUseBlock = contentBlocks.find((block: any) => block.type === 'tool_use');
        const textBlock = contentBlocks.find((block: any) => block.type === 'text');

        if (toolUseBlock) {
          // Model wants to use a tool - execute it
          const toolName = toolUseBlock.name;
          const toolInput = toolUseBlock.input;

          if (toolName === 'web_search') {
            const searchResults = await executeWebSearchTool(
              toolInput.query,
              toolInput.search_type
            );

            // Add assistant's tool use to messages
            messages.push({
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: toolUseBlock.id,
                  name: toolName,
                  input: toolInput,
                },
              ],
            });

            // Add tool results to messages
            messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUseBlock.id,
                  content: searchResults || 'No search results found.',
                },
              ],
            });

            // Mark that tool was used and break to continue iteration
            toolUsed = true;
            break; // Break out of retry loop to continue with next iteration
          }
        }

        // Model returned text response (no tool use)
        const content = textBlock?.text || contentBlocks.find((b: any) => b.type === 'text')?.text || '';
        
        return {
          success: true,
          content,
        };
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries - 1;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isRetryable =
          errorMessage.includes('ThrottlingException') ||
          errorMessage.includes('ServiceUnavailableException') ||
          errorMessage.includes('InternalServerException');

        if (isRetryable && !isLastAttempt) {
          const delay = baseDelay * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        return {
          success: false,
          content: '',
          error: errorMessage,
        };
      }
    }
    
    // If no tool was used, we already returned above
    if (!toolUsed) {
      break;
    }
  }

  return {
    success: false,
    content: '',
    error: 'Max iterations exceeded',
  };
}

// Enhanced invoke function for Claude Sonnet 4.5 (backward compatible, without tools)
export async function invokeEnhancedModel(
  prompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<{
  success: boolean;
  content: string;
  error?: string;
}> {
  const bedrockClient = getBedrockClient();
  
  if (!bedrockClient) {
    return {
      success: false,
      content: '',
      error: 'AWS Bedrock client is not initialized',
    };
  }

  const maxRetries = 3;
  const baseDelay = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options.maxTokens || ENHANCED_BEDROCK_CONFIG.maxTokens,
        temperature: options.temperature ?? ENHANCED_BEDROCK_CONFIG.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      // Use inference profile format for Claude Sonnet 4.5 (required for on-demand requests)
      // The modelId should already be in inference profile format: {region}.anthropic.claude-sonnet-4-5-20250929-v1:0
      const modelIdToUse = ENHANCED_BEDROCK_CONFIG.modelId;
      console.log(`🔧 Using model ID: ${modelIdToUse} (Region: ${ENHANCED_BEDROCK_CONFIG.region})`);
      
      const input: InvokeModelCommandInput = {
        modelId: modelIdToUse,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      };

      const command = new InvokeModelCommand(input);
      const response = await bedrockClient.send(command);
      
      // Decode response body
      const responseBodyStr = new TextDecoder().decode(response.body);
      
      // Log raw response for debugging (first 500 chars)
      if (responseBodyStr.length > 0) {
        console.log('📥 Raw Bedrock response preview:', responseBodyStr.substring(0, 500));
      }
      
      const responseBody = JSON.parse(responseBodyStr);
      
      // Extract content from Claude response format
      // Claude responses can have multiple content blocks
      let content = '';
      if (responseBody.content && Array.isArray(responseBody.content)) {
        // Combine all text blocks
        content = responseBody.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text || '')
          .join('\n');
      } else if (responseBody.content?.[0]?.text) {
        content = responseBody.content[0].text;
      }
      
      // Validate content
      if (!content || content.trim().length === 0) {
        console.error('❌ Empty content in Bedrock response');
        console.error('📄 Full response body:', JSON.stringify(responseBody, null, 2));
        return {
          success: false,
          content: '',
          error: 'AI model returned empty content',
        };
      }

      return {
        success: true,
        content,
      };
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries - 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error?.name || '';
      
      // Check if error mentions inference profile requirement (specific error for Claude Sonnet 4.5)
      if (errorMessage.includes('inference profile') || errorMessage.includes('on-demand throughput')) {
        console.error('❌ Model requires inference profile ID (not direct model ID)');
        console.error('   Current model ID:', ENHANCED_BEDROCK_CONFIG.modelId);
        console.error('   Region prefix:', REGION_PREFIX);
        console.error('   Full region:', ENHANCED_BEDROCK_CONFIG.region);
        console.error('   Error:', errorMessage);
        
        // The model ID should already be in inference profile format
        // But verify it matches the expected pattern
        const expectedFormat = `${REGION_PREFIX}.anthropic.claude-sonnet-4-5-20250929-v1:0`;
        
        if (!ENHANCED_BEDROCK_CONFIG.modelId.startsWith(REGION_PREFIX + '.')) {
          return {
            success: false,
            content: '',
            error: `Model requires inference profile format. Expected format: ${expectedFormat}, but got: ${ENHANCED_BEDROCK_CONFIG.modelId}. 

Please verify the exact inference profile ID from AWS Bedrock Console Model Catalog.`,
          };
        }
        
        return {
          success: false,
          content: '',
          error: `Inference profile error: ${errorMessage}

Current model ID: ${ENHANCED_BEDROCK_CONFIG.modelId}
Region: ${ENHANCED_BEDROCK_CONFIG.region}

Please verify the correct inference profile ID/ARN in AWS Bedrock Console:
https://console.aws.amazon.com/bedrock/home?region=${ENHANCED_BEDROCK_CONFIG.region}#/inference-profiles`,
        };
      }
      
      // Check if it's a ResourceNotFoundException (model ID or access issue)
      if (errorName === 'ResourceNotFoundException' || errorMessage.includes('ResourceNotFoundException')) {
        console.error('❌ ResourceNotFoundException - Model not found or incorrect model ID');
        console.error('   Model ID used:', ENHANCED_BEDROCK_CONFIG.modelId);
        console.error('   Region:', ENHANCED_BEDROCK_CONFIG.region);
        console.error('   Full error:', errorMessage);
        
        // If use case details error is mentioned, provide specific guidance
        if (errorMessage.includes('use case details')) {
          return {
            success: false,
            content: '',
            error: `Model access error: ${errorMessage}

Since use case details are already submitted, this might indicate:
1. Model ID format issue: '${ENHANCED_BEDROCK_CONFIG.modelId}'
2. Model might not be available in region: ${ENHANCED_BEDROCK_CONFIG.region}
3. Need to verify exact model ID in AWS Bedrock Console Model Catalog

Please verify the exact model ID from: https://console.aws.amazon.com/bedrock/home?region=${ENHANCED_BEDROCK_CONFIG.region}#/modelaccess`,
          };
        }
        
        return {
          success: false,
          content: '',
          error: `Model not found. Model ID: ${ENHANCED_BEDROCK_CONFIG.modelId}, Region: ${ENHANCED_BEDROCK_CONFIG.region}. 
          
Please verify the correct model ID from AWS Bedrock Console Model Catalog. Error: ${errorMessage}`,
        };
      }
      
      const isRetryable =
        errorMessage.includes('ThrottlingException') ||
        errorMessage.includes('ServiceUnavailableException') ||
        errorMessage.includes('InternalServerException');

      if (isRetryable && !isLastAttempt) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Retryable error, retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      console.error('❌ Bedrock invocation error:', errorMessage);
      return {
        success: false,
        content: '',
        error: errorMessage,
      };
    }
  }

  return {
    success: false,
    content: '',
    error: 'Max retries exceeded',
  };
}

// Web search configuration
const WEB_SEARCH_API_KEY = process.env.WEB_SEARCH_API_KEY || '';
const USE_WEB_SEARCH = !!WEB_SEARCH_API_KEY;

/**
 * Search the web for product information (direct Google API call from server)
 */
async function searchWebForProduct(productName: string, brandName?: string): Promise<string> {
  if (!USE_WEB_SEARCH) {
    return '';
  }

  try {
    const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
    if (!GOOGLE_CSE_ID) {
      return '';
    }

    const searchQuery = brandName 
      ? `${brandName} ${productName} product category`
      : `${productName} product category ecommerce`;
    
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${WEB_SEARCH_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(searchQuery)}&num=3`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) {
      console.warn('Web search API not available, skipping web search');
      return '';
    }
    
    const data = await response.json();
    const results = data.items || [];
    
    // Extract snippets from search results
    const snippets = results
      .slice(0, 3)
      .map((item: any) => item.snippet || item.title)
      .filter(Boolean)
      .join('\n\n');
    
    return snippets;
  } catch (error) {
    console.warn('Web search failed, continuing without web context:', error);
    return '';
  }
}

/**
 * Search the web for brand information (direct Google API call from server)
 */
async function searchWebForBrand(productName: string): Promise<string> {
  if (!USE_WEB_SEARCH) {
    return '';
  }

  try {
    const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
    if (!GOOGLE_CSE_ID) {
      return '';
    }

    const searchQuery = `${productName} brand manufacturer company`;
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${WEB_SEARCH_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(searchQuery)}&num=3`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) {
      return '';
    }
    
    const data = await response.json();
    const results = data.items || [];
    
    const snippets = results
      .slice(0, 3)
      .map((item: any) => item.snippet || item.title)
      .filter(Boolean)
      .join('\n\n');
    
    return snippets;
  } catch (error) {
    console.warn('Brand web search failed:', error);
    return '';
  }
}

/**
 * Find best matching category from available categories (case-insensitive, fuzzy matching)
 */
function findBestMatchingCategory(
  suggestedCategory: string,
  availableCategories: string[]
): string | undefined {
  if (!suggestedCategory || availableCategories.length === 0) {
    return undefined;
  }

  const normalized = suggestedCategory.toLowerCase().trim();
  
  // First try exact match (case-insensitive)
  let match = availableCategories.find(cat => cat.toLowerCase().trim() === normalized);
  if (match) return match;

  // Try partial match (contains)
  match = availableCategories.find(cat => {
    const catLower = cat.toLowerCase().trim();
    return catLower.includes(normalized) || normalized.includes(catLower);
  });
  if (match) return match;

  // Try word-by-word matching
  const suggestedWords = normalized.split(/\s+/).filter(w => w.length > 3);
  let bestMatch: { category: string; score: number } | undefined;
  
  for (const cat of availableCategories) {
    const catLower = cat.toLowerCase().trim();
    const catWords = catLower.split(/\s+/);
    
    let score = 0;
    for (const word of suggestedWords) {
      if (catWords.some(cw => cw.includes(word) || word.includes(cw))) {
        score += word.length;
      }
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { category: cat, score };
    }
  }
  
  return bestMatch?.category;
}

/**
 * Find best matching subcategory from available subcategories
 */
function findBestMatchingSubcategory(
  suggestedSubcategory: string,
  category: string,
  availableSubcategories: Record<string, string[]>
): string | undefined {
  if (!suggestedSubcategory || !category) {
    return undefined;
  }

  const categorySubs = availableSubcategories[category] || [];
  if (categorySubs.length === 0) {
    return undefined;
  }

  const normalized = suggestedSubcategory.toLowerCase().trim();
  
  // Exact match
  let match = categorySubs.find(sub => sub.toLowerCase().trim() === normalized);
  if (match) return match;

  // Partial match
  match = categorySubs.find(sub => {
    const subLower = sub.toLowerCase().trim();
    return subLower.includes(normalized) || normalized.includes(subLower);
  });
  if (match) return match;

  return undefined;
}

/**
 * Enhanced category mapping with AI-driven web search (using tool use)
 */
export async function categorizeProductWithWebSearch(
  productName: string,
  brandName: string | undefined,
  categories: string[],
  subcategories: Record<string, string[]>
): Promise<{
  success: boolean;
  category?: string;
  subcategory?: string;
  confidence: number;
  webContext?: string;
  error?: string;
}> {
  if (!validateBedrockConfig()) {
    return {
      success: false,
      confidence: 0,
      error: 'AWS Bedrock is not configured',
    };
  }

  try {
    const subcategoriesStr = Object.entries(subcategories)
      .map(([cat, subs]) => `${cat}: ${subs.join(', ')}`)
      .join('\n');

    // Build examples for better context
    const examples = `
Examples:
- Product: "Parle-G Biscuits" → Category: "foods & beverages", Subcategory: "biscuit & cookies"
- Product: "Dettol Soap" → Category: "personal care", Subcategory: "soap"
- Product: "Tide Detergent" → Category: "home care", Subcategory: "laundry detergent"
- Product: "Colgate Toothpaste" → Category: "personal care", Subcategory: "toothpaste"
- Product: "Maggi Noodles" → Category: "foods & beverages", Subcategory: "snacks"
- Product: "Lakme Face Cream" → Category: "beauty & cosmetics" or "personal care", Subcategory: "face cream"
- Product: "Amul Milk" → Category: "foods & beverages", Subcategory: "dairy"
`;

    const prompt = `You are an expert product categorization assistant for an Indian FMCG/grocery e-commerce platform.

Product to categorize: ${productName}${brandName ? ` (Brand: ${brandName})` : ''}

Available categories (EXACTLY match one of these - case-insensitive): 
${categories.map(c => `- ${c}`).join('\n')}

Available subcategories by category:
${Object.entries(subcategories).map(([cat, subs]) => `- ${cat}: ${subs.join(', ')}`).join('\n')}

${examples}

IMPORTANT RULES:
1. The category MUST exactly match one from the "Available categories" list (case-insensitive)
2. The subcategory should match one from the corresponding category's subcategories list
3. If you're uncertain about the product or need current information, use the web_search tool with search_type="product"
4. For Indian context: "biscuits" go to "foods & beverages" > "biscuit & cookies", "soaps" go to "personal care" > "soap"

Your task:
1. Determine the most appropriate category (must be from available list)
2. Determine the most appropriate subcategory (from available list for that category)
3. Provide confidence score (0-1)

Respond with ONLY valid JSON in this format (no markdown, no code blocks):
{
  "category": "exact category name from available list",
  "subcategory": "subcategory name",
  "confidence": 0.95,
  "reasoning": "brief explanation"
}`;

    // Use enhanced model with tool use (web search tool available)
    const tools = USE_WEB_SEARCH ? [WEB_SEARCH_TOOL] : [];
    const response = await invokeEnhancedModelWithTools(prompt, tools, {
      maxTokens: ENHANCED_BEDROCK_CONFIG.maxTokens,
      temperature: 0.1, // Lower temperature for more consistent category matching
    });

    if (!response.success) {
      return {
        success: false,
        confidence: 0,
        error: response.error || 'Failed to categorize product',
      };
    }

    const parsed = parseBedrockJSON<{
      category: string;
      subcategory: string;
      confidence: number;
      reasoning: string;
    }>(response.content);

    if (!parsed || !parsed.category) {
      return {
        success: false,
        confidence: 0,
        error: 'Failed to parse AI response',
      };
    }

    // Find best matching category (case-insensitive, fuzzy)
    const matchedCategory = findBestMatchingCategory(parsed.category, categories);
    if (!matchedCategory) {
      return {
        success: false,
        confidence: 0,
        error: `Category "${parsed.category}" not found in available categories`,
      };
    }

    // Find best matching subcategory
    const matchedSubcategory = findBestMatchingSubcategory(
      parsed.subcategory,
      matchedCategory,
      subcategories
    );

    return {
      success: true,
      category: matchedCategory,
      subcategory: matchedSubcategory || parsed.subcategory,
      confidence: parsed.confidence || 0.8,
    };
  } catch (error: any) {
    console.error('Error in enhanced category mapping:', error);
    return {
      success: false,
      confidence: 0,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Find best matching brand from existing brands (case-insensitive, fuzzy matching)
 */
function findBestMatchingBrand(
  suggestedBrand: string,
  existingBrands: string[]
): { brand: string; isExisting: boolean } | undefined {
  if (!suggestedBrand || existingBrands.length === 0) {
    return { brand: suggestedBrand, isExisting: false };
  }

  const normalized = suggestedBrand.toLowerCase().trim();
  
  // Exact match (case-insensitive)
  let match = existingBrands.find(b => b.toLowerCase().trim() === normalized);
  if (match) {
    return { brand: match, isExisting: true };
  }

  // Partial match (contains)
  match = existingBrands.find(b => {
    const bLower = b.toLowerCase().trim();
    return bLower.includes(normalized) || normalized.includes(bLower);
  });
  if (match) {
    return { brand: match, isExisting: true };
  }

  // Fuzzy matching for common variations
  const suggestedWords = normalized.split(/\s+/).filter(w => w.length > 2);
  let bestMatch: { brand: string; score: number } | undefined;
  
  for (const existingBrand of existingBrands) {
    const brandLower = existingBrand.toLowerCase().trim();
    const brandWords = brandLower.split(/\s+/);
    
    let score = 0;
    for (const word of suggestedWords) {
      if (brandWords.some(bw => {
        // Check for close matches (Levenshtein-like)
        const minLength = Math.min(word.length, bw.length);
        const maxLength = Math.max(word.length, bw.length);
        if (minLength / maxLength < 0.7) return false; // Too different in length
        
        return bw.includes(word) || word.includes(bw) || 
               (Math.abs(bw.length - word.length) <= 2 && bw.charAt(0) === word.charAt(0));
      })) {
        score += word.length;
      }
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { brand: existingBrand, score };
    }
  }
  
  // If we found a good match, use the existing brand
  if (bestMatch && bestMatch.score > 3) {
    return { brand: bestMatch.brand, isExisting: true };
  }
  
  return { brand: suggestedBrand, isExisting: false };
}

/**
 * Enhanced brand mapping with AI-driven web search (using tool use)
 */
export async function identifyBrandWithWebSearch(
  productName: string,
  existingBrands: string[]
): Promise<{
  success: boolean;
  brand?: string;
  confidence: number;
  isExisting: boolean;
  webContext?: string;
  error?: string;
}> {
  if (!validateBedrockConfig()) {
    return {
      success: false,
      confidence: 0,
      isExisting: false,
      error: 'AWS Bedrock is not configured',
    };
  }

  try {
    const brandsList = existingBrands.length > 0 
      ? existingBrands.slice(0, 50).join(', ') + (existingBrands.length > 50 ? `, ... (${existingBrands.length} total)` : '')
      : 'None';

    const prompt = `You are an expert brand identification assistant for an Indian FMCG/grocery e-commerce platform.

Product name: ${productName}

Existing brands in the system (check if brand matches - use exact format if found): ${brandsList}

Your task is to identify the brand/manufacturer for this product. If you're uncertain or need current information about the brand, use the web_search tool with search_type="brand" to find information about this product's brand.

IMPORTANT RULES:
1. Extract brand from product name (e.g., "Parle-G Biscuits" → brand: "Parle-G" or "Parle")
2. Match against existing brands first (use exact format if similar brand exists)
3. Common Indian FMCG brands: HUL (Hindustan Unilever), ITC, Nestle, Britannia, Parle, Dabur, Colgate-Palmolive, P&G, Amul, etc.
4. Brand should be the manufacturer/company name, not generic terms like "Premium" or "Deluxe"

Examples:
- "Parle-G Biscuits" → brand: "Parle-G" or "Parle"
- "Dettol Antiseptic Soap" → brand: "Dettol" (Reckitt Benckiser)
- "Colgate Strong Teeth" → brand: "Colgate"
- "Maggi 2-Minute Noodles" → brand: "Maggi" (Nestle)
- "Amul Butter" → brand: "Amul"
- "Tide Plus Detergent" → brand: "Tide" (P&G)

Instructions:
1. First, try to identify brand from product name
2. If uncertain, use web_search tool
3. After gathering information, determine:
   - Brand name (use existing brand format if match found)
   - Confidence score (0-1)
   - Whether brand matches existing brands list

Respond with ONLY valid JSON in this format (no markdown, no code blocks):
{
  "brand": "brand name",
  "confidence": 0.95,
  "isExisting": false,
  "reasoning": "brief explanation"
}`;

    // Use enhanced model with tool use (web search tool available)
    const tools = USE_WEB_SEARCH ? [WEB_SEARCH_TOOL] : [];
    const response = await invokeEnhancedModelWithTools(prompt, tools, {
      maxTokens: ENHANCED_BEDROCK_CONFIG.maxTokens,
      temperature: 0.1, // Lower temperature for more consistent brand matching
    });

    if (!response.success) {
      return {
        success: false,
        confidence: 0,
        isExisting: false,
        error: response.error || 'Failed to identify brand',
      };
    }

    const parsed = parseBedrockJSON<{
      brand: string;
      confidence: number;
      isExisting: boolean;
      reasoning: string;
    }>(response.content);

    if (!parsed || !parsed.brand) {
      return {
        success: false,
        confidence: 0,
        isExisting: false,
        error: 'Failed to parse AI response',
      };
    }

    // Find best matching brand (case-insensitive, fuzzy)
    const brandMatch = findBestMatchingBrand(parsed.brand, existingBrands);
    const finalBrand = brandMatch?.brand || parsed.brand;
    const isExisting = brandMatch?.isExisting || parsed.isExisting;

    // Validate brand name (remove common non-brand words)
    const cleanedBrand = finalBrand
      .replace(/\b(premium|deluxe|extra|plus|super|mega|ultra|special|original|classic)\b/gi, '')
      .trim()
      .replace(/\s+/g, ' ');

    return {
      success: true,
      brand: cleanedBrand || finalBrand,
      confidence: parsed.confidence || 0.8,
      isExisting,
    };
  } catch (error: any) {
    console.error('Error in enhanced brand mapping:', error);
    return {
      success: false,
      confidence: 0,
      isExisting: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Batch categorize products with web search (chunked for browser performance)
 */
export async function batchCategorizeWithWebSearch(
  products: Array<{ name: string; brand?: string }>,
  categories: string[],
  subcategories: Record<string, string[]>,
  onProgress?: (processed: number, total: number) => void
): Promise<Array<{
  productName: string;
  category?: string;
  subcategory?: string;
  confidence: number;
  success: boolean;
}>> {
  const CHUNK_SIZE = 5; // Process 5 products at a time to prevent browser freezing
  const DELAY_BETWEEN_CHUNKS = 100; // 100ms delay between chunks

  const results: Array<{
    productName: string;
    category?: string;
    subcategory?: string;
    confidence: number;
    success: boolean;
  }> = [];

  // Process in chunks to prevent browser freezing
  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE);
    
    // Process chunk
    const chunkResults = await Promise.all(
      chunk.map(async (product) => {
        const result = await categorizeProductWithWebSearch(
          product.name,
          product.brand,
          categories,
          subcategories
        );
        
        return {
          productName: product.name,
          category: result.category,
          subcategory: result.subcategory,
          confidence: result.confidence,
          success: result.success,
        };
      })
    );
    
    results.push(...chunkResults);
    
    // Report progress
    if (onProgress) {
      onProgress(results.length, products.length);
    }
    
    // Yield to browser between chunks (except for last chunk)
    if (i + CHUNK_SIZE < products.length) {
      await yieldToBrowser();
      await sleep(DELAY_BETWEEN_CHUNKS);
    }
  }

  return results;
}

/**
 * Batch identify brands with web search (chunked for browser performance)
 */
export async function batchIdentifyBrandsWithWebSearch(
  products: Array<{ name: string }>,
  existingBrands: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<Array<{
  productName: string;
  brand?: string;
  confidence: number;
  isExisting: boolean;
  success: boolean;
}>> {
  const CHUNK_SIZE = 5; // Process 5 products at a time
  const DELAY_BETWEEN_CHUNKS = 100; // 100ms delay between chunks

  const results: Array<{
    productName: string;
    brand?: string;
    confidence: number;
    isExisting: boolean;
    success: boolean;
  }> = [];

  // Process in chunks to prevent browser freezing
  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE);
    
    // Process chunk
    const chunkResults = await Promise.all(
      chunk.map(async (product) => {
        const result = await identifyBrandWithWebSearch(product.name, existingBrands);
        
        return {
          productName: product.name,
          brand: result.brand,
          confidence: result.confidence,
          isExisting: result.isExisting,
          success: result.success,
        };
      })
    );
    
    results.push(...chunkResults);
    
    // Report progress
    if (onProgress) {
      onProgress(results.length, products.length);
    }
    
    // Yield to browser between chunks (except for last chunk)
    if (i + CHUNK_SIZE < products.length) {
      await yieldToBrowser();
      await sleep(DELAY_BETWEEN_CHUNKS);
    }
  }

  return results;
}
