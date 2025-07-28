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
import { adminQueries } from '@/lib/supabase';
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

      // Fetch dashboard statistics
      const { users, orders, revenue } = await adminQueries.getDashboardStats();

      if (users.error || orders.error || revenue.error) {
        throw new Error('Failed to fetch dashboard data');
      }

      // Process user statistics
      const usersByRole = users.data?.reduce((acc: any, user: any) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});

      // Process order statistics
      const ordersByStatus = orders.data?.reduce((acc: any, order: any) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {});

      // Calculate revenue
      const totalRevenue = revenue.data?.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0;
      const thirtyDaysAgo = subDays(new Date(), 30);
      const monthlyRevenue = revenue.data?.filter((order: any) => new Date(order.created_at) >= thirtyDaysAgo)
        .reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0;

      setStats({
        totalUsers: users.count || 0,
        totalRetailers: usersByRole?.retailer || 0,
        totalWholesalers: usersByRole?.wholesaler || 0,
        totalManufacturers: usersByRole?.manufacturer || 0,
        totalOrders: orders.count || 0,
        pendingOrders: ordersByStatus?.pending || 0,
        completedOrders: ordersByStatus?.delivered || 0,
        totalRevenue,
        monthlyRevenue,
      });

      // Generate chart data based on selected time filter
      const generateChartData = () => {
        let chartDataArray: any[] = [];
        const now = new Date();

        switch (timeFilter) {
          case '7days':
            chartDataArray = Array.from({ length: 7 }, (_, i) => {
              const date = subDays(now, 6 - i);
              const dayStart = startOfDay(date);
              const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
              
              const dayOrders = orders.data?.filter((order: any) => {
                const orderDate = new Date(order.created_at);
                return orderDate >= dayStart && orderDate < dayEnd;
              }) || [];
              
              const dayRevenue = revenue.data?.filter((order: any) => {
                const orderDate = new Date(order.created_at);
                return orderDate >= dayStart && orderDate < dayEnd;
              }).reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0;

              return {
                date: format(date, 'MMM dd'),
                orders: dayOrders.length,
                revenue: dayRevenue,
              };
            });
            break;

          case '4weeks':
            chartDataArray = Array.from({ length: 4 }, (_, i) => {
              const weekStart = startOfWeek(subWeeks(now, 3 - i));
              const weekEnd = endOfWeek(subWeeks(now, 3 - i));
              
              const weekOrders = orders.data?.filter((order: any) => {
                const orderDate = new Date(order.created_at);
                return orderDate >= weekStart && orderDate <= weekEnd;
              }) || [];
              
              const weekRevenue = revenue.data?.filter((order: any) => {
                const orderDate = new Date(order.created_at);
                return orderDate >= weekStart && orderDate <= weekEnd;
              }).reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0;

              return {
                date: `Week ${i + 1}`,
                orders: weekOrders.length,
                revenue: weekRevenue,
              };
            });
            break;

          case '12months':
            chartDataArray = Array.from({ length: 12 }, (_, i) => {
              const monthStart = startOfMonth(subMonths(now, 11 - i));
              const monthEnd = endOfMonth(subMonths(now, 11 - i));
              
              const monthOrders = orders.data?.filter((order: any) => {
                const orderDate = new Date(order.created_at);
                return orderDate >= monthStart && orderDate <= monthEnd;
              }) || [];
              
              const monthRevenue = revenue.data?.filter((order: any) => {
                const orderDate = new Date(order.created_at);
                return orderDate >= monthStart && orderDate <= monthEnd;
              }).reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0;

              return {
                date: format(monthStart, 'MMM yyyy'),
                orders: monthOrders.length,
                revenue: monthRevenue,
              };
            });
            break;

          case '5years':
            chartDataArray = Array.from({ length: 5 }, (_, i) => {
              const yearStart = startOfYear(subYears(now, 4 - i));
              const yearEnd = endOfYear(subYears(now, 4 - i));
              
              const yearOrders = orders.data?.filter((order: any) => {
                const orderDate = new Date(order.created_at);
                return orderDate >= yearStart && orderDate <= yearEnd;
              }) || [];
              
              const yearRevenue = revenue.data?.filter((order: any) => {
                const orderDate = new Date(order.created_at);
                return orderDate >= yearStart && orderDate <= yearEnd;
              }).reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0;

              return {
                date: format(yearStart, 'yyyy'),
                orders: yearOrders.length,
                revenue: yearRevenue,
              };
            });
            break;

          default:
            chartDataArray = [];
        }

        return chartDataArray;
      };

      setChartData(generateChartData());

      // Fetch recent orders
      const { data: ordersData } = await adminQueries.getAllOrders(1, 5);
      setRecentOrders(ordersData || []);

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
    if (stats) {
      fetchDashboardData();
    }
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
                secondary={`${order.retailer?.business_details?.shopName || 'Unknown'} • ₹${order.total_amount}`}
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