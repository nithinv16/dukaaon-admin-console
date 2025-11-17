'use client';

import React, { useState } from 'react';
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
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Upload,
  Download,
  People,
  Inventory,
  ShoppingCart,
  CheckCircle,
  Warning,
  Delete,
  Edit,
  Send,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function BulkOperationsPage() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [operation, setOperation] = useState('');
  const [operationValue, setOperationValue] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);

  const handleBulkUserOperation = async () => {
    if (!operation || selectedUsers.length === 0) {
      toast.error('Please select users and an operation');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/bulk/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: selectedUsers,
          operation,
          value: operationValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Bulk operation failed');
      }

      const result = await response.json();
      toast.success(`Successfully updated ${result.updated} users`);
      setSelectedUsers([]);
      setOperation('');
      setOperationValue('');
    } catch (error: any) {
      console.error('Error performing bulk operation:', error);
      toast.error(error.message || 'Failed to perform bulk operation');
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  };

  const handleBulkProductOperation = async () => {
    if (!operation || selectedProducts.length === 0) {
      toast.error('Please select products and an operation');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/bulk/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_ids: selectedProducts,
          operation,
          value: operationValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Bulk operation failed');
      }

      const result = await response.json();
      toast.success(`Successfully updated ${result.updated} products`);
      setSelectedProducts([]);
      setOperation('');
      setOperationValue('');
    } catch (error: any) {
      console.error('Error performing bulk operation:', error);
      toast.error(error.message || 'Failed to perform bulk operation');
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  };

  const handleBulkOrderOperation = async () => {
    if (!operation || selectedOrders.length === 0) {
      toast.error('Please select orders and an operation');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/bulk/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: selectedOrders,
          operation,
          value: operationValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Bulk operation failed');
      }

      const result = await response.json();
      toast.success(`Successfully updated ${result.updated} orders`);
      setSelectedOrders([]);
      setOperation('');
      setOperationValue('');
    } catch (error: any) {
      console.error('Error performing bulk operation:', error);
      toast.error(error.message || 'Failed to perform bulk operation');
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setCsvFile(file);
    // Parse CSV and show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',');
      const preview = lines.slice(1, 6).map((line) => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header.trim()] = values[i]?.trim();
        });
        return obj;
      });
      setImportPreview(preview);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('type', tabValue === 0 ? 'users' : tabValue === 1 ? 'products' : 'orders');

      const response = await fetch('/api/admin/bulk/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();
      toast.success(`Successfully imported ${result.imported} items`);
      setCsvFile(null);
      setImportPreview([]);
    } catch (error: any) {
      console.error('Error importing:', error);
      toast.error(error.message || 'Failed to import');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" gutterBottom>
        Bulk Operations
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Perform bulk updates, imports, and operations on users, products, and orders
      </Typography>

      <Paper>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab icon={<People />} label="Users" />
          <Tab icon={<Inventory />} label="Products" />
          <Tab icon={<ShoppingCart />} label="Orders" />
          <Tab icon={<Upload />} label="Import CSV" />
        </Tabs>

        {/* Users Tab */}
        <TabPanel value={tabValue} index={0}>
          <Stack spacing={3}>
            <Alert severity="info">
              Select user IDs (comma-separated) and choose an operation to perform bulk updates.
            </Alert>

            <TextField
              label="User IDs (comma-separated)"
              fullWidth
              multiline
              rows={4}
              placeholder="user-id-1, user-id-2, user-id-3"
              value={selectedUsers.join(', ')}
              onChange={(e) => setSelectedUsers(e.target.value.split(',').map((id) => id.trim()).filter(Boolean))}
            />

            <FormControl fullWidth>
              <InputLabel>Operation</InputLabel>
              <Select
                value={operation}
                label="Operation"
                onChange={(e) => setOperation(e.target.value)}
              >
                <MenuItem value="update_status">Update Status</MenuItem>
                <MenuItem value="update_role">Update Role</MenuItem>
                <MenuItem value="update_kyc_status">Update KYC Status</MenuItem>
                <MenuItem value="send_notification">Send Notification</MenuItem>
                <MenuItem value="block">Block Users</MenuItem>
                <MenuItem value="unblock">Unblock Users</MenuItem>
              </Select>
            </FormControl>

            {operation && (
              <TextField
                label="Value"
                fullWidth
                value={operationValue}
                onChange={(e) => setOperationValue(e.target.value)}
                placeholder={
                  operation === 'update_status' ? 'active, inactive, suspended'
                    : operation === 'update_role' ? 'retailer, wholesaler, manufacturer'
                    : operation === 'update_kyc_status' ? 'pending, verified, rejected'
                    : operation === 'send_notification' ? 'Notification message'
                    : ''
                }
              />
            )}

            <Button
              variant="contained"
              onClick={() => setConfirmDialogOpen(true)}
              disabled={!operation || selectedUsers.length === 0 || loading}
              startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
            >
              Execute Bulk Operation ({selectedUsers.length} users)
            </Button>
          </Stack>
        </TabPanel>

        {/* Products Tab */}
        <TabPanel value={tabValue} index={1}>
          <Stack spacing={3}>
            <Alert severity="info">
              Select product IDs (comma-separated) and choose an operation to perform bulk updates.
            </Alert>

            <TextField
              label="Product IDs (comma-separated)"
              fullWidth
              multiline
              rows={4}
              placeholder="product-id-1, product-id-2, product-id-3"
              value={selectedProducts.join(', ')}
              onChange={(e) => setSelectedProducts(e.target.value.split(',').map((id) => id.trim()).filter(Boolean))}
            />

            <FormControl fullWidth>
              <InputLabel>Operation</InputLabel>
              <Select
                value={operation}
                label="Operation"
                onChange={(e) => setOperation(e.target.value)}
              >
                <MenuItem value="update_status">Update Status</MenuItem>
                <MenuItem value="update_price">Update Price (percentage)</MenuItem>
                <MenuItem value="update_stock">Update Stock</MenuItem>
                <MenuItem value="update_category">Update Category</MenuItem>
                <MenuItem value="activate">Activate Products</MenuItem>
                <MenuItem value="deactivate">Deactivate Products</MenuItem>
              </Select>
            </FormControl>

            {operation && (
              <TextField
                label="Value"
                fullWidth
                value={operationValue}
                onChange={(e) => setOperationValue(e.target.value)}
                placeholder={
                  operation === 'update_status' ? 'available, out_of_stock, discontinued'
                    : operation === 'update_price' ? '10 (for 10% increase) or -10 (for 10% decrease)'
                    : operation === 'update_stock' ? 'Stock quantity'
                    : operation === 'update_category' ? 'Category name'
                    : ''
                }
              />
            )}

            <Button
              variant="contained"
              onClick={() => setConfirmDialogOpen(true)}
              disabled={!operation || selectedProducts.length === 0 || loading}
              startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
            >
              Execute Bulk Operation ({selectedProducts.length} products)
            </Button>
          </Stack>
        </TabPanel>

        {/* Orders Tab */}
        <TabPanel value={tabValue} index={2}>
          <Stack spacing={3}>
            <Alert severity="info">
              Select order IDs (comma-separated) and choose an operation to perform bulk updates.
            </Alert>

            <TextField
              label="Order IDs (comma-separated)"
              fullWidth
              multiline
              rows={4}
              placeholder="order-id-1, order-id-2, order-id-3"
              value={selectedOrders.join(', ')}
              onChange={(e) => setSelectedOrders(e.target.value.split(',').map((id) => id.trim()).filter(Boolean))}
            />

            <FormControl fullWidth>
              <InputLabel>Operation</InputLabel>
              <Select
                value={operation}
                label="Operation"
                onChange={(e) => setOperation(e.target.value)}
              >
                <MenuItem value="update_status">Update Status</MenuItem>
                <MenuItem value="add_note">Add Note</MenuItem>
                <MenuItem value="assign_seller">Assign Seller</MenuItem>
                <MenuItem value="cancel">Cancel Orders</MenuItem>
              </Select>
            </FormControl>

            {operation && (
              <TextField
                label="Value"
                fullWidth
                value={operationValue}
                onChange={(e) => setOperationValue(e.target.value)}
                placeholder={
                  operation === 'update_status' ? 'pending, confirmed, shipped, delivered, cancelled'
                    : operation === 'add_note' ? 'Note text'
                    : operation === 'assign_seller' ? 'Seller ID'
                    : ''
                }
              />
            )}

            <Button
              variant="contained"
              onClick={() => setConfirmDialogOpen(true)}
              disabled={!operation || selectedOrders.length === 0 || loading}
              startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
            >
              Execute Bulk Operation ({selectedOrders.length} orders)
            </Button>
          </Stack>
        </TabPanel>

        {/* Import CSV Tab */}
        <TabPanel value={tabValue} index={3}>
          <Stack spacing={3}>
            <Alert severity="info">
              Upload a CSV file to bulk import users, products, or orders. The first row should contain headers.
            </Alert>

            <Button
              variant="outlined"
              component="label"
              startIcon={<Upload />}
            >
              Select CSV File
              <input
                type="file"
                hidden
                accept=".csv"
                onChange={handleFileUpload}
              />
            </Button>

            {csvFile && (
              <Alert severity="success">
                File selected: {csvFile.name}
              </Alert>
            )}

            {importPreview.length > 0 && (
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preview (first 5 rows):
                </Typography>
                <List dense>
                  {importPreview.map((row, idx) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={JSON.stringify(row)}
                        primaryTypographyProps={{ variant: 'caption', fontFamily: 'monospace' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}

            <Button
              variant="contained"
              onClick={handleImport}
              disabled={!csvFile || loading}
              startIcon={loading ? <CircularProgress size={20} /> : <Upload />}
            >
              Import CSV
            </Button>
          </Stack>
        </TabPanel>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirm Bulk Operation</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to perform <strong>{operation}</strong> on{' '}
            {tabValue === 0 && `${selectedUsers.length} users`}
            {tabValue === 1 && `${selectedProducts.length} products`}
            {tabValue === 2 && `${selectedOrders.length} orders`}
            ?
          </Typography>
          {(operation === 'block' || operation === 'delete' || operation === 'cancel') && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This action cannot be easily undone. Please verify this is correct.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (tabValue === 0) handleBulkUserOperation();
              else if (tabValue === 1) handleBulkProductOperation();
              else if (tabValue === 2) handleBulkOrderOperation();
            }}
            variant="contained"
            color="warning"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

