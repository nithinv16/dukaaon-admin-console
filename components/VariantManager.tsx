/**
 * VariantManager Component
 * UI component for managing product variants
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Chip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Check,
  Close,
} from '@mui/icons-material';
import { VariantService, CreateVariantInput } from '@/lib/services/products/VariantService';
import toast from 'react-hot-toast';

export interface VariantManagerProps {
  productId?: string;
  productName?: string;
  variants?: CreateVariantInput[];
  onVariantsChange?: (variants: CreateVariantInput[]) => void;
  readOnly?: boolean;
}

export default function VariantManager({
  productId,
  productName = '',
  variants: initialVariants = [],
  onVariantsChange,
  readOnly = false,
}: VariantManagerProps) {
  const [variants, setVariants] = useState<CreateVariantInput[]>(initialVariants);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newVariant, setNewVariant] = useState<Partial<CreateVariantInput>>({
    variant_type: 'size',
    stock_quantity: 0,
    display_order: 0,
    is_default: false,
  });

  useEffect(() => {
    setVariants(initialVariants);
  }, [initialVariants]);

  useEffect(() => {
    if (onVariantsChange) {
      onVariantsChange(variants);
    }
  }, [variants, onVariantsChange]);

  const variantTypes = [
    { value: 'size', label: 'Size' },
    { value: 'flavor', label: 'Flavor' },
    { value: 'color', label: 'Color' },
    { value: 'weight', label: 'Weight' },
    { value: 'pack', label: 'Pack' },
  ];

  const handleAddVariant = () => {
    if (!newVariant.variant_value || !newVariant.price || newVariant.stock_quantity === undefined) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Generate SKU if not provided
    const sku = newVariant.sku || VariantService.generateSKU(
      productName,
      newVariant.variant_type || 'size',
      newVariant.variant_value
    );

    // If this is set as default, unset other defaults
    const updatedVariants = [...variants];
    if (newVariant.is_default) {
      updatedVariants.forEach(v => v.is_default = false);
    }

    const variant: CreateVariantInput = {
      product_id: productId || '',
      sku,
      variant_type: newVariant.variant_type || 'size',
      variant_value: newVariant.variant_value,
      price: parseFloat(newVariant.price.toString()),
      mrp: newVariant.mrp ? parseFloat(newVariant.mrp.toString()) : undefined,
      stock_quantity: parseInt(newVariant.stock_quantity.toString()),
      image_url: newVariant.image_url,
      is_default: newVariant.is_default || false,
      display_order: newVariant.display_order || updatedVariants.length,
    };

    updatedVariants.push(variant);
    setVariants(updatedVariants);
    setNewVariant({
      variant_type: 'size',
      stock_quantity: 0,
      display_order: updatedVariants.length,
      is_default: false,
    });
    setShowAddDialog(false);
    toast.success('Variant added');
  };

  const handleEditVariant = (index: number) => {
    setEditingIndex(index);
    setNewVariant({ ...variants[index] });
    setShowAddDialog(true);
  };

  const handleUpdateVariant = () => {
    if (editingIndex === null || !newVariant.variant_value || !newVariant.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    const updatedVariants = [...variants];
    
    // If this is set as default, unset other defaults
    if (newVariant.is_default) {
      updatedVariants.forEach((v, i) => {
        if (i !== editingIndex) v.is_default = false;
      });
    }

    updatedVariants[editingIndex] = {
      ...updatedVariants[editingIndex],
      ...newVariant,
      price: parseFloat(newVariant.price.toString()),
      mrp: newVariant.mrp ? parseFloat(newVariant.mrp.toString()) : undefined,
      stock_quantity: parseInt(newVariant.stock_quantity?.toString() || '0'),
    } as CreateVariantInput;

    setVariants(updatedVariants);
    setEditingIndex(null);
    setShowAddDialog(false);
    setNewVariant({
      variant_type: 'size',
      stock_quantity: 0,
      display_order: variants.length,
      is_default: false,
    });
    toast.success('Variant updated');
  };

  const handleDeleteVariant = (index: number) => {
    if (window.confirm('Are you sure you want to delete this variant?')) {
      const updatedVariants = variants.filter((_, i) => i !== index);
      setVariants(updatedVariants);
      toast.success('Variant deleted');
    }
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingIndex(null);
    setNewVariant({
      variant_type: 'size',
      stock_quantity: 0,
      display_order: variants.length,
      is_default: false,
    });
  };

  // Sort variants by display_order
  const sortedVariants = [...variants].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Product Variants</Typography>
        {!readOnly && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<Add />}
            onClick={() => setShowAddDialog(true)}
          >
            Add Variant
          </Button>
        )}
      </Box>

      {variants.length === 0 ? (
        <Alert severity="info">
          No variants added. Click "Add Variant" to create variants for this product.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {sortedVariants.map((variant, index) => {
            const actualIndex = variants.findIndex(v => v === variant);
            return (
              <Grid item xs={12} sm={6} md={4} key={actualIndex}>
                <Paper sx={{ p: 2, position: 'relative' }}>
                  {variant.is_default && (
                    <Chip
                      label="Default"
                      color="primary"
                      size="small"
                      sx={{ position: 'absolute', top: 8, right: 8 }}
                    />
                  )}
                  <Typography variant="subtitle2" gutterBottom>
                    {variant.variant_type.charAt(0).toUpperCase() + variant.variant_type.slice(1)}: {variant.variant_value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    SKU: {variant.sku}
                  </Typography>
                  <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
                    ₹{variant.price.toFixed(2)}
                    {variant.mrp && variant.mrp > variant.price && (
                      <Typography component="span" variant="body2" sx={{ textDecoration: 'line-through', ml: 1, color: 'text.secondary' }}>
                        ₹{variant.mrp.toFixed(2)}
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Stock: {variant.stock_quantity}
                  </Typography>
                  {!readOnly && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditVariant(actualIndex)}
                        color="primary"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteVariant(actualIndex)}
                        color="error"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Add/Edit Variant Dialog */}
      <Dialog open={showAddDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingIndex !== null ? 'Edit Variant' : 'Add Variant'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Variant Type</InputLabel>
                <Select
                  value={newVariant.variant_type || 'size'}
                  onChange={(e) => setNewVariant({ ...newVariant, variant_type: e.target.value as any })}
                  label="Variant Type"
                >
                  {variantTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Variant Value"
                value={newVariant.variant_value || ''}
                onChange={(e) => setNewVariant({ ...newVariant, variant_value: e.target.value })}
                placeholder="e.g., 250ml, Chocolate, Red, 500g"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="SKU"
                value={newVariant.sku || VariantService.generateSKU(
                  productName,
                  newVariant.variant_type || 'size',
                  newVariant.variant_value || ''
                )}
                onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
                helperText="Auto-generated if left empty"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Price"
                type="number"
                value={newVariant.price || ''}
                onChange={(e) => setNewVariant({ ...newVariant, price: parseFloat(e.target.value) || 0 })}
                inputProps={{ step: '0.01', min: '0' }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="MRP (Optional)"
                type="number"
                value={newVariant.mrp || ''}
                onChange={(e) => setNewVariant({ ...newVariant, mrp: e.target.value ? parseFloat(e.target.value) : undefined })}
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Stock Quantity"
                type="number"
                value={newVariant.stock_quantity || 0}
                onChange={(e) => setNewVariant({ ...newVariant, stock_quantity: parseInt(e.target.value) || 0 })}
                inputProps={{ min: '0' }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Display Order"
                type="number"
                value={newVariant.display_order || variants.length}
                onChange={(e) => setNewVariant({ ...newVariant, display_order: parseInt(e.target.value) || 0 })}
                inputProps={{ min: '0' }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Image URL (Optional)"
                value={newVariant.image_url || ''}
                onChange={(e) => setNewVariant({ ...newVariant, image_url: e.target.value })}
                placeholder="https://..."
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Default Variant</InputLabel>
                <Select
                  value={newVariant.is_default ? 'true' : 'false'}
                  onChange={(e) => setNewVariant({ ...newVariant, is_default: e.target.value === 'true' })}
                  label="Default Variant"
                >
                  <MenuItem value="false">No</MenuItem>
                  <MenuItem value="true">Yes</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<Close />}>
            Cancel
          </Button>
          <Button
            onClick={editingIndex !== null ? handleUpdateVariant : handleAddVariant}
            variant="contained"
            startIcon={<Check />}
          >
            {editingIndex !== null ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

