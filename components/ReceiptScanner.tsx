/**
 * ReceiptScanner Component
 * 
 * Upload component for receipt scanning with drag-and-drop support,
 * file input, image preview, and API integration.
 * 
 * Requirements: 1.1
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
  Slider,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import Crop from '@mui/icons-material/Crop';
import Check from '@mui/icons-material/Check';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/cropImage';
import { ScanReceiptResponse } from '@/lib/receiptTypes';

interface ReceiptScannerProps {
  onScanComplete?: (result: ScanReceiptResponse) => void;
  onCancel?: () => void;
  provider?: 'azure' | 'aws'; // OCR provider to use
  title?: string; // Custom title for the scanner
}

export default function ReceiptScanner({ onScanComplete, onCancel, provider = 'aws', title }: ReceiptScannerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop state
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64 string
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Crop complete callback
  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Handle crop and scan
  const handleCropAndScan = async () => {
    if (!selectedImage || !croppedAreaPixels) return;

    try {
      setShowCropModal(false);
      setIsScanning(true);
      setError(null);

      // Get cropped image blob
      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);

      // Convert blob to base64
      const arrayBuffer = await croppedBlob.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString('base64');

      // Process the cropped image
      await processReceipt(base64Image);
    } catch (error) {
      console.error('Crop error:', error);
      setError('Failed to crop image');
      setIsScanning(false);
    }
  };

  // Handle skip crop
  const handleSkipCrop = async () => {
    if (!selectedImage) return;

    try {
      setShowCropModal(false);
      setIsScanning(true);
      setError(null);

      // Extract base64 from data URL
      const base64Image = selectedImage.split(',')[1];

      await processReceipt(base64Image);
    } catch (error) {
      console.error('Processing error:', error);
      setError('Failed to process receipt');
      setIsScanning(false);
    }
  };

  // Process receipt with given base64 image
  const processReceipt = async (base64Image: string) => {
    try {
      // Get admin and session info for tracking
      const adminSession = localStorage.getItem('admin_session');
      const sessionId = localStorage.getItem('tracking_session_id');
      const admin = adminSession ? JSON.parse(adminSession) : null;

      // Call scan API with provider specification and tracking info
      const response = await fetch('/api/admin/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          provider: provider, // Specify OCR provider
          admin_id: admin?.id, // For tracking
          session_id: sessionId, // For tracking
        }),
      });

      const result: ScanReceiptResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to scan receipt');
      }

      if (result.success && onScanComplete) {
        onScanComplete(result);
      } else if (!result.success) {
        setError(result.error || 'Failed to extract products from receipt');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while scanning');
    } finally {
      setIsScanning(false);
    }
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

    // Store original file and show crop modal
    setOriginalFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
      setShowCropModal(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);



  // Clear selected image
  const handleClear = () => {
    setSelectedImage(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {title || 'Scan Receipt'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload a receipt image to automatically extract product names and prices
        {provider === 'aws' && (
          <Typography component="span" variant="caption" display="block" sx={{ mt: 1, color: 'primary.main' }}>
            Using AWS Textract (Enhanced accuracy)
          </Typography>
        )}
        {provider === 'azure' && (
          <Typography component="span" variant="caption" display="block" sx={{ mt: 1, color: 'info.main' }}>
            Using Azure OCR
          </Typography>
        )}
      </Typography>

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

      {/* Crop Modal */}
      <Dialog
        open={showCropModal}
        onClose={() => setShowCropModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Crop />
            <Typography variant="h6">Crop Receipt Image</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ position: 'relative', width: '100%', height: 400, bgcolor: 'grey.900' }}>
            {selectedImage && (
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </Box>
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" gutterBottom>
              Zoom
            </Typography>
            <Slider
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e, value) => setZoom(value as number)}
              sx={{ mt: 1 }}
            />
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>
            Adjust the crop area to focus on the product table. Freestyle cropping enabled.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setShowCropModal(false)}
            startIcon={<CloseIcon />}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSkipCrop}
            variant="outlined"
          >
            Skip Crop
          </Button>
          <Button
            onClick={handleCropAndScan}
            variant="contained"
            startIcon={<Check />}
            disabled={!croppedAreaPixels}
          >
            Crop & Scan
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}