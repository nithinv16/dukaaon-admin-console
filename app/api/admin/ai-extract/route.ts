/**
 * AI Extraction API Route
 * 
 * Accepts image buffer, returns AI-extracted products with confidence scores and review flags.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractFromImage, matchProductsWithMasterData } from '@/lib/aiExtractionService';
import type { AIExtractionResult } from '@/lib/aiExtractionService';

export interface AIExtractRequest {
  image: string; // Base64 encoded image
}

export interface AIExtractResponse {
  success: boolean;
  data?: AIExtractionResult;
  error?: string;
}

/**
 * POST /api/admin/ai-extract
 * 
 * Extract products from an image using AI
 * 
 * Request body:
 * - image: Base64 encoded image string
 * 
 * Response:
 * - success: boolean
 * - data: AIExtractionResult with products, confidence scores, and review flags
 * - error: string (if failed)
 */
export async function POST(request: NextRequest): Promise<NextResponse<AIExtractResponse>> {
  try {
    const body = await request.json() as AIExtractRequest;

    if (!body.image) {
      return NextResponse.json(
        { success: false, error: 'Image data is required' },
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
        { success: false, error: 'Invalid image data format' },
        { status: 400 }
      );
    }

    // Validate image buffer size
    if (imageBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empty image data' },
        { status: 400 }
      );
    }

    // Maximum image size: 10MB
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Image size exceeds maximum allowed (10MB)' },
        { status: 400 }
      );
    }

    // Extract products from image using AI (Requirements 1.1, 1.2, 1.3)
    const extractionResult = await extractFromImage(imageBuffer);

    if (!extractionResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: extractionResult.error || 'Failed to extract products from image' 
        },
        { status: 500 }
      );
    }

    // Enrich products with master product data (Requirements 3.4, 3.5)
    const enrichedProducts = await matchProductsWithMasterData(extractionResult.products);

    // Return result with confidence scores and review flags (Requirements 1.5, 1.6)
    const result: AIExtractionResult = {
      ...extractionResult,
      products: enrichedProducts,
    };

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Error in AI extraction API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
