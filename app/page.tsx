'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  People,
  ShoppingCart,
  TrendingUp,
  AttachMoney,
  Refresh,
  Warning,
  CheckCircle,
  Schedule,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { adminQueries } from '@/lib/supabase-browser';
import { format, subDays, startOfDay, subWeeks, subMonths, subYears, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear } from 'date-fns';

interface DashboardStats {
  totalUsers: number;
  totalRetailers: number;
  totalWholesalers: number;
  totalManufacturers: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

interface ChartData {
  date: string;
  orders: number;
  revenue: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>('7days');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard statistics with chart data
      const dashboardData = await adminQueries.getDashboardStats(timeFilter);

      // Fetch additional analytics data
      const analyticsData = await adminQueries.getAnalytics();

      // Set recent orders
      setRecentOrders(dashboardData.recentOrders || []);

      // Set stats
      setStats({
        totalUsers: analyticsData.totalUsers || 0,
        totalRetailers: 0, // Will need to implement user role counting
        totalWholesalers: 0, // Will need to implement user role counting
        totalManufacturers: 0, // Will need to implement user role counting
        totalOrders: dashboardData.stats.totalOrders || 0,
        pendingOrders: dashboardData.stats.pendingOrders || 0,
        completedOrders: dashboardData.stats.completedOrders || 0,
        totalRevenue: analyticsData.totalRevenue || 0,
        monthlyRevenue: dashboardData.stats.monthlyRevenue || 0,
      });

      // Use real chart data from API
      setChartData(dashboardData.chartData || []);

      // Recent orders are already set from dashboardData
      // No need to fetch separately

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [timeFilter]);

  const getChartTitle = () => {
    switch (timeFilter) {
      case '7days': return 'Orders & Revenue (Last 7 Days)';
      case '4weeks': return 'Orders & Revenue (Last 4 Weeks)';
      case '12months': return 'Orders & Revenue (Last 12 Months)';
      case '5years': return 'Orders & Revenue (Last 5 Years)';
      default: return 'Orders & Revenue';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'confirmed': return 'info';
      case 'shipped': return 'primary';
      case 'delivered': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Schedule />;
      case 'delivered': return <CheckCircle />;
      case 'cancelled': return <Warning />;
      default: return <Schedule />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <IconButton color="inherit" size="small" onClick={fetchDashboardData}>
            <Refresh />
          </IconButton>
        }
      >
        {error}
      </Alert>
    );
  }

  const pieData = [
    { name: 'Retailers', value: stats?.totalRetailers || 0 },
    { name: 'Wholesalers', value: stats?.totalWholesalers || 0 },
    { name: 'Manufacturers', value: stats?.totalManufacturers || 0 },
  ].filter(item => item.value > 0); // Only show roles that have users

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Dashboard Overview
        </Typography>
        <Tooltip title="Refresh Data">
          <IconButton onClick={fetchDashboardData} color="primary">
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Users
                  </Typography>
                  <Typography variant="h4" component="div">
                    {stats?.totalUsers.toLocaleString()}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <People />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Orders
                  </Typography>
                  <Typography variant="h4" component="div">
                    {stats?.totalOrders.toLocaleString()}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <ShoppingCart />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Monthly Revenue
                  </Typography>
                  <Typography variant="h4" component="div">
                    ₹{stats?.monthlyRevenue.toLocaleString()}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <AttachMoney />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Pending Orders
                  </Typography>
                  <Typography variant="h4" component="div">
                    {stats?.pendingOrders.toLocaleString()}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <TrendingUp />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                {getChartTitle()}
              </Typography>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Time Period</InputLabel>
                <Select
                  value={timeFilter}
                  label="Time Period"
                  onChange={(e) => setTimeFilter(e.target.value)}
                >
                  <MenuItem value="7days">Last 7 Days</MenuItem>
                  <MenuItem value="4weeks">Last 4 Weeks</MenuItem>
                  <MenuItem value="12months">Last 12 Months</MenuItem>
                  <MenuItem value="5years">Last 5 Years</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <RechartsTooltip />
                <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#8884d8" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              User Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Orders */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent Orders
        </Typography>
        <List>
          {recentOrders.map((order) => (
            <ListItem key={order.id} divider>
              <ListItemText
                primary={`Order #${order.id.slice(-8)}`}
                secondary={`${order.retailer?.business_details?.shopName || order.retailer?.phone_number || 'Unknown'} • ₹${(order.total_amount || 0).toLocaleString()}`}
              />
              <Chip
                icon={getOrderStatusIcon(order.status)}
                label={order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                color={getOrderStatusColor(order.status) as any}
                size="small"
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}