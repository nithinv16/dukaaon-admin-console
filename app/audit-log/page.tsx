'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  Stack,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid';
import {
  History,
  Person,
  ShoppingCart,
  Inventory,
  Settings,
  Campaign,
  Warning,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalLogs, setTotalLogs] = useState(0);
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');

  useEffect(() => {
    loadAuditLog();
  }, [page, pageSize, filterAction, filterEntity]);

  const loadAuditLog = async () => {
    try {
      setLoading(true);
      const result = await adminQueries.getAuditLog({
        page: page + 1,
        limit: pageSize,
        action: filterAction === 'all' ? undefined : filterAction,
        entity_type: filterEntity === 'all' ? undefined : filterEntity,
      });
      setLogs(result.logs || []);
      setTotalLogs(result.total || 0);
    } catch (error) {
      console.error('Error loading audit log:', error);
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('user')) return <Person />;
    if (action.includes('order')) return <ShoppingCart />;
    if (action.includes('product')) return <Inventory />;
    if (action.includes('config') || action.includes('flag')) return <Settings />;
    if (action.includes('content')) return <Campaign />;
    if (action.includes('message') || action.includes('warning')) return <Warning />;
    return <History />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete')) return 'error';
    if (action.includes('update') || action.includes('edit')) return 'warning';
    if (action.includes('create') || action.includes('add')) return 'success';
    return 'default';
  };

  const columns: GridColDef[] = [
    {
      field: 'created_at',
      headerName: 'Time',
      width: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleString()}
        </Typography>
      ),
    },
    {
      field: 'admin_credentials',
      headerName: 'Admin',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value?.name || params.value?.email || 'Unknown'}
        </Typography>
      ),
    },
    {
      field: 'action',
      headerName: 'Action',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          icon={getActionIcon(params.value)}
          label={params.value}
          color={getActionColor(params.value) as any}
          size="small"
        />
      ),
    },
    {
      field: 'entity_type',
      headerName: 'Entity',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: 'entity_id',
      headerName: 'Entity ID',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
          {params.value ? `#${params.value.slice(-8)}` : 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'before_data',
      headerName: 'Before',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        params.value ? (
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            {JSON.stringify(params.value).substring(0, 50)}...
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">—</Typography>
        )
      ),
    },
    {
      field: 'after_data',
      headerName: 'After',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        params.value ? (
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            {JSON.stringify(params.value).substring(0, 50)}...
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">—</Typography>
        )
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" gutterBottom>
        Audit Log
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Track all admin actions and changes made to the system
      </Typography>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Action</InputLabel>
                <Select
                  value={filterAction}
                  label="Filter by Action"
                  onChange={(e) => setFilterAction(e.target.value)}
                >
                  <MenuItem value="all">All Actions</MenuItem>
                  <MenuItem value="update_user">Update User</MenuItem>
                  <MenuItem value="delete_user">Delete User</MenuItem>
                  <MenuItem value="update_order">Update Order</MenuItem>
                  <MenuItem value="update_product">Update Product</MenuItem>
                  <MenuItem value="change_feature_flag">Change Feature Flag</MenuItem>
                  <MenuItem value="save_config">Save Config</MenuItem>
                  <MenuItem value="send_warning">Send Warning</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Entity</InputLabel>
                <Select
                  value={filterEntity}
                  label="Filter by Entity"
                  onChange={(e) => setFilterEntity(e.target.value)}
                >
                  <MenuItem value="all">All Entities</MenuItem>
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="order">Order</MenuItem>
                  <MenuItem value="product">Product</MenuItem>
                  <MenuItem value="config">Config</MenuItem>
                  <MenuItem value="content">Content</MenuItem>
                  <MenuItem value="message">Message</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">
                Total Logs: {totalLogs}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardContent>
          <DataGrid
            rows={logs}
            columns={columns}
            loading={loading}
            pageSizeOptions={[25, 50, 100]}
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            rowCount={totalLogs}
            paginationMode="server"
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            getRowId={(row) => row.id}
            initialState={{
              sorting: {
                sortModel: [{ field: 'created_at', sort: 'desc' }],
              },
            }}
          />
        </CardContent>
      </Card>
    </Box>
  );
}

