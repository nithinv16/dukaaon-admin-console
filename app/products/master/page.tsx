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
import { 
  defaultCategorySubcategoryMap, 
  mergeCategoriesFromCsv,
  type CategorySubcategoryMap 
} from '@/lib/categoryUtils';

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
  const [bulkResults, setBulkResults] = useState<{
    success: boolean;
    totalProcessed: number;
    totalInserted: number;
    duplicatesSkipped?: number;
    duplicateDetails?: Array<{ product: any; reason: string; existing: any }>;
    imageResults?: {
      totalUploaded: number;
      totalFailed: number;
    } | null;
    error?: string;
  } | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  // Category-Subcategory mapping - use the centralized utility
  const [categorySubcategoryMap, setCategorySubcategoryMap] = useState<CategorySubcategoryMap>(defaultCategorySubcategoryMap);

  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 0,
    category: '',
    subcategory: '',
    brand: '',
    image_url: ''
  });
  const [singleImageFiles, setSingleImageFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  
  // Image-only upload states
  const [imageOnlyUploadOpen, setImageOnlyUploadOpen] = useState(false);
  const [imageOnlyFiles, setImageOnlyFiles] = useState<File[]>([]);
  const [imageOnlyProcessing, setImageOnlyProcessing] = useState(false);
  const [imageOnlyResults, setImageOnlyResults] = useState<any>(null);

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
        description: newProduct.description,
        price: newProduct.price,
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
        description: '',
        price: 0,
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
    
    // Use the utility function to merge categories from CSV
     const { updatedMap, newCategories, newSubcategories } = mergeCategoriesFromCsv(categorySubcategoryMap, data);
    
    // Update the local state with the merged categories
    setCategorySubcategoryMap(updatedMap);
    
    // Validate data with updated category map
    data.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errors.push(`Row ${index + 1}: Missing required field '${field}'`);
        }
      });
      
      // Validate status if provided
      if (row.status && !['active', 'inactive', 'draft'].includes(row.status.toLowerCase())) {
        errors.push(`Row ${index + 1}: Invalid status '${row.status}'. Must be 'active', 'inactive', or 'draft'`);
      }
    });
    
    // Show info about new categories/subcategories added
     if (newCategories.length > 0 || newSubcategories > 0) {
       const message = `Auto-detected: ${newCategories.length} new categories, ${newSubcategories} new subcategories`;
       toast(message, { icon: 'ℹ️' });
     }
    
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
      
      // Process CSV data and validate for duplicates
      const validatedProducts = [];
      const duplicateProducts = [];
      
      for (const row of csvData) {
        const productData = {
          name: row.name.trim(),
          category: row.category.toLowerCase().trim(),
          subcategory: row.subcategory ? row.subcategory.toLowerCase().trim() : undefined,
          brand: row.brand ? row.brand.trim() : undefined,
          image_filename: row.image_filename,
          status: (row.status ? row.status.toLowerCase().trim() : 'active') as 'active' | 'inactive' | 'draft'
        };
        
        const duplicateCheck = await checkForDuplicates(productData);
        
        if (duplicateCheck.isDuplicate) {
          duplicateProducts.push({
            product: productData,
            reason: duplicateCheck.reason || 'Duplicate product detected',
            existing: duplicateCheck.existingProduct || null
          });
        } else {
          const imageUrl = row.image_filename ? imageUrlMap[row.image_filename] : undefined;
          validatedProducts.push({
            name: productData.name,
            category: productData.category,
            subcategory: productData.subcategory,
            brand: productData.brand,
            image_url: imageUrl,
            status: productData.status
          });
        }
      }
      
      // Insert only non-duplicate products
      let result = { count: 0 };
      if (validatedProducts.length > 0) {
        result = await adminQueries.addMasterProductsBulk(validatedProducts);
      }
      
      setBulkResults({
        success: true,
        totalProcessed: csvData.length,
        totalInserted: result.count,
        duplicatesSkipped: duplicateProducts.length,
        duplicateDetails: duplicateProducts,
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

  // Image-only upload functions
  const handleImageOnlyUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setImageOnlyFiles(files);
  };

  const processImageOnlyUpload = async () => {
    if (imageOnlyFiles.length === 0) {
      toast.error('Please select images to upload');
      return;
    }

    setImageOnlyProcessing(true);
    try {
      // Upload images to master-products bucket and match to products
      const results = await adminQueries.uploadImagesToMasterProducts(imageOnlyFiles);
      
      setImageOnlyResults({
        success: true,
        totalUploaded: results.totalUploaded,
        totalFailed: results.totalFailed,
        totalMatched: results.totalMatched,
        totalUnmatched: results.totalUnmatched
      });
      
      toast.success(`Images processed! ${results.totalMatched} matched, ${results.totalUnmatched} unmatched`);
      
      // Refresh products list
      loadMasterProducts();
      
    } catch (error: unknown) {
      console.error('Image upload error:', error);
      setImageOnlyResults({
        success: false,
        error: (error as Error)?.message || 'Unknown error occurred'
      });
      toast.error('Failed to process image upload');
    } finally {
      setImageOnlyProcessing(false);
    }
  };

  const resetImageOnlyUpload = () => {
    setImageOnlyFiles([]);
    setImageOnlyResults(null);
    setImageOnlyProcessing(false);
  };

  // Duplicate validation function
  const checkForDuplicates = async (productData: any) => {
    try {
      const duplicateCheck = await adminQueries.checkMasterProductDuplicates(productData);
      return duplicateCheck;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return { isDuplicate: false, reason: null, existingProduct: null };
    }
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
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<CloudUpload />}
                  onClick={() => setImageOnlyUploadOpen(true)}
                >
                  Upload Images
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
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                  fullWidth
                  required
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Price"
                  type="number"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  fullWidth
                  required
                  inputProps={{ min: 0, step: 0.01 }}
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
                     {Object.keys(categorySubcategoryMap).map((category) => (
                       <MenuItem key={category} value={category}>
                         {category.charAt(0).toUpperCase() + category.slice(1).replace(/[-_]/g, ' ')}
                       </MenuItem>
                     ))}
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
                    {bulkResults.duplicatesSkipped && bulkResults.duplicatesSkipped > 0 && (
                      <Typography variant="body2">
                        • {bulkResults.duplicatesSkipped} duplicates skipped
                      </Typography>
                    )}
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

      {/* Image-Only Upload Dialog */}
      <Dialog open={imageOnlyUploadOpen} onClose={() => setImageOnlyUploadOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Upload Images to Existing Products
            <IconButton onClick={() => setImageOnlyUploadOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <Alert severity="info">
               <Typography variant="body2">
                 Upload images that will be automatically matched to existing products by filename.
                 Image filenames should contain or match the product name for automatic matching.
                 <br /><br />
                 <strong>Note:</strong> Images will replace existing files in the storage bucket, but product image URLs 
                 in the database will only be updated for products that don't already have an image URL set.
               </Typography>
             </Alert>

            <Box>
              <Typography variant="h6" gutterBottom>
                Select Images
              </Typography>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="image-only-upload"
                multiple
                type="file"
                onChange={handleImageOnlyUpload}
              />
              <label htmlFor="image-only-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUpload />}
                  sx={{ mb: 2 }}
                >
                  Select Images
                </Button>
              </label>
              {imageOnlyFiles.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckCircle color="success" />
                  <Typography variant="body2">
                    {imageOnlyFiles.length} images selected
                  </Typography>
                </Box>
              )}
            </Box>

            {imageOnlyProcessing && (
              <Box>
                <Typography variant="body2" gutterBottom>
                  Processing image upload...
                </Typography>
                <LinearProgress />
              </Box>
            )}

            {imageOnlyResults && (
               <Alert severity={imageOnlyResults.success ? 'success' : 'error'}>
                 {imageOnlyResults.success ? (
                   <Box>
                     <Typography variant="subtitle2" gutterBottom>
                       Image Upload Completed!
                     </Typography>
                     <Typography variant="body2">
                       • {imageOnlyResults.totalUploaded} images uploaded to bucket
                     </Typography>
                     <Typography variant="body2">
                       • {imageOnlyResults.totalMatched} images matched to products
                     </Typography>
                     <Typography variant="body2">
                       • {imageOnlyResults.totalUnmatched} images could not be matched
                     </Typography>
                     {imageOnlyResults.totalFailed > 0 && (
                       <Typography variant="body2">
                         • {imageOnlyResults.totalFailed} images failed to upload
                       </Typography>
                     )}
                     <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}>
                       Note: Images replace existing files in storage, but product image URLs remain unchanged if already set.
                     </Typography>
                   </Box>
                 ) : (
                   <Box>
                     <Typography variant="subtitle2" gutterBottom>
                       Upload Failed
                     </Typography>
                     <Typography variant="body2">
                       {imageOnlyResults.error}
                     </Typography>
                   </Box>
                 )}
               </Alert>
             )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetImageOnlyUpload}>Reset</Button>
          <Button onClick={() => setImageOnlyUploadOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={processImageOnlyUpload}
            disabled={imageOnlyFiles.length === 0 || imageOnlyProcessing}
            startIcon={imageOnlyProcessing ? <CircularProgress size={20} /> : <Upload />}
          >
            {imageOnlyProcessing ? 'Processing...' : 'Upload Images'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}