import { ExtractedProduct, ReceiptData, ProcessingResult, processReceiptImage as processReceiptImageAzure, validateAzureConfig } from './azureOCR';
import { AWSExtractedProduct, AWSReceiptData, AWSProcessingResult, processReceiptImageAWS, validateAWSConfig } from './awsTextract';

// Unified interfaces that work with both providers
export interface UnifiedExtractedProduct {
  name: string;
  price: number;
  quantity?: number;
  unit?: string;
  category?: string;
  confidence: number;
}

export interface UnifiedReceiptData {
  products: UnifiedExtractedProduct[];
  totalAmount?: number;
  merchantName?: string;
  date?: string;
  confidence: number;
  provider?: 'azure' | 'aws';
}

export interface UnifiedProcessingResult {
  success: boolean;
  data?: UnifiedReceiptData;
  error?: string;
  provider?: 'azure' | 'aws';
}

export type OCRProvider = 'azure' | 'aws';

// Get the configured OCR provider
export function getConfiguredOCRProvider(): OCRProvider {
  const provider = process.env.NEXT_PUBLIC_OCR_PROVIDER as OCRProvider;
  return provider === 'aws' ? 'aws' : 'azure'; // Default to azure
}

// Get available OCR providers based on configuration
export function getAvailableOCRProviders(): OCRProvider[] {
  const providers: OCRProvider[] = [];
  
  if (validateAzureConfig()) {
    providers.push('azure');
  }
  
  if (validateAWSConfig()) {
    providers.push('aws');
  }
  
  return providers;
}

// Check if a specific provider is available
export function isProviderAvailable(provider: OCRProvider): boolean {
  switch (provider) {
    case 'azure':
      return validateAzureConfig();
    case 'aws':
      return validateAWSConfig();
    default:
      return false;
  }
}

// Convert Azure result to unified format
function convertAzureToUnified(azureResult: ProcessingResult): UnifiedProcessingResult {
  if (!azureResult.success || !azureResult.data) {
    return {
      success: false,
      error: azureResult.error,
      provider: 'azure'
    };
  }

  const unifiedData: UnifiedReceiptData = {
    products: azureResult.data.products.map(product => ({
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      unit: product.unit,
      category: product.category,
      confidence: product.confidence
    })),
    totalAmount: azureResult.data.totalAmount,
    merchantName: azureResult.data.merchantName,
    date: azureResult.data.date,
    confidence: azureResult.data.confidence,
    provider: 'azure'
  };

  return {
    success: true,
    data: unifiedData,
    provider: 'azure'
  };
}

// Convert AWS result to unified format
function convertAWSToUnified(awsResult: AWSProcessingResult): UnifiedProcessingResult {
  if (!awsResult.success || !awsResult.data) {
    return {
      success: false,
      error: awsResult.error,
      provider: 'aws'
    };
  }

  const unifiedData: UnifiedReceiptData = {
    products: awsResult.data.products.map(product => ({
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      unit: product.unit,
      category: product.category,
      confidence: product.confidence
    })),
    totalAmount: awsResult.data.totalAmount,
    merchantName: awsResult.data.merchantName,
    date: awsResult.data.date,
    confidence: awsResult.data.confidence,
    provider: 'aws'
  };

  return {
    success: true,
    data: unifiedData,
    provider: 'aws'
  };
}

// Main unified OCR function
export async function processReceiptImage(
  imageBuffer: Buffer, 
  preferredProvider?: OCRProvider
): Promise<UnifiedProcessingResult> {
  const provider = preferredProvider || getConfiguredOCRProvider();
  const availableProviders = getAvailableOCRProviders();
  
  // If preferred provider is not available, use the first available one
  const actualProvider = availableProviders.includes(provider) ? provider : availableProviders[0];
  
  if (!actualProvider) {
    return {
      success: false,
      error: 'No OCR providers are configured. Please set up either Azure Computer Vision or AWS Textract.',
    };
  }

  try {
    switch (actualProvider) {
      case 'aws':
        const awsResult = await processReceiptImageAWS(imageBuffer);
        return convertAWSToUnified(awsResult);
      
      case 'azure':
      default:
        const azureResult = await processReceiptImageAzure(imageBuffer);
        return convertAzureToUnified(azureResult);
    }
  } catch (error) {
    // If the primary provider fails, try fallback to other available providers
    const fallbackProviders = availableProviders.filter(p => p !== actualProvider);
    
    for (const fallbackProvider of fallbackProviders) {
      try {
        console.warn(`Primary OCR provider (${actualProvider}) failed, trying fallback: ${fallbackProvider}`);
        
        switch (fallbackProvider) {
          case 'aws':
            const awsResult = await processReceiptImageAWS(imageBuffer);
            return convertAWSToUnified(awsResult);
          
          case 'azure':
            const azureResult = await processReceiptImageAzure(imageBuffer);
            return convertAzureToUnified(azureResult);
        }
      } catch (fallbackError) {
        console.warn(`Fallback provider (${fallbackProvider}) also failed:`, fallbackError);
        continue;
      }
    }
    
    return {
      success: false,
      error: `All OCR providers failed. Last error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Function to get provider status and capabilities
export function getOCRProviderStatus(): {
  configured: OCRProvider;
  available: OCRProvider[];
  azure: { available: boolean; configured: boolean };
  aws: { available: boolean; configured: boolean };
} {
  return {
    configured: getConfiguredOCRProvider(),
    available: getAvailableOCRProviders(),
    azure: {
      available: validateAzureConfig(),
      configured: process.env.NEXT_PUBLIC_AZURE_ENDPOINT !== 'your-azure-endpoint-here' && 
                 process.env.NEXT_PUBLIC_AZURE_API_KEY !== 'your-azure-api-key-here'
    },
    aws: {
      available: validateAWSConfig(),
      configured: process.env.AWS_ACCESS_KEY_ID !== 'your-aws-access-key-here' && 
                 process.env.AWS_SECRET_ACCESS_KEY !== 'your-aws-secret-key-here'
    }
  };
}

// Export specific provider functions for direct use if needed
export { processReceiptImageAzure, processReceiptImageAWS };

export default {
  processReceiptImage,
  getConfiguredOCRProvider,
  getAvailableOCRProviders,
  isProviderAvailable,
  getOCRProviderStatus
};