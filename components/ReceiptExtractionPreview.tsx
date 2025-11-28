/**
 * ReceiptExtractionPreview Component
 * 
 * Displays extraction results with side-by-side view of original image
 * and extracted data. Highlights low-confidence products and shows
 * confidence indicators.
 * 
 * Requirements: 3.1, 3.2, 5.1, 5.3
 */

'use client';

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { ExtractedReceiptProduct, ReceiptMetadata } from '@/lib/receiptTypes';

interface ReceiptExtractionPreviewProps {
  products: ExtractedReceiptProduct[];
  metadata: ReceiptMetadata;
  confidence: number;
  originalImageUrl?: string;
  onProductHover?: (productId: string | null) => void;
}

export default function ReceiptExtractionPreview({
  products,
  metadata,
  confidence,
  originalImageUrl,
  onProductHover,
}: ReceiptExtractionPreviewProps) {
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);

  const handleProductHover = (productId: string | null) => {
    setHoveredProductId(productId);
    if (onProductHover) {
      onProductHover(productId);
    }
  };

  const getConfidenceColor = (conf: number): 'error' | 'warning' | 'success' => {
    if (conf < 0.5) return 'error';
    if (conf < 0.7) return 'warning';
    return 'success';
  };

  const getConfidenceLabel = (conf: number): string => {
    if (conf < 0.5) return 'Low';
    if (conf < 0.7) return 'Medium';
    return 'High';
  };

  const lowConfidenceCount = products.filter(p => p.needsReview).length;

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Extraction Results
      </Typography>

      {/* Overall confidence and metadata */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Overall Confidence
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Chip
                label={`${(confidence * 100).toFixed(0)}% - ${getConfidenceLabel(confidence)}`}
                color={getConfidenceColor(confidence)}
                size="small"
                icon={confidence >= 0.7 ? <CheckCircleIcon /> : <WarningIcon />}
              />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Format Type
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              {metadata.formatType.replace('_', ' ').toUpperCase()}
            </Typography>
          </Grid>
          {metadata.merchantName && (
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Merchant
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {metadata.merchantName}
              </Typography>
            </Grid>
          )}
          {metadata.invoiceNumber && (
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Invoice Number
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {metadata.invoiceNumber}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Warning for low confidence products */}
      {lowConfidenceCount > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {lowConfidenceCount} product{lowConfidenceCount > 1 ? 's' : ''} flagged for review due to low confidence
        </Alert>
      )}

      {/* Side-by-side view */}
      <Grid container spacing={3}>
        {/* Original image */}
        {originalImageUrl && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Original Receipt
              </Typography>
              <Box
                component="img"
                src={originalImageUrl}
                alt="Original receipt"
                sx={{
                  width: '100%',
                  maxHeight: 600,
                  objectFit: 'contain',
                  border: 1,
                  borderColor: 'grey.300',
                  borderRadius: 1,
                }}
              />
            </Paper>
          </Grid>
        )}

        {/* Extracted data */}
        <Grid item xs={12} md={originalImageUrl ? 6 : 12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Extracted Products ({products.length})
            </Typography>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product Name</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Net Amount</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="center">Confidence</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => (
                    <TableRow
                      key={product.id}
                      onMouseEnter={() => handleProductHover(product.id)}
                      onMouseLeave={() => handleProductHover(null)}
                      sx={{
                        bgcolor: product.needsReview ? 'warning.light' : 'inherit',
                        '&:hover': {
                          bgcolor: product.needsReview ? 'warning.main' : 'action.hover',
                        },
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                      }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{product.name}</Typography>
                          {product.name !== product.originalText && (
                            <Typography variant="caption" color="text.secondary">
                              Original: {product.originalText}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{product.quantity}</TableCell>
                      <TableCell align="right">₹{product.netAmount.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        {product.unitPrice !== null ? `₹${product.unitPrice.toFixed(2)}` : 'N/A'}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${(product.confidence * 100).toFixed(0)}%`}
                          color={getConfidenceColor(product.confidence)}
                          size="small"
                          icon={product.needsReview ? <WarningIcon /> : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
