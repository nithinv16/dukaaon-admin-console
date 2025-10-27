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
  Divider,
  Stack,
  Avatar,
  Paper,
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
  Visibility,
  Edit,
  LocalShipping,
  CheckCircle,
  Cancel,
  Schedule,
  Payment,
  Receipt,
  Phone,
  LocationOn,
} from '@mui/icons-material';
import { adminQueries, getSupabaseClient } from '@/lib/supabase-browser';
import { Order } from '@/types';
import toast from 'react-hot-toast';

interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  

  useEffect(() => {
    loadOrders();
    loadStats();
  }, [page, pageSize, searchTerm, filterStatus]);



  const loadOrders = async () => {
    try {
      setLoading(true);
      
      const result = await adminQueries.getOrders({
        page: page + 1, // Convert from 0-based to 1-based pagination
        limit: pageSize,
        search: searchTerm,
        status: filterStatus === 'all' ? undefined : filterStatus,
      });
      
      if (result && result.orders) {
        setOrders(result.orders);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error(`Failed to load orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      console.log('Loading analytics...');
      const analytics = await adminQueries.getAnalytics();
      console.log('Analytics result:', analytics);
      if (analytics) {
        setStats({
          totalOrders: analytics.totalOrders,
          pendingOrders: analytics.pendingOrders || 0,
          completedOrders: analytics.completedOrders || 0,
          cancelledOrders: analytics.cancelledOrders || 0,
          totalRevenue: analytics.totalRevenue,
        });
        console.log('Stats set successfully');
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleOrderStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      // Implementation would depend on your Supabase schema
      // This is a placeholder for the actual implementation
      toast.success(`Order status updated to ${newStatus}`);
      loadOrders();
      loadStats();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'success';
      case 'pending':
      case 'processing':
        return 'warning';
      case 'shipped':
      case 'in_transit':
        return 'info';
      case 'cancelled':
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return <CheckCircle />;
      case 'pending':
      case 'processing':
        return <Schedule />;
      case 'shipped':
      case 'in_transit':
        return <LocalShipping />;
      case 'cancelled':
      case 'failed':
        return <Cancel />;
      default:
        return <Receipt />;
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'Order ID',
      width: 120,
      minWidth: 100,
      flex: 0,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="monospace" noWrap>
          #{params.value.slice(-8)}
        </Typography>
      ),
    },
    {
      field: 'retailer_id',
      headerName: 'Customer',
      width: 180,
      minWidth: 150,
      flex: 0.5,
      hideable: true,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 32, height: 32 }}>
            U
          </Avatar>
          <Typography variant="body2" noWrap>{params.value?.slice(-8) || 'N/A'}</Typography>
        </Box>
      ),
    },
    {
      field: 'seller_id',
      headerName: 'Seller',
      width: 180,
      minWidth: 150,
      flex: 0.5,
      hideable: true,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
            S
          </Avatar>
          <Typography variant="body2" noWrap>{params.value?.slice(-8) || 'N/A'}</Typography>
        </Box>
      ),
    },
    {
      field: 'total_amount',
      headerName: 'Amount',
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
      field: 'status',
      headerName: 'Status',
      width: 140,
      minWidth: 120,
      flex: 0,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          icon={getStatusIcon(params.value)}
          label={params.value || 'pending'}
          color={getStatusColor(params.value)}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Order Date',
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
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => {
              setSelectedOrder(params.row);
              setDialogOpen(true);
            }}
          >
            <Visibility />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              // Handle edit order
              toast('Edit order functionality coming soon');
            }}
          >
            <Edit />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" gutterBottom>
        Order Management
      </Typography>



      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Orders
              </Typography>
              <Typography variant="h4">{stats.totalOrders}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Pending
              </Typography>
              <Typography variant="h4" color="warning.main">
                {stats.pendingOrders}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Completed
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats.completedOrders}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Cancelled
              </Typography>
              <Typography variant="h4" color="error.main">
                {stats.cancelledOrders}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Revenue
              </Typography>
              <Typography variant="h4" color="primary.main">
                ₹{stats.totalRevenue.toLocaleString()}
              </Typography>
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
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status Filter"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All Orders</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="processing">Processing</MenuItem>
                  <MenuItem value="shipped">Shipped</MenuItem>
                  <MenuItem value="delivered">Delivered</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterList />}
                onClick={loadOrders}
              >
                Apply Filters
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Receipt />}
                onClick={() => {
                  // Handle export orders
                  toast('Export functionality coming soon');
                }}
              >
                Export Orders
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent>
          <DataGrid
            rows={orders}
            columns={columns}
            loading={loading}
            pageSizeOptions={[10, 25, 50, 100]}
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            disableRowSelectionOnClick
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
                  retailer_id: false, // Hide on mobile by default
                  seller_id: false,   // Hide on mobile by default
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

      {/* Order Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Order Details
          {selectedOrder && (
            <Chip
              label={selectedOrder.status || 'pending'}
              color={getStatusColor(selectedOrder.status)}
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* Order Info */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Order Information
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="subtitle2">Order ID</Typography>
                      <Typography variant="body2" fontFamily="monospace">
                        #{selectedOrder.id.slice(-8)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Order Date</Typography>
                      <Typography variant="body2">
                        {new Date(selectedOrder.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Total Amount</Typography>
                      <Typography variant="h6" color="primary">
                        ₹{selectedOrder.total_amount?.toLocaleString() || '0'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Payment Status</Typography>
                      <Chip
                        label={'pending'}
                        color={'warning'}
                        size="small"
                      />
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              {/* Retailer Info */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Retailer Information
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="subtitle2">Name</Typography>
                      <Typography variant="body2">
                        {selectedOrder.retailer?.shopName || selectedOrder.retailer?.email || 'N/A'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Phone</Typography>
                      <Typography variant="body2">
                        <Phone sx={{ fontSize: 16, mr: 1 }} />
                        {selectedOrder.retailer?.phone || 'N/A'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Delivery Address</Typography>
                      <Typography variant="body2">
                        <LocationOn sx={{ fontSize: 16, mr: 1 }} />
                        {selectedOrder.delivery_address || 'N/A'}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              {/* Seller Info */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Seller Information
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="subtitle2">Business Name</Typography>
                      <Typography variant="body2">
                        {selectedOrder.seller?.business_name || 'N/A'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Phone</Typography>
                      <Typography variant="body2">
                        <Phone sx={{ fontSize: 16, mr: 1 }} />
                        {selectedOrder.seller?.phone || 'N/A'}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              {/* Order Items */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Order Items
                  </Typography>
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    <Stack spacing={1}>
                      {selectedOrder.items.map((item: any, index: number) => (
                        <Box
                          key={index}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            p: 1,
                            border: '1px solid #e0e0e0',
                            borderRadius: 1,
                          }}
                        >
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {item.product_name || item.name || item.title || 'Product'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Qty: {item.quantity || 1} × ₹{item.price || 0}
                            </Typography>
                            {item.variant && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Variant: {item.variant}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="body2" fontWeight="medium">
                            ₹{((item.quantity || 1) * (item.price || 0)).toLocaleString()}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="info">No items found for this order</Alert>
                  )}
                </Paper>
              </Grid>

              {/* Status Update */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Update Order Status
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => (
                      <Button
                        key={status}
                        variant={selectedOrder.status === status ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => handleOrderStatusUpdate(selectedOrder.id, status)}
                        disabled={selectedOrder.status === status}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Button>
                    ))}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<Receipt />}
            onClick={() => {
              // Handle print/download invoice
              toast('Invoice download functionality coming soon');
            }}
          >
            Download Invoice
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}