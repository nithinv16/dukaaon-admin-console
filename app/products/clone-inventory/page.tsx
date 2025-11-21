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
import { adminQueries } from '../../../lib/supabase-browser';

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
  min_quantity?: number;
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
      const sellers = await adminQueries.getSellersWithDetails();
      console.log('Loaded sellers in clone-inventory:', sellers);
      console.log('Sellers count:', sellers?.length || 0);
      console.log('Sellers sample:', sellers?.[0]);
      
      if (sellers && Array.isArray(sellers)) {
        // Filter out any invalid sellers and ensure they have an id and business_name
        const validSellers = sellers.filter(seller => {
          const isValid = seller && seller.id && (seller.business_name || seller.display_name || seller.phone_number);
          if (!isValid) {
            console.warn('Invalid seller filtered out:', seller);
          }
          return isValid;
        });
        
        console.log('Valid sellers count:', validSellers.length);
        console.log('Valid sellers sample:', validSellers[0] ? {
          id: validSellers[0].id,
          business_name: validSellers[0].business_name,
          display_name: validSellers[0].display_name
        } : null);
        
        setSellers(validSellers);
        if (validSellers.length === 0) {
          console.warn('No valid sellers found');
          toast.error('No sellers found. Please add sellers first.');
        }
      } else {
        console.error('Sellers data is not an array:', sellers);
        setSellers([]);
        toast.error('Invalid sellers data received');
      }
    } catch (error) {
      console.error('Error loading sellers:', error);
      setSellers([]);
      toast.error('Failed to load sellers');
    } finally {
      setLoadingSellers(false);
    }
  };

  const loadSellerProducts = async (sellerId: string) => {
    try {
      setLoading(true);
      console.log('Loading products for seller:', sellerId);
      
      // Fetch products for the selected seller
      const response = await adminQueries.getProducts({
        seller_id: sellerId,
        limit: 1000, // Get all products for this seller
      });
      
      console.log('Products response:', response);
      const sellerProducts = response.products || [];
      console.log('Products found:', sellerProducts.length);
      
      const cloneProducts: CloneProduct[] = sellerProducts.map((product: Product & { seller_id?: string }) => {
        // Log each product to verify all fields are present
        console.log('Product data:', {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          category: product.category,
          subcategory: product.subcategory,
          brand: product.brand,
          stock_available: product.stock_available,
          unit: product.unit,
          status: product.status,
          image_url: product.image_url
        });
        
        return {
          ...product,
          selected: false,
          newPrice: product.price || 0
        };
      });
      
      console.log('Clone products prepared:', cloneProducts.length);
      setProducts(cloneProducts);
      
      if (cloneProducts.length === 0) {
        toast.info('No products found for this seller');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
      setProducts([]);
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
          // Ensure all required fields have valid values
          if (!product.name || !product.name.trim()) {
            console.error(`Product ${product.id} has no name`);
            errorCount++;
            toast.error(`Product "${product.name || 'Unknown'}" has no name`);
            continue;
          }

          if (!product.description || !product.description.trim()) {
            console.warn(`Product ${product.name} has no description, using default`);
          }

          if (!product.newPrice || product.newPrice <= 0) {
            console.warn(`Product ${product.name} has invalid price: ${product.newPrice}, using original price: ${product.price}`);
          }

          if (!toSeller || !toSeller.trim()) {
            console.error('No target seller selected');
            errorCount++;
            toast.error('Please select a target seller');
            continue;
          }

          const productData = {
            name: product.name.trim(),
            description: (product.description || product.name || 'Product cloned from inventory').trim(),
            price: product.newPrice > 0 ? product.newPrice : (product.price || 0),
            category: product.category || 'Uncategorized',
            subcategory: product.subcategory || undefined,
            brand: product.brand || undefined,
            images: product.image_url ? [product.image_url] : [],
            seller_id: toSeller,
            stock_available: product.stock_available ?? 0,
            unit: product.unit || 'piece',
            min_order_quantity: product.min_quantity || product.min_order_quantity || 1,
            status: product.status || 'available'
          };

          console.log('Cloning product:', product.name, 'to seller:', toSeller);
          console.log('Product data being sent:', JSON.stringify(productData, null, 2));
          
          const result = await adminQueries.addProduct(productData);
          
          console.log('Add product result:', result);
          
          // Check if result has success property or if data/id exists (API returns { data, success: true })
          if (result?.success === true || result?.data || result?.id) {
            console.log('Successfully cloned product:', product.name);
            successCount++;
          } else {
            const errorMsg = result?.error || 'Unknown error';
            console.error(`Error cloning product ${product.name}:`, errorMsg, result);
            errorCount++;
            toast.error(`Failed to clone ${product.name}: ${errorMsg}`);
          }
        } catch (error: any) {
          const errorMsg = error?.message || 'Unknown error';
          console.error(`Error cloning product ${product.name}:`, error);
          errorCount++;
          toast.error(`Failed to clone ${product.name}: ${errorMsg}`);
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
              <InputLabel id="from-seller-select-label">From Seller</InputLabel>
              <Select
                labelId="from-seller-select-label"
                value={fromSeller}
                onChange={(e) => {
                  console.log('From Seller selected:', e.target.value);
                  setFromSeller(e.target.value);
                }}
                label="From Seller"
                disabled={loadingSellers}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
              >
                {loadingSellers ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Loading sellers...
                  </MenuItem>
                ) : sellers.length === 0 ? (
                  <MenuItem disabled>No sellers available</MenuItem>
                ) : (
                  sellers.map((seller) => (
                    <MenuItem key={seller.id} value={seller.id}>
                      {getSellerDisplayName(seller)}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth disabled={loadingSellers}>
              <InputLabel id="to-seller-select-label">To Seller</InputLabel>
              <Select
                labelId="to-seller-select-label"
                value={toSeller}
                onChange={(e) => {
                  console.log('To Seller selected:', e.target.value);
                  setToSeller(e.target.value);
                }}
                label="To Seller"
                disabled={loadingSellers}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
              >
                {loadingSellers ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Loading sellers...
                  </MenuItem>
                ) : sellers.length === 0 ? (
                  <MenuItem disabled>No sellers available</MenuItem>
                ) : (
                  sellers.map((seller) => (
                    <MenuItem key={seller.id} value={seller.id}>
                      {getSellerDisplayName(seller)}
                    </MenuItem>
                  ))
                )}
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