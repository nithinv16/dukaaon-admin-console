'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Grid,
  Chip,
  Alert,
} from '@mui/material';
import {
  CloudUpload,
  Receipt,
  ArrowBack,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { processReceiptImage, UnifiedExtractedProduct as ExtractedProduct } from '@/lib/unifiedOCR';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';

export default function ScanReceiptPage() {
  const router = useRouter();
  const [receiptProcessing, setReceiptProcessing] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(true);

  // Load sellers
  useEffect(() => {
    const loadSellers = async () => {
      try {
        setLoadingSellers(true);
        const sellersData = await adminQueries.getSellersWithDetails();
        if (sellersData && Array.isArray(sellersData)) {
          const validSellers = sellersData.filter(seller => seller && seller.id);
          setSellers(validSellers);
        }
      } catch (error) {
        console.error('Error loading sellers:', error);
        toast.error('Failed to load sellers');
      } finally {
        setLoadingSellers(false);
      }
    };

    loadSellers();
  }, []);

  // Receipt scanning handler
  const handleReceiptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size should be less than 10MB');
      return;
    }
    
    setReceiptProcessing(true);
    setReceiptImage(URL.createObjectURL(file));
    
    try {
      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const result = await processReceiptImage(buffer, 'aws');
      
      console.log('=== RECEIPT PROCESSING RESULT ===');
      console.log('Full result:', result);
      console.log('Products array:', result.data?.products);
      console.log('Products length:', result.data?.products?.length || 0);
      
      // Clear previous results first
      setExtractedProducts([]);
      
      // Small delay to ensure state is cleared
      setTimeout(() => {
        if (result.data?.products && result.data.products.length > 0) {
          console.log('Setting extracted products:', result.data.products);
          // Store products in sessionStorage and navigate to extracted products page
          sessionStorage.setItem('extractedProducts', JSON.stringify(result.data.products));
          toast.success(`Extracted ${result.data.products.length} products from receipt!`);
          router.push('/products/extracted-products');
        } else {
          console.log('No products found in result');
          toast.error('Receipt processed but no products found. Please try again with a clearer image.');
        }
      }, 100);
    } catch (error) {
      console.error('Receipt processing error:', error);
      setExtractedProducts([]);
      toast.error('Failed to process receipt. Please try again.');
    } finally {
      setReceiptProcessing(false);
    }
    
    // Clear the input
    event.target.value = '';
  };


  const handleClear = () => {
    setReceiptImage(null);
    setExtractedProducts([]);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => router.push('/products')}
          sx={{ mb: 2 }}
        >
          Back to Products
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Receipt color="primary" sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h4" gutterBottom>
              Scan Receipt
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Upload a receipt image to automatically extract product details and add them to your inventory.
            </Typography>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Upload Section */}
        <Grid item xs={12} md={extractedProducts.length > 0 ? 6 : 12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Upload Receipt
              </Typography>
              
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="receipt-scan-upload"
                type="file"
                onChange={handleReceiptUpload}
              />
              <label htmlFor="receipt-scan-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUpload />}
                  disabled={receiptProcessing}
                  size="large"
                  fullWidth
                  sx={{ mb: 3 }}
                >
                  {receiptProcessing ? 'Processing Receipt...' : 'Upload Receipt Image'}
                </Button>
              </label>
              
              {receiptProcessing && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 3 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2">Extracting text from receipt...</Typography>
                </Box>
              )}
              
              {receiptImage && (
                <Box sx={{ mb: 3, textAlign: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Receipt Preview
                  </Typography>
                  <Box
                    component="img"
                    src={receiptImage}
                    alt="Receipt preview"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      objectFit: 'contain',
                      borderRadius: 2,
                      border: 1,
                      borderColor: 'grey.300',
                      p: 1,
                    }}
                  />
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={handleClear}
                    sx={{ mt: 2 }}
                  >
                    Clear Image
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Extracted Products Preview */}
        {extractedProducts.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Extracted Products ({extractedProducts.length})
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Review the extracted products below. You can edit them before adding to inventory.
                </Typography>
                
                <Stack spacing={2} sx={{ maxHeight: 500, overflow: 'auto' }}>
                  {extractedProducts.map((product, index) => {
                    return (
                      <Card 
                        key={index} 
                        variant="outlined"
                        sx={{ 
                          '&:hover': { 
                            bgcolor: 'action.hover',
                            boxShadow: 2
                          }
                        }}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {product.name || 'Unnamed Product'}
                            </Typography>
                            {product.confidence && (
                              <Chip
                                label={`${Math.round(product.confidence * 100)}% confidence`}
                                size="small"
                                color={product.confidence > 0.8 ? 'success' : product.confidence > 0.6 ? 'warning' : 'error'}
                              />
                            )}
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={4}>
                              <Typography variant="caption" color="text.secondary">Unit Price</Typography>
                              <Typography variant="body2">₹{product.price || 'N/A'}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="caption" color="text.secondary">Quantity</Typography>
                              <Typography variant="body2">{product.quantity || 'N/A'} {product.unit || ''}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="caption" color="text.secondary">Net Amount</Typography>
                              <Typography variant="body2">₹{product.price || 'N/A'}</Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => {
                    sessionStorage.setItem('extractedProducts', JSON.stringify(extractedProducts));
                    router.push('/products/extracted-products');
                  }}
                  sx={{ mt: 2 }}
                >
                  Edit & Add to Inventory
                </Button>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

    </Container>
  );
}

