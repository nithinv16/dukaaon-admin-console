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
  Autocomplete,
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
  Receipt,
  ContentCopy,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';
import { processReceiptImage, UnifiedExtractedProduct as ExtractedProduct } from '@/lib/unifiedOCR';
import { Product } from '@/types';
import ExtractedProductEditor from '@/components/ExtractedProductEditor';
import ProductImageEditor from '@/components/ProductImageEditor';
import { useRouter } from 'next/navigation';
import { defaultCategorySubcategoryMap } from '@/lib/categoryUtils';

interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  outOfStock: number;
  lowStock: number;
}

export default function ProductsPage() {
  const router = useRouter();
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
  const [filterSeller, setFilterSeller] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editingProductForImage, setEditingProductForImage] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    subcategory: '',
    stock: '',
    unit: 'piece',
    seller_id: '',
    min_order_quantity: '1',
    images: [] as string[]
  });
  
  // Product name suggestions
  const [productSuggestions, setProductSuggestions] = useState<string[]>([]);
  
  // Categories and subcategories data as state
  const [categories, setCategories] = useState([
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
  
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<{ [key: string]: string[] }>({
    'Electronics': ['Smartphones', 'Laptops', 'Tablets', 'Accessories', 'Audio', 'Gaming'],
    'Clothing': ['Men\'s Wear', 'Women\'s Wear', 'Kids Wear', 'Shoes', 'Accessories'],
    'Food & Beverages': ['Fresh Produce', 'Packaged Foods', 'Beverages', 'Snacks', 'Dairy', 'Biscuit & Cookies'],
    'Home & Garden': ['Furniture', 'Decor', 'Kitchen', 'Garden Tools', 'Lighting'],
    'Health & Beauty': ['Skincare', 'Makeup', 'Hair Care', 'Health Supplements', 'Personal Care'],
    'Sports & Outdoors': ['Fitness Equipment', 'Outdoor Gear', 'Sports Apparel', 'Team Sports'],
    'Books & Media': ['Books', 'Movies', 'Music', 'Games', 'Educational'],
    'Toys & Games': ['Action Figures', 'Board Games', 'Educational Toys', 'Outdoor Toys'],
    'Automotive': ['Car Parts', 'Accessories', 'Tools', 'Maintenance'],
    'Office Supplies': ['Stationery', 'Electronics', 'Furniture', 'Organization']
  });
  
  const unitOptions = [
    'piece',
    'kg',
    'gram',
    'ml',
    'litre',
    'box',
    'carton',
    'pack',
    'dozen',
    'meter',
    'cm',
    'inch',
    'square meter',
    'cubic meter',
    'bottle',
    'can',
    'jar',
    'bag',
    'roll',
    'sheet'
  ];
  
  // Dialog states for adding new categories
  const [newCategoryDialog, setNewCategoryDialog] = useState(false);
  const [newSubcategoryDialog, setNewSubcategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
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
  
  // Receipt scanning states
  const [receiptProcessing, setReceiptProcessing] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([]);
  const [receiptScanDialogOpen, setReceiptScanDialogOpen] = useState(false);
  const [extractedProductEditorOpen, setExtractedProductEditorOpen] = useState(false);



  useEffect(() => {
    loadProducts();
    loadStats();
  }, [page, pageSize, searchTerm, filterCategory, filterStatus, filterSeller]);

  useEffect(() => {
    loadSellers();
    loadProductSuggestions();
  }, []);

  // Debug log for extracted products
  useEffect(() => {
    console.log('=== EXTRACTED PRODUCTS STATE CHANGED ===');
    console.log('extractedProducts:', extractedProducts);
    console.log('extractedProducts length:', extractedProducts.length);
    if (extractedProducts.length > 0) {
      console.log('First product:', extractedProducts[0]);
      console.log('All products:', extractedProducts);
    }
  }, [extractedProducts]);

  // Test function to add dummy products for debugging
  const addTestProducts = () => {
    const testProducts: ExtractedProduct[] = [
      {
        name: 'Test Product 1',
        price: 50.25,
        quantity: 2,
        unit: 'pcs',
        confidence: 0.9
      },
      {
        name: 'Test Product 2',
        price: 75.00,
        quantity: 1,
        unit: 'kg',
        confidence: 0.8
      }
    ];
    setExtractedProducts(testProducts);
    console.log('Added test products:', testProducts);
  };
  
  // Load product name suggestions from existing products
  const loadProductSuggestions = async () => {
    try {
      // Temporary fallback since getProducts doesn't exist in adminQueries
      // TODO: Implement proper getProducts API endpoint
      const result = { products: [] as Product[] };
      const suggestions = result.products?.map((p: any) => p.name) || [];
      setProductSuggestions(Array.from(new Set(suggestions))); // Remove duplicates
    } catch (error) {
      console.error('Error loading product suggestions:', error);
    }
  };
  
  // Handle adding new category
  const handleAddNewCategory = () => {
    if (newCategoryName.trim()) {
      const trimmedName = newCategoryName.trim();
      setCategories(prev => [...prev, trimmedName]);
      setNewProduct(prev => ({ ...prev, category: trimmedName }));
      setNewCategoryName('');
      setNewCategoryDialog(false);
      toast.success('New category added!');
    }
  };
  
  // Handle adding new subcategory
  const handleAddNewSubcategory = () => {
    if (newSubcategoryName.trim() && newProduct.category) {
      const trimmedName = newSubcategoryName.trim();
      setSubcategoriesByCategory(prev => ({
        ...prev,
        [newProduct.category]: [...(prev[newProduct.category] || []), trimmedName]
      }));
      setNewProduct(prev => ({ ...prev, subcategory: trimmedName }));
      setNewSubcategoryName('');
      setNewSubcategoryDialog(false);
      toast.success('New subcategory added!');
    }
  };

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
        stock_quantity: editingProduct.stock_available,
        status: editingProduct.status,
        is_active: editingProduct.status === 'active'
      });
      
      setEditDialogOpen(false);
      setEditingProduct(null);
      loadProducts();
      loadStats();
      toast.success('Product updated successfully!');
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    } finally {
      setUploading(false);
    }
  };

  const handleOpenImageEditor = (product: Product) => {
    setEditingProductForImage(product);
    setImageEditorOpen(true);
  };

  const handleCloseImageEditor = () => {
    setImageEditorOpen(false);
    setEditingProductForImage(null);
  };

  const handleImageUpdate = (newImageUrl: string) => {
    if (editingProductForImage) {
      // Update the product in the local state
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product.id === editingProductForImage.id 
            ? { ...product, image_url: newImageUrl, images: [newImageUrl] }
            : product
        )
      );
      
      // Also update editingProduct if it's the same product
      if (editingProduct && editingProduct.id === editingProductForImage.id) {
        setEditingProduct(prev => prev ? { ...prev, image_url: newImageUrl, images: [newImageUrl] } : null);
      }
      
      toast.success('Product image updated successfully!');
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
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/admin/upload-product-image', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.url) {
            imageUrls.push(result.url);
          }
        }
      }

      // Add product with image URLs
      const productData = {
        name: newProduct.name,
        description: newProduct.description,
        price: parseFloat(newProduct.price) || 0,
        category: newProduct.category,
        subcategory: newProduct.subcategory,
        seller_id: newProduct.seller_id,
        stock_quantity: parseInt(newProduct.stock) || 0,
        unit_of_measure: newProduct.unit,
        min_order_quantity: parseInt(newProduct.min_order_quantity) || 1,
        images: imageUrls,
        status: 'available'
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
        min_order_quantity: '1',
        images: []
      });
      setImageFiles([]);
      setAddDialogOpen(false);
      
      // Refresh products list
      loadProducts();
      loadStats();
      
      toast.success('Product added successfully!');
    } catch (error: any) {
      console.error('Error adding product:', error);
      toast.error(error.message || 'Failed to add product. Please try again.');
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
  
  // Receipt scanning handlers
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
    // Don't clear extracted products immediately - wait for new results
    // setExtractedProducts([]);
    
    try {
      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const result = await processReceiptImage(buffer);
      
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
          setExtractedProducts(result.data.products);
          setReceiptScanDialogOpen(false);
          setExtractedProductEditorOpen(true);
          toast.success(`Extracted ${result.data.products.length} products from receipt!`);
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
  
  const fillProductFromExtracted = (extractedProduct: ExtractedProduct) => {
    setNewProduct({
      name: extractedProduct.name,
      price: extractedProduct.price.toString(),
      stock: extractedProduct.quantity?.toString() || '',
      unit: extractedProduct.unit || 'piece',
      description: 'Product extracted from receipt',
      category: '',
      subcategory: '',
      seller_id: '',
      min_order_quantity: '1',
      images: []
    });
    
    // Close receipt dialog and open add product dialog
    setReceiptScanDialogOpen(false);
    setAddDialogOpen(true);
    
    toast.success('Product details filled from receipt!');
  };

  const handleExtractedProductsConfirm = async (editedProducts: any[]) => {
    try {
      const addPromises = editedProducts.map(async (product) => {
        const productData = {
          name: product.name,
          description: product.description || 'Product extracted from receipt',
          price: product.price,
          category: product.category,
          subcategory: product.subcategory,
          seller_id: product.seller_id,
          stock_quantity: product.quantity || 0,
          unit_of_measure: product.unit || 'piece',
          min_order_quantity: product.min_order_quantity || 1,
          images: product.imageUrl ? [product.imageUrl] : [],
          status: 'available'
        };
        
        return adminQueries.addProduct(productData);
      });
      
      await Promise.all(addPromises);
      
      toast.success(`Successfully added ${editedProducts.length} products to inventory!`);
      setExtractedProductEditorOpen(false);
      setExtractedProducts([]);
      loadProducts(); // Refresh the products list
      loadStats();
    } catch (error: any) {
      console.error('Error adding extracted products:', error);
      toast.error(error.message || 'Failed to add some products. Please try again.');
      throw error;
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const result = await adminQueries.getProducts({
        page: page + 1,
        limit: pageSize,
        search: searchTerm,
        category: filterCategory === 'all' ? undefined : filterCategory,
        status: filterStatus === 'all' ? undefined : filterStatus,
        seller_id: filterSeller === 'all' ? undefined : filterSeller,
      });
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
      const result = await adminQueries.getProducts({
        page: 1,
        limit: 10000, // Get all for stats
      });
      const allProducts = result.products || [];
      
      const totalProducts = allProducts.length;
      const activeProducts = allProducts.filter(p => p.is_active && p.status !== 'out_of_stock').length;
      const outOfStock = allProducts.filter(p => (p.stock_available || 0) === 0).length;
      const lowStock = allProducts.filter(p => {
        const stock = p.stock_available || 0;
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
      const result = await adminQueries.getAllUsers();
      const allUsers = result.data || [];
      
      // Filter to get only sellers (wholesalers and manufacturers)
      const sellersOnly = allUsers.filter((user: any) => 
        user.role === 'wholesaler' || user.role === 'manufacturer'
      );
      
      console.log('Loaded sellers:', sellersOnly);
      setSellers(sellersOnly);
    } catch (error) {
      console.error('Error loading sellers:', error);
    }
  };

  const loadMasterProducts = async (resetPage = false) => {
    try {
      setMasterProductLoading(true);
      
      const currentPage = resetPage ? 1 : masterProductsPage;
      if (resetPage) {
        setMasterProductsPage(1);
      }
      
      const result = await adminQueries.getMasterProducts({
        page: currentPage,
        limit: masterProductsPageSize,
        search: masterProductsSearchTerm || undefined,
        category: masterProductsFilterCategory === 'all' ? undefined : masterProductsFilterCategory,
      });
      
      setMasterProducts(result?.products || []);
      setMasterProductsTotalCount(result?.total || 0);
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
      
      await adminQueries.addMasterProductToSeller({
        master_product_id: selectedMasterProduct.id,
        seller_id: sellerData.seller_id,
        price: parseFloat(sellerData.price) || 0,
        stock_available: parseInt(sellerData.stock_available) || 0,
        min_order_quantity: parseInt(sellerData.min_order_quantity) || 1,
        unit: sellerData.unit,
        description: sellerData.description
      });
      
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
      loadStats();
    } catch (error: any) {
      console.error('Error adding master product to seller:', error);
      toast.error(error.message || 'Failed to add product to seller inventory');
    } finally {
      setUploading(false);
    }
  };

  const handleMasterProductDialogOpen = () => {
    setMasterProductsDialogOpen(true);
    loadMasterProducts();
  };

  // Helper functions for master products pagination
  const handleMasterProductsSearch = (searchTerm: string) => {
    setMasterProductsSearchTerm(searchTerm);
  };

  const handleMasterProductsCategoryFilter = (category: string) => {
    setMasterProductsFilterCategory(category);
  };

  const handleMasterProductsPageChange = (newPage: number) => {
    setMasterProductsPage(newPage);
  };

  const totalMasterProductsPages = Math.ceil(masterProductsTotalCount / masterProductsPageSize);

  // Effect to reload master products when search/filter/page changes
  useEffect(() => {
    if (masterProductsDialogOpen) {
      const timeoutId = setTimeout(() => {
        loadMasterProducts();
      }, 300); // Debounce search
      
      return () => clearTimeout(timeoutId);
    }
  }, [masterProductsSearchTerm, masterProductsFilterCategory, masterProductsPage, masterProductsDialogOpen]);

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
      minWidth: 60,
      flex: 0,
      hideable: false,
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
      minWidth: 200,
      flex: 1,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" fontWeight="medium" noWrap>
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {params.row.category} • {params.row.subcategory}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'price',
      headerName: 'Price',
      width: 120,
      minWidth: 100,
      flex: 0,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight="medium">
          ₹{params.value?.toLocaleString() || '0'}
        </Typography>
      ),
    },
    {
      field: 'stock_available',
      headerName: 'Stock',
      width: 100,
      minWidth: 80,
      flex: 0,
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
      minWidth: 100,
      flex: 0,
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
      minWidth: 120,
      flex: 0,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" noWrap>
          {params.value || 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'created_at',
      headerName: 'Added',
      width: 120,
      minWidth: 100,
      flex: 0,
      hideable: true,
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
      minWidth: 100,
      flex: 0,
      hideable: false,
      sortable: false,
      filterable: false,
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
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
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
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
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
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
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
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Seller</InputLabel>
                <Select
                  value={filterSeller}
                  onChange={(e) => setFilterSeller(e.target.value)}
                  label="Seller"
                >
                  <MenuItem value="all">All Sellers</MenuItem>
                  {sellers.map((seller) => (
                    <MenuItem key={seller.id} value={seller.id}>
                      {seller.business_name || seller.full_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Add />}
                onClick={() => setAddDialogOpen(true)}
                size="small"
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              >
                Add Product
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PlaylistAdd />}
                onClick={() => router.push('/products/add-from-master')}
                size="small"
                sx={{ 
                  whiteSpace: 'nowrap',
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Quick Add from Master
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Inventory />}
                onClick={() => window.location.href = '/products/master'}
                size="small"
                sx={{ 
                  whiteSpace: 'nowrap',
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Master Products
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Receipt />}
                onClick={() => setReceiptScanDialogOpen(true)}
                size="small"
                sx={{ 
                  whiteSpace: 'nowrap',
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Scan Receipt
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ContentCopy />}
                onClick={() => router.push('/products/clone-inventory')}
                size="small"
                sx={{ 
                  whiteSpace: 'nowrap',
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Clone Inventory
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
            pageSizeOptions={[10, 25, 50, 100]}
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
            initialState={{
              columns: {
                columnVisibilityModel: {
                  seller_name: false, // Hide on mobile by default
                  created_at: false,  // Hide on mobile by default
                },
              },
            }}
            sx={{ 
              height: { xs: 400, sm: 500, md: 600 },
              '& .MuiDataGrid-main': {
                '& .MuiDataGrid-columnHeaders': {
                  borderBottom: 1,
                  borderColor: 'divider',
                },
                '& .MuiDataGrid-cell': {
                  borderBottom: 1,
                  borderColor: 'divider',
                },
              },
              '& .MuiDataGrid-toolbarContainer': {
                padding: { xs: 1, sm: 2 },
                '& .MuiButton-root': {
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                },
              },
            }}
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
                  image={selectedProduct.image_url || '/placeholder-product.png'}
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
                    Stock: {selectedProduct.stock_available} units
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
            <Autocomplete
              freeSolo
              options={productSuggestions}
              value={newProduct.name}
              onInputChange={(event, newInputValue) => {
                setNewProduct(prev => ({ ...prev, name: newInputValue }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Product Name"
                  fullWidth
                  required
                  helperText="Start typing to see suggestions from existing products"
                />
              )}
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
                placeholder="Enter price"
                inputProps={{ min: 0, step: 0.01 }}
              />
              
              <TextField
                label="Stock"
                type="number"
                value={newProduct.stock}
                onChange={(e) => setNewProduct(prev => ({ ...prev, stock: e.target.value }))}
                fullWidth
                placeholder="Enter stock quantity"
                inputProps={{ min: 0 }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Minimum Order Quantity"
                type="number"
                value={newProduct.min_order_quantity}
                onChange={(e) => setNewProduct(prev => ({ ...prev, min_order_quantity: e.target.value }))}
                fullWidth
                inputProps={{ min: 1 }}
                helperText="Minimum quantity that customers must order"
              />
              
              <FormControl fullWidth>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={newProduct.unit}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, unit: e.target.value }))}
                  label="Unit"
                >
                  {unitOptions.map((unit) => (
                    <MenuItem key={unit} value={unit}>
                      {unit.charAt(0).toUpperCase() + unit.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={newProduct.category}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'add_new') {
                      setNewCategoryDialog(true);
                    } else {
                      setNewProduct(prev => ({ ...prev, category: value, subcategory: '' }));
                    }
                  }}
                  label="Category"
                >
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                  <MenuItem value="add_new" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                    + Add New Category
                  </MenuItem>
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>Subcategory</InputLabel>
                <Select
                  value={newProduct.subcategory}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'add_new') {
                      setNewSubcategoryDialog(true);
                    } else {
                      setNewProduct(prev => ({ ...prev, subcategory: value }));
                    }
                  }}
                  label="Subcategory"
                  disabled={!newProduct.category}
                >
                  {newProduct.category && subcategoriesByCategory[newProduct.category]?.map((subcategory) => (
                    <MenuItem key={subcategory} value={subcategory}>
                      {subcategory}
                    </MenuItem>
                  ))}
                  {newProduct.category && (
                    <MenuItem value="add_new" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                      + Add New Subcategory
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
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
                  value={editingProduct.stock_available}
                  onChange={(e) => setEditingProduct(prev => prev ? ({ ...prev, stock_available: parseInt(e.target.value) || 0 }) : null)}
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
              
              {/* Product Image Section */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                <Typography variant="subtitle1">Product Image:</Typography>
                {editingProduct.image_url ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <img 
                      src={editingProduct.image_url} 
                      alt={editingProduct.name}
                      style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleOpenImageEditor(editingProduct)}
                      startIcon={<Edit />}
                    >
                      Edit Image
                    </Button>
                  </Box>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleOpenImageEditor(editingProduct)}
                    startIcon={<Add />}
                  >
                    Add Image
                  </Button>
                )}
              </Box>
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

      {/* Product Image Editor Dialog */}
      {imageEditorOpen && editingProductForImage && (
        <ProductImageEditor
          open={imageEditorOpen}
          onClose={handleCloseImageEditor}
          currentImage={editingProductForImage.image_url || ''}
          productName={editingProductForImage.name}
          productId={editingProductForImage.id}
          onImageUpdate={handleImageUpdate}
        />
      )}

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

      {/* Add New Category Dialog */}
      <Dialog open={newCategoryDialog} onClose={() => setNewCategoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Category</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Category Name"
            fullWidth
            variant="outlined"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewCategoryDialog(false)}>Cancel</Button>
          <Button onClick={handleAddNewCategory} variant="contained" disabled={!newCategoryName.trim()}>
            Add Category
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Subcategory Dialog */}
      <Dialog open={newSubcategoryDialog} onClose={() => setNewSubcategoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Subcategory</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Adding subcategory to: <strong>{newProduct.category}</strong>
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Subcategory Name"
            fullWidth
            variant="outlined"
            value={newSubcategoryName}
            onChange={(e) => setNewSubcategoryName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewSubcategoryDialog(false)}>Cancel</Button>
          <Button onClick={handleAddNewSubcategory} variant="contained" disabled={!newSubcategoryName.trim()}>
            Add Subcategory
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Scanning Dialog */}
      <Dialog
        open={receiptScanDialogOpen}
        onClose={() => setReceiptScanDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Receipt color="primary" />
          Scan Receipt
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Upload a receipt image to automatically extract product details and add them to your inventory.
          </Typography>
          
          {/* Debug Test Button */}
          <Button 
            variant="outlined" 
            color="secondary" 
            onClick={addTestProducts}
            sx={{ mb: 2, mr: 2 }}
          >
            Add Test Products (Debug)
          </Button>
          
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
              sx={{ mb: 3, width: '100%' }}
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
              <img
                src={receiptImage}
                alt="Receipt preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  objectFit: 'contain',
                  borderRadius: 8,
                  border: '1px solid #ddd'
                }}
              />
            </Box>
          )}
          
          {extractedProducts.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Extracted Products ({extractedProducts.length})
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                 Review the extracted products below. Click on any product to add it to your inventory.
               </Typography>
               

              <Stack spacing={2} sx={{ maxHeight: 400, overflow: 'auto' }}>
                 {extractedProducts.map((product, index) => {
                   console.log(`Product ${index}:`, product);
                   console.log(`Product ${index} properties:`, {
                      name: product.name,
                      price: product.price,
                      quantity: product.quantity,
                      unit: product.unit,
                     confidence: product.confidence
                   });
                   return (
                   <Card 
                     key={index} 
                     variant="outlined"
                     sx={{ 
                       cursor: 'pointer',
                       '&:hover': { 
                         bgcolor: '#f5f5f5',
                         boxShadow: 2
                       }
                     }}
                     onClick={() => fillProductFromExtracted(product)}
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
                       <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                         Click to add this product
                       </Typography>
                     </CardContent>
                   </Card>
                   );
                 })}
               </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
           <Button onClick={() => setReceiptScanDialogOpen(false)}>Close</Button>
         </DialogActions>
      </Dialog>

      {/* Extracted Product Editor */}
      <ExtractedProductEditor
        open={extractedProductEditorOpen}
        onClose={() => setExtractedProductEditorOpen(false)}
        extractedProducts={extractedProducts}
        onConfirm={handleExtractedProductsConfirm}
        sellers={sellers}
        categories={categories}
        subcategories={subcategoriesByCategory}
      />
    </Box>
  );
}