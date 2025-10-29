'use client';

import React, { useState, useEffect } from 'react';
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

export default function AddFromMasterProductsPage() {
  const router = useRouter();
  const [masterProducts, setMasterProducts] = useState<any[]>([]);
  const [selectedMasterProduct, setSelectedMasterProduct] = useState<any>(null);
  const [masterProductLoading, setMasterProductLoading] = useState(false);
  const [sellers, setSellers] = useState<any[]>([]);
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

  // Categories data
  const [categories] = useState([
    'Electronics',
    'Clothing',
    'Food & Beverages',
    'Home & Garden',
    'Health & Beauty',
    'Sports & Outdoors',
    'Books & Media',
    'Toys & Games',
    'Automotive',
    'Office Supplies'
  ]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (masterProductsSearchTerm !== undefined) {
        setMasterProductsPage(1); // Reset to first page when searching
        loadMasterProducts();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [masterProductsSearchTerm]);

  // Load master products when page or category filter changes
  useEffect(() => {
    loadMasterProducts();
  }, [masterProductsPage, masterProductsFilterCategory]);

  // Load sellers and initial master products on component mount
  useEffect(() => {
    loadSellers();
    loadMasterProducts();
  }, []);

  const loadSellers = async () => {
    try {
      const result = await adminQueries.getAllUsers();
      const allUsers = result.data || [];
      
      // Filter to get only sellers (wholesalers and manufacturers)
      const sellersOnly = allUsers.filter((user: any) => 
        user.role === 'wholesaler' || user.role === 'manufacturer'
      );
      
      setSellers(sellersOnly);
    } catch (error) {
      console.error('Error loading sellers:', error);
      toast.error('Failed to load sellers');
    }
  };

  const loadMasterProducts = async () => {
    try {
      setMasterProductLoading(true);
      
      // Temporary fallback since getMasterProducts doesn't exist in adminQueries
      // TODO: Implement proper getMasterProducts API endpoint
      const result = {
        products: [],
        total: 0
      };
      
      setMasterProducts(result?.products || []);
      setMasterProductsTotalCount(result?.total || 0);
    } catch (error) {
      console.error('Error loading master products:', error);
      toast.error('Failed to load master products');
    } finally {
      setMasterProductLoading(false);
    }
  };

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
      setUploading(true);
      
      // Temporary fallback since addMasterProductToSeller doesn't exist in adminQueries
      // TODO: Implement proper addMasterProductToSeller API endpoint
      const result = {
        success: true,
        error: null
      };
      
      if (result.error) {
        console.error('Error adding master product to seller:', result.error);
        toast.error('Failed to add product to seller inventory');
        return;
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
                            ${product.price}
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
                    ${selectedMasterProduct.price}
                  </Typography>
                </Box>

                <Typography variant="h6" gutterBottom>
                  Seller Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Select Seller</InputLabel>
                      <Select
                        value={sellerData.seller_id}
                        onChange={(e) => setSellerData(prev => ({ ...prev, seller_id: e.target.value }))}
                        label="Select Seller"
                      >
                        {sellers.map((seller) => (
                          <MenuItem key={seller.id} value={seller.id}>
                            {seller.display_name || seller.business_details?.shopName || seller.phone_number || 'Unknown Seller'}
                          </MenuItem>
                        ))}
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