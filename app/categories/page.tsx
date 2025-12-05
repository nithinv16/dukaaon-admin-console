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
  CircularProgress,
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
  DragIndicator,
  ShoppingCart,
  Close,
  CameraAlt,
  CloudUpload,
} from '@mui/icons-material';
import { adminQueries, queries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';
import {
  defaultCategorySubcategoryMap,
  generateMockCategoryData,
  calculateCategoryStats
} from '@/lib/categoryUtils';

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
  uncategorizedProducts?: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [stats, setStats] = useState<CategoryStats>({
    totalCategories: 0,
    activeCategories: 0,
    totalSubcategories: 0,
    totalProducts: 0,
    uncategorizedProducts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'category' | 'subcategory'>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Edit dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState<'category' | 'subcategory'>('category');
  const [editFormData, setEditFormData] = useState({ name: '', categoryId: '' });

  // Add dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addMode, setAddMode] = useState<'category' | 'subcategory'>('category');
  const [addFormData, setAddFormData] = useState({ name: '', categoryId: '' });

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'category' | 'subcategory'; name: string } | null>(null);

  // Add subcategory dialog
  const [addSubcategoryDialogOpen, setAddSubcategoryDialogOpen] = useState(false);
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] = useState<CategoryData | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');

  // Image upload states
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [imageUploadTarget, setImageUploadTarget] = useState<{ id: string; type: 'category' | 'subcategory'; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Drag and drop states
  const [draggedItem, setDraggedItem] = useState<{ type: 'product' | 'subcategory'; id: string; data: any } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ type: 'category' | 'subcategory'; id: string } | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showProductsPanel, setShowProductsPanel] = useState(false);
  const [selectedCategoryForProducts, setSelectedCategoryForProducts] = useState<string | null>(null);
  const [selectedSubcategoryForProducts, setSelectedSubcategoryForProducts] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
    loadStats();
  }, [searchTerm, filterStatus]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const result = await adminQueries.getCategories();
      // The API returns { categories: [...], subcategories: [...] }
      // Categories already have subcategories nested
      const categoriesData = result?.categories || [];
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await adminQueries.getCategoryStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats({
        totalCategories: 0,
        activeCategories: 0,
        totalSubcategories: 0,
        totalProducts: 0
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

  const handleEditCategory = (category: CategoryData) => {
    setEditMode('category');
    setEditFormData({ name: category.name, categoryId: '' });
    setSelectedCategory(category);
    setEditDialogOpen(true);
  };

  const handleEditSubcategory = (subcategory: CategoryData) => {
    setEditMode('subcategory');
    setEditFormData({ name: subcategory.name, categoryId: subcategory.parent_id || '' });
    setSelectedCategory(subcategory);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCategory || !editFormData.name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    try {
      if (editMode === 'category') {
        await adminQueries.updateCategory(selectedCategory.id, editFormData.name.trim());
        toast.success('Category updated successfully');
      } else {
        await adminQueries.updateSubcategory(selectedCategory.id, editFormData.name.trim(), editFormData.categoryId || undefined);
        toast.success('Subcategory updated successfully');
      }
      setEditDialogOpen(false);
      loadCategories();
      loadStats();
    } catch (error: any) {
      console.error('Error updating:', error);
      toast.error(error.message || 'Failed to update');
    }
  };

  const handleDeleteCategory = (category: CategoryData) => {
    setDeleteTarget({ id: category.id, type: 'category', name: category.name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteSubcategory = (subcategory: CategoryData) => {
    setDeleteTarget({ id: subcategory.id, type: 'subcategory', name: subcategory.name });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'category') {
        await adminQueries.deleteCategory(deleteTarget.id);
        toast.success('Category deleted successfully');
      } else {
        await adminQueries.deleteSubcategory(deleteTarget.id);
        toast.success('Subcategory deleted successfully');
      }
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadCategories();
      loadStats();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast.error(error.message || 'Failed to delete');
    }
  };

  const handleAddCategory = () => {
    setAddMode('category');
    setAddFormData({ name: '', categoryId: '' });
    setAddDialogOpen(true);
  };

  const handleAddSubcategory = (category: CategoryData) => {
    setSelectedCategoryForSubcategory(category);
    setNewSubcategoryName('');
    setAddSubcategoryDialogOpen(true);
  };

  const handleSaveAddCategory = async () => {
    if (!addFormData.name.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    try {
      await adminQueries.createCategory(addFormData.name.trim());
      toast.success('Category created successfully');
      setAddDialogOpen(false);
      loadCategories();
      loadStats();
    } catch (error: any) {
      console.error('Error creating category:', error);
      toast.error(error.message || 'Failed to create category');
    }
  };

  const handleSaveAddSubcategory = async () => {
    if (!newSubcategoryName.trim() || !selectedCategoryForSubcategory) {
      toast.error('Please enter a subcategory name');
      return;
    }

    try {
      await adminQueries.createSubcategory(newSubcategoryName.trim(), selectedCategoryForSubcategory.id);
      toast.success('Subcategory created successfully');
      setAddSubcategoryDialogOpen(false);
      setSelectedCategoryForSubcategory(null);
      setNewSubcategoryName('');
      // Expand the category to show the new subcategory
      setExpandedCategories(prev => new Set(prev).add(selectedCategoryForSubcategory.id));
      loadCategories();
      loadStats();
    } catch (error: any) {
      console.error('Error creating subcategory:', error);
      toast.error(error.message || 'Failed to create subcategory');
    }
  };

  // Load products for a category/subcategory
  const loadProducts = async (category?: string, subcategory?: string) => {
    try {
      setProductsLoading(true);
      const result = await adminQueries.getProductsByCategory(category, subcategory, 100);
      setProducts(result?.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, type: 'product' | 'subcategory', id: string, data: any) => {
    setDraggedItem({ type, id, data });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItem(null);
    setDragOverTarget(null);
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, type: 'category' | 'subcategory', id: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget({ type, id });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, targetType: 'category' | 'subcategory', targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);

    if (!draggedItem) return;

    try {
      if (draggedItem.type === 'product') {
        // Moving a product
        const targetCategory = categories.find(c => c.id === targetId);
        const targetSubcategory = categories
          .flatMap(c => c.subcategories || [])
          .find(s => s.id === targetId);

        if (targetType === 'category' && targetCategory) {
          await adminQueries.updateProductCategory(
            [draggedItem.id],
            targetCategory.name,
            null // Clear subcategory when moving to category
          );
          toast.success(`Product moved to ${targetCategory.name}`);
        } else if (targetType === 'subcategory' && targetSubcategory) {
          const parentCategory = categories.find(c =>
            c.subcategories?.some(s => s.id === targetId)
          );
          if (parentCategory) {
            await adminQueries.updateProductCategory(
              [draggedItem.id],
              parentCategory.name,
              targetSubcategory.name
            );
            toast.success(`Product moved to ${parentCategory.name} > ${targetSubcategory.name}`);
          }
        }

        // Reload products if panel is open
        if (showProductsPanel) {
          loadProducts(selectedCategoryForProducts || undefined, selectedSubcategoryForProducts || undefined);
        }
      } else if (draggedItem.type === 'subcategory') {
        // Moving a subcategory
        if (targetType === 'category') {
          await adminQueries.moveSubcategory(draggedItem.id, targetId);
          toast.success('Subcategory moved successfully');
        } else {
          toast.error('Subcategories can only be moved to categories, not to other subcategories');
          return;
        }
      }

      // Reload categories to reflect changes
      loadCategories();
      loadStats();
      setDraggedItem(null);
    } catch (error: any) {
      console.error('Error handling drop:', error);
      toast.error(error.message || 'Failed to move item');
      setDraggedItem(null);
    }
  };

  const handleCategoryClick = (category: CategoryData) => {
    setSelectedCategoryForProducts(category.name);
    setSelectedSubcategoryForProducts(null);
    setShowProductsPanel(true);
    loadProducts(category.name, undefined);
  };

  const handleSubcategoryClick = (subcategory: CategoryData, parentCategory: CategoryData) => {
    setSelectedCategoryForProducts(parentCategory.name);
    setSelectedSubcategoryForProducts(subcategory.name);
    setShowProductsPanel(true);
    loadProducts(parentCategory.name, subcategory.name);
  };

  // Image upload handlers
  const handleImageClick = (row: CategoryData) => {
    const isSubcategory = !!row.parent_id;
    setImageUploadTarget({
      id: row.id,
      type: isSubcategory ? 'subcategory' : 'category',
      name: row.name,
    });
    // Trigger file input click
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !imageUploadTarget) {
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Allowed: JPEG, PNG, WebP, GIF, SVG');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size exceeds 2MB limit');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('id', imageUploadTarget.id);
      formData.append('type', imageUploadTarget.type);

      const response = await fetch('/api/upload-category-image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload image');
      }

      toast.success(`${imageUploadTarget.type === 'category' ? 'Category' : 'Subcategory'} icon updated!`);

      // Reload categories to show the new image
      loadCategories();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      setImageUploadTarget(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'success' : 'default';
  };

  const columns: GridColDef[] = [
    {
      field: 'type',
      headerName: 'Type',
      width: 120,
      minWidth: 100,
      flex: 0,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => {
        const isSubcategory = !!params.row.parent_id;
        return (
          <Chip
            label={isSubcategory ? 'Subcategory' : 'Category'}
            color={isSubcategory ? 'secondary' : 'primary'}
            size="small"
            variant="filled"
          />
        );
      },
    },
    {
      field: 'image_url',
      headerName: 'Icon',
      width: 80,
      minWidth: 60,
      flex: 0,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => {
        const isSubcategory = !!params.row.parent_id;
        const isUploading = uploading && imageUploadTarget?.id === params.row.id;
        return (
          <Box
            sx={{
              position: 'relative',
              cursor: 'pointer',
              '&:hover': {
                '& .upload-overlay': {
                  opacity: 1,
                },
              },
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleImageClick(params.row);
            }}
            title="Click to upload icon"
          >
            <Avatar
              src={params.value}
              alt={params.row.name}
              sx={{
                width: 40,
                height: 40,
                bgcolor: isSubcategory ? 'secondary.main' : 'primary.main',
                opacity: isUploading ? 0.5 : 1,
              }}
            >
              <Category />
            </Avatar>
            {isUploading ? (
              <CircularProgress
                size={20}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  marginTop: '-10px',
                  marginLeft: '-10px',
                }}
              />
            ) : (
              <Box
                className="upload-overlay"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  bgcolor: 'rgba(0, 0, 0, 0.5)',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                }}
              >
                <CameraAlt sx={{ color: 'white', fontSize: 18 }} />
              </Box>
            )}
          </Box>
        );
      },
    },
    {
      field: 'name',
      headerName: 'Name',
      minWidth: 180,
      flex: 1,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => {
        const isSubcategory = !!params.row.parent_id;
        const parentCategory = isSubcategory
          ? categories.find(c => c.subcategories?.some(s => s.id === params.row.id))
          : null;

        return (
          <Box sx={{ pl: isSubcategory ? 4 : 0 }}>
            {isSubcategory && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {parentCategory?.name || 'Parent Category'}
              </Typography>
            )}
            <Typography
              variant="body2"
              fontWeight={isSubcategory ? "regular" : "medium"}
              noWrap
              sx={{
                fontStyle: isSubcategory ? 'italic' : 'normal',
                color: isSubcategory ? 'text.secondary' : 'text.primary'
              }}
            >
              {isSubcategory && '↳ '}
              {params.value}
            </Typography>
            {params.row.description && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {params.row.description}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'product_count',
      headerName: 'Products',
      width: 120,
      minWidth: 100,
      flex: 0,
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
      minWidth: 100,
      flex: 0,
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
      width: 150,
      renderCell: (params: GridRenderCellParams) => {
        const isSubcategory = !!params.row.parent_id;
        return (
          <Box>
            <IconButton
              size="small"
              onClick={() => {
                setSelectedCategory(params.row);
                setDialogOpen(true);
              }}
              title="View details"
            >
              <Visibility />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => {
                if (isSubcategory) {
                  handleEditSubcategory(params.row);
                } else {
                  handleEditCategory(params.row);
                }
              }}
              title="Edit"
            >
              <Edit />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                if (isSubcategory) {
                  handleDeleteSubcategory(params.row);
                } else {
                  handleDeleteCategory(params.row);
                }
              }}
              title="Delete"
            >
              <Delete />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  // Prepare data for DataGrid - separate categories and subcategories but show them together
  let flattenedCategories = Array.isArray(categories) ? categories.reduce((acc: any[], category) => {
    // Add category first
    acc.push({
      ...category,
      parent_id: undefined, // Ensure no parent_id for categories
      type: 'category', // Add type field for sorting/filtering
      typeSort: 0, // Sort order: categories first
    });
    // Then add its subcategories
    if (category.subcategories && category.subcategories.length > 0) {
      acc.push(...category.subcategories.map(sub => ({
        ...sub,
        parent_id: category.id, // Ensure parent_id is set
        type: 'subcategory', // Add type field for sorting/filtering
        typeSort: 1, // Sort order: subcategories second
      })));
    }
    return acc;
  }, [] as any[]) : [];

  // Filter by type if needed
  if (filterType !== 'all') {
    flattenedCategories = flattenedCategories.filter(item => {
      const isSubcategory = !!item.parent_id;
      if (filterType === 'category') return !isSubcategory;
      if (filterType === 'subcategory') return isSubcategory;
      return true;
    });
  }

  // Filter by status if needed
  if (filterStatus !== 'all') {
    flattenedCategories = flattenedCategories.filter(item => item.status === filterStatus);
  }

  // Filter by search term if needed
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    flattenedCategories = flattenedCategories.filter(item =>
      item.name.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower)
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Hidden file input for image uploads */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        onChange={handleImageUpload}
      />

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
        <Grid item xs={12} md={showProductsPanel ? 3 : 4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Category Tree</Typography>
                <Button startIcon={<Add />} size="small" onClick={handleAddCategory}>
                  Add Category
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                💡 Drag products and subcategories to reorganize. Click categories/subcategories to view products.
              </Typography>
              <List>
                {Array.isArray(categories) && categories.map((category) => (
                  <React.Fragment key={category.id}>
                    <ListItem
                      button
                      onClick={() => {
                        toggleCategoryExpansion(category.id);
                        handleCategoryClick(category);
                      }}
                      onDragOver={(e) => handleDragOver(e, 'category', category.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'category', category.id)}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: dragOverTarget?.type === 'category' && dragOverTarget?.id === category.id
                          ? 'action.selected'
                          : 'transparent',
                        border: dragOverTarget?.type === 'category' && dragOverTarget?.id === category.id
                          ? '2px dashed'
                          : 'none',
                        borderColor: dragOverTarget?.type === 'category' && dragOverTarget?.id === category.id
                          ? 'primary.main'
                          : 'transparent',
                        borderRadius: 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <ListItemAvatar>
                        <Box
                          sx={{
                            position: 'relative',
                            cursor: 'pointer',
                            '&:hover': {
                              '& .sidebar-upload-overlay': { opacity: 1 },
                            },
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageClick(category);
                          }}
                          title="Click to upload icon"
                        >
                          <Avatar src={category.image_url}>
                            <Category />
                          </Avatar>
                          <Box
                            className="sidebar-upload-overlay"
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                              bgcolor: 'rgba(0, 0, 0, 0.5)',
                              opacity: 0,
                              transition: 'opacity 0.2s',
                            }}
                          >
                            <CameraAlt sx={{ color: 'white', fontSize: 16 }} />
                          </Box>
                        </Box>
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
                          <ListItem
                            key={subcategory.id}
                            sx={{
                              py: 0.5,
                              cursor: 'move',
                              backgroundColor: dragOverTarget?.type === 'subcategory' && dragOverTarget?.id === subcategory.id
                                ? 'action.selected'
                                : 'transparent',
                              border: dragOverTarget?.type === 'subcategory' && dragOverTarget?.id === subcategory.id
                                ? '2px dashed'
                                : 'none',
                              borderColor: dragOverTarget?.type === 'subcategory' && dragOverTarget?.id === subcategory.id
                                ? 'primary.main'
                                : 'transparent',
                              borderRadius: 1,
                              transition: 'all 0.2s ease',
                            }}
                            draggable
                            onDragStart={(e) => handleDragStart(e, 'subcategory', subcategory.id, subcategory)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDragOver(e, 'subcategory', subcategory.id);
                            }}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDrop(e, 'subcategory', subcategory.id);
                            }}
                            onClick={() => handleSubcategoryClick(subcategory, category)}
                            secondaryAction={
                              <Box>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditSubcategory(subcategory);
                                  }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSubcategory(subcategory);
                                  }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Box>
                            }
                          >
                            <ListItemAvatar>
                              <Box
                                sx={{
                                  position: 'relative',
                                  cursor: 'pointer',
                                  '&:hover': {
                                    '& .sub-upload-overlay': { opacity: 1 },
                                  },
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Add parent_id to subcategory for proper type detection
                                  handleImageClick({ ...subcategory, parent_id: category.id });
                                }}
                                title="Click to upload icon"
                              >
                                <Avatar src={subcategory.image_url} sx={{ width: 32, height: 32 }}>
                                  <DragIndicator fontSize="small" sx={{ cursor: 'move' }} />
                                </Avatar>
                                <Box
                                  className="sub-upload-overlay"
                                  sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: 32,
                                    height: 32,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    bgcolor: 'rgba(0, 0, 0, 0.5)',
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                  }}
                                >
                                  <CameraAlt sx={{ color: 'white', fontSize: 14 }} />
                                </Box>
                              </Box>
                            </ListItemAvatar>
                            <ListItemText
                              primary={subcategory.name}
                              secondary={`${subcategory.product_count} products`}
                              primaryTypographyProps={{ variant: 'body2' }}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItem>
                        ))}
                        <Box sx={{ pl: 2, py: 1 }}>
                          <Button
                            size="small"
                            startIcon={<Add />}
                            onClick={() => handleAddSubcategory(category)}
                            sx={{ fontSize: '0.75rem' }}
                          >
                            Add Subcategory
                          </Button>
                        </Box>
                      </Box>
                    )}
                    {expandedCategories.has(category.id) && (!category.subcategories || category.subcategories.length === 0) && (
                      <Box sx={{ pl: 4, py: 1 }}>
                        <Button
                          size="small"
                          startIcon={<Add />}
                          onClick={() => handleAddSubcategory(category)}
                          sx={{ fontSize: '0.75rem' }}
                        >
                          Add Subcategory
                        </Button>
                      </Box>
                    )}
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Products Panel */}
        {showProductsPanel && (
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Products
                    {selectedSubcategoryForProducts && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {selectedCategoryForProducts} &gt; {selectedSubcategoryForProducts}
                      </Typography>
                    )}
                    {!selectedSubcategoryForProducts && selectedCategoryForProducts && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {selectedCategoryForProducts}
                      </Typography>
                    )}
                  </Typography>
                  <IconButton size="small" onClick={() => setShowProductsPanel(false)}>
                    <Close />
                  </IconButton>
                </Box>
                {productsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : products.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 3 }}>
                    No products found
                  </Typography>
                ) : (
                  <List dense sx={{ maxHeight: 600, overflow: 'auto' }}>
                    {products.map((product: any) => (
                      <ListItem
                        key={product.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'product', product.id, product)}
                        onDragEnd={handleDragEnd}
                        sx={{
                          cursor: 'move',
                          mb: 0.5,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar
                            src={product.image_url}
                            sx={{ width: 40, height: 40 }}
                          >
                            <ShoppingCart />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <DragIndicator fontSize="small" sx={{ color: 'text.secondary' }} />
                              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                                {product.name}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              ₹{product.price || 0} • Stock: {product.stock_available || 0}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Categories Table */}
        <Grid item xs={12} md={showProductsPanel ? 6 : 8}>
          <Card>
            <CardContent>
              {/* Filters */}
              <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4} md={4}>
                  <TextField
                    fullWidth
                    placeholder="Search categories..."
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
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as 'all' | 'category' | 'subcategory')}
                      label="Type"
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="category">Categories</MenuItem>
                      <MenuItem value="subcategory">Subcategories</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={2} md={2}>
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
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3} md={4}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Add />}
                    size="small"
                    onClick={handleAddCategory}
                    sx={{
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    }}
                  >
                    Add Category
                  </Button>
                </Grid>
              </Grid>

              <DataGrid
                rows={flattenedCategories}
                columns={columns}
                loading={loading}
                pageSizeOptions={[10, 25, 50, 100]}
                getRowId={(row) => row.id}
                initialState={{
                  pagination: {
                    paginationModel: { page: 0, pageSize: 25 },
                  },
                  sorting: {
                    sortModel: [
                      { field: 'typeSort', sort: 'asc' }, // Categories first (0), then subcategories (1)
                      { field: 'name', sort: 'asc' },
                    ],
                  },
                  columns: {
                    columnVisibilityModel: {
                      created_at: false, // Hide on mobile by default
                    },
                  },
                }}
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                    quickFilterProps: { debounceMs: 500 },
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
                    '& .MuiDataGrid-row': {
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                      // Style subcategories differently
                      '&[data-subcategory="true"]': {
                        backgroundColor: 'action.hover',
                      },
                    },
                  },
                  '& .MuiDataGrid-toolbarContainer': {
                    padding: { xs: 1, sm: 2 },
                    '& .MuiButton-root': {
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    },
                  },
                }}
                getRowClassName={(params) => {
                  return params.row.parent_id ? 'subcategory-row' : 'category-row';
                }}
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
          {selectedCategory && !selectedCategory.parent_id && (
            <Button
              variant="contained"
              onClick={() => {
                setDialogOpen(false);
                handleEditCategory(selectedCategory);
              }}
            >
              Edit Category
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit {editMode === 'category' ? 'Category' : 'Subcategory'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={editFormData.name}
              onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              autoFocus
            />
            {editMode === 'subcategory' && (
              <FormControl fullWidth>
                <InputLabel>Parent Category</InputLabel>
                <Select
                  value={editFormData.categoryId}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                  label="Parent Category"
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add New Category
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Category Name"
              value={addFormData.name}
              onChange={(e) => setAddFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              autoFocus
              placeholder="Enter category name"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAddCategory}>Add Category</Button>
        </DialogActions>
      </Dialog>

      {/* Add Subcategory Dialog */}
      <Dialog open={addSubcategoryDialogOpen} onClose={() => {
        setAddSubcategoryDialogOpen(false);
        setSelectedCategoryForSubcategory(null);
        setNewSubcategoryName('');
      }} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add Subcategory to {selectedCategoryForSubcategory?.name}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Subcategory Name"
              value={newSubcategoryName}
              onChange={(e) => setNewSubcategoryName(e.target.value)}
              fullWidth
              required
              autoFocus
              placeholder="Enter subcategory name"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddSubcategoryDialogOpen(false);
            setSelectedCategoryForSubcategory(null);
            setNewSubcategoryName('');
          }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAddSubcategory}>Add Subcategory</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => {
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
      }}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this {deleteTarget?.type}?
            <br />
            <strong>{deleteTarget?.name}</strong>
            <br />
            {deleteTarget?.type === 'category' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Note: You cannot delete a category that has subcategories. Please delete or move subcategories first.
              </Alert>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
          }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}