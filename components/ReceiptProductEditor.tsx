/**
 * ReceiptProductEditor Component
 * 
 * Editable table for reviewing and modifying extracted products.
 * Automatically recalculates unit price when quantity or net amount changes.
 * 
 * PERFORMANCE OPTIMIZED:
 * - Uses defaultValue for uncontrolled inputs (no re-render on keystroke)
 * - Debounced updates (300ms) to prevent lag
 * - Memoized callbacks
 * 
 * Requirements: 3.3
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
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
import debounce from 'lodash/debounce';

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

  // Debounced field update - prevents lag when typing
  const handleFieldChange = useCallback(
    debounce((
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
    }, 300), // 300ms debounce
    []
  );

  // Delete a product (no debounce needed for delete)
  const handleDelete = useCallback((productId: string) => {
    setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
  }, []);

  // Confirm and submit
  const handleConfirm = useCallback(() => {
    onConfirm(products);
  }, [onConfirm, products]);

  // Memoized confidence color function
  const getConfidenceColor = useCallback((conf: number): 'error' | 'warning' | 'success' => {
    if (conf < 0.5) return 'error';
    if (conf < 0.7) return 'warning';
    return 'success';
  }, []);

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
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  sx={{
                    bgcolor: product.needsReview ? 'warning.light' : 'inherit',
                  }}
                >
                  <TableCell>
                    {/* Using defaultValue instead of value for uncontrolled input - prevents re-render on each keystroke */}
                    <TextField
                      fullWidth
                      size="small"
                      defaultValue={product.name}
                      onChange={(e) => handleFieldChange(product.id, 'name', e.target.value)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      defaultValue={product.quantity}
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
                      defaultValue={product.netAmount}
                      onChange={(e) => handleFieldChange(product.id, 'netAmount', e.target.value)}
                      variant="outlined"
                      inputProps={{ min: 0, step: 0.01 }}
                      sx={{ width: 120 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {product.unitPrice !== null ? product.unitPrice.toFixed(2) : 'N/A'}
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
                </TableRow>
              ))}
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
