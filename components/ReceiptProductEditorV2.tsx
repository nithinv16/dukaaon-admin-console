/**
 * ReceiptProductEditor V2 Component
 * 
 * Editable table for reviewing and modifying products extracted by Scan Receipts 2.0
 * Supports unit field and improved product name editing
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  IconButton,
  Chip,
  Autocomplete,
  Dialog,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { ExtractedProductV2 } from '@/lib/receiptExtractionV2';
import CategorySelector from './CategorySelector';
import { debounce } from 'lodash';

interface ReceiptProductEditorV2Props {
  products: ExtractedProductV2[];
  onConfirm: (products: ExtractedProductV2[]) => void;
  onCancel: () => void;
  showTitle?: boolean;
}

const COMMON_UNITS = ['piece', 'pieces', 'kg', 'g', 'gm', 'l', 'ml', 'pack', 'box', 'packet', 'bottle', 'bag', 'case', 'cases'];

export default function ReceiptProductEditorV2({
  products: initialProducts,
  onConfirm,
  onCancel,
  showTitle = true,
}: ReceiptProductEditorV2Props) {
  const [products, setProducts] = useState<ExtractedProductV2[]>(initialProducts);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [subcategories, setSubcategories] = useState<Array<{ id: string; category_id: string; name: string }>>([]);

  // Track subcategory input per product for "Add New" functionality
  const [subcategoryInputs, setSubcategoryInputs] = useState<{ [productId: string]: string }>({});
  // Track category input per product for "Add New" functionality
  const [categoryInputs, setCategoryInputs] = useState<{ [productId: string]: string }>({});

  // Load categories and subcategories from database using adminQueries
  React.useEffect(() => {
    const loadCategories = async () => {
      try {
        const { adminQueries } = await import('@/lib/supabase-browser');
        const data = await adminQueries.getCategories();

        if (data) {
          setCategories(data.categories || []);
          setSubcategories(data.subcategories || []);
          console.log('Loaded categories:', data.categories?.length || 0);
          console.log('Loaded subcategories:', data.subcategories?.length || 0);
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };

    loadCategories();
  }, []);

  // Debounced field change for better performance
  const handleFieldChange = useCallback(
    debounce((productId: string, field: 'name' | 'quantity' | 'unit' | 'netAmount' | 'category' | 'subcategory' | 'minOrderQuantity' | 'description', value: string | number) => {
      setProducts((prevProducts) =>
        prevProducts.map((product) => {
          if (product.id !== productId) return product;

          const updated = { ...product };

          if (field === 'name') {
            updated.name = value as string;
          } else if (field === 'quantity') {
            const qty = typeof value === 'string' ? parseFloat(value) : value;
            updated.quantity = isNaN(qty) || qty <= 0 ? 1 : qty;
            updated.unitPrice = updated.netAmount / updated.quantity;
          } else if (field === 'unit') {
            updated.unit = value as string;
          } else if (field === 'netAmount') {
            const amt = typeof value === 'string' ? parseFloat(value) : value;
            updated.netAmount = isNaN(amt) || amt < 0 ? 0 : amt;
            updated.unitPrice = updated.quantity > 0 ? updated.netAmount / updated.quantity : 0;
          } else if (field === 'category') {
            updated.category = value as string;
          } else if (field === 'subcategory') {
            updated.subcategory = value as string;
          } else if (field === 'minOrderQuantity') {
            const moq = typeof value === 'string' ? parseInt(value) : value;
            updated.minOrderQuantity = isNaN(moq) || moq <= 0 ? 1 : moq;
          } else if (field === 'description') {
            updated.description = value as string;
          }

          return updated;
        })
      );
    }, 300),
    []
  );

  const handleDelete = useCallback((productId: string) => {
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== productId));
  }, []);

  const handleConfirm = () => {
    setIsFullscreen(false);
    onConfirm(products);
  };

  const getConfidenceColor = (conf: number): 'error' | 'warning' | 'success' => {
    if (conf < 0.5) return 'error';
    if (conf < 0.7) return 'warning';
    return 'success';
  };

  const handleImageUpload = (productId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setProducts((prevProducts) =>
          prevProducts.map((p) =>
            p.id === productId ? { ...p, imageUrl } : p
          )
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const renderTable = () => (
    <Paper sx={{ mb: isFullscreen ? 2 : 3 }}>
      <TableContainer sx={{ maxHeight: isFullscreen ? 'calc(100vh - 150px)' : 'calc(100vh - 250px)', minHeight: 600, overflowX: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 80 }}>Image</TableCell>
              <TableCell sx={{ minWidth: 220, maxWidth: 300 }}>Product Name</TableCell>
              <TableCell sx={{ width: 220 }}>Category</TableCell>
              <TableCell sx={{ width: 220 }}>Subcategory</TableCell>
              <TableCell sx={{ width: 180 }}>Description</TableCell>
              <TableCell align="right" sx={{ width: 60 }}>Min Qty</TableCell>
              <TableCell sx={{ width: 110 }}>Unit</TableCell>
              <TableCell align="right" sx={{ width: 80 }}>Stock</TableCell>
              <TableCell align="right" sx={{ width: 65 }}>Qty</TableCell>
              <TableCell align="right" sx={{ width: 100 }}>Net Amt (₹)</TableCell>
              <TableCell align="right" sx={{ width: 100 }}>Unit Price (₹)</TableCell>
              <TableCell align="center" sx={{ width: 90 }}>Confidence</TableCell>
              <TableCell
                align="center"
                sx={{
                  width: 60,
                  position: 'sticky',
                  right: 0,
                  backgroundColor: 'background.paper',
                  zIndex: 10,
                  boxShadow: '-2px 0 4px rgba(0,0,0,0.1)',
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow
                key={product.id}
                sx={{ bgcolor: product.needsReview ? 'warning.light' : 'inherit' }}
              >
                <TableCell sx={{ width: 80 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    {product.imageUrl ? (
                      <Box
                        component="img"
                        src={product.imageUrl}
                        alt={product.name}
                        sx={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                      />
                    ) : (
                      <Box sx={{ width: 60, height: 60, bgcolor: 'grey.200', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" color="text.secondary">No img</Typography>
                      </Box>
                    )}
                    <Button
                      component="label"
                      size="small"
                      sx={{ fontSize: '0.65rem', minWidth: 60, p: 0.5 }}
                    >
                      Upload
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={(e) => handleImageUpload(product.id, e)}
                      />
                    </Button>
                  </Box>
                </TableCell>
                <TableCell sx={{ maxWidth: 280 }}>
                  <TextField
                    fullWidth
                    size="small"
                    defaultValue={product.name}
                    onChange={(e) => handleFieldChange(product.id, 'name', e.target.value)}
                    variant="outlined"
                    inputProps={{
                      title: product.name,
                      style: { fontSize: '0.8rem' }
                    }}
                  />
                </TableCell>
                {/* Category - moved before Qty */}
                <TableCell>
                  <Autocomplete
                    freeSolo
                    size="small"
                    value={product.category || ''}
                    inputValue={categoryInputs[product.id] ?? product.category ?? ''}
                    onInputChange={(event, newInputValue, reason) => {
                      // Track what user types for this specific product
                      setCategoryInputs(prev => ({
                        ...prev,
                        [product.id]: newInputValue
                      }));
                    }}
                    options={categories.map(c => c.name)}
                    getOptionLabel={(option) => option === '__ADD_NEW__' ? '' : option}
                    filterOptions={(options, state) => {
                      const filtered = categories
                        .filter(c => c.name.toLowerCase().includes(state.inputValue.toLowerCase()))
                        .map(c => c.name);

                      // Add "Add New" option if typing something not in list
                      if (state.inputValue && !categories.find(c => c.name.toLowerCase() === state.inputValue.toLowerCase())) {
                        filtered.push('__ADD_NEW__');
                      }
                      return filtered;
                    }}
                    renderOption={(props, option, state) => {
                      if (option === '__ADD_NEW__') {
                        return (
                          <li {...props} key="add-new">
                            <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
                              <Typography>Add "{state.inputValue}" as new category</Typography>
                            </Box>
                          </li>
                        );
                      }
                      return <li {...props} key={option}>{option}</li>;
                    }}
                    onChange={async (_, newValue, reason, details) => {
                      // Handle "Add New" category
                      if (newValue === '__ADD_NEW__') {
                        // Get the typed value from our state
                        const typedValue = categoryInputs[product.id] || '';

                        console.log('Creating category:', typedValue);

                        if (typedValue && typedValue.trim()) {
                          try {
                            const { adminQueries } = await import('@/lib/supabase-browser');
                            const result = await adminQueries.createCategory(typedValue.trim());

                            console.log('Category creation result:', result);

                            if (result.success && result.data) {
                              const newCat = result.data as { id: string; name: string };
                              console.log('New category created:', newCat);

                              // Update categories list
                              setCategories(prev => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));

                              // Update product with new category
                              setProducts((prevProducts) =>
                                prevProducts.map((p) =>
                                  p.id === product.id ? { ...p, category: newCat.name } : p
                                )
                              );

                              // Clear input tracking for this product
                              setCategoryInputs(prev => ({
                                ...prev,
                                [product.id]: newCat.name
                              }));
                            } else {
                              console.error('Category creation failed:', result);
                            }
                          } catch (error) {
                            console.error('Error creating category:', error);
                          }
                        } else {
                          console.error('No typed value for category');
                        }
                        return;
                      }

                      // Update category normally
                      setProducts((prevProducts) =>
                        prevProducts.map((p) =>
                          p.id === product.id
                            ? { ...p, category: newValue || '', subcategory: newValue !== product.category ? '' : p.subcategory }
                            : p
                        )
                      );

                      // Update input tracking
                      setCategoryInputs(prev => ({
                        ...prev,
                        [product.id]: newValue || ''
                      }));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="outlined"
                        placeholder="Category"
                        sx={{
                          width: 215,
                          '& .MuiInputBase-input': {
                            padding: '6px 8px'
                          }
                        }}
                      />
                    )}
                    componentsProps={{
                      popper: {
                        sx: { width: 400 }
                      }
                    }}
                  />
                </TableCell>
                {/* Subcategory */}
                <TableCell>
                  <Autocomplete
                    freeSolo
                    size="small"
                    value={product.subcategory || ''}
                    inputValue={subcategoryInputs[product.id] ?? product.subcategory ?? ''}
                    onInputChange={(event, newInputValue, reason) => {
                      // Track what user types for this specific product's subcategory
                      setSubcategoryInputs(prev => ({
                        ...prev,
                        [product.id]: newInputValue
                      }));
                    }}
                    options={
                      product.category
                        ? subcategories
                          .filter((s) => {
                            const cat = categories.find((c) => c.name === product.category);
                            return cat && s.category_id === cat.id;
                          })
                          .map((s) => s.name)
                        : []
                    }
                    getOptionLabel={(option) => option === '__ADD_NEW__' ? '' : option}
                    filterOptions={(options, state) => {
                      const currentCat = categories.find(c => c.name === product.category);
                      if (!currentCat) return [];

                      const filtered = subcategories
                        .filter(s => s.category_id === currentCat.id && s.name.toLowerCase().includes(state.inputValue.toLowerCase()))
                        .map(s => s.name);

                      // Add "Add New" option if typing something not in list
                      if (state.inputValue && !subcategories.find(s => s.category_id === currentCat.id && s.name.toLowerCase() === state.inputValue.toLowerCase())) {
                        filtered.push('__ADD_NEW__');
                      }
                      return filtered;
                    }}
                    renderOption={(props, option, state) => {
                      if (option === '__ADD_NEW__') {
                        return (
                          <li {...props} key="add-new">
                            <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
                              <Typography>Add "{state.inputValue}" as new subcategory</Typography>
                            </Box>
                          </li>
                        );
                      }
                      return <li {...props} key={option}>{option}</li>;
                    }}
                    onChange={async (event, newValue, reason, details) => {
                      // Handle "Add New" subcategory
                      if (newValue === '__ADD_NEW__') {
                        const cat = categories.find(c => c.name === product.category);
                        if (!cat) {
                          console.error('Category not found for subcategory creation');
                          return;
                        }

                        // Get the typed value from our state
                        const typedValue = subcategoryInputs[product.id] || '';

                        console.log('Creating subcategory:', typedValue, 'for category:', cat.name, 'category_id:', cat.id);

                        if (typedValue && typedValue.trim()) {
                          try {
                            const { adminQueries } = await import('@/lib/supabase-browser');
                            const result = await adminQueries.createSubcategory(typedValue.trim(), cat.id);

                            console.log('Subcategory creation result:', result);

                            if (result.success && result.data) {
                              const newSub = result.data as { id: string; category_id: string; name: string };
                              console.log('New subcategory created:', newSub);

                              // Update subcategories list
                              setSubcategories(prev => [...prev, newSub].sort((a, b) => a.name.localeCompare(b.name)));

                              // Update product with new subcategory
                              setProducts((prevProducts) =>
                                prevProducts.map((p) =>
                                  p.id === product.id ? { ...p, subcategory: newSub.name } : p
                                )
                              );

                              // Clear input tracking for this product
                              setSubcategoryInputs(prev => ({
                                ...prev,
                                [product.id]: newSub.name
                              }));
                            } else {
                              console.error('Subcategory creation failed:', result);
                            }
                          } catch (error) {
                            console.error('Error creating subcategory:', error);
                          }
                        } else {
                          console.error('No typed value for subcategory');
                        }
                        return;
                      }

                      // Update subcategory normally
                      setProducts((prevProducts) =>
                        prevProducts.map((p) =>
                          p.id === product.id ? { ...p, subcategory: newValue || '' } : p
                        )
                      );

                      // Update input tracking
                      setSubcategoryInputs(prev => ({
                        ...prev,
                        [product.id]: newValue || ''
                      }));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="outlined"
                        placeholder="Subcategory"
                        sx={{
                          width: 215,
                          '& .MuiInputBase-input': {
                            padding: '6px 8px'
                          }
                        }}
                      />
                    )}
                    disabled={!product.category}
                    componentsProps={{
                      popper: {
                        sx: { width: 400 }
                      }
                    }}
                  />
                </TableCell>
                {/* Description - moved before Qty */}
                <TableCell>
                  <TextField
                    size="small"
                    multiline
                    maxRows={3}
                    defaultValue={product.description || ''}
                    onChange={(e) => handleFieldChange(product.id, 'description', e.target.value)}
                    variant="outlined"
                    placeholder="Description"
                    sx={{ width: 175 }}
                  />
                </TableCell>
                {/* Min Order Quantity */}
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    defaultValue={product.minOrderQuantity || ''}
                    onChange={(e) => handleFieldChange(product.id, 'minOrderQuantity', e.target.value)}
                    variant="outlined"
                    placeholder="1"
                    inputProps={{ min: 1, step: 1 }}
                    sx={{ width: 70 }}
                  />
                </TableCell>
                {/* Unit */}
                <TableCell>
                  <Autocomplete
                    freeSolo
                    size="small"
                    defaultValue={product.unit}
                    options={COMMON_UNITS}
                    onChange={(_, newValue) => handleFieldChange(product.id, 'unit', newValue || 'piece')}
                    onInputChange={(_, newValue) => handleFieldChange(product.id, 'unit', newValue || 'piece')}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="outlined"
                        placeholder="unit"
                        sx={{
                          width: 110,
                          '& .MuiInputBase-input': {
                            padding: '6px 8px'
                          }
                        }}
                      />
                    )}
                    componentsProps={{
                      popper: {
                        sx: { width: 150 }
                      }
                    }}
                  />
                </TableCell>
                {/* Stock Available */}
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    defaultValue={product.stockAvailable ?? 100}
                    onChange={(e) => handleFieldChange(product.id, 'stockAvailable', e.target.value)}
                    variant="outlined"
                    placeholder="100"
                    inputProps={{ min: 0, step: 1 }}
                    sx={{
                      width: 75,
                      '& .MuiInputBase-input': {
                        padding: '6px 8px',
                        textAlign: 'right'
                      }
                    }}
                  />
                </TableCell>
                {/* Quantity */}
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    defaultValue={product.quantity}
                    onChange={(e) => handleFieldChange(product.id, 'quantity', e.target.value)}
                    variant="outlined"
                    inputProps={{ min: 0.01, step: 0.01 }}
                    sx={{
                      width: 65,
                      '& .MuiInputBase-input': {
                        padding: '6px 8px',
                        textAlign: 'right'
                      }
                    }}
                  />
                </TableCell>
                {/* Net Amount (Read-only) */}
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    value={product.netAmount}
                    onChange={(e) => handleFieldChange(product.id, 'netAmount', e.target.value)}
                    variant="outlined"
                    inputProps={{ min: 0, step: 0.01 }}
                    sx={{ width: 95 }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {product.unitPrice > 0 ? product.unitPrice.toFixed(2) : 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={`${(product.confidence * 100).toFixed(0)}%`}
                    color={getConfidenceColor(product.confidence)}
                    size="small"
                    icon={product.needsReview ? <WarningIcon /> : undefined}
                  />
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    width: 60,
                    position: 'sticky',
                    right: 0,
                    backgroundColor: 'background.paper',
                    zIndex: 1,
                    boxShadow: '-2px 0 4px rgba(0,0,0,0.1)',
                  }}
                >
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(product.id)}
                    title="Delete product"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      {showTitle && (
        <>
          <Typography variant="h5" gutterBottom>
            Review & Edit Extracted Products
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Review the extracted products and make any necessary corrections. Unit prices will be automatically recalculated.
          </Typography>
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          startIcon={isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          onClick={() => setIsFullscreen(!isFullscreen)}
          variant="outlined"
          size="small"
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </Button>
      </Box>

      {!isFullscreen && renderTable()}

      {!isFullscreen && (
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
          <Button variant="outlined" startIcon={<CloseIcon />} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<CheckIcon />}
            onClick={handleConfirm}
            disabled={products.length === 0}
          >
            Confirm & Add to Inventory ({products.length})
          </Button>
        </Box>
      )}

      <Dialog
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        maxWidth={false}
        fullScreen
        PaperProps={{ sx: { m: 0, p: 3 } }}
      >
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">
            Review & Edit Extracted Products
          </Typography>
          <Button
            startIcon={<FullscreenExitIcon />}
            onClick={() => setIsFullscreen(false)}
            variant="outlined"
            size="small"
          >
            Exit Fullscreen
          </Button>
        </Box>

        {renderTable()}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
          <Button variant="outlined" startIcon={<CloseIcon />} onClick={() => setIsFullscreen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<CheckIcon />}
            onClick={handleConfirm}
            disabled={products.length === 0}
          >
            Confirm & Add to Inventory ({products.length})
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}
