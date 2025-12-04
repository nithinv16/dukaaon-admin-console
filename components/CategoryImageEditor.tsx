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

interface CategoryImageEditorProps {
  open: boolean;
  onClose: () => void;
  currentImage?: string;
  categoryName: string;
  categoryId: string;
  type: 'category' | 'subcategory';
  onImageUpdate: (newImageUrl: string) => void;
}

export default function CategoryImageEditor({
  open,
  onClose,
  currentImage,
  categoryName,
  categoryId,
  type,
  onImageUpdate,
}: CategoryImageEditorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(currentImage || '');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update preview when currentImage changes
  React.useEffect(() => {
    setPreviewUrl(currentImage || '');
  }, [currentImage]);

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
      formData.append('categoryName', categoryName);
      formData.append('categoryId', categoryId);
      formData.append('type', type);
      
      // Include current image URL so the API can delete the old image
      if (currentImage) {
        formData.append('currentImageUrl', currentImage);
      }

      // Upload to your backend endpoint
      const response = await fetch('/api/upload-category-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload image');
      }

      const result = await response.json();
      
      // Update the image URL
      onImageUpdate(result.imageUrl);
      toast.success('Image updated successfully!');
      onClose();
      
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image. Please try again.');
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

  const handleRemoveImage = async () => {
    try {
      setUploading(true);
      
      // Update the database to remove the image URL
      const response = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: categoryId,
          type: type,
          image_url: null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove image');
      }

      setSelectedFile(null);
      setPreviewUrl('');
      onImageUpdate('');
      toast.success('Image removed');
      onClose();
    } catch (error) {
      console.error('Error removing image:', error);
      toast.error('Failed to remove image. Please try again.');
    } finally {
      setUploading(false);
    }
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
            Edit {type === 'category' ? 'Category' : 'Subcategory'} Image - {categoryName}
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
                  alt={categoryName}
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
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              sx={{
                height: 250,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: dragOver ? 'action.hover' : 'grey.50',
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : 'grey.300',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={handleUploadClick}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
              <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {dragOver ? 'Drop image here' : 'Click or drag image here'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                PNG, JPG, GIF up to 5MB
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {uploading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Uploading image...
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleReset}
          startIcon={<Refresh />}
          disabled={uploading || !selectedFile}
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
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<Save />}
          disabled={uploading || !selectedFile}
        >
          {uploading ? 'Uploading...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


