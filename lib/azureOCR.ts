import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
import { CognitiveServicesCredentials } from '@azure/ms-rest-azure-js';
import { ReadResult } from '@azure/cognitiveservices-computervision/esm/models';
import { extractProductNameFromLine, cleanProductName } from './productNameCleaner';

// Azure Computer Vision configuration
const AZURE_ENDPOINT = process.env.NEXT_PUBLIC_AZURE_ENDPOINT || '';
const AZURE_API_KEY = process.env.NEXT_PUBLIC_AZURE_API_KEY || '';
const AZURE_REGION = process.env.NEXT_PUBLIC_AZURE_REGION || 'eastus';

// Initialize Computer Vision client only if API key is available
let client: ComputerVisionClient | null = null;

if (AZURE_API_KEY && AZURE_API_KEY !== 'your-azure-api-key-here' && AZURE_ENDPOINT && AZURE_ENDPOINT !== 'your-azure-endpoint-here') {
  try {
    const credentials = new CognitiveServicesCredentials(AZURE_API_KEY);
    client = new ComputerVisionClient(credentials, AZURE_ENDPOINT);
  } catch (error) {
    console.warn('Failed to initialize Azure Computer Vision client:', error);
  }
}

export interface ExtractedProduct {
  name: string;
  price: number;
  quantity?: number;
  unit?: string;
  category?: string;
  confidence: number;
}

export interface ReceiptData {
  products: ExtractedProduct[];
  totalAmount?: number;
  merchantName?: string;
  date?: string;
  confidence: number;
}

export interface ProcessingResult {
  success: boolean;
  data?: ReceiptData;
  error?: string;
}

// Helper function to extract text from image
export async function extractTextFromImage(imageBuffer: Buffer): Promise<string[]> {
  if (!client) {
    throw new Error('Azure Computer Vision client is not initialized. Please check your API configuration.');
  }
  
  try {
    const readResult = await client.readInStream(imageBuffer);
    const operationId = readResult.operationLocation?.split('/').pop();
    
    if (!operationId) {
      throw new Error('Failed to get operation ID');
    }

    // Poll for results
    let result;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      result = await client.getReadResult(operationId);
    } while (result.status === 'running' || result.status === 'notStarted');

    if (result.status === 'failed') {
      throw new Error('OCR operation failed');
    }

    const textLines: string[] = [];
    if (result.analyzeResult?.readResults) {
      for (const page of result.analyzeResult.readResults) {
        if (page.lines) {
          for (const line of page.lines) {
            textLines.push(line.text || '');
          }
        }
      }
    }

    return textLines;
  } catch (error) {
    console.error('Error extracting text from image:', error);
    throw error;
  }
}

// Helper function to parse receipt text into structured data
export function parseReceiptText(textLines: string[]): ReceiptData {
  const products: ExtractedProduct[] = [];
  let totalAmount: number | undefined;
  let merchantName: string | undefined;
  let date: string | undefined;

  // Enhanced patterns for tabular data extraction
  const pricePattern = /\$?([0-9]+[,.]?[0-9]*\.?[0-9]{0,2})/g;
  const quantityPattern = /\b([0-9]+(?:\.[0-9]+)?)\s*(?:pcs?|pc|pieces?|qty|x|units?)?\b/i;
  const datePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
  const totalPattern = /(?:total|sum|amount|net\s*amount|grand\s*total|final\s*total)\s*:?\s*\$?([0-9]+[,.]?[0-9]*\.?[0-9]{0,2})/i;
  
  // Patterns to identify table headers or product lines
  const productLinePattern = /^\s*\d+\s+/; // Lines starting with numbers (item numbers)
  const skipPatterns = [
    /^\s*(?:receipt|invoice|bill|store|shop|market)/i,
    /^\s*(?:date|time|cashier|clerk|thank\s*you)/i,
    /^\s*(?:subtotal|tax|discount|change|tender)/i,
    /^\s*(?:card|cash|payment|method)/i
  ];

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i].trim();
    if (!line) continue;
    
    // Extract merchant name (usually first few lines)
    if (i < 3 && !merchantName && line.length > 3 && !pricePattern.test(line) && 
        !skipPatterns.some(pattern => pattern.test(line))) {
      merchantName = line;
    }

    // Extract date
    const dateMatch = line.match(datePattern);
    if (dateMatch && !date) {
      date = dateMatch[0];
    }

    // Extract total amount with enhanced pattern
    const totalMatch = line.match(totalPattern);
    if (totalMatch) {
      totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
      continue;
    }

    // Skip lines that are clearly not product lines
    if (skipPatterns.some(pattern => pattern.test(line))) {
      continue;
    }

    // Enhanced product extraction for tabular data
    const prices = Array.from(line.matchAll(pricePattern)).map(match => 
      parseFloat(match[1].replace(/,/g, ''))
    ).filter(price => price > 0);
    
    if (prices.length > 0) {
      // Try to extract quantity
      const quantityMatch = line.match(quantityPattern);
      const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : 1;
      
      // Extract and clean product name using enhanced cleaning utility
      let productName = extractProductNameFromLine(line);
      
      // If extraction failed, fall back to basic cleaning
      if (!productName || productName.length < 2) {
        productName = line;
        
        // Remove all price matches
        productName = productName.replace(pricePattern, '');
        
        // Remove quantity if found
        if (quantityMatch) {
          productName = productName.replace(quantityMatch[0], '');
        }
        
        // Remove common prefixes like item numbers
        productName = productName.replace(/^\s*\d+\s*/, '');
        
        // Clean up the product name
        productName = productName.replace(/\s+/g, ' ').trim();
        
        // Remove trailing/leading special characters
        productName = productName.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      }
      
      if (productName.length > 2) {
        // Use the last price as the total amount for this item
        const itemTotal = prices[prices.length - 1];
        // If we have multiple prices, the first might be unit price
        const unitPrice = prices.length > 1 ? prices[0] : itemTotal / quantity;
        
        products.push({
          name: productName,
          price: unitPrice,
          quantity: quantity,
          confidence: 0.85
        });
      }
    }
  }

  // Post-processing: remove duplicates and clean up
  const uniqueProducts = products.filter((product, index, self) => 
    index === self.findIndex(p => p.name.toLowerCase() === product.name.toLowerCase())
  );

  return {
    products: uniqueProducts,
    totalAmount,
    merchantName,
    date,
    confidence: uniqueProducts.length > 0 ? 0.85 : 0.3
  };
}

// Main function to process receipt image
export async function processReceiptImage(imageBuffer: Buffer): Promise<ProcessingResult> {
  try {
    const textLines = await extractTextFromImage(imageBuffer);
    const receiptData = parseReceiptText(textLines);
    
    return {
      success: true,
      data: receiptData
    };
  } catch (error) {
    console.error('Error processing receipt image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Function to validate Azure configuration
export function validateAzureConfig(): boolean {
  return !!(AZURE_ENDPOINT && 
           AZURE_API_KEY && 
           AZURE_REGION && 
           AZURE_ENDPOINT !== 'your-azure-endpoint-here' && 
           AZURE_API_KEY !== 'your-azure-api-key-here' &&
           client !== null);
}

export default {
  extractTextFromImage,
  parseReceiptText,
  processReceiptImage,
  validateAzureConfig
};