import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
import { CognitiveServicesCredentials } from '@azure/ms-rest-azure-js';
import { ReadResult } from '@azure/cognitiveservices-computervision/esm/models';

// Azure Computer Vision configuration
const AZURE_ENDPOINT = process.env.NEXT_PUBLIC_AZURE_ENDPOINT || '';
const AZURE_API_KEY = process.env.AZURE_API_KEY || '';
const AZURE_REGION = process.env.AZURE_REGION || 'eastus';

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

  // Enhanced patterns for different data extraction
  const pricePattern = /\$?([0-9]+\.?[0-9]*)/g;
  const datePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
  const totalPattern = /total|sum|amount|grand|net/i;
  
  // Patterns for tabular receipt data (like the samples provided)
  const productLinePattern = /^(.+?)\s+(\d+)\s+([0-9.]+)\s+([0-9.]+)\s+.*?([0-9.]+)$/;
  const quantityPattern = /\b(\d+)\b/;
  const amountPattern = /([0-9]+\.?[0-9]*)\s*$/;

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i].trim();
    
    // Skip empty lines and headers
    if (!line || line.length < 3) continue;
    
    // Extract merchant name (usually first few lines, avoid lines with numbers)
    if (i < 5 && !merchantName && line.length > 3 && !/\d/.test(line) && !line.includes('HSN') && !line.includes('MRP')) {
      merchantName = line;
    }

    // Extract date
    const dateMatch = line.match(datePattern);
    if (dateMatch && !date) {
      date = dateMatch[0];
    }

    // Extract total amount (look for lines with "total", "grand", "net" etc.)
    if (totalPattern.test(line)) {
      const amounts = line.match(pricePattern);
      if (amounts && amounts.length > 0) {
        // Take the last/largest amount as total
        const lastAmount = amounts[amounts.length - 1];
        totalAmount = parseFloat(lastAmount.replace('$', ''));
      }
    }

    // Try to extract products using tabular format pattern
    const tabularMatch = line.match(productLinePattern);
    if (tabularMatch) {
      const [, productName, , , , totalPrice] = tabularMatch;
      const price = parseFloat(totalPrice);
      const quantityMatch = line.match(quantityPattern);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
      
      if (productName && price > 0) {
        products.push({
          name: productName.trim(),
          price: price,
          quantity: quantity,
          confidence: 0.9
        });
      }
    } else {
      // Fallback: Extract products from lines containing product names and prices
       const amounts = Array.from(line.matchAll(pricePattern));
      if (amounts.length > 0 && !totalPattern.test(line) && !line.includes('HSN') && !line.includes('MRP')) {
        // Look for product name at the beginning of the line
        const productNameMatch = line.match(/^([A-Za-z\s]+)/);
        if (productNameMatch) {
          const productName = productNameMatch[1].trim();
          const price = parseFloat(amounts[amounts.length - 1][1]); // Take last price as total
          const quantityMatch = line.match(quantityPattern);
          const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
          
          // Filter out header lines and invalid entries
          if (productName.length > 2 && 
              !productName.toLowerCase().includes('name') && 
              !productName.toLowerCase().includes('item') &&
              !productName.toLowerCase().includes('product') &&
              price > 0) {
            products.push({
              name: productName,
              price: price,
              quantity: quantity,
              confidence: 0.8
            });
          }
        }
      }
    }
  }

  // Remove duplicate products (same name)
  const uniqueProducts = products.filter((product, index, self) => 
    index === self.findIndex(p => p.name.toLowerCase() === product.name.toLowerCase())
  );

  return {
    products: uniqueProducts,
    totalAmount,
    merchantName,
    date,
    confidence: uniqueProducts.length > 0 ? 0.8 : 0.3
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