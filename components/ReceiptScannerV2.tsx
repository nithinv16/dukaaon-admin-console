/**
 * ReceiptScanner V2.0 Component
 * 
 * Enhanced receipt scanning with intelligent product extraction
 * Uses AWS Textract + AI for accurate product mapping
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  CircularProgress,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { ExtractedProductV2 } from '@/lib/receiptExtractionV2';

interface ReceiptScannerV2Props {
  open: boolean;
  onClose: () => void;
  onScanComplete?: (products: ExtractedProductV2[]) => void;
  onCancel?: () => void;
}

export default function ReceiptScannerV2({
  open,
  onClose,
  onScanComplete,
  onCancel,
}: ReceiptScannerV2Props) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, or WebP)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  // Handle scan submission
  const handleScan = async () => {
    if (!selectedImage) return;

    setIsScanning(true);
    setError(null);

    try {
      // Extract base64 from data URL
      const base64Image = selectedImage.split(',')[1];

      // Get seller ID from sessionStorage if available
      const sellerId = sessionStorage.getItem('receiptScanSellerId') || '';

      // Call scan API V2
      const response = await fetch('/api/admin/scan-receipt-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          seller_id: sellerId || undefined, // Pass seller ID for AI matching
        }),
      });

      // Try to parse response as JSON, with better error handling
      let result;
      try {
        const responseText = await response.text();
        if (!responseText || responseText.trim() === '') {
          throw new Error('Server returned an empty response. This may indicate a timeout or server error. Please try again.');
        }
        result = JSON.parse(responseText);
      } catch (parseError) {
        // If JSON parsing fails, the server likely crashed or timed out
        console.error('Failed to parse response:', parseError);
        throw new Error(
          'Failed to process the receipt. The server may have timed out or encountered an error. ' +
          'Please ensure AWS Bedrock credentials are configured correctly and try again. ' +
          'If the issue persists, check the server logs for more details.'
        );
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to scan receipt');
      }

      if (result.success && result.products && result.products.length > 0) {
        if (onScanComplete) {
          onScanComplete(result.products);
        }
        handleClose();
      } else {
        setError(result.error || 'No products found in receipt');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while scanning');
    } finally {
      setIsScanning(false);
    }
  };

  // Clear selected image
  const handleClear = () => {
    setSelectedImage(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle dialog close
  const handleClose = () => {
    handleClear();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Scan Receipt 2.0
        <Typography variant="caption" display="block" sx={{ mt: 1, color: 'primary.main' }}>
          Enhanced AI-powered extraction with AWS Textract + Claude Sonnet 4.5 (AI Only)
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ width: '100%', p: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {!selectedImage ? (
            <Paper
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                border: 2,
                borderStyle: 'dashed',
                borderColor: isDragging ? 'primary.main' : 'grey.300',
                bgcolor: isDragging ? 'action.hover' : 'background.paper',
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Drop receipt image here
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                or click to browse files
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Supported formats: JPEG, PNG, WebP (max 10MB)
              </Typography>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
            </Paper>
          ) : (
            <Box>
              <Paper sx={{ p: 2, mb: 2, position: 'relative' }}>
                <IconButton
                  onClick={handleClear}
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                  size="small"
                >
                  <CloseIcon />
                </IconButton>
                <Typography variant="subtitle2" gutterBottom>
                  Preview
                </Typography>
                <Box
                  component="img"
                  src={selectedImage}
                  alt="Receipt preview"
                  sx={{
                    width: '100%',
                    maxHeight: 400,
                    objectFit: 'contain',
                    border: 1,
                    borderColor: 'grey.300',
                    borderRadius: 1,
                  }}
                />
              </Paper>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel || handleClose} disabled={isScanning}>
          Cancel
        </Button>
        {selectedImage && (
          <Button
            variant="contained"
            onClick={handleScan}
            disabled={isScanning}
            startIcon={isScanning ? <CircularProgress size={20} /> : <CameraAltIcon />}
          >
            {isScanning ? 'Scanning...' : 'Extract Products'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}


