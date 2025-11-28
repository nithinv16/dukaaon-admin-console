'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Alert,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid';
import {
  Edit,
  Search,
  CloudUpload,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';
import BulkImportDialog, { ParsedProduct, ImportResult } from '@/components/BulkImportDialog';
import BulkImportPreview from '@/components/BulkImportPreview';

export default function SellerInventoryPage() {
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalProducts, setTotalProducts] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  // Bulk import state
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [bulkImportPreviewOpen, setBulkImportPreviewOpen] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);

  useEffect(() => {
    loadSellers();
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedSeller) {
      loadSellerProducts();
    }
  }, [selectedSeller, page, pageSize, searchTerm, filterCategory]);

  const loadCategories = async () => {
    try {
      // Fetch unique categories from products
      const result = await adminQueries.getProducts({ limit: 1000 });
      const allProducts = result.products || [];
      const uniqueCategories = Array.from(new Set(
        allProducts
          .map((p: any) => p.category)
          .filter(Boolean)
      )).sort() as string[];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadSellers = async () => {
    try {
      setLoading(true);
      const sellers = await adminQueries.getSellersWithDetails();
      console.log('Loaded sellers in seller-inventory:', sellers);
      
      if (sellers && Array.isArray(sellers)) {
        const validSellers = sellers.filter(seller => seller && seller.id);
        setSellers(validSellers);
        
        // Auto-select first seller if available
        if (validSellers.length > 0 && !selectedSeller) {
          setSelectedSeller(validSellers[0].id);
        }
      } else {
        setSellers([]);
        toast.error('Invalid sellers data received');
      }
    } catch (error) {
      console.error('Error loading sellers:', error);
      setSellers([]);
      toast.error('Failed to load sellers');
    } finally {
      setLoading(false);
    }
  };

  const loadSellerProducts = async () => {
    if (!selectedSeller) return;

    try {
      setLoading(true);
      const result = await adminQueries.getProducts({
        seller_id: selectedSeller,
        page: page + 1,
        limit: pageSize,
        search: searchTerm || undefined,
        category: filterCategory !== 'all' ? filterCategory : undefined,
      });
      setProducts(result.products || []);
      setTotalProducts(result.total || 0);
    } catch (error) {
      console.error('Error loading seller products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    setEditDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;

    try {
      await adminQueries.updateProduct(editingProduct.id, editingProduct);
      toast.success('Product updated successfully!');
      setEditDialogOpen(false);
      setEditingProduct(null);
      loadSellerProducts();
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast.error(error.message || 'Failed to update product');
    }
  };

  // Bulk import handlers
  const handleBulkImportClick = () => {
    if (!selectedSeller) {
      toast.error('Please select a seller first');
      return;
    }
    setBulkImportDialogOpen(true);
  };

  const handleProductsParsed = (products: ParsedProduct[]) => {
    setParsedProducts(products);
    setBulkImportDialogOpen(false);
    setBulkImportPreviewOpen(true);
  };

  const handleImportComplete = (results: ImportResult) => {
    setBulkImportPreviewOpen(false);
    setParsedProducts([]);
    
    if (results.successful > 0) {
      toast.success(`Successfully imported ${results.successful} product(s)`);
      loadSellerProducts(); // Refresh the product list
    }
    
    if (results.failed > 0) {
      toast.error(`${results.failed} product(s) failed to import`);
    }
  };

  const handleImportCancel = () => {
    setBulkImportPreviewOpen(false);
    setParsedProducts([]);
  };

  const columns: GridColDef[] = [
    {
      field: 'image_url',
      headerName: 'Image',
      width: 80,
      minWidth: 60,
      flex: 0,
      renderCell: (params: GridRenderCellParams) => (
        <Box
          component="img"
          src={params.value || params.row.images?.[0] || '/placeholder-product.png'}
          alt={params.row.name}
          sx={{
            width: 40,
            height: 40,
            objectFit: 'cover',
            borderRadius: 1,
          }}
        />
      ),
    },
    {
      field: 'name',
      headerName: 'Product Name',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" fontWeight="medium" noWrap>
            {params.value}
          </Typography>
          {params.row.description && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {params.row.description.substring(0, 50)}
              {params.row.description.length > 50 ? '...' : ''}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value || 'N/A'} size="small" />
      ),
    },
    {
      field: 'subcategory',
      headerName: 'Subcategory',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'price',
      headerName: 'Price',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography>₹{params.value?.toLocaleString() || '0'}</Typography>
      ),
    },
    {
      field: 'stock_available',
      headerName: 'Stock',
      width: 100,
      renderCell: (params: GridRenderCellParams) => {
        const stock = params.value || 0;
        return (
          <Chip
            label={stock}
            color={stock > 10 ? 'success' : stock > 0 ? 'warning' : 'error'}
            size="small"
          />
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value || 'available'}
          color={params.value === 'available' ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleEditProduct(params.row)}
          >
            <Edit />
          </IconButton>
        </Box>
      ),
    },
  ];

  const selectedSellerData = sellers.find((s) => s.id === selectedSeller);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" gutterBottom>
        Seller Inventory Management
      </Typography>

      <Grid container spacing={3}>
        {/* Seller Selection */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Select Seller
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Seller</InputLabel>
                <Select
                  value={selectedSeller || ''}
                  label="Seller"
                  onChange={(e) => setSelectedSeller(e.target.value)}
                >
                  {sellers.map((seller) => {
                    const businessName = seller.business_name || 
                                        seller.display_name || 
                                        seller.phone_number || 
                                        'Unknown Seller';
                    return (
                      <MenuItem key={seller.id} value={seller.id}>
                        <Box>
                          <Typography variant="body1">{businessName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {seller.seller_type || seller.role} • {seller.phone_number || 'N/A'}
                          </Typography>
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              {selectedSellerData && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">
                    {selectedSellerData.business_name || 
                     selectedSellerData.display_name || 
                     selectedSellerData.phone_number || 
                     'Seller'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Type: {selectedSellerData.seller_type || selectedSellerData.role || 'N/A'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Phone: {selectedSellerData.phone_number || 'N/A'}
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Products List */}
        <Grid item xs={12} md={9}>
          {selectedSeller ? (
            <>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                          startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Category</InputLabel>
                        <Select
                          value={filterCategory}
                          label="Category"
                          onChange={(e) => setFilterCategory(e.target.value)}
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
                    <Grid item xs={12} sm={2}>
                      <Typography variant="body2" color="text.secondary">
                        Total Products: {totalProducts}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <Button
                        variant="contained"
                        startIcon={<CloudUpload />}
                        onClick={handleBulkImportClick}
                        disabled={!selectedSeller}
                        fullWidth
                        size="small"
                      >
                        Bulk Import
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

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
                    rowCount={totalProducts}
                    paginationMode="server"
                    disableRowSelectionOnClick
                    slots={{ toolbar: GridToolbar }}
                    getRowId={(row) => row.id}
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent>
                <Alert severity="info">
                  Please select a seller to view their inventory.
                </Alert>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Edit Product Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingProduct(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Product</DialogTitle>
        <DialogContent>
          {editingProduct && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Product Name"
                value={editingProduct.name || ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, name: e.target.value })
                }
                fullWidth
              />
              <TextField
                label="Price"
                type="number"
                value={editingProduct.price || 0}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    price: parseFloat(e.target.value),
                  })
                }
                fullWidth
              />
              <TextField
                label="Stock Available"
                type="number"
                value={editingProduct.stock_available || 0}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    stock_available: parseInt(e.target.value),
                  })
                }
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={editingProduct.status || 'available'}
                  label="Status"
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      status: e.target.value,
                    })
                  }
                >
                  <MenuItem value="available">Available</MenuItem>
                  <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                  <MenuItem value="discontinued">Discontinued</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            setEditingProduct(null);
          }}>
            Cancel
          </Button>
          <Button onClick={handleSaveProduct} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={bulkImportDialogOpen}
        onClose={() => setBulkImportDialogOpen(false)}
        sellerId={selectedSeller || ''}
        onProductsParsed={handleProductsParsed}
      />

      {/* Bulk Import Preview Dialog */}
      <Dialog
        open={bulkImportPreviewOpen}
        onClose={handleImportCancel}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { minHeight: '80vh' } }}
      >
        <DialogTitle>
          Review & Import Products
        </DialogTitle>
        <DialogContent dividers>
          {parsedProducts.length > 0 && selectedSeller && (
            <BulkImportPreview
              products={parsedProducts}
              sellerId={selectedSeller}
              onConfirm={handleImportComplete}
              onCancel={handleImportCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

