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

  // Patterns for different data extraction
  const pricePattern = /\$?([0-9]+\.?[0-9]*)/;
  const datePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
  const totalPattern = /total|sum|amount/i;

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i].trim();
    
    // Extract merchant name (usually first few lines)
    if (i < 3 && !merchantName && line.length > 3 && !pricePattern.test(line)) {
      merchantName = line;
    }

    // Extract date
    const dateMatch = line.match(datePattern);
    if (dateMatch && !date) {
      date = dateMatch[0];
    }

    // Extract total amount
    if (totalPattern.test(line)) {
      const priceMatch = line.match(pricePattern);
      if (priceMatch) {
        totalAmount = parseFloat(priceMatch[1]);
      }
    }

    // Extract products (lines with prices that aren't totals)
    const priceMatch = line.match(pricePattern);
    if (priceMatch && !totalPattern.test(line)) {
      const price = parseFloat(priceMatch[1]);
      const productName = line.replace(pricePattern, '').trim();
      
      if (productName.length > 0 && price > 0) {
        products.push({
          name: productName,
          price: price,
          confidence: 0.8 // Base confidence score
        });
      }
    }
  }

  return {
    products,
    totalAmount,
    merchantName,
    date,
    confidence: products.length > 0 ? 0.8 : 0.3
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