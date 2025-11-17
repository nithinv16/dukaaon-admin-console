'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid';
import {
  Add,
  Edit,
  Delete,
  Save,
  Person,
  Security,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  role_id?: string;
  status: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

export default function AdminUsersPage() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  useEffect(() => {
    loadAdminUsers();
    loadRoles();
  }, []);

  const loadAdminUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/admin-users');
      if (response.ok) {
        const data = await response.json();
        setAdminUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading admin users:', error);
      toast.error('Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await fetch('/api/admin/roles');
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setSelectedRoleId(user.role_id || '');
    setEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/admin/admin-users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: selectedRoleId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update admin user');
      }

      toast.success('Admin user updated successfully!');
      setEditDialogOpen(false);
      setEditingUser(null);
      loadAdminUsers();
    } catch (error: any) {
      console.error('Error updating admin user:', error);
      toast.error(error.message || 'Failed to update admin user');
    } finally {
      setLoading(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'role',
      headerName: 'Role (Legacy)',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value || 'N/A'} size="small" />
      ),
    },
    {
      field: 'role_name',
      headerName: 'Assigned Role',
      width: 200,
      renderCell: (params: GridRenderCellParams) => {
        const roleName = params.row.role_name;
        return roleName ? (
          <Chip label={roleName} color="primary" size="small" />
        ) : (
          <Chip label="No Role Assigned" color="default" size="small" />
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          color={params.value === 'active' ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'last_login',
      headerName: 'Last Login',
      width: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value ? new Date(params.value).toLocaleString() : 'Never'}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton
          size="small"
          color="primary"
          onClick={() => handleEditUser(params.row)}
        >
          <Edit />
        </IconButton>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Admin Users</Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Manage admin users and assign roles. The legacy 'role' text field is kept for backward compatibility.
        Use 'Assigned Role' to assign roles from the Roles & Permissions system.
      </Alert>

      <Card>
        <CardContent>
          <DataGrid
            rows={adminUsers}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingUser(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Admin User</DialogTitle>
        <DialogContent>
          {editingUser && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={editingUser.name}
                disabled
                fullWidth
              />
              <TextField
                label="Email"
                value={editingUser.email}
                disabled
                fullWidth
              />
              <TextField
                label="Legacy Role"
                value={editingUser.role}
                disabled
                fullWidth
                helperText="This is the legacy role field. Use 'Assigned Role' for RBAC."
              />
              <FormControl fullWidth>
                <InputLabel>Assigned Role</InputLabel>
                <Select
                  value={selectedRoleId}
                  label="Assigned Role"
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                >
                  <MenuItem value="">No Role Assigned</MenuItem>
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name} - {role.description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            setEditingUser(null);
          }}>
            Cancel
          </Button>
          <Button onClick={handleSaveUser} variant="contained" startIcon={<Save />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

