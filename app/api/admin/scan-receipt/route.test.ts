/**
 * Receipt Scanner API Route Tests
 * 
 * Unit tests for the scan-receipt API endpoint.
 * Tests successful scan response format and error responses for invalid images.
 * 
 * Requirements: 1.1, 3.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import * as receiptScannerService from '@/lib/receiptScannerService';
import type { ScanResult } from '@/lib/receiptTypes';

// Mock the receiptScannerService
vi.mock('@/lib/receiptScannerService', () => ({
  scanReceipt: vi.fn(),
}));

describe('POST /api/admin/scan-receipt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test successful scan response format
   * Requirements: 1.1, 1.4
   */
  it('should return successful scan result with correct response format', async () => {
    // Mock successful scan result
    const mockScanResult: ScanResult = {
      success: true,
      products: [
        {
          id: 'prod_1',
          name: 'Test Product',
          originalName: 'Test Product',
          quantity: 10,
          netAmount: 100,
          unitPrice: 10,
          confidence: 0.9,
          needsReview: false,
          originalText: 'Test Product',
          fieldConfidences: {
            name: 0.9,
            quantity: 0.9,
            netAmount: 0.9,
          },
        },
      ],
      metadata: {
        formatType: 'tax_invoice',
        merchantName: 'Test Merchant',
        invoiceNumber: 'INV-001',
      },
      confidence: 0.9,
      mappingLog: [],
    };

    vi.mocked(receiptScannerService.scanReceipt).mockResolvedValue(mockScanResult);

    // Create a valid base64 JPEG image (minimal valid JPEG header)
    const validJpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const base64Image = validJpegBuffer.toString('base64');

    const request = new NextRequest('http://localhost:3000/api/admin/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ image: base64Image }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Verify response format
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.products).toHaveLength(1);
    expect(data.products[0]).toMatchObject({
      id: 'prod_1',
      name: 'Test Product',
      quantity: 10,
      netAmount: 100,
      unitPrice: 10,
    });
    expect(data.metadata).toMatchObject({
      formatType: 'tax_invoice',
      merchantName: 'Test Merchant',
    });
    expect(data.confidence).toBe(0.9);
    expect(data.error).toBeUndefined();
  });

  /**
   * Test error response for missing image data
   * Requirements: 3.5
   */
  it('should return 400 error when image data is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Image data is required');
    expect(data.products).toEqual([]);
    expect(data.metadata.formatType).toBe('unknown');
  });

  /**
   * Test error response for invalid base64 format
   * Requirements: 3.5
   */
  it('should return 400 error for invalid base64 format', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ image: 'not-valid-base64!!!' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    // Invalid base64 gets decoded but fails image format validation
    expect(data.error).toBe('Invalid image format. Supported formats: JPEG, PNG, WebP');
  });

  /**
   * Test error response for empty image data
   * Requirements: 3.5
   */
  it('should return 400 error for empty image data', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ image: '' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    // Empty string is caught by the "image data is required" check
    expect(data.error).toBe('Image data is required');
  });

  /**
   * Test error response for image size exceeding limit
   * Requirements: 3.5
   */
  it('should return 400 error when image size exceeds 10MB', async () => {
    // Create a buffer larger than 10MB
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    const base64Image = largeBuffer.toString('base64');

    const request = new NextRequest('http://localhost:3000/api/admin/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ image: base64Image }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Image size exceeds maximum allowed (10MB)');
  });

  /**
   * Test error response for invalid image format
   * Requirements: 3.5
   */
  it('should return 400 error for invalid image format (not JPEG, PNG, or WebP)', async () => {
    // Create a buffer with invalid magic bytes (not JPEG, PNG, or WebP)
    const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    const base64Image = invalidBuffer.toString('base64');

    const request = new NextRequest('http://localhost:3000/api/admin/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ image: base64Image }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid image format. Supported formats: JPEG, PNG, WebP');
  });

  /**
   * Test successful scan with PNG image
   * Requirements: 3.5
   */
  it('should accept valid PNG image format', async () => {
    const mockScanResult: ScanResult = {
      success: true,
      products: [],
      metadata: { formatType: 'unknown' },
      confidence: 0,
      mappingLog: [],
    };

    vi.mocked(receiptScannerService.scanReceipt).mockResolvedValue(mockScanResult);

    // Create a valid PNG image (PNG magic bytes)
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const base64Image = validPngBuffer.toString('base64');

    const request = new NextRequest('http://localhost:3000/api/admin/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ image: base64Image }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  /**
   * Test successful scan with WebP image
   * Requirements: 3.5
   */
  it('should accept valid WebP image format', async () => {
    const mockScanResult: ScanResult = {
      success: true,
      products: [],
      metadata: { formatType: 'unknown' },
      confidence: 0,
      mappingLog: [],
    };

    vi.mocked(receiptScannerService.scanReceipt).mockResolvedValue(mockScanResult);

    // Create a valid WebP image (WebP magic bytes: RIFF....WEBP)
    const validWebPBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // file size (placeholder)
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    const base64Image = validWebPBuffer.toString('base64');

    const request = new NextRequest('http://localhost:3000/api/admin/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ image: base64Image }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  /**
   * Test handling of data URL format (with prefix)
   * Requirements: 1.1
   */
  it('should handle data URL format with prefix', async () => {
    const mockScanResult: ScanResult = {
      success: true,
      products: [],
      metadata: { formatType: 'unknown' },
      confidence: 0,
      mappingLog: [],
    };

    vi.mocked(receiptScannerService.scanReceipt).mockResolvedValue(mockScanResult);

    // Create a valid JPEG with data URL prefix
    const validJpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const base64Image = `data:image/jpeg;base64,${validJpegBuffer.toString('base64')}`;

    const request = new NextRequest('http://localhost:3000/api/admin/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ image: base64Image }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  /**
   * Test error response when scan fails
   * Requirements: 3.5
   */
  it('should return 500 error when scan fails', async () => {
    const mockScanResult: ScanResult = {
      success: false,
      products: [],
      metadata: { formatType: 'unknown' },
      confidence: 0,
      mappingLog: [],
      error: 'No text detected in the image',
    };

    vi.mocked(receiptScannerService.scanReceipt).mockResolvedValue(mockScanResult);

    const validJpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const base64Image = validJpegBuffer.toString('base64');

    const request = new NextRequest('http://localhost:3000/api/admin/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ image: base64Image }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('No text detected in the image');
  });

  /**
   * Test error response when scanner throws exception
   * Requirements: 3.5
   */
  it('should return 500 error when scanner throws exception', async () => {
    vi.mocked(receiptScannerService.scanReceipt).mockRejectedValue(
      new Error('Internal scanner error')
    );

    const validJpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const base64Image = validJpegBuffer.toString('base64');

    const request = new NextRequest('http://localhost:3000/api/admin/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ image: base64Image }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal scanner error');
  });
});
