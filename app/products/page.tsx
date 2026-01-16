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
import { Product } from '@/types';
import { VariantService } from '@/lib/services/products/VariantService';
import ProductImageEditor from '@/components/ProductImageEditor';
import CategorySelector, { CategorySelectorValue } from '@/components/CategorySelector';
import { useRouter } from 'next/navigation';
import ReceiptScanner from '@/components/ReceiptScanner';
import ReceiptExtractionPreview from '@/components/ReceiptExtractionPreview';
import ReceiptScannerV2 from '@/components/ReceiptScannerV2';
import { ScanReceiptResponse, ExtractedReceiptProduct, ReceiptMetadata } from '@/lib/receiptTypes';
import { ExtractedProductV2 } from '@/lib/receiptExtractionV2';
import VariantManager, { VariantManagerProps } from '@/components/VariantManager';
import { CreateVariantInput } from '@/lib/services/products/VariantService';


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
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [stats, setStats] = useState<ProductStats>({
    totalProducts: 0,
    activeProducts: 0,
    outOfStock: 0,
    lowStock: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState({
    totalProducts: true,
    activeProducts: true,
    outOfStock: true,
    lowStock: true,
  });
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
  const [productVariants, setProductVariants] = useState<CreateVariantInput[]>([]);

  // Product name suggestions
  const [productSuggestions, setProductSuggestions] = useState<string[]>([]);

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


  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalProducts, setTotalProducts] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const [quickAddVariants, setQuickAddVariants] = useState<CreateVariantInput[]>([]);


  // Receipt scanning 2.0 states (using full receipt scanning system)
  const [receiptScanResult, setReceiptScanResult] = useState<ScanReceiptResponse | null>(null);
  const [receiptExtractionPreviewOpen, setReceiptExtractionPreviewOpen] = useState(false);

  // Scan Receipts 2.0 states (NEW - enhanced AI-powered extraction)
  const [receiptScanV2DialogOpen, setReceiptScanV2DialogOpen] = useState(false);
  const [receiptScanSellerDialogOpen, setReceiptScanSellerDialogOpen] = useState(false);
  const [receiptScanSelectedSeller, setReceiptScanSelectedSeller] = useState<string>('');



  useEffect(() => {
    loadProducts();
    loadStats();

    // Check if products were added (flag set by extracted page)
    const productsAdded = sessionStorage.getItem('productsAdded');
    if (productsAdded === 'true') {
      // Refresh stats and products to show updated counts
      loadStats();
      loadProducts();
      sessionStorage.removeItem('productsAdded');
    }
  }, [page, pageSize, searchTerm, filterCategory, filterStatus, filterSeller]);

  // Also refresh when page becomes visible (e.g., after returning from extracted page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if products were added (flag set by extracted page)
        const productsAdded = sessionStorage.getItem('productsAdded');
        if (productsAdded === 'true') {
          loadStats();
          loadProducts();
          sessionStorage.removeItem('productsAdded');
        }
      }
    };

    // Also check on focus (when user switches back to tab)
    const handleFocus = () => {
      const productsAdded = sessionStorage.getItem('productsAdded');
      if (productsAdded === 'true') {
        loadStats();
        loadProducts();
        sessionStorage.removeItem('productsAdded');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Define loadSellers before useEffect hooks that use it
  const loadSellers = useCallback(async () => {
    try {
      setLoadingSellers(true);
      const sellers = await adminQueries.getSellersWithDetails();
      console.log('Loaded sellers in products page:', sellers);
      console.log('Sellers count:', sellers?.length || 0);
      console.log('Sellers sample:', sellers?.[0]);

      if (sellers && Array.isArray(sellers)) {
        // Only filter out sellers without an id - don't require business_name
        const validSellers = sellers.filter(seller => {
          if (!seller || !seller.id) {
            console.warn('Invalid seller (no id):', seller);
            return false;
          }
          // Ensure business_name is set - if not, log a warning but don't filter out
          if (!seller.business_name) {
            console.warn('Seller missing business_name:', {
              id: seller.id,
              display_name: seller.display_name,
              phone_number: seller.phone_number,
              fullSeller: seller
            });
          }
          return true;
        });

        console.log('Loaded sellers - Total:', sellers.length, 'Valid:', validSellers.length);
        console.log('Sellers with business_name:', validSellers.filter(s => s.business_name).length);
        console.log('All sellers:', validSellers.map(s => ({
          id: s.id,
          business_name: s.business_name,
          display_name: s.display_name,
          phone_number: s.phone_number
        })));

        setSellers(validSellers);
        if (validSellers.length === 0) {
          console.error('No sellers found after filtering');
          toast.error('No sellers available. Please check if sellers exist in the database.');
        } else {
          console.log('Sellers set in state:', validSellers.length);
        }
      } else {
        console.error('Sellers data is not an array:', sellers);
        setSellers([]);
        toast.error('Invalid sellers data received from server');
      }
    } catch (error) {
      console.error('Error loading sellers:', error);
      setSellers([]);
      toast.error('Failed to load sellers');
    } finally {
      setLoadingSellers(false);
    }
  }, []);

  useEffect(() => {
    loadSellers();
    loadProductSuggestions();
  }, [loadSellers]);

  // Always reload sellers when Quick Add dialog opens to ensure fresh data
  useEffect(() => {
    if (masterProductsDialogOpen) {
      console.log('Quick Add dialog opened - Current state:', {
        sellersCount: sellers.length,
        loadingSellers: loadingSellers
      });
      // Always reload sellers when dialog opens to ensure fresh data
      console.log('Reloading sellers for Quick Add dialog...');
      loadSellers();
    }
  }, [masterProductsDialogOpen, loadSellers]);

  // Always reload sellers when Add Product dialog opens to ensure fresh data
  useEffect(() => {
    if (addDialogOpen) {
      console.log('Add Product dialog opened - Current state:', {
        sellersCount: sellers.length,
        loadingSellers: loadingSellers
      });
      // Always reload sellers when dialog opens to ensure fresh data
      console.log('Reloading sellers for Add Product dialog...');
      loadSellers();
    }
  }, [addDialogOpen, loadSellers]);

  // Ensure sellers are loaded when a product is selected in Quick Add
  useEffect(() => {
    if (selectedMasterProduct && masterProductsDialogOpen) {
      console.log('Product selected in Quick Add, checking sellers:', {
        productId: selectedMasterProduct.id,
        productName: selectedMasterProduct.name,
        sellersCount: sellers.length,
        loadingSellers: loadingSellers,
        sellers: sellers.map(s => ({
          id: s.id,
          name: s.business_name || s.display_name || s.phone_number
        }))
      });

      // If no sellers are loaded, reload them
      if (sellers.length === 0 && !loadingSellers) {
        console.log('No sellers found when product selected, reloading sellers...');
        loadSellers();
      }
    }
  }, [selectedMasterProduct, masterProductsDialogOpen, sellers.length, loadingSellers, loadSellers]);

  // Debug: Log whenever sellers state changes
  useEffect(() => {
    console.log('Sellers state changed:', {
      count: sellers.length,
      sellers: sellers.map(s => ({
        id: s.id,
        business_name: s.business_name,
        display_name: s.display_name
      })),
      loading: loadingSellers
    });
  }, [sellers, loadingSellers]);

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

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setEditDialogOpen(true);
  };

  const handleDeleteProducts = async () => {
    if (selectedProducts.length === 0) return;

    try {
      setDeleting(true);

      // Delete products via API
      const response = await fetch(`/api/admin/products?ids=${selectedProducts.join(',')}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete products');
      }

      toast.success(`Successfully deleted ${selectedProducts.length} product(s)`);
      setSelectedProducts([]);
      setDeleteDialogOpen(false);
      loadProducts();
      loadStats();
    } catch (error: any) {
      console.error('Error deleting products:', error);
      toast.error(error.message || 'Failed to delete products');
    } finally {
      setDeleting(false);
    }
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
        stock_available: editingProduct.stock_available,
        status: editingProduct.status || 'available'
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
      // Check for duplicate product
      const duplicateCheck = await fetch('/api/admin/products/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProduct.name.trim(),
          seller_id: newProduct.seller_id,
        }),
      });

      if (duplicateCheck.ok) {
        const duplicateResult = await duplicateCheck.json();
        if (duplicateResult.isDuplicate) {
          const confirmMessage = `${duplicateResult.reason}\n\nDo you want to add it anyway?`;
          if (!window.confirm(confirmMessage)) {
            setUploading(false);
            return;
          }
        }
      }

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

      // Add product with image URLs and tracking
      const adminSession = localStorage.getItem('admin_session');
      const sessionId = localStorage.getItem('tracking_session_id');
      const admin = adminSession ? JSON.parse(adminSession) : null;

      const productData = {
        name: newProduct.name,
        description: newProduct.description,
        price: parseFloat(newProduct.price) || 0,
        category: newProduct.category,
        subcategory: newProduct.subcategory,
        seller_id: newProduct.seller_id,
        stock_available: parseInt(newProduct.stock) || 0,
        unit: newProduct.unit,
        min_order_quantity: parseInt(newProduct.min_order_quantity) || 1,
        images: imageUrls,
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
          // Don't fail the product creation if variants fail
          toast.error('Product created but variants failed to save. You can add them later.');
        }
      }

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
      setProductVariants([]);
      setImageFiles([]);
      setAddDialogOpen(false);

      // Refresh products list and stats with a small delay to ensure database commit
      setTimeout(() => {
        loadProducts();
        loadStats();
      }, 500);

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
      // Set all stats to loading
      setStatsLoading({
        totalProducts: true,
        activeProducts: true,
        outOfStock: true,
        lowStock: true,
      });

      // Use efficient stats API that queries database directly for counts
      const statsResult = await adminQueries.getProductStats();

      setStats({
        totalProducts: statsResult.totalProducts || 0,
        activeProducts: statsResult.activeProducts || 0,
        outOfStock: statsResult.outOfStock || 0,
        lowStock: statsResult.lowStock || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      // Set default values on error
      setStats({
        totalProducts: 0,
        activeProducts: 0,
        outOfStock: 0,
        lowStock: 0,
      });
    } finally {
      // Clear all loading states
      setStatsLoading({
        totalProducts: false,
        activeProducts: false,
        outOfStock: false,
        lowStock: false,
      });
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

      const result = await adminQueries.addMasterProductToSeller({
        master_product_id: selectedMasterProduct.id,
        seller_id: sellerData.seller_id,
        price: parseFloat(sellerData.price) || 0,
        stock_available: parseInt(sellerData.stock_available) || 0,
        min_order_quantity: parseInt(sellerData.min_order_quantity) || 1,
        unit: sellerData.unit,
        description: sellerData.description
      });

      // Create variants if product was created and variants exist
      if (result?.data?.id && quickAddVariants.length > 0) {
        try {
          const variantsWithProductId = quickAddVariants.map(v => ({
            ...v,
            product_id: result.data.id,
          }));
          await VariantService.createVariants(variantsWithProductId);
        } catch (variantError) {
          console.error('Error creating variants:', variantError);
          toast.error('Product created but variants failed to save. You can add them later.');
        }
      }

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
      setQuickAddVariants([]);
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
    console.log('Quick Add dialog opening - reloading sellers...');
    setMasterProductsDialogOpen(true);
    loadMasterProducts();
    // Always reload sellers when dialog opens to ensure fresh data
    if (sellers.length === 0) {
      console.log('No sellers in state, loading sellers...');
      loadSellers();
    }
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
      field: 'image_url',
      headerName: 'Image',
      width: 80,
      minWidth: 60,
      flex: 0,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => {
        // Get image URL from image_url field
        const imageUrl = params.value || params.row.image_url || null;
        return (
          <Avatar
            src={imageUrl || undefined}
            alt={params.row.name || 'Product'}
            variant="rounded"
            sx={{ width: 40, height: 40 }}
            imgProps={{
              onError: (e) => {
                // Hide broken image and show icon instead
                e.currentTarget.style.display = 'none';
              }
            }}
          >
            <Inventory />
          </Avatar>
        );
      },
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
      headerName: 'Seller Name',
      width: 180,
      minWidth: 150,
      flex: 0.5,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" noWrap title={params.value || 'N/A'}>
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
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Product Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your product catalog and inventory
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<TrendingUp />}
          onClick={() => {
            loadStats();
            loadProducts();
            toast.success('Refreshing products and stats...');
          }}
          size="small"
        >
          Refresh
        </Button>
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
                <Box sx={{ flex: 1 }}>
                  {statsLoading.totalProducts ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Loading...
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="h6">{stats.totalProducts.toLocaleString()}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Products
                      </Typography>
                    </>
                  )}
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
                <Box sx={{ flex: 1 }}>
                  {statsLoading.activeProducts ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Loading...
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="h6">{stats.activeProducts.toLocaleString()}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Active Products
                      </Typography>
                    </>
                  )}
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
                <Box sx={{ flex: 1 }}>
                  {statsLoading.outOfStock ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Loading...
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="h6">{stats.outOfStock}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Out of Stock
                      </Typography>
                    </>
                  )}
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
                <Box sx={{ flex: 1 }}>
                  {statsLoading.lowStock ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Loading...
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="h6">{stats.lowStock}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Low Stock
                      </Typography>
                    </>
                  )}
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
                      {seller.display_name || seller.business_name || seller.phone_number || 'Unknown Seller'}
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
            {selectedProducts.length > 0 && (
              <Grid item xs={12} sm={6} md={2.4}>
                <Button
                  fullWidth
                  variant="contained"
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => setDeleteDialogOpen(true)}
                  size="small"
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  Delete Selected ({selectedProducts.length})
                </Button>
              </Grid>
            )}
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
                onClick={() => router.push('/products/scan-receipt')}
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
                variant="contained"
                color="secondary"
                startIcon={<Receipt />}
                onClick={() => {
                  if (sellers.length === 0) {
                    toast.error('Please add sellers first before scanning receipts');
                    return;
                  }
                  setReceiptScanSellerDialogOpen(true);
                }}
                size="small"
                sx={{
                  whiteSpace: 'nowrap',
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Scan Receipts 2.0 ⚡
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
            checkboxSelection
            rowSelectionModel={selectedProducts}
            onRowSelectionModelChange={(newSelection) => {
              setSelectedProducts(newSelection as string[]);
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
                  seller_name: true, // Show seller name by default
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

            <CategorySelector
              value={{
                category: newProduct.category,
                subcategory: newProduct.subcategory
              }}
              onChange={(value) => {
                setNewProduct(prev => ({
                  ...prev,
                  category: value.category,
                  subcategory: value.subcategory
                }));
              }}
              allowNew={true}
              size="medium"
            />

            <FormControl
              fullWidth
              required
              error={sellers.length === 0 && !loadingSellers}
            >
              <InputLabel id="add-product-seller-select-label">Select Seller</InputLabel>
              <Select
                labelId="add-product-seller-select-label"
                value={newProduct.seller_id || ''}
                onChange={(e) => {
                  console.log('Seller selected in Add Product:', e.target.value);
                  setNewProduct(prev => ({ ...prev, seller_id: e.target.value }));
                }}
                onOpen={() => {
                  console.log('Add Product seller dropdown opened, sellers count:', sellers.length);
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
                      zIndex: 1301, // Ensure it appears above the dialog
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
                        {seller.role && ` (${seller.role})`}
                      </MenuItem>
                    );
                  }).filter(Boolean)
                )}
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

            {/* Variant Manager */}
            <Box sx={{ mt: 2 }}>
              <VariantManager
                productName={newProduct.name}
                variants={productVariants}
                onVariantsChange={setProductVariants}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddDialogOpen(false);
            setProductVariants([]);
          }}>Cancel</Button>
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
        disableEscapeKeyDown={false}
        disablePortal={false}
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
                          console.log('Product clicked in Quick Add:', product.id, product.name);
                          console.log('Current sellers before selection:', {
                            count: sellers.length,
                            sellers: sellers.map(s => ({ id: s.id, name: s.business_name || s.display_name }))
                          });
                          setSelectedMasterProduct(product);
                          setSellerData(prev => ({
                            ...prev,
                            seller_id: prev.seller_id || '', // Preserve seller_id if already set
                            price: product.price?.toString() || '',
                            description: product.description || ''
                          }));
                          // Always ensure sellers are loaded when product is selected
                          if (sellers.length === 0) {
                            console.log('No sellers found, reloading sellers...');
                            loadSellers();
                          }
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

                {selectedMasterProduct && (
                  <>
                    <Typography variant="h6" gutterBottom>
                      Seller Details
                    </Typography>
                    <Box sx={{ mb: 2, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Debug: {sellers.length} seller{sellers.length !== 1 ? 's' : ''} loaded | Loading: {loadingSellers ? 'Yes' : 'No'}
                      </Typography>
                      {sellers.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Sellers: {sellers.map(s => s.business_name || s.id).join(', ')}
                        </Typography>
                      )}
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControl
                          fullWidth
                          error={sellers.length === 0 && !loadingSellers}
                        >
                          <InputLabel id="quick-add-seller-select-label">
                            Select Seller
                          </InputLabel>
                          <Select
                            labelId="quick-add-seller-select-label"
                            value={sellerData.seller_id || ''}
                            onChange={(e) => {
                              console.log('Seller selected in Quick Add:', e.target.value);
                              setSellerData(prev => ({ ...prev, seller_id: e.target.value }));
                            }}
                            onOpen={() => {
                              console.log('Select dropdown opened, sellers count:', sellers.length);
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
                                  zIndex: 1301,
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
                              disablePortal: false,
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
                                  <MenuItem
                                    key={seller.id}
                                    value={seller.id}
                                    sx={{ py: 1.5 }}
                                  >
                                    {businessName}
                                  </MenuItem>
                                );
                              }).filter(Boolean)
                            )}
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

                    {/* Variant Manager */}
                    {selectedMasterProduct && (
                      <Box sx={{ mt: 3 }}>
                        <VariantManager
                          productName={selectedMasterProduct.name}
                          variants={quickAddVariants}
                          onVariantsChange={setQuickAddVariants}
                        />
                      </Box>
                    )}
                  </>
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setMasterProductsDialogOpen(false);
            setQuickAddVariants([]);
          }}>Cancel</Button>
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


      {/* Extracted Product Editor */}

      {/* Receipt Extraction Preview Dialog (Receipt Scanning 2.0) */}
      <Dialog
        open={receiptExtractionPreviewOpen}
        onClose={() => setReceiptExtractionPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Receipt Extraction Preview
          <Button
            onClick={() => {
              // Store receipt result and navigate to extracted page
              if (receiptScanResult) {
                sessionStorage.setItem('extractedReceiptResult', JSON.stringify(receiptScanResult));
                setReceiptExtractionPreviewOpen(false);
                router.push('/products/extracted');
              }
            }}
            variant="contained"
            sx={{ float: 'right', mt: -1 }}
          >
            Edit Products
          </Button>
        </DialogTitle>
        <DialogContent>
          {receiptScanResult && (
            <ReceiptExtractionPreview
              products={receiptScanResult.products}
              metadata={receiptScanResult.metadata}
              confidence={receiptScanResult.confidence}
              originalImageUrl={receiptScanResult.originalImageUrl}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptExtractionPreviewOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              // Store receipt result and navigate to extracted page
              if (receiptScanResult) {
                sessionStorage.setItem('extractedReceiptResult', JSON.stringify(receiptScanResult));
                setReceiptExtractionPreviewOpen(false);
                router.push('/products/extracted');
              }
            }}
          >
            Edit & Add to Inventory
          </Button>
        </DialogActions>
      </Dialog>

      {/* Seller Selection Dialog for Receipt Scanning */}
      <Dialog open={receiptScanSellerDialogOpen} onClose={() => setReceiptScanSellerDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Select Seller for Receipt Scanning</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Select a seller first so AI can match products to existing inventory and group variants correctly.
          </Alert>
          <FormControl fullWidth required>
            <InputLabel>Select Seller</InputLabel>
            <Select
              value={receiptScanSelectedSeller}
              onChange={(e) => setReceiptScanSelectedSeller(e.target.value)}
              label="Select Seller"
            >
              {sellers.map((seller) => {
                if (!seller || !seller.id) return null;
                const businessName = seller.business_name || seller.display_name || seller.phone_number || `Seller ${seller.id}`;
                return (
                  <MenuItem key={seller.id} value={seller.id}>
                    {businessName}
                  </MenuItem>
                );
              }).filter(Boolean)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setReceiptScanSellerDialogOpen(false);
            setReceiptScanSelectedSeller('');
          }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!receiptScanSelectedSeller) {
                toast.error('Please select a seller');
                return;
              }
              // Store seller ID for use in extracted page
              sessionStorage.setItem('receiptScanSellerId', receiptScanSelectedSeller);
              setReceiptScanSellerDialogOpen(false);
              setReceiptScanV2DialogOpen(true);
            }}
            disabled={!receiptScanSelectedSeller}
          >
            Continue to Scan
          </Button>
        </DialogActions>
      </Dialog>

      {/* Scan Receipts 2.0 Dialog (NEW - Enhanced AI-powered extraction) */}
      <ReceiptScannerV2
        open={receiptScanV2DialogOpen}
        onClose={() => {
          setReceiptScanV2DialogOpen(false);
          setReceiptScanSelectedSeller('');
        }}
        onScanComplete={(products: ExtractedProductV2[]) => {
          // Store products and seller ID in sessionStorage and navigate to extracted products page
          sessionStorage.setItem('extractedProducts', JSON.stringify(products));
          if (receiptScanSelectedSeller) {
            sessionStorage.setItem('receiptScanSellerId', receiptScanSelectedSeller);
          }
          setReceiptScanV2DialogOpen(false);
          toast.success(`Extracted ${products.length} products using AI-powered extraction!`);
          router.push('/products/extracted');
        }}
        onCancel={() => {
          setReceiptScanV2DialogOpen(false);
          setReceiptScanSelectedSeller('');
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Products</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Are you sure you want to delete {selectedProducts.length} product(s)? This action cannot be undone.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Selected products:
          </Typography>
          <Box sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
            {products
              .filter(p => selectedProducts.includes(p.id))
              .map(product => (
                <Box key={product.id} sx={{ py: 0.5 }}>
                  <Typography variant="body2">
                    • {product.name} (₹{product.price?.toLocaleString() || '0'})
                  </Typography>
                </Box>
              ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteProducts}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <Delete />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}