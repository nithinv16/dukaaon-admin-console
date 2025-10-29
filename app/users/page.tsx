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
  Avatar,
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
  Pagination,
  Stack,
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
  FilterList,
  PersonAdd,
  Edit,
  Delete,
  Visibility,
  Block,
  CheckCircle,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import { User } from '@/types';
import toast from 'react-hot-toast';

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  pendingKyc: number;
  blockedUsers: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingKyc: 0,
    blockedUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [updating, setUpdating] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    loadUsers();
    loadStats();
  }, [page, pageSize, searchTerm, filterStatus]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await adminQueries.getAllUsers();
      
      if (result.error) {
        console.error('Error loading users:', result.error);
        toast.error('Failed to load users');
        setUsers([]);
      } else {
        setUsers(result.data || []);
        console.log('Loaded users:', result.data); // Debug log
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const analytics = await adminQueries.getAnalytics();
      if (analytics) {
        setStats({
          totalUsers: analytics.totalUsers,
          activeUsers: analytics.activeUsers,
          pendingKyc: analytics.pendingKyc || 0,
          blockedUsers: analytics.blockedUsers || 0,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleUserAction = async (userId: string, action: 'block' | 'unblock' | 'delete') => {
    try {
      // Implementation would depend on your Supabase schema
      // This is a placeholder for the actual implementation
      toast.success(`User ${action}ed successfully`);
      loadUsers();
      loadStats();
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      toast.error(`Failed to ${action} user`);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser({ ...user });
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      setUpdating(true);
      // TODO: Implement updateUser method in adminQueries
      // const result = await adminQueries.updateUser(editingUser.id, {
      //   phone_number: editingUser.phone_number,
      //   status: editingUser.status,
      //   // kyc_status: editingUser.kyc_status,
      //   // business_details: editingUser.business_details,
      //   // profile_image_url: editingUser.profile_image_url
      // });
      const result = { error: null, data: editingUser };

      if (result.error) {
        throw result.error;
      }

      toast.success('User updated successfully!');
      setEditDialogOpen(false);
      setEditingUser(null);
      loadUsers();
      loadStats();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns: GridColDef[] = [
    // {
    //   field: 'profile_image_url',
    //   headerName: 'Avatar',
    //   width: 80,
    //   minWidth: 60,
    //   flex: 0,
    //   hideable: false,
    //   renderCell: (params: GridRenderCellParams) => (
    //     <Avatar
    //       src={params.value}
    //       alt={params.row.business_details?.shopName || 'User'}
    //       sx={{ width: 40, height: 40 }}
    //     >
    //       {(params.row.business_details?.shopName || 'U')[0].toUpperCase()}
    //     </Avatar>
    //   ),
    // },
    {
      field: 'display_name',
      headerName: 'Business Name',
      minWidth: 150,
      flex: 1,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" noWrap>
          {params.value || 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'user_type',
      headerName: 'User Type',
      width: 120,
      minWidth: 100,
      flex: 0,
      hideable: true,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value === 'manufacturer' ? 'Manufacturer' : 
                 params.value === 'wholesaler' ? 'Wholesaler' : 
                 params.value === 'retailer' ? 'Retailer' : 'Unknown'}
          color={params.value === 'manufacturer' ? 'primary' : 
                 params.value === 'wholesaler' ? 'secondary' : 
                 params.value === 'retailer' ? 'info' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'phone_number',
      headerName: 'Phone',
      width: 150,
      minWidth: 120,
      flex: 0,
      hideable: true,
    },
    {
      field: 'kyc_status',
      headerName: 'KYC Status',
      width: 120,
      minWidth: 100,
      flex: 0,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value || 'pending'}
          color={getStatusColor(params.value)}
          size="small"
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Joined',
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
      width: 200,
      minWidth: 150,
      flex: 0,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => {
              setSelectedUser(params.row);
              setDialogOpen(true);
            }}
          >
            <Visibility />
          </IconButton>
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleEditUser(params.row)}
          >
            <Edit />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleUserAction(params.row.id, 'block')}
          >
            <Block />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleUserAction(params.row.id, 'delete')}
          >
            <Delete />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Users
              </Typography>
              <Typography variant="h4">{stats.totalUsers}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Users
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats.activeUsers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Pending KYC
              </Typography>
              <Typography variant="h4" color="warning.main">
                {stats.pendingKyc}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Blocked Users
              </Typography>
              <Typography variant="h4" color="error.main">
                {stats.blockedUsers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status Filter"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All Users</MenuItem>
                  <MenuItem value="verified">Verified</MenuItem>
                  <MenuItem value="pending">Pending KYC</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterList />}
                size="small"
                onClick={loadUsers}
                sx={{
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                }}
              >
                Apply Filters
              </Button>
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<PersonAdd />}
                size="small"
                onClick={() => {
                  // Handle add user
                  toast('Add user functionality coming soon');
                }}
                sx={{
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                }}
              >
                Add User
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent>
          <DataGrid
            rows={users}
            columns={columns}
            loading={loading}
            pageSizeOptions={[10, 25, 50, 100]}
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            getRowId={(row) => row.id}
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
                  user_type: false,    // Hide on mobile by default
                  phone_number: false, // Hide on mobile by default
                  created_at: false,   // Hide on mobile by default
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

      {/* User Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          User Details
          {/* {selectedUser && (
            <Chip
              label={selectedUser.kyc_status || 'pending'}
              color={getStatusColor(selectedUser.kyc_status)}
              sx={{ ml: 2 }}
            />
          )} */}
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {/* <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Shop Name
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {selectedUser.business_details?.shopName || 'N/A'}
                </Typography>
              </Grid> */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Phone Number
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {selectedUser.phone_number}
                </Typography>
              </Grid>
              {/* <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Address
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {selectedUser.business_details?.address || 'N/A'}
                </Typography>
              </Grid> */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Joined Date
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {new Date(selectedUser.created_at).toLocaleDateString()}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Last Updated
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {new Date(selectedUser.updated_at).toLocaleDateString()}
                </Typography>
              </Grid>
              {/* {selectedUser.documents && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Documents
                  </Typography>
                  <Alert severity="info">
                    KYC documents are available for review
                  </Alert>
                </Grid>
              )} */}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => {
              if (selectedUser) {
                handleEditUser(selectedUser);
                setDialogOpen(false);
              }
            }}
          >
            Edit User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Edit User Details
          {editingUser && (
            <Chip
              label={editingUser.role}
              color="primary"
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {editingUser && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Phone Number"
                  value={editingUser.phone_number || ''}
                  onChange={(e) => setEditingUser(prev => prev ? {
                    ...prev,
                    phone_number: e.target.value
                  } : null)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editingUser.status || 'active'}
                    label="Status"
                    onChange={(e) => setEditingUser(prev => prev ? {
                      ...prev,
                      status: e.target.value as 'active' | 'inactive' | 'suspended'
                    } : null)}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="suspended">Suspended</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {/* <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>KYC Status</InputLabel>
                  <Select
                    value={editingUser.kyc_status || 'pending'}
                    label="KYC Status"
                    onChange={(e) => setEditingUser(prev => prev ? {
                      ...prev,
                      kyc_status: e.target.value as 'pending' | 'verified' | 'rejected'
                    } : null)}
                  >
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="verified">Verified</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                  </Select>
                </FormControl>
              </Grid> */}
              {/* <Grid item xs={12} md={6}>
                <TextField
                  label="Business/Shop Name"
                  value={editingUser.business_details?.shopName || ''}
                  onChange={(e) => setEditingUser(prev => prev ? {
                    ...prev,
                    business_details: {
                      ...prev.business_details,
                      shopName: e.target.value
                    }
                  } : null)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Address"
                  value={editingUser.business_details?.address || ''}
                  onChange={(e) => setEditingUser(prev => prev ? {
                    ...prev,
                    business_details: {
                      ...prev.business_details,
                      address: e.target.value
                    }
                  } : null)}
                  fullWidth
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Latitude"
                  type="number"
                  value={editingUser.business_details?.latitude || ''}
                  onChange={(e) => setEditingUser(prev => prev ? {
                    ...prev,
                    business_details: {
                      ...prev.business_details,
                      latitude: parseFloat(e.target.value) || undefined
                    }
                  } : null)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Longitude"
                  type="number"
                  value={editingUser.business_details?.longitude || ''}
                  onChange={(e) => setEditingUser(prev => prev ? {
                    ...prev,
                    business_details: {
                      ...prev.business_details,
                      longitude: parseFloat(e.target.value) || undefined
                    }
                  } : null)}
                  fullWidth
                />
              </Grid> */}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpdateUser}
            variant="contained"
            disabled={updating}
            startIcon={updating ? <CircularProgress size={20} /> : <Edit />}
          >
            {updating ? 'Updating...' : 'Update User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}