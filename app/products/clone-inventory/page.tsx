'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Checkbox,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton
} from '@mui/material';
import {
  ArrowBack,
  ContentCopy,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { adminQueries } from '../../../lib/supabase';

interface Seller {
  id: string;
  display_name?: string;
  business_details?: {
    shopName?: string;
  };
  business_name?: string;
  phone_number?: string;
  role: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subcategory?: string;
  brand?: string;
  image_url?: string;
  stock_available?: number;
  unit?: string;
  min_order_quantity?: number;
  status: string;
}

interface CloneProduct extends Product {
  selected: boolean;
  newPrice: number;
}

export default function CloneInventoryPage() {
  const router = useRouter();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [fromSeller, setFromSeller] = useState('');
  const [toSeller, setToSeller] = useState('');
  const [products, setProducts] = useState<CloneProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [loadingSellers, setLoadingSellers] = useState(true);

  // Load sellers on component mount
  useEffect(() => {
    loadSellers();
  }, []);

  // Load products when from seller is selected
  useEffect(() => {
    if (fromSeller) {
      loadSellerProducts(fromSeller);
    } else {
      setProducts([]);
    }
  }, [fromSeller]);

  const loadSellers = async () => {
    try {
      setLoadingSellers(true);
      const response = await adminQueries.getUsers({ limit: 1000 });
      const filteredSellers = (response.data || []).filter(
        (user: Seller) => user.role === 'wholesaler' || user.role === 'manufacturer'
      );
      setSellers(filteredSellers);
    } catch (error) {
      console.error('Error loading sellers:', error);
      toast.error('Failed to load sellers');
    } finally {
      setLoadingSellers(false);
    }
  };

  const loadSellerProducts = async (sellerId: string) => {
    try {
      setLoading(true);
      const response = await adminQueries.getProducts(1, 1000, '', 'all', 'active');
      const sellerProducts = (response.products || []).filter(
        (product: Product & { seller_id?: string }) => product.seller_id === sellerId
      );
      
      const cloneProducts: CloneProduct[] = sellerProducts.map((product: Product) => ({
        ...product,
        selected: false,
        newPrice: product.price
      }));
      
      setProducts(cloneProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (productId: string, selected: boolean) => {
    setProducts(prev => prev.map(product => 
      product.id === productId ? { ...product, selected } : product
    ));
  };

  const handlePriceChange = (productId: string, newPrice: number) => {
    setProducts(prev => prev.map(product => 
      product.id === productId ? { ...product, newPrice } : product
    ));
  };

  const handleSelectAll = (selected: boolean) => {
    setProducts(prev => prev.map(product => ({ ...product, selected })));
  };

  const handleCloneProducts = async () => {
    const selectedProducts = products.filter(p => p.selected);
    
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product to clone');
      return;
    }

    if (!toSeller) {
      toast.error('Please select a target seller');
      return;
    }

    if (fromSeller === toSeller) {
      toast.error('Source and target sellers cannot be the same');
      return;
    }

    try {
      setCloning(true);
      let successCount = 0;
      let errorCount = 0;

      for (const product of selectedProducts) {
        try {
          const productData = {
            name: product.name,
            description: product.description,
            price: product.newPrice,
            category: product.category,
            subcategory: product.subcategory,
            images: product.image_url ? [product.image_url] : [],
            seller_id: toSeller,
            stock: product.stock_available || 0,
            unit: product.unit || 'piece',
            min_order_quantity: product.min_order_quantity || 1
          };

          const result = await adminQueries.addProduct(productData);
          
          if (!result.success) {
            console.error(`Error cloning product ${product.name}:`, result.data);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Error cloning product ${product.name}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully cloned ${successCount} product(s)`);
      }
      
      if (errorCount > 0) {
        toast.error(`Failed to clone ${errorCount} product(s)`);
      }

      // Reset selections after cloning
      setProducts(prev => prev.map(product => ({ ...product, selected: false })));
      
    } catch (error) {
      console.error('Error cloning products:', error);
      toast.error('Failed to clone products');
    } finally {
      setCloning(false);
    }
  };

  const selectedCount = products.filter(p => p.selected).length;
  const allSelected = products.length > 0 && selectedCount === products.length;
  const someSelected = selectedCount > 0 && selectedCount < products.length;

  const getSellerDisplayName = (seller: Seller) => {
    return seller.display_name || 
           seller.business_details?.shopName || 
           seller.business_name || 
           seller.phone_number || 
           'Unknown Seller';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => router.push('/products')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          Clone Inventory
        </Typography>
      </Box>

      {/* Seller Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Select Sellers
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth disabled={loadingSellers}>
              <InputLabel>From Seller</InputLabel>
              <Select
                value={fromSeller}
                onChange={(e) => setFromSeller(e.target.value)}
                label="From Seller"
              >
                {sellers.map((seller) => (
                  <MenuItem key={seller.id} value={seller.id}>
                    {getSellerDisplayName(seller)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth disabled={loadingSellers}>
              <InputLabel>To Seller</InputLabel>
              <Select
                value={toSeller}
                onChange={(e) => setToSeller(e.target.value)}
                label="To Seller"
              >
                {sellers.map((seller) => (
                  <MenuItem key={seller.id} value={seller.id}>
                    {getSellerDisplayName(seller)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {loadingSellers && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Paper>

      {/* Products List */}
      {fromSeller && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Products ({products.length})
            </Typography>
            
            {products.length > 0 && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Chip 
                  label={`${selectedCount} selected`} 
                  color={selectedCount > 0 ? 'primary' : 'default'}
                  size="small"
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleSelectAll(!allSelected)}
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<ContentCopy />}
                  onClick={handleCloneProducts}
                  disabled={selectedCount === 0 || !toSeller || cloning}
                >
                  {cloning ? 'Cloning...' : `Clone ${selectedCount} Product(s)`}
                </Button>
              </Box>
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : products.length === 0 ? (
            <Alert severity="info">
              No products found for the selected seller.
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={someSelected}
                        checked={allSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Original Price</TableCell>
                    <TableCell>New Price</TableCell>
                    <TableCell>Stock</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={product.selected}
                          onChange={(e) => handleProductSelect(product.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          {product.image_url && (
                            <Box
                              component="img"
                              src={product.image_url}
                              alt={product.name}
                              sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1 }}
                            />
                          )}
                          <Box>
                            <Typography variant="subtitle2">{product.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {product.brand && `${product.brand} • `}{product.unit}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{product.category}</Typography>
                        {product.subcategory && (
                          <Typography variant="caption" color="text.secondary">
                            {product.subcategory}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">₹{product.price}</Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={product.newPrice}
                          onChange={(e) => handlePriceChange(product.id, parseFloat(e.target.value) || 0)}
                          size="small"
                          sx={{ width: 100 }}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{product.stock_available || 0}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={product.status}
                          color={product.status === 'active' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {!fromSeller && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select a source seller to view their products
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose a seller from the "From Seller" dropdown to see their inventory
          </Typography>
        </Paper>
      )}
    </Box>
  );
}