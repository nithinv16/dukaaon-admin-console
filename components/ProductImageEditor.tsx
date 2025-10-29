'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Grid,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Edit,
  CloudUpload,
  Delete,
  Close,
  Save,
  Refresh,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

interface ProductImageEditorProps {
  open: boolean;
  onClose: () => void;
  currentImage?: string;
  productName: string;
  productId?: string;
  onImageUpdate: (newImageUrl: string) => void;
}

export default function ProductImageEditor({
  open,
  onClose,
  currentImage,
  productName,
  productId,
  onImageUpdate,
}: ProductImageEditorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(currentImage || '');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('Image size should be less than 5MB');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, []);

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSave = async () => {
    if (!selectedFile) {
      toast.error('Please select an image to upload');
      return;
    }

    try {
      setUploading(true);
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('productName', productName);
      
      // Include product ID for database updates
      if (productId) {
        formData.append('productId', productId);
      }
      
      // Include current image URL so the API can delete the old image
      if (currentImage) {
        formData.append('currentImageUrl', currentImage);
      }

      // Upload to your backend endpoint
      const response = await fetch('/api/upload-product-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const result = await response.json();
      
      // Update the image URL
      onImageUpdate(result.imageUrl);
      toast.success('Image updated successfully!');
      onClose();
      
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(currentImage || '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    onImageUpdate('');
    toast.success('Image removed');
    onClose();
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            Edit Product Image - {productName}
          </Typography>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={3}>
          {/* Current Image Preview */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Current Image
            </Typography>
            <Paper
              sx={{
                height: 250,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'grey.50',
                border: '2px dashed',
                borderColor: 'grey.300',
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={productName}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <Typography color="text.secondary">
                  No image selected
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Upload Area */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Upload New Image
            </Typography>
            <Paper
              sx={{
                height: 250,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: dragOver ? 'primary.50' : 'grey.50',
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : 'grey.300',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'primary.50',
                },
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleUploadClick}
            >
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Drop image here or click to browse
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Supports: JPG, PNG, GIF (Max 5MB)
              </Typography>
            </Paper>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
          </Grid>

          {/* Upload Status */}
          {selectedFile && (
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </Typography>
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button
          onClick={handleReset}
          startIcon={<Refresh />}
          disabled={uploading}
        >
          Reset
        </Button>
        
        {currentImage && (
          <Button
            onClick={handleRemoveImage}
            startIcon={<Delete />}
            color="error"
            disabled={uploading}
          >
            Remove Image
          </Button>
        )}
        
        <Button
          onClick={handleClose}
          disabled={uploading}
        >
          Cancel
        </Button>
        
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={uploading ? <CircularProgress size={20} /> : <Save />}
          disabled={!selectedFile || uploading}
        >
          {uploading ? 'Uploading...' : 'Save Image'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}