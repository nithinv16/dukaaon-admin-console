import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';

// AWS Bedrock configuration
const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '';
const AWS_BEDROCK_API_KEY = process.env.NEXT_PUBLIC_AWS_BEDROCK_API_KEY || '';

// Bedrock model configuration - Claude 3 Haiku for cost-effective AI processing
export const BEDROCK_CONFIG = {
  modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
  maxTokens: 4096,
  temperature: 0.1, // Low temperature for consistent parsing
  region: AWS_REGION,
};

// Initialize Bedrock client only if credentials are available
let bedrockClient: BedrockRuntimeClient | null = null;

// Try to initialize with IAM credentials first, then fall back to API key
if (
  AWS_ACCESS_KEY_ID &&
  AWS_ACCESS_KEY_ID !== 'your-aws-access-key-here' &&
  AWS_SECRET_ACCESS_KEY &&
  AWS_SECRET_ACCESS_KEY !== 'your-aws-secret-key-here'
) {
  try {
    bedrockClient = new BedrockRuntimeClient({
      region: BEDROCK_CONFIG.region,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
    console.log('AWS Bedrock client initialized with IAM credentials');
  } catch (error) {
    console.warn('Failed to initialize AWS Bedrock client with IAM credentials:', error);
  }
}

// Store API key for potential use in custom authentication
export const getBedrockApiKey = (): string => AWS_BEDROCK_API_KEY;

export interface BedrockResponse {
  success: boolean;
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
}

export interface BedrockInvokeOptions {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Invoke AWS Bedrock model with retry logic and exponential backoff
 */
export async function invokeModel(
  prompt: string,
  options: BedrockInvokeOptions = {}
): Promise<BedrockResponse> {
  if (!bedrockClient) {
    return {
      success: false,
      content: '',
      usage: { inputTokens: 0, outputTokens: 0 },
      error: 'AWS Bedrock client is not initialized. Please check your AWS configuration.',
    };
  }

  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options.maxTokens || BEDROCK_CONFIG.maxTokens,
        temperature: options.temperature ?? BEDROCK_CONFIG.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        ...(options.stopSequences && { stop_sequences: options.stopSequences }),
      };

      const input: InvokeModelCommandInput = {
        modelId: BEDROCK_CONFIG.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      };

      const command = new InvokeModelCommand(input);
      const response = await bedrockClient.send(command);

      // Parse response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Extract content from Claude response format
      const content = responseBody.content?.[0]?.text || '';
      const usage = {
        inputTokens: responseBody.usage?.input_tokens || 0,
        outputTokens: responseBody.usage?.output_tokens || 0,
      };

      return {
        success: true,
        content,
        usage,
      };
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if error is retryable
      const isRetryable =
        errorMessage.includes('ThrottlingException') ||
        errorMessage.includes('ServiceUnavailableException') ||
        errorMessage.includes('InternalServerException') ||
        errorMessage.includes('timeout');

      if (isRetryable && !isLastAttempt) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Bedrock request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      console.error('Error invoking AWS Bedrock model:', error);
      return {
        success: false,
        content: '',
        usage: { inputTokens: 0, outputTokens: 0 },
        error: errorMessage,
      };
    }
  }

  // Should not reach here, but TypeScript needs a return
  return {
    success: false,
    content: '',
    usage: { inputTokens: 0, outputTokens: 0 },
    error: 'Max retries exceeded',
  };
}

/**
 * Parse JSON from Bedrock response, handling potential markdown code blocks
 */
export function parseBedrockJSON<T>(content: string): T | null {
  try {
    // Try direct JSON parse first
    return JSON.parse(content) as T;
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as T;
      } catch {
        // Fall through to next attempt
      }
    }

    // Try to find JSON object or array in the content
    const objectMatch = content.match(/\{[\s\S]*\}/);
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    const match = objectMatch || arrayMatch;

    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // Fall through
      }
    }

    console.error('Failed to parse JSON from Bedrock response:', content.substring(0, 200));
    return null;
  }
}

/**
 * Validate AWS Bedrock configuration
 * Returns true if either IAM credentials or API key is configured
 */
export function validateBedrockConfig(): boolean {
  const hasIAMCredentials = !!(
    AWS_ACCESS_KEY_ID &&
    AWS_SECRET_ACCESS_KEY &&
    AWS_REGION &&
    AWS_ACCESS_KEY_ID !== 'your-aws-access-key-here' &&
    AWS_SECRET_ACCESS_KEY !== 'your-aws-secret-key-here' &&
    bedrockClient !== null
  );
  
  const hasApiKey = !!(AWS_BEDROCK_API_KEY && AWS_BEDROCK_API_KEY.length > 0);
  
  return hasIAMCredentials || hasApiKey;
}

/**
 * Get the Bedrock client instance (for testing purposes)
 */
export function getBedrockClient(): BedrockRuntimeClient | null {
  return bedrockClient;
}

// ============================================================================
// Bedrock Service Wrapper Functions
// ============================================================================

/**
 * AI-extracted product interface with confidence scores
 */
export interface AIExtractedProduct {
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  confidence: {
    name: number;
    price: number;
    quantity: number;
    brand: number;
    overall: number;
  };
  needsReview: boolean;
  masterProductMatch?: {
    id: string;
    name: string;
    price: number;
    description: string;
    brand: string;
    matchConfidence: number;
  };
}

export type ImageType = 'receipt' | 'product_list' | 'name_only_list' | 'invoice' | 'unknown';

/**
 * AI parsing response structure
 */
