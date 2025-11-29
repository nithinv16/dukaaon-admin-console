/**
 * Receipt Scanner API Route
 * 
 * Accepts base64 image, validates format and size, scans receipt using ReceiptScannerService,
 * and returns extracted products with metadata.
 * 
 * Requirements: 1.1, 1.4, 3.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanReceipt } from '@/lib/receiptScannerService';
import type { ScanReceiptRequest, ScanReceiptResponse } from '@/lib/receiptTypes';
import { processReceiptImage } from '@/lib/unifiedOCR';
import type { OCRProvider } from '@/lib/unifiedOCR';
import { trackReceiptScan, endActivityTracking, getClientIP } from '@/lib/employeeTracking';

/**
 * POST /api/admin/scan-receipt
 * 
 * Scan a receipt image and extract products with calculated unit prices
 * 
 * Request body:
 * - image: Base64 encoded image string
 * 
 * Response:
 * - success: boolean
 * - products: Array of extracted products with unit prices
 * - metadata: Receipt metadata (format type, merchant, invoice number, etc.)
 * - confidence: Overall confidence score
 * - error: string (if failed)
 * 
 * Requirements: 1.1, 1.4, 3.5
 */
export async function POST(request: NextRequest): Promise<NextResponse<ScanReceiptResponse>> {
  let trackingId: string | undefined;

  try {
    const body = await request.json() as ScanReceiptRequest & { admin_id?: string, session_id?: string };

    // Start tracking if admin_id provided
    if (body.admin_id) {
      try {
        const tracking = await trackReceiptScan(
          body.admin_id,
          body.session_id,
          0, // Will update with actual count later
          { image_size: body.image?.length || 0 },
          getClientIP(request)
        );
        trackingId = tracking.operationId;
      } catch (trackError) {
        console.error('Failed to start tracking:', trackError);
        // Continue without tracking if it fails
      }
    }

    // Validate image data is provided
    // Requirements: 3.5
    if (!body.image) {
      if (trackingId) {
        await endActivityTracking(trackingId, 'failed', 'Image data is required');
      }
      return NextResponse.json(
        {
          success: false,
          products: [],
          metadata: { formatType: 'unknown' },
          confidence: 0,
          error: 'Image data is required'
        },
        { status: 400 }
      );
    }

    // Decode base64 image to buffer
    let imageBuffer: Buffer;
    try {
      // Handle data URL format (e.g., "data:image/png;base64,...")
      const base64Data = body.image.includes(',')
        ? body.image.split(',')[1]
        : body.image;
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch {
      return NextResponse.json(
        {
          success: false,
          products: [],
          metadata: { formatType: 'unknown' },
          confidence: 0,
          error: 'Invalid image data format'
        },
        { status: 400 }
      );
    }

    // Validate image buffer is not empty
    // Requirements: 3.5
    if (imageBuffer.length === 0) {
      return NextResponse.json(
        {
          success: false,
          products: [],
          metadata: { formatType: 'unknown' },
          confidence: 0,
          error: 'Empty image data'
        },
        { status: 400 }
      );
    }

    // Validate image size (maximum 10MB)
    // Requirements: 3.5
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          products: [],
          metadata: { formatType: 'unknown' },
          confidence: 0,
          error: 'Image size exceeds maximum allowed (10MB)'
        },
        { status: 400 }
      );
    }

    // Validate image format by checking magic bytes
    // Requirements: 3.5
    const isValidFormat = isValidImageFormat(imageBuffer);
    if (!isValidFormat) {
      return NextResponse.json(
        {
          success: false,
          products: [],
          metadata: { formatType: 'unknown' },
          confidence: 0,
          error: 'Invalid image format. Supported formats: JPEG, PNG, WebP'
        },
        { status: 400 }
      );
    }

    // Determine which provider to use
    const provider: OCRProvider = body.provider || 'aws'; // Default to AWS for advanced features

    let response: ScanReceiptResponse;

    if (provider === 'azure') {
      // Use unified OCR for Azure (simpler extraction)
      // Requirements: 1.1, 1.4
      const unifiedResult = await processReceiptImage(imageBuffer, 'azure');

      if (!unifiedResult.success || !unifiedResult.data) {
        return NextResponse.json(
          {
            success: false,
            products: [],
            metadata: { formatType: 'unknown' },
            confidence: 0,
            error: unifiedResult.error || 'Failed to scan receipt',
          },
          { status: 500 }
        );
      }

      // Convert unified OCR result to ScanReceiptResponse format
      response = {
        success: true,
        products: unifiedResult.data.products.map((p, index) => ({
          id: `prod_${Date.now()}_${index}`,
          name: p.name,
          originalName: p.name,
          quantity: p.quantity || 1,
          netAmount: p.price * (p.quantity || 1),
          unitPrice: p.price,
          confidence: p.confidence,
          needsReview: p.confidence < 0.7,
          originalText: p.name,
          fieldConfidences: {
            name: p.confidence,
            quantity: p.confidence,
            netAmount: p.confidence,
          },
        })),
        metadata: {
          formatType: 'simple_list',
          merchantName: unifiedResult.data.merchantName,
          date: unifiedResult.data.date,
          totalAmount: unifiedResult.data.totalAmount,
        },
        confidence: unifiedResult.data.confidence,
      };
    } else {
      // Use advanced ReceiptScannerService for AWS Textract (table parsing, column mapping)
      // Requirements: 1.1, 1.4
      const scanResult = await scanReceipt(imageBuffer);

      // Return scan result
      // Requirements: 1.4
      response = {
        success: scanResult.success,
        products: scanResult.products,
        metadata: scanResult.metadata,
        confidence: scanResult.confidence,
        error: scanResult.error,
      };
    }

    // Return appropriate status code based on success
    const statusCode = response.success ? 200 : 500;

    // End tracking with product count
    if (trackingId) {
      await endActivityTracking(
        trackingId,
        response.success ? 'success' : 'failed',
        response.error,
        response.products.length
      );
    }

    return NextResponse.json(response, { status: statusCode });

  } catch (error) {
    console.error('Error in receipt scanner API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // End tracking with failure
    if (trackingId) {
      await endActivityTracking(trackingId, 'failed', errorMessage);
    }

    return NextResponse.json(
      {
        success: false,
        products: [],
        metadata: { formatType: 'unknown' },
        confidence: 0,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

/**
 * Validates image format by checking magic bytes (file signature)
 * Supported formats: JPEG, PNG, WebP
 * 
 * Requirements: 3.5
 */
function isValidImageFormat(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }

  // Check for JPEG (FF D8 FF)
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return true;
  }

  // Check for PNG (89 50 4E 47)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return true;
  }

  // Check for WebP (52 49 46 46 ... 57 45 42 50)
  if (buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return true;
  }

  return false;
}
