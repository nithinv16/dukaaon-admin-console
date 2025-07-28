'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  Stack,
  Avatar,
  Paper,
  IconButton,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack,
  LocalShipping,
  CheckCircle,
  Cancel,
  Schedule,
  Payment,
  Receipt,
  Phone,
  LocationOn,
  Person,
  ShoppingCart,
} from '@mui/icons-material';
import { useRouter, useParams } from 'next/navigation';
import { adminQueries, Order } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
    }
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to get order details using the admin queries
      const result = await adminQueries.getOrders({
        page: 1,
        limit: 1,
        search: orderId,
      });
      
      if (result && result.orders && result.orders.length > 0) {
        const foundOrder = result.orders.find(o => o.id === orderId);
        if (foundOrder) {
          setOrder(foundOrder);
        } else {
          setError('Order not found');
        }
      } else {
        setError('Order not found');
      }
    } catch (error) {
      console.error('Error loading order details:', error);
      setError('Failed to load order details');
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !order) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">Order Details</Typography>
        </Box>
        <Alert severity="error">{error || 'Order not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4">Order Details</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Order Summary */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Order #{order.id.slice(-8)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Placed on {new Date(order.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
                <Chip
                  icon={getStatusIcon(order.status)}
                  label={order.status?.toUpperCase() || 'UNKNOWN'}
                  color={getStatusColor(order.status) as any}
                  variant="outlined"
                />
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Person sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="subtitle2">Customer</Typography>
                  </Box>
                  <Typography variant="body1">{order.retailer_id?.slice(-8) || 'N/A'}</Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Payment sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="subtitle2">Total Amount</Typography>
                  </Box>
                  <Typography variant="h6" color="primary">
                    ₹{order.total_amount?.toLocaleString() || '0'}
                  </Typography>
                </Grid>
                
                {order.delivery_address && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                      <LocationOn sx={{ mr: 1, color: 'text.secondary', mt: 0.5 }} />
                      <Typography variant="subtitle2">Delivery Address</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {order.delivery_address}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Order Items */}
          {order.items && order.items.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Order Items
                </Typography>
                <Stack spacing={2}>
                  {order.items.map((item: any, index: number) => (
                    <Paper key={index} sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <ShoppingCart sx={{ mr: 2, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="subtitle2">
                              {item.name || item.product_name || 'Product'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Quantity: {item.quantity} × ₹{item.price}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          ₹{(item.quantity * item.price).toLocaleString()}
                        </Typography>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Order Actions & Info */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Order Actions
              </Typography>
              
              <Stack spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<Phone />}
                  fullWidth
                  disabled={true}
                >
                  Contact Customer
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<LocalShipping />}
                  fullWidth
                >
                  Track Delivery
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<Receipt />}
                  fullWidth
                >
                  Generate Invoice
                </Button>
              </Stack>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" gutterBottom>
                Order Information
              </Typography>
              
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Order ID:</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {order.id.slice(-12)}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Created:</Typography>
                  <Typography variant="body2">
                    {new Date(order.created_at).toLocaleString()}
                  </Typography>
                </Box>
                
                {order.updated_at && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Updated:</Typography>
                    <Typography variant="body2">
                      {new Date(order.updated_at).toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}