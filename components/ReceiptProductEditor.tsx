/**
 * ReceiptProductEditor Component
 * 
 * Editable table for reviewing and modifying extracted products.
 * Automatically recalculates unit price when quantity or net amount changes.
 * 
 * Requirements: 3.3
 */

'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';
import { ExtractedReceiptProduct } from '@/lib/receiptTypes';
import { calculateUnitPrice } from '@/lib/unitPriceCalculator';
import { debounce } from 'lodash';

interface ReceiptProductEditorProps {
  products: ExtractedReceiptProduct[];
  onConfirm: (products: ExtractedReceiptProduct[]) => void;
  onCancel: () => void;
  showTitle?: boolean; // Optional prop to show/hide title and description
}

export default function ReceiptProductEditor({
  products: initialProducts,
  onConfirm,
  onCancel,
  showTitle = true,
}: ReceiptProductEditorProps) {
  const [products, setProducts] = useState<ExtractedReceiptProduct[]>(initialProducts);
  
  // Local state for immediate UI updates (for controlled inputs)
  const [localValues, setLocalValues] = useState<{ [key: string]: { name?: string; quantity?: number; netAmount?: number } }>({});

  // Debounced update function - updates state after user stops typing
  const debouncedUpdate = useMemo(
    () => debounce((
      productId: string,
      field: 'name' | 'quantity' | 'netAmount',
      value: string | number
    ) => {
      setProducts(prevProducts =>
        prevProducts.map(product => {
          if (product.id !== productId) return product;

          const updated = { ...product };

          if (field === 'name') {
            updated.name = value as string;
          } else if (field === 'quantity') {
            const qty = typeof value === 'string' ? parseFloat(value) : value;
            updated.quantity = isNaN(qty) ? 0 : qty;
            
            // Recalculate unit price
            const result = calculateUnitPrice(updated.netAmount, updated.quantity);
            updated.unitPrice = result.unitPrice;
          } else if (field === 'netAmount') {
            const amt = typeof value === 'string' ? parseFloat(value) : value;
            updated.netAmount = isNaN(amt) ? 0 : amt;
            
            // Recalculate unit price
            const result = calculateUnitPrice(updated.netAmount, updated.quantity);
            updated.unitPrice = result.unitPrice;
          }

          return updated;
        })
      );
      
      // Clear local value after update
      setLocalValues(prev => {
        const newValues = { ...prev };
        if (newValues[productId]) {
          delete newValues[productId][field];
          if (Object.keys(newValues[productId]).length === 0) {
            delete newValues[productId];
          }
        }
        return newValues;
      });
    }, 300), // 300ms debounce delay
    []
  );

  // Update a product field - immediate local update + debounced state update
  const handleFieldChange = useCallback((
    productId: string,
    field: 'name' | 'quantity' | 'netAmount',
    value: string | number
  ) => {
    // Update local state immediately for responsive UI
    setLocalValues(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));

    // Debounced update to main state
    debouncedUpdate(productId, field, value);
  }, [debouncedUpdate]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  // Delete a product
  const handleDelete = useCallback((productId: string) => {
    setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
    // Clean up local values for deleted product
    setLocalValues(prev => {
      const newValues = { ...prev };
      delete newValues[productId];
      return newValues;
    });
  }, []);

  // Confirm and submit - merge any pending local values first
  const handleConfirm = () => {
    // Cancel any pending debounced updates
    debouncedUpdate.cancel();
    
    // Merge local values into products before submitting
    const finalProducts = products.map(product => {
      const local = localValues[product.id];
      if (!local) return product;
      
      const updated = { ...product };
      if (local.name !== undefined) updated.name = local.name;
      if (local.quantity !== undefined) {
        const qty = typeof local.quantity === 'string' ? parseFloat(local.quantity) : local.quantity;
        updated.quantity = isNaN(qty) ? 0 : qty;
        const result = calculateUnitPrice(updated.netAmount, updated.quantity);
        updated.unitPrice = result.unitPrice;
      }
      if (local.netAmount !== undefined) {
        const amt = typeof local.netAmount === 'string' ? parseFloat(local.netAmount) : local.netAmount;
        updated.netAmount = isNaN(amt) ? 0 : amt;
        const result = calculateUnitPrice(updated.netAmount, updated.quantity);
        updated.unitPrice = result.unitPrice;
      }
      return updated;
    });
    
    onConfirm(finalProducts);
  };

  const getConfidenceColor = (conf: number): 'error' | 'warning' | 'success' => {
    if (conf < 0.5) return 'error';
    if (conf < 0.7) return 'warning';
    return 'success';
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      {showTitle && (
        <>
          <Typography variant="h5" gutterBottom>
            Review & Edit Products
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Review the extracted products and make any necessary corrections. Unit prices will be automatically recalculated.
          </Typography>
        </>
      )}

      <Paper sx={{ mb: 3 }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)', minHeight: 400 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Product Name</TableCell>
                <TableCell align="right" sx={{ minWidth: 100 }}>Quantity</TableCell>
                <TableCell align="right" sx={{ minWidth: 120 }}>Net Amount (₹)</TableCell>
                <TableCell align="right" sx={{ minWidth: 120 }}>Unit Price (₹)</TableCell>
                <TableCell align="center" sx={{ minWidth: 100 }}>Confidence</TableCell>
                <TableCell align="center" sx={{ minWidth: 80 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => {
                // Get local values for this product (for immediate UI updates)
                const local = localValues[product.id];
                const displayName = local?.name !== undefined ? local.name : product.name;
                const displayQuantity = local?.quantity !== undefined ? local.quantity : product.quantity;
                const displayNetAmount = local?.netAmount !== undefined ? local.netAmount : product.netAmount;
                
                // Calculate unit price based on current display values
                const currentUnitPrice = (() => {
                  const qty = typeof displayQuantity === 'string' ? parseFloat(displayQuantity) : displayQuantity;
                  const amt = typeof displayNetAmount === 'string' ? parseFloat(displayNetAmount) : displayNetAmount;
                  if (isNaN(qty) || isNaN(amt) || qty <= 0) return product.unitPrice;
                  return amt / qty;
                })();

                return (
                  <TableRow
                    key={product.id}
                    sx={{
                      bgcolor: product.needsReview ? 'warning.light' : 'inherit',
                    }}
                  >
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        value={displayName}
                        onChange={(e) => handleFieldChange(product.id, 'name', e.target.value)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={displayQuantity}
                        onChange={(e) => handleFieldChange(product.id, 'quantity', e.target.value)}
                        variant="outlined"
                        inputProps={{ min: 0, step: 0.01 }}
                        sx={{ width: 100 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={displayNetAmount}
                        onChange={(e) => handleFieldChange(product.id, 'netAmount', e.target.value)}
                        variant="outlined"
                        inputProps={{ min: 0, step: 0.01 }}
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {currentUnitPrice !== null && !isNaN(currentUnitPrice) ? currentUnitPrice.toFixed(2) : 'N/A'}
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
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(product.id)}
                      title="Delete product"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${(product.confidence * 100).toFixed(0)}%`}
                      color={getConfidenceColor(product.confidence)}
                      size="small"
                      icon={product.needsReview ? <WarningIcon /> : undefined}
                    />
                  </TableCell>
                  <TableCell align="center">
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
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<CloseIcon />}
          onClick={onCancel}
        >
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
    </Box>
  );
}
