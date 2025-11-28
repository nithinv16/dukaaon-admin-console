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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';
import { ExtractedProductV2 } from '@/lib/receiptExtractionV2';

interface ReceiptProductEditorV2Props {
  products: ExtractedProductV2[];
  onConfirm: (products: ExtractedProductV2[]) => void;
  onCancel: () => void;
}

const COMMON_UNITS = ['piece', 'pieces', 'kg', 'g', 'gm', 'l', 'ml', 'pack', 'box', 'packet', 'bottle', 'bag', 'case', 'cases'];

export default function ReceiptProductEditorV2({
  products: initialProducts,
  onConfirm,
  onCancel,
}: ReceiptProductEditorV2Props) {
  const [products, setProducts] = useState<ExtractedProductV2[]>(initialProducts);

  // Update a product field
  const handleFieldChange = useCallback(
    (productId: string, field: 'name' | 'quantity' | 'unit' | 'netAmount', value: string | number) => {
      setProducts((prevProducts) =>
        prevProducts.map((product) => {
          if (product.id !== productId) return product;

          const updated = { ...product };

          if (field === 'name') {
            updated.name = value as string;
          } else if (field === 'quantity') {
            const qty = typeof value === 'string' ? parseFloat(value) : value;
            updated.quantity = isNaN(qty) || qty <= 0 ? 1 : qty;
            // Recalculate unit price
            updated.unitPrice = updated.netAmount / updated.quantity;
          } else if (field === 'unit') {
            updated.unit = value as string;
          } else if (field === 'netAmount') {
            const amt = typeof value === 'string' ? parseFloat(value) : value;
            updated.netAmount = isNaN(amt) || amt < 0 ? 0 : amt;
            // Recalculate unit price
            updated.unitPrice = updated.quantity > 0 ? updated.netAmount / updated.quantity : 0;
          }

          return updated;
        })
      );
    },
    []
  );

  // Delete a product
  const handleDelete = useCallback((productId: string) => {
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== productId));
  }, []);

  // Confirm and submit
  const handleConfirm = () => {
    onConfirm(products);
  };

  const getConfidenceColor = (conf: number): 'error' | 'warning' | 'success' => {
    if (conf < 0.5) return 'error';
    if (conf < 0.7) return 'warning';
    return 'success';
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Review & Edit Extracted Products
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review the extracted products and make any necessary corrections. Unit prices will be automatically recalculated.
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <TableContainer sx={{ maxHeight: 600, overflowX: 'auto' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 200, maxWidth: 300 }}>Product Name</TableCell>
                <TableCell align="right" sx={{ minWidth: 100, width: 100 }}>
                  Quantity
                </TableCell>
                <TableCell sx={{ minWidth: 120, width: 120 }}>Unit</TableCell>
                <TableCell align="right" sx={{ minWidth: 120, width: 120 }}>
                  Net Amount (₹)
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 120, width: 120 }}>
                  Unit Price (₹)
                </TableCell>
                <TableCell align="center" sx={{ minWidth: 100, width: 100 }}>
                  Confidence
                </TableCell>
                <TableCell 
                  align="center" 
                  sx={{ 
                    minWidth: 80, 
                    width: 80, 
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
                  sx={{
                    bgcolor: product.needsReview ? 'warning.light' : 'inherit',
                  }}
                >
                  <TableCell sx={{ minWidth: 200, maxWidth: 300, overflow: 'hidden' }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={product.name}
                      onChange={(e) => handleFieldChange(product.id, 'name', e.target.value)}
                      variant="outlined"
                      sx={{
                        '& .MuiInputBase-input': {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        },
                      }}
                      inputProps={{
                        style: {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        },
                        title: product.name, // Show full name on hover tooltip
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={product.quantity}
                      onChange={(e) => handleFieldChange(product.id, 'quantity', e.target.value)}
                      variant="outlined"
                      inputProps={{ min: 0.01, step: 0.01 }}
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      freeSolo
                      size="small"
                      value={product.unit}
                      options={COMMON_UNITS}
                      onChange={(_, newValue) => {
                        handleFieldChange(product.id, 'unit', newValue || 'piece');
                      }}
                      onInputChange={(_, newValue) => {
                        handleFieldChange(product.id, 'unit', newValue || 'piece');
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          variant="outlined"
                          placeholder="unit"
                          sx={{ width: 120 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={product.netAmount}
                      onChange={(e) => handleFieldChange(product.id, 'netAmount', e.target.value)}
                      variant="outlined"
                      inputProps={{ min: 0, step: 0.01 }}
                      sx={{ width: 120 }}
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
                      minWidth: 80, 
                      width: 80, 
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
                      sx={{
                        '&:hover': {
                          backgroundColor: 'error.light',
                          color: 'error.contrastText',
                        },
                      }}
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
    </Box>
  );
}


