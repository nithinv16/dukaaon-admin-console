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
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
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
  Add,
  Edit,
  Delete,
  Visibility,
  Category,
  TrendingUp,
  Inventory,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface CategoryData {
  id: string;
  name: string;
  description: string;
  parent_id?: string;
  image_url?: string;
  status: 'active' | 'inactive';
  product_count: number;
  created_at: string;
  subcategories?: CategoryData[];
}

interface CategoryStats {
  totalCategories: number;
  activeCategories: number;
  totalSubcategories: number;
  totalProducts: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [stats, setStats] = useState<CategoryStats>({
    totalCategories: 0,
    activeCategories: 0,
    totalSubcategories: 0,
    totalProducts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCategories();
    loadStats();
  }, [searchTerm, filterStatus]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const result = await adminQueries.getCategories(searchTerm, filterStatus);
      setCategories(result || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
      // Fallback to mock data if Supabase fails
      const mockCategories: CategoryData[] = [
        {
          id: '1',
          name: 'Electronics',
          description: 'Electronic devices and accessories',
          status: 'active',
          product_count: 450,
          created_at: '2024-01-15T10:00:00Z',
          subcategories: [
            {
              id: '1-1',
              name: 'Smartphones',
              description: 'Mobile phones and accessories',
              parent_id: '1',
              status: 'active',
              product_count: 120,
              created_at: '2024-01-15T10:00:00Z',
            },
            {
              id: '1-2',
              name: 'Laptops',
              description: 'Laptops and computer accessories',
              parent_id: '1',
              status: 'active',
              product_count: 85,
              created_at: '2024-01-15T10:00:00Z',
            },
          ],
        },
        {
          id: '2',
          name: 'Clothing',
          description: 'Fashion and apparel',
          status: 'active',
          product_count: 320,
          created_at: '2024-01-16T10:00:00Z',
          subcategories: [
            {
              id: '2-1',
              name: "Men's Wear",
              description: 'Clothing for men',
              parent_id: '2',
              status: 'active',
              product_count: 150,
              created_at: '2024-01-16T10:00:00Z',
            },
            {
              id: '2-2',
              name: "Women's Wear",
              description: 'Clothing for women',
              parent_id: '2',
              status: 'active',
              product_count: 170,
              created_at: '2024-01-16T10:00:00Z',
            },
          ],
        },
        {
          id: '3',
          name: 'Home & Garden',
          description: 'Home improvement and garden supplies',
          status: 'active',
          product_count: 280,
          created_at: '2024-01-17T10:00:00Z',
          subcategories: [
            {
              id: '3-1',
              name: 'Furniture',
              description: 'Home furniture',
              parent_id: '3',
              status: 'active',
              product_count: 95,
              created_at: '2024-01-17T10:00:00Z',
            },
          ],
        },
      ];
      setCategories(mockCategories);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const categoryStats = await adminQueries.getCategoryStats();
      setStats(categoryStats);
    } catch (error) {
      console.error('Error loading stats:', error);
      // Fallback to mock stats
      setStats({
        totalCategories: 12,
        activeCategories: 11,
        totalSubcategories: 45,
        totalProducts: 1250,
      });
    }
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'success' : 'default';
  };

  const columns: GridColDef[] = [
    {
      field: 'image_url',
      headerName: 'Icon',
      width: 80,
      renderCell: (params: GridRenderCellParams) => (
        <Avatar
          src={params.value}
          alt={params.row.name}
          sx={{ width: 40, height: 40 }}
        >
          <Category />
        </Avatar>
      ),
    },
    {
      field: 'name',
      headerName: 'Category Name',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.description}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'product_count',
      headerName: 'Products',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value || 0}
          color="primary"
          variant="outlined"
          size="small"
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          color={getStatusColor(params.value)}
          size="small"
        />
      ),
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
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => {
              setSelectedCategory(params.row);
              setDialogOpen(true);
            }}
          >
            <Visibility />
          </IconButton>
          <IconButton size="small">
            <Edit />
          </IconButton>
          <IconButton size="small" color="error">
            <Delete />
          </IconButton>
        </Box>
      ),
    },
  ];

  // Flatten categories for DataGrid
  const flattenedCategories = Array.isArray(categories) ? categories.reduce((acc: CategoryData[], category) => {
    acc.push(category);
    if (category.subcategories && category.subcategories.length > 0) {
      acc.push(...category.subcategories);
    }
    return acc;
  }, [] as CategoryData[]) : [];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Category Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Organize your product catalog with categories and subcategories
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <Category />
                </Avatar>
                <Box>
                  <Typography variant="h6">{stats.totalCategories}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Categories
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
                  <Typography variant="h6">{stats.activeCategories}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Categories
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
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <Category />
                </Avatar>
                <Box>
                  <Typography variant="h6">{stats.totalSubcategories}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Subcategories
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
                  <Typography variant="h6">{stats.totalProducts}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Products
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Category Tree View */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Category Tree</Typography>
                <Button startIcon={<Add />} size="small">
                  Add Category
                </Button>
              </Box>
              <List>
                {Array.isArray(categories) && categories.map((category) => (
                  <React.Fragment key={category.id}>
                    <ListItem
                      button
                      onClick={() => toggleCategoryExpansion(category.id)}
                    >
                      <ListItemAvatar>
                        <Avatar>
                          <Category />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={category.name}
                        secondary={`${category.product_count} products`}
                      />
                      {category.subcategories && category.subcategories.length > 0 && (
                        expandedCategories.has(category.id) ? <ExpandLess /> : <ExpandMore />
                      )}
                    </ListItem>
                    {expandedCategories.has(category.id) && category.subcategories && (
                      <Box sx={{ pl: 4 }}>
                        {category.subcategories.map((subcategory) => (
                          <ListItem key={subcategory.id} sx={{ py: 0.5 }}>
                            <ListItemAvatar>
                              <Avatar sx={{ width: 32, height: 32 }}>
                                <Category fontSize="small" />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={subcategory.name}
                              secondary={`${subcategory.product_count} products`}
                              primaryTypographyProps={{ variant: 'body2' }}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItem>
                        ))}
                      </Box>
                    )}
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Categories Table */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              {/* Filters */}
              <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    placeholder="Search categories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="all">All Status</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => toast('Add category feature coming soon!')}
                  >
                    Add
                  </Button>
                </Grid>
              </Grid>

              <DataGrid
                rows={flattenedCategories}
                columns={columns}
                loading={loading}
                pageSizeOptions={[25, 50, 100]}
                initialState={{
                  pagination: {
                    paginationModel: { page: 0, pageSize: 25 },
                  },
                }}
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                    quickFilterProps: { debounceMs: 500 },
                  },
                }}
                sx={{ height: 500 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Category Details Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Category Details
        </DialogTitle>
        <DialogContent>
          {selectedCategory && (
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 60, height: 60 }}>
                  <Category />
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedCategory.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedCategory.description}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Statistics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      Products: {selectedCategory.product_count}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      Status: <Chip label={selectedCategory.status} size="small" />
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
              {selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Subcategories ({selectedCategory.subcategories.length})
                  </Typography>
                  <List dense>
                    {selectedCategory.subcategories.map((sub) => (
                      <ListItem key={sub.id}>
                        <ListItemText
                          primary={sub.name}
                          secondary={`${sub.product_count} products`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          <Button variant="contained">Edit Category</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}