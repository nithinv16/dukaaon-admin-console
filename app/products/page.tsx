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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  Avatar,
  CardMedia,
  CircularProgress,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid';
import {
  Search,
  FilterList,
  Add,
  Edit,
  Delete,
  Visibility,
  Inventory,
  TrendingUp,
  Category,
  AttachMoney,
  CloudUpload,
  Close,
  PlaylistAdd,
} from '@mui/icons-material';
import { adminQueries, Product } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  outOfStock: number;
  lowStock: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [stats, setStats] = useState<ProductStats>({
    totalProducts: 0,
    activeProducts: 0,
    outOfStock: 0,
    lowStock: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    subcategory: '',
    stock: '',
    unit: 'piece',
    seller_id: '',
    images: [] as string[]
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalProducts, setTotalProducts] = useState(0);
  
  // Master products dialog states
  const [masterProductsDialogOpen, setMasterProductsDialogOpen] = useState(false);
  const [masterProducts, setMasterProducts] = useState<any[]>([]);
  const [selectedMasterProduct, setSelectedMasterProduct] = useState<any>(null);
  const [masterProductLoading, setMasterProductLoading] = useState(false);
  const [sellerData, setSellerData] = useState({
    seller_id: '',
    price: '',
    stock_available: '',
    min_order_quantity: '1',
    unit: 'piece',
    description: ''
  });

  useEffect(() => {
    loadProducts();
    loadStats();
  }, [page, pageSize, searchTerm, filterCategory, filterStatus]);

  useEffect(() => {
    loadSellers();
  }, []);

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setEditDialogOpen(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    
    try {
      setUploading(true);
      await adminQueries.updateProduct(editingProduct.id, {
        name: editingProduct.name,
        description: editingProduct.description,
        price: editingProduct.price,
        category: editingProduct.category,
        subcategory: editingProduct.subcategory,
        stock_available: editingProduct.stock_quantity,
        status: editingProduct.status
      });
      
      setEditDialogOpen(false);
      setEditingProduct(null);
      loadProducts();
      toast.success('Product updated successfully!');
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    } finally {
      setUploading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.description || !newProduct.price || !newProduct.category || !newProduct.seller_id) {
      toast.error('Please fill in all required fields including seller selection');
      return;
    }

    setUploading(true);
    try {
      // Upload images first
      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const result = await adminQueries.uploadProductImage(file);
        if (result.success) {
          imageUrls.push(result.url);
        }
      }

      // Add product with image URLs
      const productData = {
        ...newProduct,
        price: parseFloat(newProduct.price) || 0,
        stock: parseInt(newProduct.stock) || 0,
        images: imageUrls
      };

      await adminQueries.addProduct(productData);
      
      // Reset form
      setNewProduct({
        name: '',
        description: '',
        price: '',
        category: '',
        subcategory: '',
        stock: '',
        unit: 'piece',
        seller_id: '',
        images: []
      });
      setImageFiles([]);
      setAddDialogOpen(false);
      
      // Refresh products list
      loadProducts();
      
      toast.success('Product added successfully!');
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to add product. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setImageFiles(prev => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const result = await adminQueries.getProducts(
        page + 1,
        pageSize,
        searchTerm,
        filterCategory === 'all' ? undefined : filterCategory,
        filterStatus === 'all' ? undefined : filterStatus
      );
      setProducts(result.products || []);
      setTotalProducts(result.total || 0);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Get all products without pagination to calculate accurate stats
      const result = await adminQueries.getProducts(1, 10000); // Large limit to get all products
      const allProducts = result.products || [];
      
      const totalProducts = allProducts.length;
      const activeProducts = allProducts.filter(p => p.status === 'active').length;
      const outOfStock = allProducts.filter(p => (p.stock_quantity || 0) === 0).length;
      const lowStock = allProducts.filter(p => {
        const stock = p.stock_quantity || 0;
        return stock > 0 && stock <= 10; // Consider stock <= 10 as low stock
      }).length;
      
      setStats({
        totalProducts,
        activeProducts,
        outOfStock,
        lowStock,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadSellers = async () => {
    try {
      const result = await adminQueries.getUsers({ limit: 1000 });
      const allUsers = result.data || [];
      
      // Filter to get only sellers (wholesalers and manufacturers)
      const sellersOnly = allUsers.filter(user => 
        user.role === 'wholesaler' || user.role === 'manufacturer'
      );
      
      console.log('Loaded sellers:', sellersOnly);
      setSellers(sellersOnly);
    } catch (error) {
      console.error('Error loading sellers:', error);
    }
  };

  const loadMasterProducts = async () => {
    try {
      setMasterProductLoading(true);
      const result = await adminQueries.getMasterProducts();
      setMasterProducts(result?.products || []);
    } catch (error) {
      console.error('Error loading master products:', error);
      toast.error('Failed to load master products');
    } finally {
      setMasterProductLoading(false);
    }
  };

  const handleAddMasterProductToSeller = async () => {
    if (!selectedMasterProduct || !sellerData.seller_id) {
      toast.error('Please select a master product and seller');
      return;
    }

    try {
      setUploading(true);
      await adminQueries.addMasterProductToSeller(
        selectedMasterProduct.id,
        sellerData.seller_id,
        {
          price: parseFloat(sellerData.price) || selectedMasterProduct.price,
          stock_available: parseInt(sellerData.stock_available) || 0,
          min_order_quantity: parseInt(sellerData.min_order_quantity) || 1,
          unit: sellerData.unit,
          description: sellerData.description || selectedMasterProduct.description
        }
      );
      
      toast.success('Product added to seller inventory successfully!');
      setMasterProductsDialogOpen(false);
      setSelectedMasterProduct(null);
      setSellerData({
        seller_id: '',
        price: '',
        stock_available: '',
        min_order_quantity: '1',
        unit: 'piece',
        description: ''
      });
      loadProducts(); // Refresh the products list
    } catch (error) {
      console.error('Error adding master product to seller:', error);
      toast.error('Failed to add product to seller inventory');
    } finally {
      setUploading(false);
    }
  };

  const handleMasterProductDialogOpen = () => {
    setMasterProductsDialogOpen(true);
    loadMasterProducts();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'out_of_stock':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'images',
      headerName: 'Image',
      width: 80,
      renderCell: (params: GridRenderCellParams) => (
        <Avatar
          src={params.value?.[0]}
          alt={params.row.name}
          variant="rounded"
          sx={{ width: 40, height: 40 }}
        >
          <Inventory />
        </Avatar>
      ),
    },
    {
      field: 'name',
      headerName: 'Product Name',
      width: 250,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.category} • {params.row.subcategory}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'price',
      headerName: 'Price',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight="medium">
          ₹{params.value?.toLocaleString() || '0'}
        </Typography>
      ),
    },
    {
      field: 'stock_quantity',
      headerName: 'Stock',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value || 0}
          color={params.value > 10 ? 'success' : params.value > 0 ? 'warning' : 'error'}
          size="small"
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value || 'active'}
          color={getStatusColor(params.value)}
          size="small"
        />
      ),
    },
    {
      field: 'seller_name',
      headerName: 'Seller',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value || 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'created_at',
      headerName: 'Added',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handleViewProduct(params.row)}
          >
            <Visibility />
          </IconButton>
          <IconButton 
            size="small"
            onClick={() => handleEditProduct(params.row)}
          >
            <Edit />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Product Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your product catalog and inventory
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <Inventory />
                </Avatar>
                <Box>
                  <Typography variant="h6">{stats.totalProducts.toLocaleString()}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Products
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <TrendingUp />
                </Avatar>
                <Box>
                  <Typography variant="h6">{stats.activeProducts.toLocaleString()}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Products
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <Inventory />
                </Avatar>
                <Box>
                  <Typography variant="h6">{stats.outOfStock}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Out of Stock
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <Inventory />
                </Avatar>
                <Box>
                  <Typography variant="h6">{stats.lowStock}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Low Stock
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  <MenuItem value="electronics">Electronics</MenuItem>
                  <MenuItem value="clothing">Clothing</MenuItem>
                  <MenuItem value="home">Home & Garden</MenuItem>
                  <MenuItem value="books">Books</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Add />}
                onClick={() => setAddDialogOpen(true)}
              >
                Add Product
              </Button>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PlaylistAdd />}
                onClick={handleMasterProductDialogOpen}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Quick Add from Master
              </Button>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Inventory />}
                onClick={() => window.location.href = '/products/master'}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Master Products
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent>
          <DataGrid
            rows={products}
            columns={columns}
            loading={loading}
            pageSizeOptions={[25, 50, 100]}
            paginationModel={{ page, pageSize }}
            paginationMode="server"
            rowCount={totalProducts}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 500 },
              },
            }}
            sx={{ height: 600 }}
          />
        </CardContent>
      </Card>

      {/* Product Details Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Product Details
        </DialogTitle>
        <DialogContent>
          {selectedProduct && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <CardMedia
                  component="img"
                  height="200"
                  image={selectedProduct.images?.[0] || '/placeholder-product.png'}
                  alt={selectedProduct.name}
                  sx={{ borderRadius: 1 }}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Stack spacing={2}>
                  <Typography variant="h6">{selectedProduct.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedProduct.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Chip label={selectedProduct.category} />
                    <Chip label={selectedProduct.subcategory} variant="outlined" />
                  </Box>
                  <Typography variant="h6" color="primary">
                    ₹{selectedProduct.price?.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    Stock: {selectedProduct.stock_quantity} units
                  </Typography>
                  <Typography variant="body2">
                    Status: <Chip label={selectedProduct.status} size="small" />
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          <Button variant="contained">Edit Product</Button>
        </DialogActions>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Product</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Product Name"
              value={newProduct.name}
              onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />
            
            <TextField
              label="Description"
              value={newProduct.description}
              onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={3}
              fullWidth
              required
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Price"
                type="number"
                value={newProduct.price}
                onChange={(e) => setNewProduct(prev => ({ ...prev, price: e.target.value }))}
                fullWidth
                required
              />
              
              <TextField
                label="Stock"
                type="number"
                value={newProduct.stock}
                onChange={(e) => setNewProduct(prev => ({ ...prev, stock: e.target.value }))}
                fullWidth
              />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Category"
                value={newProduct.category}
                onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                fullWidth
                required
              />
              
              <TextField
                label="Subcategory"
                value={newProduct.subcategory}
                onChange={(e) => setNewProduct(prev => ({ ...prev, subcategory: e.target.value }))}
                fullWidth
              />
            </Box>
            
            <FormControl fullWidth required>
              <InputLabel>Select Seller</InputLabel>
              <Select
                value={newProduct.seller_id}
                onChange={(e) => setNewProduct(prev => ({ ...prev, seller_id: e.target.value }))}
                label="Select Seller"
              >
                {sellers.map((seller) => (
                  <MenuItem key={seller.id} value={seller.id}>
                    {seller.business_details?.shopName || seller.business_name || seller.phone_number} 
                    ({seller.role})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              label="Unit"
              value={newProduct.unit}
              onChange={(e) => setNewProduct(prev => ({ ...prev, unit: e.target.value }))}
              fullWidth
            />
            
            {/* Image Upload Section */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Product Images
              </Typography>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="image-upload"
                multiple
                type="file"
                onChange={handleImageUpload}
              />
              <label htmlFor="image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUpload />}
                  sx={{ mb: 2 }}
                >
                  Upload Images
                </Button>
              </label>
              
              {imageFiles.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {imageFiles.map((file, index) => (
                    <Box key={index} sx={{ position: 'relative', width: 100, height: 100 }}>
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: 4
                        }}
                      />
                      <IconButton
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          bgcolor: 'error.main',
                          color: 'white',
                          '&:hover': { bgcolor: 'error.dark' }
                        }}
                        onClick={() => removeImage(index)}
                      >
                        <Close sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddProduct}
            variant="contained"
            disabled={uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <Add />}
          >
            {uploading ? 'Adding...' : 'Add Product'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Product</DialogTitle>
        <DialogContent>
          {editingProduct && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Product Name"
                value={editingProduct.name}
                onChange={(e) => setEditingProduct(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                fullWidth
                required
              />
              
              <TextField
                label="Description"
                value={editingProduct.description}
                onChange={(e) => setEditingProduct(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                multiline
                rows={3}
                fullWidth
                required
              />
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Price"
                  type="number"
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct(prev => prev ? ({ ...prev, price: parseFloat(e.target.value) || 0 }) : null)}
                  fullWidth
                  required
                />
                
                <TextField
                  label="Stock"
                  type="number"
                  value={editingProduct.stock_quantity}
                  onChange={(e) => setEditingProduct(prev => prev ? ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }) : null)}
                  fullWidth
                />
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Category"
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct(prev => prev ? ({ ...prev, category: e.target.value }) : null)}
                  fullWidth
                  required
                />
                
                <TextField
                  label="Subcategory"
                  value={editingProduct.subcategory}
                  onChange={(e) => setEditingProduct(prev => prev ? ({ ...prev, subcategory: e.target.value }) : null)}
                  fullWidth
                />
              </Box>
              
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={editingProduct.status}
                  onChange={(e) => setEditingProduct(prev => prev ? ({ ...prev, status: e.target.value as 'active' | 'inactive' | 'out_of_stock' }) : null)}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpdateProduct}
            variant="contained"
            disabled={uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <Edit />}
          >
            {uploading ? 'Updating...' : 'Update Product'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Master Products Dialog */}
      <Dialog
        open={masterProductsDialogOpen}
        onClose={() => setMasterProductsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Product from Master Products</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {masterProductLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Typography variant="h6" gutterBottom>
                  Select Master Product
                </Typography>
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
                          image={product.images?.[0] || '/placeholder-image.png'}
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

                {selectedMasterProduct && (
                  <>
                    <Typography variant="h6" gutterBottom>
                      Seller Details
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Select Seller</InputLabel>
                          <Select
                            value={sellerData.seller_id}
                            onChange={(e) => setSellerData(prev => ({ ...prev, seller_id: e.target.value }))}
                            label="Select Seller"
                          >
                            {sellers.map((seller) => (
                              <MenuItem key={seller.id} value={seller.id}>
                                {seller.business_name || seller.full_name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Price"
                          type="number"
                          value={sellerData.price}
                          onChange={(e) => setSellerData(prev => ({ ...prev, price: e.target.value }))}
                          inputProps={{ step: '0.01', min: '0' }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Stock Available"
                          type="number"
                          value={sellerData.stock_available}
                          onChange={(e) => setSellerData(prev => ({ ...prev, stock_available: e.target.value }))}
                          inputProps={{ min: '0' }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Minimum Order Quantity"
                          type="number"
                          value={sellerData.min_order_quantity}
                          onChange={(e) => setSellerData(prev => ({ ...prev, min_order_quantity: e.target.value }))}
                          inputProps={{ min: '1' }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
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
                    </Grid>
                  </>
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMasterProductsDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddMasterProductToSeller}
            variant="contained"
            disabled={!selectedMasterProduct || !sellerData.seller_id || uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <Add />}
          >
            {uploading ? 'Adding...' : 'Add to Inventory'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}