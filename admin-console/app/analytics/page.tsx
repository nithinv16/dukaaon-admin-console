'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  Chip,
  Stack,
  Alert,
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  People,
  ShoppingCart,
  AttachMoney,
  Inventory,
  Download,
  DateRange,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface AnalyticsData {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  activeUsers: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  userGrowthRate: number;
  revenueGrowthRate: number;
  retailers?: number;
  wholesalers?: number;
  manufacturers?: number;
  admins?: number;
}

interface ChartData {
  name: string;
  value: number;
  orders?: number;
  revenue?: number;
  users?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    activeUsers: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    averageOrderValue: 0,
    conversionRate: 0,
    userGrowthRate: 0,
    revenueGrowthRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');
  const [revenueData, setRevenueData] = useState<ChartData[]>([]);
  const [orderData, setOrderData] = useState<ChartData[]>([]);
  const [userDistribution, setUserDistribution] = useState<ChartData[]>([]);
  const [topProducts, setTopProducts] = useState<ChartData[]>([]);

  useEffect(() => {
    loadAnalytics();
    loadChartData();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await adminQueries.getAnalytics();
      if (data) {
        setAnalytics({
          totalUsers: data.totalUsers || 0,
          totalOrders: data.totalOrders || 0,
          totalRevenue: data.totalRevenue || 0,
          totalProducts: data.totalProducts || 0,
          activeUsers: data.activeUsers || 0,
          pendingOrders: data.pendingOrders || 0,
          completedOrders: data.completedOrders || 0,
          cancelledOrders: data.cancelledOrders || 0,
          averageOrderValue: data.totalRevenue / (data.totalOrders || 1),
          conversionRate: ((data.totalOrders || 0) / (data.totalUsers || 1)) * 100,
          userGrowthRate: 12.5, // Mock data - would come from actual calculation
          revenueGrowthRate: 18.3, // Mock data - would come from actual calculation
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    try {
      // Mock data for charts - in real implementation, this would come from Supabase
      const mockRevenueData = [
        { name: 'Mon', value: 12000, revenue: 12000, orders: 45 },
        { name: 'Tue', value: 15000, revenue: 15000, orders: 52 },
        { name: 'Wed', value: 18000, revenue: 18000, orders: 61 },
        { name: 'Thu', value: 14000, revenue: 14000, orders: 48 },
        { name: 'Fri', value: 22000, revenue: 22000, orders: 73 },
        { name: 'Sat', value: 25000, revenue: 25000, orders: 82 },
        { name: 'Sun', value: 20000, revenue: 20000, orders: 67 },
      ];

      const mockOrderData = [
        { name: 'Pending', value: analytics.pendingOrders || 0 },
        { name: 'Delivered', value: analytics.completedOrders || 0 },
        { name: 'Cancelled', value: analytics.cancelledOrders || 0 },
      ].filter(item => item.value > 0); // Only show statuses that have orders

      const mockUserDistribution = [
        { name: 'Retailers', value: Math.floor(analytics.totalUsers * 0.6) || 0 },
        { name: 'Wholesalers', value: Math.floor(analytics.totalUsers * 0.25) || 0 },
        { name: 'Manufacturers', value: Math.floor(analytics.totalUsers * 0.12) || 0 },
        { name: 'Admins', value: Math.floor(analytics.totalUsers * 0.03) || 0 },
      ].filter(item => item.value > 0); // Only show roles that have users

      const mockTopProducts = [
        { name: 'Electronics', value: 45 },
        { name: 'Clothing', value: 30 },
        { name: 'Home & Garden', value: 15 },
        { name: 'Sports', value: 10 },
      ];

      setRevenueData(mockRevenueData);
      setOrderData(mockOrderData);
      setUserDistribution(mockUserDistribution);
      setTopProducts(mockTopProducts);
    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const StatCard = ({ title, value, icon, trend, trendValue, color = 'primary' }: any) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {typeof value === 'number' && title.includes('Revenue') ? formatCurrency(value) : value}
            </Typography>
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {trend === 'up' ? (
                  <TrendingUp color="success" sx={{ fontSize: 16, mr: 0.5 }} />
                ) : (
                  <TrendingDown color="error" sx={{ fontSize: 16, mr: 0.5 }} />
                )}
                <Typography
                  variant="body2"
                  color={trend === 'up' ? 'success.main' : 'error.main'}
                >
                  {trendValue}%
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}.light`,
              borderRadius: 2,
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Analytics Dashboard
        </Typography>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              label="Date Range"
              onChange={(e) => setDateRange(e.target.value)}
            >
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 3 months</MenuItem>
              <MenuItem value="1y">Last year</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => toast('Export functionality coming soon')}
          >
            Export Report
          </Button>
        </Stack>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={analytics.totalUsers.toLocaleString()}
            icon={<People />}
            trend="up"
            trendValue={analytics.userGrowthRate}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Orders"
            value={analytics.totalOrders.toLocaleString()}
            icon={<ShoppingCart />}
            trend="up"
            trendValue="8.2"
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Revenue"
            value={analytics.totalRevenue}
            icon={<AttachMoney />}
            trend="up"
            trendValue={analytics.revenueGrowthRate}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Products"
            value={analytics.totalProducts.toLocaleString()}
            icon={<Inventory />}
            trend="up"
            trendValue="5.1"
            color="info"
          />
        </Grid>
      </Grid>

      {/* Secondary Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Average Order Value
              </Typography>
              <Typography variant="h5">
                {formatCurrency(analytics.averageOrderValue)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Conversion Rate
              </Typography>
              <Typography variant="h5">
                {analytics.conversionRate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Active Users
              </Typography>
              <Typography variant="h5">
                {analytics.activeUsers.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Pending Orders
              </Typography>
              <Typography variant="h5" color="warning.main">
                {analytics.pendingOrders.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Revenue & Orders Trend */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Revenue & Orders Trend
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'revenue' ? formatCurrency(Number(value)) : value,
                      name === 'revenue' ? 'Revenue' : 'Orders',
                    ]}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stackId="1"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="orders"
                    stroke="#82ca9d"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Order Status Distribution */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Order Status Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={orderData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {orderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* User Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                User Type Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={userDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Product Categories */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Product Categories
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={topProducts}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Insights */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Insights
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Alert severity="success">
                    <Typography variant="subtitle2">Revenue Growth</Typography>
                    <Typography variant="body2">
                      Revenue increased by {analytics.revenueGrowthRate}% compared to last period
                    </Typography>
                  </Alert>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Alert severity="info">
                    <Typography variant="subtitle2">User Engagement</Typography>
                    <Typography variant="body2">
                      {((analytics.activeUsers / analytics.totalUsers) * 100).toFixed(1)}% of users are active
                    </Typography>
                  </Alert>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Alert severity="warning">
                    <Typography variant="subtitle2">Pending Orders</Typography>
                    <Typography variant="body2">
                      {analytics.pendingOrders} orders need attention
                    </Typography>
                  </Alert>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}