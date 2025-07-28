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
  Breadcrumbs,
  Link,
  Paper,
  Tooltip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
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
  ArrowBack,
  Home,
  Upload,
  GetApp,
  CheckCircle,
  Error,
  Warning,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { adminQueries, MasterProduct } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

interface MasterProductStats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  inactiveProducts: number;
}

export default function MasterProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [stats, setStats] = useState<MasterProductStats>({
    totalProducts: 0,
    activeProducts: 0,
    draftProducts: 0,
    inactiveProducts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<MasterProduct | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  // Category-Subcategory mapping
  const categorySubcategoryMap: Record<string, string[]> = {
    electronics: ['smartphones', 'laptops', 'tablets', 'headphones', 'cameras', 'gaming'],
    clothing: ['mens', 'womens', 'kids', 'shoes', 'bags'],
    groceries: ['rice', 'pulses', 'spices', 'oil', 'flour', 'canned', 'frozen'],
    sweets: ['chocolates', 'candies', 'traditional', 'cookies'],
    beverages: ['soft-drinks', 'juices', 'tea', 'water', 'energy'],
    dairy: ['milk', 'cheese', 'yogurt', 'eggs', 'butter'],
    fruits: ['fresh-fruits', 'fresh-vegetables', 'organic', 'exotic'],
    meat: ['fresh-meat', 'frozen-meat', 'seafood', 'processed'],
    bakery: ['bread', 'pastries', 'cakes', 'muffins'],
    snacks: ['chips', 'nuts', 'crackers', 'popcorn'],
    home: ['furniture', 'decor', 'lighting', 'storage', 'garden'],
    kitchen: ['appliances', 'cookware', 'utensils', 'storage'],
    books: ['fiction', 'non-fiction', 'educational', 'stationery'],
    sports: ['fitness', 'outdoor', 'team-sports', 'water-sports'],
    beauty: ['skincare', 'makeup', 'haircare', 'fragrances'],
    health: ['supplements', 'medical', 'fitness', 'wellness'],
    baby: ['feeding', 'clothing', 'toys', 'care'],
    automotive: ['parts', 'accessories', 'tools', 'fluids'],
    toys: ['educational', 'action', 'dolls', 'games'],
    pet: ['food', 'toys', 'care', 'accessories'],
    office: ['supplies', 'furniture', 'electronics', 'storage'],
    tools: ['hand-tools', 'power-tools', 'hardware', 'safety'],
    jewelry: ['rings', 'necklaces', 'earrings', 'watches'],
    music: ['instruments', 'audio', 'accessories', 'sheet-music'],
    travel: ['luggage', 'accessories', 'comfort', 'security']
  };

  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '',
    subcategory: '',
    brand: '',
    image_url: ''
  });
  const [singleImageFiles, setSingleImageFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    loadMasterProducts();
    loadStats();
  }, [page, pageSize, searchTerm, filterCategory, filterStatus]);

  const loadMasterProducts = async () => {
    try {
      setLoading(true);
      const result = await adminQueries.getMasterProducts(
        page + 1,
        pageSize,
        searchTerm,
        filterCategory,
        filterStatus
      );
      setProducts(result.products);
    } catch (error: unknown) {
      console.error('Error loading master products:', error);
      toast.error('Failed to load master products');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const stats = await adminQueries.getMasterProductStats();
      setStats({
        totalProducts: stats.total,
        activeProducts: stats.active,
        draftProducts: stats.draft,
        inactiveProducts: stats.inactive,
      });
    } catch (error: unknown) {
      console.error('Error loading stats:', error);
    }
  };

  const handleViewProduct = (product: MasterProduct) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  const handleEditProduct = (product: MasterProduct) => {
    setEditingProduct(product);
    setEditDialogOpen(true);
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    setUploading(true);
    try {
      // Upload images to product-images/master-products bucket with product name
      const imageUrls: string[] = [];
      for (let i = 0; i < singleImageFiles.length; i++) {
        const file = singleImageFiles[i];
        const fileName = `${newProduct.name.replace(/[^a-zA-Z0-9]/g, '_')}_${i + 1}.${file.name.split('.').pop()}`;
        const result = await adminQueries.uploadProductImage(file, `master-products/${fileName}`);
        if (result.success) {
          imageUrls.push(result.url);
        }
      }

      // Add master product with image URL - only include fields that exist in database
      const productData = {
        name: newProduct.name,
        category: newProduct.category,
        subcategory: newProduct.subcategory,
        brand: newProduct.brand,
        image_url: imageUrls[0] || undefined, // Use first image as primary image
        status: 'active' as const
      };

      await adminQueries.addMasterProduct(productData);
      toast.success('Master product added successfully!');
      
      // Reset form
      setNewProduct({
        name: '',
        category: '',
        subcategory: '',
        brand: '',
        image_url: ''
      });
      setSingleImageFiles([]);
      setAddDialogOpen(false);
      
      // Refresh products list
      loadMasterProducts();
      loadStats();
    } catch (error: unknown) {
      console.error('Error adding master product:', error);
      toast.error('Failed to add master product');
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSingleImageFiles(prev => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setSingleImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Bulk upload functions
  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      parseCsvFile(file);
    } else {
      toast.error('Please select a valid CSV file');
    }
  };

  const handleBulkImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setImageFiles(files);
  };

  const parseCsvFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        validateCsvData(results.data);
      },
      error: (error) => {
        toast.error('Error parsing CSV file: ' + error.message);
      }
    });
  };

  const validateCsvData = (data: any[]) => {
    const errors: string[] = [];
    const requiredFields = ['name', 'category'];
    
    data.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errors.push(`Row ${index + 1}: Missing required field '${field}'`);
        }
      });
      
      // Validate category exists
      if (row.category && !categorySubcategoryMap[row.category.toLowerCase()]) {
        errors.push(`Row ${index + 1}: Invalid category '${row.category}'`);
      }
      
      // Validate subcategory if provided
      if (row.subcategory && row.category) {
        const validSubcategories = categorySubcategoryMap[row.category.toLowerCase()] || [];
        if (!validSubcategories.includes(row.subcategory.toLowerCase())) {
          errors.push(`Row ${index + 1}: Invalid subcategory '${row.subcategory}' for category '${row.category}'`);
        }
      }
      
      // Validate status if provided
      if (row.status && !['active', 'inactive', 'draft'].includes(row.status.toLowerCase())) {
        errors.push(`Row ${index + 1}: Invalid status '${row.status}'. Must be 'active', 'inactive', or 'draft'`);
      }
    });
    
    setValidationErrors(errors);
  };

  const processBulkUpload = async () => {
    if (!csvFile || csvData.length === 0) {
      toast.error('Please upload a valid CSV file first');
      return;
    }
    
    if (validationErrors.length > 0) {
      toast.error('Please fix validation errors before proceeding');
      return;
    }
    
    setBulkProcessing(true);
    try {
      // Upload images first
      let imageUrlMap: Record<string, string> = {};
      if (imageFiles.length > 0) {
        const uploadResult = await adminQueries.uploadBulkImages(imageFiles, 'master-products');
        uploadResult.successful.forEach(img => {
          imageUrlMap[img.fileName] = img.url;
        });
      }
      
      // Process CSV data and create products
      const productsToInsert = csvData.map(row => {
        const imageUrl = row.image_filename ? imageUrlMap[row.image_filename] : undefined;
        return {
          name: row.name.trim(),
          category: row.category.toLowerCase().trim(),
          subcategory: row.subcategory ? row.subcategory.toLowerCase().trim() : undefined,
          brand: row.brand ? row.brand.trim() : undefined,
          image_url: imageUrl,
          status: (row.status ? row.status.toLowerCase().trim() : 'active') as 'active' | 'inactive' | 'draft'
        };
      });
      
      // Insert products in bulk
      const result = await adminQueries.addMasterProductsBulk(productsToInsert);
      
      setBulkResults({
        success: true,
        totalProcessed: csvData.length,
        totalInserted: result.count,
        imageResults: imageFiles.length > 0 ? {
          totalUploaded: Object.keys(imageUrlMap).length,
          totalFailed: imageFiles.length - Object.keys(imageUrlMap).length
        } : null
      });
      
      toast.success(`Successfully added ${result.count} products!`);
      
      // Refresh the products list
      loadMasterProducts();
      loadStats();
      
    } catch (error: unknown) {
      console.error('Bulk upload error:', error);
      setBulkResults({
        success: false,
        error: (error as Error)?.message || 'Unknown error occurred'
      });
      toast.error('Failed to process bulk upload');
    } finally {
      setBulkProcessing(false);
    }
  };

  const downloadCsvTemplate = () => {
    const csvContent = 'name,category,subcategory,brand,status,image_filename\n' +
      'iPhone 15,electronics,smartphones,Apple,active,iphone15.jpg\n' +
      'Samsung Galaxy S24,electronics,smartphones,Samsung,active,galaxy_s24.jpg\n' +
      'Nike Air Max,clothing,shoes,Nike,active,nike_airmax.jpg';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'master_products_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetBulkUpload = () => {
    setCsvFile(null);
    setImageFiles([]);
    setCsvData([]);
    setValidationErrors([]);
    setBulkResults(null);
    setBulkProcessing(false);
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Product Name',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            src={params.row.image_url}
            sx={{ width: 32, height: 32 }}
            variant="rounded"
          >
            <Inventory />
          </Avatar>
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'sku',
      headerName: 'SKU',
      width: 120,
    },
    {
      field: 'brand',
      headerName: 'Brand',
      width: 120,
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 130,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} size="small" />
      ),
    },

    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const status = params.value;
        const color = status === 'active' ? 'success' : status === 'draft' ? 'warning' : 'error';
        return <Chip label={status} color={color} size="small" />;
      },
    },
    {
      field: 'created_at',
      headerName: 'Created',
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
      sortable: false,
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
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            router.push('/');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <Home sx={{ mr: 0.5 }} fontSize="inherit" />
          Dashboard
        </Link>
        <Link
          color="inherit"
          href="/products"
          onClick={(e) => {
            e.preventDefault();
            router.push('/products');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Products
        </Link>
        <Typography color="text.primary">Master Products</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => router.push('/products')}>
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h4" gutterBottom>
            Master Products
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your master product catalog with detailed specifications
          </Typography>
        </Box>
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
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <Category />
                </Avatar>
                <Box>
                  <Typography variant="h6">{stats.draftProducts}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Draft Products
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
                  <Typography variant="h6">{stats.inactiveProducts}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Inactive Products
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
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search master products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
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
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Stack spacing={1}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setAddDialogOpen(true)}
                >
                  Add Master Product
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Upload />}
                  onClick={() => setBulkUploadOpen(true)}
                >
                  Bulk Upload
                </Button>
              </Stack>
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
          Master Product Details
        </DialogTitle>
        <DialogContent>
          {selectedProduct && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <CardMedia
                  component="img"
                  height="200"
                  image={selectedProduct.image_url || '/placeholder-product.png'}
                  alt={selectedProduct.name}
                  sx={{ borderRadius: 1 }}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Stack spacing={2}>
                  <Typography variant="h6">{selectedProduct.name}</Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip label={selectedProduct.category} />
                    {selectedProduct.subcategory && (
                      <Chip label={selectedProduct.subcategory} variant="outlined" />
                    )}
                    {selectedProduct.brand && (
                      <Chip label={selectedProduct.brand} color="secondary" />
                    )}
                  </Box>

                  <Typography variant="body2" color="text.secondary">
                    Created: {new Date(selectedProduct.created_at).toLocaleDateString()}
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

      {/* Add Master Product Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Add New Master Product</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Product Name"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Brand"
                  value={newProduct.brand}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, brand: e.target.value }))}
                  fullWidth
                />
              </Grid>
            </Grid>
            

            

            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Category</InputLabel>
                  <Select
                     value={newProduct.category}
                     onChange={(e) => {
                        const selectedCategory = e.target.value;
                        setNewProduct(prev => ({ 
                          ...prev, 
                          category: selectedCategory, 
                          subcategory: '' // Reset subcategory when category changes
                        }));
                      }}
                     label="Category"
                   >
                     <MenuItem value="electronics">Electronics</MenuItem>
                     <MenuItem value="clothing">Clothing & Fashion</MenuItem>
                     <MenuItem value="groceries">Groceries & Food</MenuItem>
                     <MenuItem value="sweets">Sweets & Chocolates</MenuItem>
                     <MenuItem value="beverages">Beverages</MenuItem>
                     <MenuItem value="dairy">Dairy & Eggs</MenuItem>
                     <MenuItem value="fruits">Fruits & Vegetables</MenuItem>
                     <MenuItem value="meat">Meat & Seafood</MenuItem>
                     <MenuItem value="bakery">Bakery & Bread</MenuItem>
                     <MenuItem value="snacks">Snacks & Confectionery</MenuItem>
                     <MenuItem value="home">Home & Garden</MenuItem>
                     <MenuItem value="kitchen">Kitchen & Dining</MenuItem>
                     <MenuItem value="books">Books & Stationery</MenuItem>
                     <MenuItem value="sports">Sports & Outdoors</MenuItem>
                     <MenuItem value="beauty">Beauty & Personal Care</MenuItem>
                     <MenuItem value="health">Health & Wellness</MenuItem>
                     <MenuItem value="baby">Baby & Kids</MenuItem>
                     <MenuItem value="automotive">Automotive</MenuItem>
                     <MenuItem value="toys">Toys & Games</MenuItem>
                     <MenuItem value="pet">Pet Supplies</MenuItem>
                     <MenuItem value="office">Office & Business</MenuItem>
                     <MenuItem value="tools">Tools & Hardware</MenuItem>
                     <MenuItem value="jewelry">Jewelry & Accessories</MenuItem>
                     <MenuItem value="music">Music & Instruments</MenuItem>
                     <MenuItem value="travel">Travel & Luggage</MenuItem>
                   </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth disabled={!newProduct.category}>
                  <InputLabel>Subcategory</InputLabel>
                  <Select
                     value={newProduct.subcategory}
                     onChange={(e) => setNewProduct(prev => ({ ...prev, subcategory: e.target.value }))}
                     label="Subcategory"
                   >
                     {newProduct.category && categorySubcategoryMap[newProduct.category]?.map((subcategory) => (
                       <MenuItem key={subcategory} value={subcategory}>
                         {subcategory.charAt(0).toUpperCase() + subcategory.slice(1).replace('-', ' ')}
                       </MenuItem>
                     ))}
                   </Select>
                </FormControl>
              </Grid>
            </Grid>
            

            

            
            {/* Image Upload Section */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Product Images
              </Typography>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="master-image-upload"
                multiple
                type="file"
                onChange={handleImageUpload}
              />
              <label htmlFor="master-image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUpload />}
                  sx={{ mb: 2 }}
                >
                  Upload Images
                </Button>
              </label>
              
              {singleImageFiles.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {singleImageFiles.map((file, index) => (
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
                        <Close fontSize="small" />
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
            variant="contained"
            onClick={handleAddProduct}
            disabled={uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <Add />}
          >
            {uploading ? 'Adding...' : 'Add Master Product'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkUploadOpen} onClose={() => setBulkUploadOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Bulk Upload Master Products
            <IconButton onClick={() => setBulkUploadOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            {/* Instructions */}
            <Alert severity="info">
              <Typography variant="body2">
                Upload a CSV file with product data and optionally upload images. 
                The CSV should contain columns: name, category, subcategory, brand, status, image_filename.
                Image filenames in CSV should match the uploaded image files.
              </Typography>
            </Alert>

            {/* Download Template */}
            <Box>
              <Button
                variant="outlined"
                startIcon={<GetApp />}
                onClick={downloadCsvTemplate}
                sx={{ mb: 2 }}
              >
                Download CSV Template
              </Button>
            </Box>

            {/* CSV Upload */}
            <Box>
              <Typography variant="h6" gutterBottom>
                1. Upload CSV File
              </Typography>
              <input
                accept=".csv"
                style={{ display: 'none' }}
                id="csv-upload"
                type="file"
                onChange={handleCsvUpload}
              />
              <label htmlFor="csv-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<Upload />}
                  sx={{ mb: 2 }}
                >
                  Upload CSV File
                </Button>
              </label>
              {csvFile && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckCircle color="success" />
                  <Typography variant="body2">
                    {csvFile.name} ({csvData.length} products)
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Image Upload */}
            <Box>
              <Typography variant="h6" gutterBottom>
                2. Upload Product Images (Optional)
              </Typography>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="bulk-image-upload"
                multiple
                type="file"
                onChange={handleBulkImageUpload}
              />
              <label htmlFor="bulk-image-upload">
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckCircle color="success" />
                  <Typography variant="body2">
                    {imageFiles.length} images selected
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert severity="error">
                <Typography variant="subtitle2" gutterBottom>
                  Validation Errors:
                </Typography>
                <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                  {validationErrors.slice(0, 10).map((error, index) => (
                    <Typography key={index} component="li" variant="body2">
                      {error}
                    </Typography>
                  ))}
                  {validationErrors.length > 10 && (
                    <Typography variant="body2" color="text.secondary">
                      ... and {validationErrors.length - 10} more errors
                    </Typography>
                  )}
                </Box>
              </Alert>
            )}

            {/* CSV Preview */}
            {csvData.length > 0 && validationErrors.length === 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  3. Preview Data
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Subcategory</TableCell>
                        <TableCell>Brand</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Image</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {csvData.slice(0, 5).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.category}</TableCell>
                          <TableCell>{row.subcategory || '-'}</TableCell>
                          <TableCell>{row.brand || '-'}</TableCell>
                          <TableCell>{row.status || 'active'}</TableCell>
                          <TableCell>{row.image_filename || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {csvData.length > 5 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography variant="body2" color="text.secondary">
                              ... and {csvData.length - 5} more products
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Processing Progress */}
            {bulkProcessing && (
              <Box>
                <Typography variant="body2" gutterBottom>
                  Processing bulk upload...
                </Typography>
                <LinearProgress />
              </Box>
            )}

            {/* Results */}
            {bulkResults && (
              <Alert severity={bulkResults.success ? 'success' : 'error'}>
                {bulkResults.success ? (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Upload Completed Successfully!
                    </Typography>
                    <Typography variant="body2">
                      • {bulkResults.totalInserted} products added out of {bulkResults.totalProcessed} processed
                    </Typography>
                    {bulkResults.imageResults && (
                      <Typography variant="body2">
                        • {bulkResults.imageResults.totalUploaded} images uploaded successfully
                        {bulkResults.imageResults.totalFailed > 0 && (
                          <span>, {bulkResults.imageResults.totalFailed} failed</span>
                        )}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Upload Failed
                    </Typography>
                    <Typography variant="body2">
                      {bulkResults.error}
                    </Typography>
                  </Box>
                )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetBulkUpload}>Reset</Button>
          <Button onClick={() => setBulkUploadOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={processBulkUpload}
            disabled={!csvFile || csvData.length === 0 || validationErrors.length > 0 || bulkProcessing}
            startIcon={bulkProcessing ? <CircularProgress size={20} /> : <Upload />}
          >
            {bulkProcessing ? 'Processing...' : 'Process Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}