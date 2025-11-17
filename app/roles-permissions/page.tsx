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
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
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

interface Permission {
  resource: string;
  actions: string[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

const RESOURCES = [
  'users',
  'orders',
  'products',
  'categories',
  'payments',
  'analytics',
  'settings',
  'templates',
  'bulk_operations',
  'database_tools',
  'audit_log',
  'dynamic_content',
  'messages',
];

const ACTIONS = ['view', 'create', 'update', 'delete', 'export', 'manage'];

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/roles');
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '' });
    setPermissions({});
    setEditDialogOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description,
    });
    // Convert permissions to state format
    const perms: Record<string, string[]> = {};
    role.permissions.forEach((perm) => {
      perms[perm.resource] = perm.actions;
    });
    setPermissions(perms);
    setEditDialogOpen(true);
  };

  const handleSaveRole = async () => {
    try {
      setLoading(true);
      // Convert permissions to API format
      const permissionsArray: Permission[] = Object.entries(permissions)
        .filter(([_, actions]) => actions.length > 0)
        .map(([resource, actions]) => ({
          resource,
          actions,
        }));

      const url = editingRole
        ? `/api/admin/roles/${editingRole.id}`
        : '/api/admin/roles';
      const method = editingRole ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          permissions: permissionsArray,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save role');
      }

      toast.success(`Role ${editingRole ? 'updated' : 'created'} successfully!`);
      setEditDialogOpen(false);
      loadRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      toast.error(error.message || 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      const response = await fetch(`/api/admin/roles/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete role');
      }

      toast.success('Role deleted successfully!');
      loadRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error(error.message || 'Failed to delete role');
    }
  };

  const togglePermission = (resource: string, action: string) => {
    const currentActions = permissions[resource] || [];
    if (currentActions.includes(action)) {
      setPermissions({
        ...permissions,
        [resource]: currentActions.filter((a) => a !== action),
      });
    } else {
      setPermissions({
        ...permissions,
        [resource]: [...currentActions, action],
      });
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Role Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'permissions',
      headerName: 'Permissions',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={`${params.value?.length || 0} resources`}
          size="small"
        />
      ),
    },
    {
      field: 'is_system',
      headerName: 'Type',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'System' : 'Custom'}
          color={params.value ? 'primary' : 'default'}
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
          {!params.row.is_system && (
            <>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleEditRole(params.row)}
              >
                <Edit />
              </IconButton>
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteRole(params.row.id)}
              >
                <Delete />
              </IconButton>
            </>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Roles & Permissions</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateRole}
        >
          Create Role
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Manage roles and permissions for admin users. System roles cannot be modified or deleted.
      </Alert>

      <Card>
        <CardContent>
          <DataGrid
            rows={roles}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingRole ? 'Edit Role' : 'Create Role'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Role Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />

            <Divider />

            <Typography variant="h6">Permissions</Typography>
            <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
              {RESOURCES.map((resource) => (
                <Box key={resource} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {resource.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {ACTIONS.map((action) => (
                      <FormControlLabel
                        key={action}
                        control={
                          <Checkbox
                            checked={(permissions[resource] || []).includes(action)}
                            onChange={() => togglePermission(resource, action)}
                            size="small"
                          />
                        }
                        label={action}
                      />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveRole} variant="contained" startIcon={<Save />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