export interface AIParsingResponse {
  imageType: ImageType;
  products: Array<{
    name: string;
    price: number;
    quantity: number;
    unit?: string;
    confidence: number;
  }>;
}

/**
 * Brand identification response structure
 */
export interface BrandIdentificationResponse {
  brands: Array<{
    productName: string;
    brand: string;
    confidence: number;
    isExisting: boolean;
  }>;
}

/**
 * Category suggestion response structure
 */
export interface CategorySuggestionResponse {
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

// Prompt templates
const PRODUCT_PARSING_PROMPT = `
You are a product data extraction assistant specializing in parsing handwritten and printed product lists. Parse the following text extracted from an image and identify products.

IMPORTANT INSTRUCTIONS:
1. This text may be from a HANDWRITTEN list, so expect OCR errors and misspellings
2. Each line typically represents ONE product - treat each line as a separate product
3. Common Indian/FMCG brands include: Unibic, Malkist, Bournvita, Horlicks, Sunfeast, Parle, Cadbury, Kellogg's, Maggi, Amul, Amulya, Maxo, Dettol, Lux, Chandrika, Vivel, Medimix, Pears, Fiama, Dove, Santoor, Lifebuoy, Britannia, Nestle, HUL, ITC, etc.
4. Fix obvious OCR errors in product names
5. If a product has a size/weight mentioned (like "110g", "2kg"), include it in the name

For each product, extract:
- name: The corrected product name (required) - fix spelling errors and format properly
- price: The price as a number (0 if not found)
- quantity: The quantity as a number (1 if not found)
- unit: The unit of measurement (pieces, kg, g, l, ml, pack, etc.)
- confidence: Your confidence in the extraction (0-1)

CRITICAL: If the text contains mostly product names without prices, set imageType to "name_only_list" and extract ALL product names with price: 0.

Text to parse:
{rawText}

Respond with only valid JSON in this format:
{
  "imageType": "receipt|product_list|name_only_list|invoice|unknown",
  "products": [
    {"name": "...", "price": 0, "quantity": 1, "unit": "pieces", "confidence": 0.95}
  ]
}
`;

const BRAND_IDENTIFICATION_PROMPT = `
You are a brand identification assistant. Identify the brand/manufacturer from the following product names.

Known brands in the system: {existingBrands}

For each product, identify:
- The brand name (use existing brand format if it matches)
- Confidence score (0-1)
- Whether it's a known brand or new

Products to analyze:
{products}

Respond with only valid JSON:
{
  "brands": [
    {"productName": "...", "brand": "...", "confidence": 0.9, "isExisting": true}
  ]
}
`;

const CATEGORY_SUGGESTION_PROMPT = `
You are a product categorization assistant. Suggest the best category and subcategory for each product.

Available categories: {categories}
Available subcategories by category: {subcategories}

For each product, suggest:
- Top 3 category matches with confidence scores
- Top 3 subcategory matches (or suggest new ones if none fit)

Products to categorize:
{products}

Respond with only valid JSON:
{
  "categorizations": [
    {
      "productName": "...",
      "categories": [{"name": "...", "confidence": 0.9, "reason": "..."}],
      "subcategories": [{"name": "...", "isNew": false, "confidence": 0.85, "reason": "..."}]
    }
  ]
}
`;

/**
 * Parse product text using AI
 */
export async function parseProductText(rawText: string): Promise<BedrockResponse & { parsed?: AIParsingResponse }> {
  const prompt = PRODUCT_PARSING_PROMPT.replace('{rawText}', rawText);
  const response = await invokeModel(prompt);

  if (!response.success) {
    return response;
  }

  const parsed = parseBedrockJSON<AIParsingResponse>(response.content);
  return {
    ...response,
    parsed: parsed || undefined,
  };
}

/**
 * Identify brands from product names using AI
 */
export async function identifyBrands(
  products: string[],
  existingBrands: string[]
): Promise<BedrockResponse & { parsed?: BrandIdentificationResponse }> {
  const prompt = BRAND_IDENTIFICATION_PROMPT
    .replace('{existingBrands}', existingBrands.join(', ') || 'None')
    .replace('{products}', products.join('\n'));

  const response = await invokeModel(prompt);

  if (!response.success) {
    return response;
  }

  const parsed = parseBedrockJSON<BrandIdentificationResponse>(response.content);
  return {
    ...response,
    parsed: parsed || undefined,
  };
}

/**
 * Suggest categories for products using AI
 */
export async function categorizeProducts(
  products: string[],
  categories: string[],
  subcategories: Record<string, string[]>
): Promise<BedrockResponse & { parsed?: CategorySuggestionResponse }> {
  const subcategoriesStr = Object.entries(subcategories)
    .map(([cat, subs]) => `${cat}: ${subs.join(', ')}`)
    .join('\n');

  const prompt = CATEGORY_SUGGESTION_PROMPT
    .replace('{categories}', categories.join(', ') || 'None')
    .replace('{subcategories}', subcategoriesStr || 'None')
    .replace('{products}', products.join('\n'));

  const response = await invokeModel(prompt);

  if (!response.success) {
    return response;
  }

  const parsed = parseBedrockJSON<CategorySuggestionResponse>(response.content);
  return {
    ...response,
    parsed: parsed || undefined,
  };
}

export default {
  invokeModel,
  parseBedrockJSON,
  validateBedrockConfig,
  getBedrockClient,
  parseProductText,
  identifyBrands,
  categorizeProducts,
  BEDROCK_CONFIG,
};
