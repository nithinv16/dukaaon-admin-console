'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CardMedia,
  CircularProgress,
  Container,
  Paper,
  IconButton,
} from '@mui/material';
import {
  Search,
  Add,
  ArrowBack,
  Edit,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { adminQueries } from '@/lib/supabase-browser';
import ProductImageEditor from '@/components/ProductImageEditor';
import toast from 'react-hot-toast';
import VariantManager from '@/components/VariantManager';
import { VariantService } from '@/lib/services/products/VariantService';
import { CreateVariantInput } from '@/lib/services/products/VariantService';

export default function AddFromMasterProductsPage() {
  const router = useRouter();
  const [masterProducts, setMasterProducts] = useState<any[]>([]);
  const [selectedMasterProduct, setSelectedMasterProduct] = useState<any>(null);
  const [masterProductLoading, setMasterProductLoading] = useState(false);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);

  // Master products pagination and search state
  const [masterProductsPage, setMasterProductsPage] = useState(1);
  const [masterProductsPageSize] = useState(12); // 12 products per page (3x4 grid)
  const [masterProductsTotalCount, setMasterProductsTotalCount] = useState(0);
  const [masterProductsSearchTerm, setMasterProductsSearchTerm] = useState('');
  const [masterProductsFilterCategory, setMasterProductsFilterCategory] = useState('all');
  const [sellerData, setSellerData] = useState({
    seller_id: '',
    price: '',
    stock_available: '',
    min_order_quantity: '1',
    unit: 'piece',
    description: ''
  });
  const [productVariants, setProductVariants] = useState<CreateVariantInput[]>([]);

  // Categories data - fetched from database
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Load categories from database
  const loadCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const data = await adminQueries.getCategories();
      const categoryNames = (data.categories || []).map((cat: any) => cat.name);
      setCategories(categoryNames);
    } catch (error) {
      console.error('Error loading categories:', error);
      // Fallback to empty array on error
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const loadSellers = useCallback(async () => {
    try {
      setLoadingSellers(true);
      const sellers = await adminQueries.getSellersWithDetails();
      console.log('Loaded sellers in add-from-master:', sellers);
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
  }, []);

  const loadMasterProducts = useCallback(async () => {
    try {
      setMasterProductLoading(true);

      const result = await adminQueries.getMasterProducts({
        page: masterProductsPage,
        limit: masterProductsPageSize,
        search: masterProductsSearchTerm || undefined,
        category: masterProductsFilterCategory !== 'all' ? masterProductsFilterCategory : undefined,
      });

      setMasterProducts(result?.products || []);
      setMasterProductsTotalCount(result?.total || 0);
    } catch (error) {
      console.error('Error loading master products:', error);
      toast.error('Failed to load master products');
    } finally {
      setMasterProductLoading(false);
    }
  }, [masterProductsPage, masterProductsPageSize, masterProductsSearchTerm, masterProductsFilterCategory]);

  // Reset page to 1 when search term or category filter changes
  useEffect(() => {
    setMasterProductsPage(1);
  }, [masterProductsSearchTerm, masterProductsFilterCategory]);

  // Load master products with debounce for search, immediate for page/category
  useEffect(() => {
    // Debounce only when search term is not empty, immediate for empty search/page/category changes
    const delay = masterProductsSearchTerm && masterProductsSearchTerm.trim() ? 300 : 0;

    const timeoutId = setTimeout(() => {
      loadMasterProducts();
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [masterProductsSearchTerm, masterProductsPage, masterProductsFilterCategory, loadMasterProducts]);

  // Load sellers and categories on component mount
  useEffect(() => {
    loadSellers();
    loadCategories();
  }, [loadSellers, loadCategories]);

  // Reload sellers when a product is selected to ensure fresh data
  useEffect(() => {
    if (selectedMasterProduct) {
      console.log('Product selected in Add from Master, checking sellers:', {
        productId: selectedMasterProduct.id,
        productName: selectedMasterProduct.name,
        sellersCount: sellers.length,
        loadingSellers: loadingSellers
      });

      // Always reload sellers when a product is selected to ensure fresh data
      console.log('Product selected, reloading sellers...');
      loadSellers();
    }
  }, [selectedMasterProduct, loadSellers]);

  const handleMasterProductsSearch = (searchTerm: string) => {
    setMasterProductsSearchTerm(searchTerm);
  };

  const handleMasterProductsCategoryFilter = (category: string) => {
    setMasterProductsFilterCategory(category);
    setMasterProductsPage(1); // Reset to first page when filtering
  };

  const handleMasterProductsPageChange = (newPage: number) => {
    setMasterProductsPage(newPage);
  };

  const totalMasterProductsPages = Math.ceil(masterProductsTotalCount / masterProductsPageSize);

  // Image editor handlers
  const handleOpenImageEditor = () => {
    setImageEditorOpen(true);
  };

  const handleCloseImageEditor = () => {
    setImageEditorOpen(false);
  };

  const handleImageUpdate = (newImageUrl: string) => {
    if (selectedMasterProduct) {
      setSelectedMasterProduct({
        ...selectedMasterProduct,
        image_url: newImageUrl,
        images: newImageUrl ? [newImageUrl] : []
      });
    }
  };

  const handleAddMasterProductToSeller = async () => {
    if (!selectedMasterProduct || !sellerData.seller_id) {
      toast.error('Please select a master product and seller');
      return;
    }

    if (!sellerData.price || parseFloat(sellerData.price) <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    if (!sellerData.stock_available || parseInt(sellerData.stock_available) < 0) {
      toast.error('Please enter a valid stock quantity');
      return;
    }

    try {
      // Check for duplicate product
      const duplicateCheck = await fetch('/api/admin/products/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedMasterProduct.name.trim(),
          seller_id: sellerData.seller_id,
        }),
      });

      if (duplicateCheck.ok) {
        const duplicateResult = await duplicateCheck.json();
        if (duplicateResult.isDuplicate) {
          const confirmMessage = `${duplicateResult.reason}\n\nDo you want to add it anyway?`;
          if (!window.confirm(confirmMessage)) {
            return;
          }
        }
      }

      setUploading(true);

      // Get admin and session info for tracking
      const adminSession = localStorage.getItem('admin_session');
      const sessionId = localStorage.getItem('tracking_session_id');
      const admin = adminSession ? JSON.parse(adminSession) : null;

      // Add product to seller inventory
      const productData = {
        name: selectedMasterProduct.name,
        description: sellerData.description || selectedMasterProduct.description || '',
        price: parseFloat(sellerData.price),
        category: selectedMasterProduct.category || '',
        subcategory: selectedMasterProduct.subcategory || '',
        brand: selectedMasterProduct.brand || '',
        seller_id: sellerData.seller_id,
        stock_available: parseInt(sellerData.stock_available),
        unit: sellerData.unit || 'piece',
        min_order_quantity: parseInt(sellerData.min_order_quantity) || 1,
        images: selectedMasterProduct.images || (selectedMasterProduct.image_url ? [selectedMasterProduct.image_url] : []),
        status: 'available',
        // Add variants if any
        variants: productVariants.length > 0 ? productVariants : undefined,
        // Add tracking info
        admin_id: admin?.id,
        session_id: sessionId,
      };

      const createdProduct = await adminQueries.addProduct(productData);
      
      // Create variants if product was created and variants exist
      if (createdProduct?.id && productVariants.length > 0) {
        try {
          const variantsWithProductId = productVariants.map(v => ({
            ...v,
            product_id: createdProduct.id,
          }));
          await VariantService.createVariants(variantsWithProductId);
        } catch (variantError) {
          console.error('Error creating variants:', variantError);
          toast.error('Product created but variants failed to save. You can add them later.');
        }
      }

      toast.success('Product added to seller inventory successfully!');
      // Navigate back to products page
      router.push('/products');
    } catch (error) {
      console.error('Error adding master product to seller:', error);
      toast.error('Failed to add product to seller inventory');
    } finally {
      setUploading(false);
    }
  };

    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => router.push('/products')} color="primary">
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" component="h1">
            Add Product from Master Products
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {/* Master Products Selection */}
          <Grid item xs={12} lg={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Select Master Product
              </Typography>

              {/* Search and Filter Controls */}
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      placeholder="Search products..."
                      value={masterProductsSearchTerm}
                      onChange={(e) => handleMasterProductsSearch(e.target.value)}
                      InputProps={{
                        startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={masterProductsFilterCategory}
                        onChange={(e) => handleMasterProductsCategoryFilter(e.target.value)}
                        label="Category"
                      >
                        <MenuItem value="all">All Categories</MenuItem>
                        {categories.map((category) => (
                          <MenuItem key={category} value={category}>
                            {category}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      {masterProductsTotalCount} products
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {masterProductLoading ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    {masterProducts.map((product) => (
                      <Grid item xs={12} sm={6} md={4} key={product.id}>
                        <Card
                          sx={{
                            cursor: 'pointer',
                            border: selectedMasterProduct?.id === product.id ? 2 : 1,
                            borderColor: selectedMasterProduct?.id === product.id ? 'primary.main' : 'divider',
                            '&:hover': { borderColor: 'primary.main' }
                          }}
                          onClick={() => {
                            setSelectedMasterProduct(product);
                            setSellerData(prev => ({
                              ...prev,
                              price: product.price?.toString() || '',
                              description: product.description || ''
                            }));
                          }}
                        >
                          <CardMedia
                            component="img"
                            height="120"
                            image={product.images?.[0] || product.image_url || '/placeholder-image.png'}
                            alt={product.name}
                            sx={{ objectFit: 'cover' }}
                          />
                          <CardContent>
                            <Typography variant="subtitle2" noWrap>
                              {product.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {product.category} • {product.subcategory}
                            </Typography>
                            <Typography variant="body2" color="primary" fontWeight="medium">
                              ₹{product.price}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Pagination Controls */}
                  {masterProductsTotalCount > masterProductsPageSize && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 3, mb: 2 }}>
                      <Button
                        variant="outlined"
                        disabled={masterProductsPage === 1}
                        onClick={() => handleMasterProductsPageChange(masterProductsPage - 1)}
                        sx={{ mr: 2 }}
                      >
                        Previous
                      </Button>

                      <Typography variant="body2" sx={{ mx: 2 }}>
                        Page {masterProductsPage} of {totalMasterProductsPages}
                      </Typography>

                      <Button
                        variant="outlined"
                        disabled={masterProductsPage === totalMasterProductsPages}
                        onClick={() => handleMasterProductsPageChange(masterProductsPage + 1)}
                        sx={{ ml: 2 }}
                      >
                        Next
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </Paper>
          </Grid>

          {/* Seller Details Form */}
          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
              {selectedMasterProduct ? (
                <>
                  <Typography variant="h6" gutterBottom>
                    Selected Product
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                      <img
                        src={selectedMasterProduct.images?.[0] || selectedMasterProduct.image_url || '/placeholder-image.png'}
                        alt={selectedMasterProduct.name}
                        style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }}
                      />
                      <IconButton
                        onClick={handleOpenImageEditor}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          backgroundColor: 'rgba(0, 0, 0, 0.6)',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          },
                          size: 'small',
                        }}
                        size="small"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Box>
                    <Typography variant="subtitle1" sx={{ mt: 1 }}>
                      {selectedMasterProduct.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedMasterProduct.category} • {selectedMasterProduct.subcategory}
                    </Typography>
                    <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
                      ₹{selectedMasterProduct.price}
                    </Typography>
                  </Box>

                  <Typography variant="h6" gutterBottom>
                    Seller Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControl
                        fullWidth
                        error={sellers.length === 0 && !loadingSellers}
                      >
                        <InputLabel id="seller-select-label">Select Seller</InputLabel>
                        <Select
                          labelId="seller-select-label"
                          value={sellerData.seller_id || ''}
                          onChange={(e) => {
                            console.log('Seller selected:', e.target.value);
                            setSellerData(prev => ({ ...prev, seller_id: e.target.value }));
                          }}
                          onOpen={() => {
                            console.log('Seller dropdown opened in Add from Master, sellers count:', sellers.length);
                            if (sellers.length === 0 && !loadingSellers) {
                              console.log('No sellers when dropdown opened, loading sellers...');
                              loadSellers();
                            }
                          }}
                          label="Select Seller"
                          disabled={loadingSellers}
                          MenuProps={{
                            PaperProps: {
                              sx: {
                                maxHeight: 300,
                                zIndex: 1301, // Ensure it appears above other elements
                              },
                            },
                            anchorOrigin: {
                              vertical: 'bottom',
                              horizontal: 'left',
                            },
                            transformOrigin: {
                              vertical: 'top',
                              horizontal: 'left',
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
                            sellers.map((seller) => {
                              if (!seller || !seller.id) {
                                console.warn('Skipping invalid seller:', seller);
                                return null;
                              }
                              const businessName = seller.business_name || seller.display_name || seller.phone_number || `Seller ${seller.id}`;
                              console.log('Rendering MenuItem for seller:', { id: seller.id, name: businessName });
                              return (
                                <MenuItem key={seller.id} value={seller.id} sx={{ py: 1 }}>
                                  {businessName}
                                </MenuItem>
                              );
                            }).filter(Boolean)
                          )}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Price"
                        type="number"
                        value={sellerData.price}
                        onChange={(e) => setSellerData(prev => ({ ...prev, price: e.target.value }))}
                        inputProps={{ step: '0.01', min: '0' }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Stock Available"
                        type="number"
                        value={sellerData.stock_available}
                        onChange={(e) => setSellerData(prev => ({ ...prev, stock_available: e.target.value }))}
                        inputProps={{ min: '0' }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Minimum Order Quantity"
                        type="number"
                        value={sellerData.min_order_quantity}
                        onChange={(e) => setSellerData(prev => ({ ...prev, min_order_quantity: e.target.value }))}
                        inputProps={{ min: '1' }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Unit</InputLabel>
                        <Select
                          value={sellerData.unit}
                          onChange={(e) => setSellerData(prev => ({ ...prev, unit: e.target.value }))}
                          label="Unit"
                        >
                          <MenuItem value="piece">Piece</MenuItem>
                          <MenuItem value="kg">Kilogram</MenuItem>
                          <MenuItem value="liter">Liter</MenuItem>
                          <MenuItem value="meter">Meter</MenuItem>
                          <MenuItem value="box">Box</MenuItem>
                          <MenuItem value="pack">Pack</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Description (Optional)"
                        multiline
                        rows={3}
                        value={sellerData.description}
                        onChange={(e) => setSellerData(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleAddMasterProductToSeller}
                        disabled={!selectedMasterProduct || !sellerData.seller_id || uploading}
                        startIcon={uploading ? <CircularProgress size={20} /> : <Add />}
                      >
                        {uploading ? 'Adding...' : 'Add to Inventory'}
                      </Button>
                    </Grid>
                  </Grid>

                  {/* Variant Manager */}
                  {selectedMasterProduct && (
                    <Box sx={{ mt: 3 }}>
                      <VariantManager
                        productName={selectedMasterProduct.name}
                        variants={productVariants}
                        onVariantsChange={setProductVariants}
                      />
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    Select a master product to continue
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Product Image Editor Dialog */}
        {selectedMasterProduct && (
          <ProductImageEditor
            open={imageEditorOpen}
            onClose={handleCloseImageEditor}
            currentImage={selectedMasterProduct.images?.[0] || selectedMasterProduct.image_url}
            productName={selectedMasterProduct.name}
            productId={selectedMasterProduct.id}
            onImageUpdate={handleImageUpdate}
          />
        )}
      </Container>
    );
  }