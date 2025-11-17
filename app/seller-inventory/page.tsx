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
  CircularProgress,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid';
import {
  Inventory,
  Add,
  Edit,
  Delete,
  Search,
  Person,
  Store,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';

export default function SellerInventoryPage() {
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalProducts, setTotalProducts] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  useEffect(() => {
    loadSellers();
  }, []);

  useEffect(() => {
    if (selectedSeller) {
      loadSellerProducts();
    }
  }, [selectedSeller, page, pageSize, searchTerm, filterCategory]);

  const loadSellers = async () => {
    try {
      setLoading(true);
      const result = await adminQueries.getAllUsers();
      const users = result.data || result;
      const sellerUsers = Array.isArray(users)
        ? users.filter((u: any) => u.role === 'wholesaler' || u.role === 'manufacturer')
        : [];
      setSellers(sellerUsers);
      
      // Auto-select first seller if available
      if (sellerUsers.length > 0 && !selectedSeller) {
        setSelectedSeller(sellerUsers[0].id);
      }
    } catch (error) {
      console.error('Error loading sellers:', error);
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

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Product Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'category_name',
      headerName: 'Category',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value || 'N/A'} size="small" />
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
                    const businessName = seller.business_details?.shopName || 
                                        seller.business_details?.business_name || 
                                        seller.phone_number;
                    return (
                      <MenuItem key={seller.id} value={seller.id}>
                        <Box>
                          <Typography variant="body1">{businessName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {seller.role} • {seller.phone_number}
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
                    {selectedSellerData.business_details?.shopName || 
                     selectedSellerData.business_details?.business_name || 
                     'Seller'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Role: {selectedSellerData.role}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Phone: {selectedSellerData.phone_number}
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
                          {/* Add categories dynamically */}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2" color="text.secondary">
                        Total Products: {totalProducts}
                      </Typography>
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
    </Box>
  );
}

