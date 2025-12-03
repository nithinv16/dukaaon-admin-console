/**
 * Scan Receipt V2.0 API Route
 * 
 * Enhanced receipt scanning focused ONLY on product extraction
 * Uses AWS Textract + AI (Claude Sonnet 4.5) exclusively for intelligent extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractProductsFromReceiptV2 } from '@/lib/receiptExtractionV2';
import type { ExtractedProductV2, ReceiptExtractionResultV2 } from '@/lib/receiptExtractionV2';

export interface ScanReceiptV2Request {
  image: string; // Base64 encoded image
}

export interface ScanReceiptV2Response {
  success: boolean;
  products: ExtractedProductV2[];
  confidence: number;
  metadata?: {
    totalItems: number;
    totalAmount: number;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ScanReceiptV2Response>> {
  try {
    // Parse request body with error handling
    let body: ScanReceiptV2Request;
    try {
      const requestBody = await request.json();
      body = requestBody as ScanReceiptV2Request;
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        {
          success: false,
          products: [],
          confidence: 0,
          error: 'Invalid request format. Expected JSON with image field.',
        },
        { status: 400 }
      );
    }

    // Validate image data
    if (!body.image) {
      return NextResponse.json(
        {
          success: false,
          products: [],
          confidence: 0,
          error: 'Image data is required',
        },
        { status: 400 }
      );
    }

    // Decode base64 image to buffer
    let imageBuffer: Buffer;
    try {
      const base64Data = body.image.includes(',')
        ? body.image.split(',')[1]
        : body.image;
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch {
      return NextResponse.json(
        {
          success: false,
          products: [],
          confidence: 0,
          error: 'Invalid image data format',
        },
        { status: 400 }
      );
    }

    // Validate image buffer
    if (imageBuffer.length === 0) {
      return NextResponse.json(
        {
          success: false,
          products: [],
          confidence: 0,
          error: 'Empty image data',
        },
        { status: 400 }
      );
    }

    // Validate image size (max 10MB)
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          products: [],
          confidence: 0,
          error: 'Image size exceeds maximum allowed (10MB)',
        },
        { status: 400 }
      );
    }

    // Validate image format
    const isValidFormat = isValidImageFormat(imageBuffer);
    if (!isValidFormat) {
      return NextResponse.json(
        {
          success: false,
          products: [],
          confidence: 0,
          error: 'Invalid image format. Supported: JPEG, PNG, WebP',
        },
        { status: 400 }
      );
    }

    // Extract products using V2 service
    let result: ReceiptExtractionResultV2;
    try {
      result = await extractProductsFromReceiptV2(imageBuffer);
    } catch (extractionError: any) {
      console.error('Error in product extraction:', extractionError);
      return NextResponse.json(
        {
          success: false,
          products: [],
          confidence: 0,
          error: extractionError.message || 'Failed to extract products from receipt',
        },
        { status: 500 }
      );
    }

    // Ensure result is valid
    if (!result) {
      return NextResponse.json(
        {
          success: false,
          products: [],
          confidence: 0,
          error: 'Extraction service returned invalid result',
        },
        { status: 500 }
      );
    }

    const statusCode = result.success ? 200 : 500;

    return NextResponse.json(
      {
        success: result.success,
        products: result.products || [],
        confidence: result.confidence || 0,
        metadata: result.metadata,
        error: result.error,
      },
      { status: statusCode }
    );
  } catch (error: any) {
    console.error('Error in scan receipt V2 API:', error);
    // Ensure we always return valid JSON, even on unexpected errors
    const errorMessage = error?.message || String(error) || 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        products: [],
        confidence: 0,
        error: `Server error: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

/**
 * Validates image format by checking magic bytes
 */
function isValidImageFormat(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return true;
  }

  return false;
}


