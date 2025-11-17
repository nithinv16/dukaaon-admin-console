'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  Stack,
  Paper,
  FormControlLabel,
  Switch,
  LinearProgress,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid';
import {
  Add,
  Send,
  Warning,
  Info,
  Error as ErrorIcon,
  Visibility,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';

interface AdminMessage {
  id: string;
  target_user_id?: string;
  target_role?: string;
  target_region?: string;
  severity: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  requires_ack: boolean;
  send_via_whatsapp?: boolean;
  send_via_sms?: boolean;
  send_via_push?: boolean;
  created_at: string;
  created_by?: {
    name?: string;
    email?: string;
  };
}

export default function WarningsPage() {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<AdminMessage | null>(null);
  const [messageStats, setMessageStats] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalMessages, setTotalMessages] = useState(0);
  const [filterRole, setFilterRole] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const [formData, setFormData] = useState({
    target_type: 'role', // 'user', 'role', 'region'
    target_user_id: '',
    target_role: '',
    target_region: '',
    severity: 'info',
    type: 'system_update',
    title: '',
    message: '',
    requires_ack: false,
    send_via_whatsapp: false,
    send_via_sms: false,
    send_via_push: false,
    metadata: {},
  });

  useEffect(() => {
    loadMessages();
  }, [page, pageSize, filterRole, filterSeverity]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const result = await adminQueries.getAdminMessages({
        page: page + 1,
        limit: pageSize,
        target_role: filterRole === 'all' ? undefined : filterRole,
        severity: filterSeverity === 'all' ? undefined : filterSeverity,
      });
      setMessages(result.messages || []);
      setTotalMessages(result.total || 0);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      target_type: 'role',
      target_user_id: '',
      target_role: '',
      target_region: '',
      severity: 'info',
      type: 'system_update',
      title: '',
      message: '',
      requires_ack: false,
      send_via_whatsapp: false,
      send_via_sms: false,
      send_via_push: false,
      metadata: {},
    });
    setDialogOpen(true);
  };

  const handleSend = async () => {
    try {
      if (!formData.title || !formData.message) {
        toast.error('Please fill in title and message');
        return;
      }

      const messageData: any = {
        severity: formData.severity,
        type: formData.type,
        title: formData.title,
        message: formData.message,
        requires_ack: formData.requires_ack,
        send_via_whatsapp: formData.send_via_whatsapp,
        send_via_sms: formData.send_via_sms,
        send_via_push: formData.send_via_push,
        metadata: formData.metadata,
      };

      if (formData.target_type === 'user') {
        if (!formData.target_user_id) {
          toast.error('Please enter a user ID');
          return;
        }
        messageData.target_user_id = formData.target_user_id;
      } else if (formData.target_type === 'role') {
        if (!formData.target_role) {
          toast.error('Please select a role');
          return;
        }
        messageData.target_role = formData.target_role;
      } else if (formData.target_type === 'region') {
        if (!formData.target_region) {
          toast.error('Please enter a region');
          return;
        }
        messageData.target_region = formData.target_region;
      }

      await adminQueries.createAdminMessage(messageData);
      toast.success('Message sent successfully!');
      setDialogOpen(false);
      loadMessages();
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
    }
  };

  const handleViewStats = async (message: AdminMessage) => {
    try {
      const stats = await adminQueries.getMessageStats(message.id);
      setMessageStats(stats.data);
      setSelectedMessage(message);
      setStatsDialogOpen(true);
    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast.error('Failed to load message stats');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      default:
        return <Info color="info" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'severity',
      headerName: 'Severity',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          icon={getSeverityIcon(params.value)}
          label={params.value}
          color={getSeverityColor(params.value) as any}
          size="small"
        />
      ),
    },
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'target_role',
      headerName: 'Target',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.row.target_role || params.row.target_user_id ? (
            params.row.target_role || `User: ${params.row.target_user_id?.slice(-8)}`
          ) : (
            'All Users'
          )}
        </Typography>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: 'requires_ack',
      headerName: 'Requires Ack',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'warning' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Sent',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton
          size="small"
          onClick={() => handleViewStats(params.row)}
        >
          <Visibility />
        </IconButton>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">
          Warnings & Messages
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenDialog}
        >
          Send Message
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Role</InputLabel>
                <Select
                  value={filterRole}
                  label="Filter by Role"
                  onChange={(e) => setFilterRole(e.target.value)}
                >
                  <MenuItem value="all">All Roles</MenuItem>
                  <MenuItem value="retailer">Retailer</MenuItem>
                  <MenuItem value="wholesaler">Wholesaler</MenuItem>
                  <MenuItem value="manufacturer">Manufacturer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Severity</InputLabel>
                <Select
                  value={filterSeverity}
                  label="Filter by Severity"
                  onChange={(e) => setFilterSeverity(e.target.value)}
                >
                  <MenuItem value="all">All Severities</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warning">Warning</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardContent>
          <DataGrid
            rows={messages}
            columns={columns}
            loading={loading}
            pageSizeOptions={[10, 25, 50, 100]}
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            rowCount={totalMessages}
            paginationMode="server"
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
          />
        </CardContent>
      </Card>

      {/* Send Message Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Send Admin Message</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Target Type</InputLabel>
              <Select
                value={formData.target_type}
                label="Target Type"
                onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
              >
                <MenuItem value="role">All Users with Role</MenuItem>
                <MenuItem value="user">Specific User</MenuItem>
                <MenuItem value="region">Region/City</MenuItem>
              </Select>
            </FormControl>

            {formData.target_type === 'user' && (
              <TextField
                label="User ID"
                value={formData.target_user_id}
                onChange={(e) => setFormData({ ...formData, target_user_id: e.target.value })}
                fullWidth
                required
              />
            )}

            {formData.target_type === 'role' && (
              <FormControl fullWidth required>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.target_role}
                  label="Role"
                  onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
                >
                  <MenuItem value="retailer">Retailer</MenuItem>
                  <MenuItem value="wholesaler">Wholesaler</MenuItem>
                  <MenuItem value="manufacturer">Manufacturer</MenuItem>
                </Select>
              </FormControl>
            )}

            {formData.target_type === 'region' && (
              <TextField
                label="Region/City"
                value={formData.target_region}
                onChange={(e) => setFormData({ ...formData, target_region: e.target.value })}
                fullWidth
                required
                placeholder="e.g., BLR, MUM, DEL"
              />
            )}

            <FormControl fullWidth required>
              <InputLabel>Severity</InputLabel>
              <Select
                value={formData.severity}
                label="Severity"
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
              >
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                label="Type"
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <MenuItem value="system_update">System Update</MenuItem>
                <MenuItem value="policy_violation">Policy Violation</MenuItem>
                <MenuItem value="payment_reminder">Payment Reminder</MenuItem>
                <MenuItem value="account_warning">Account Warning</MenuItem>
                <MenuItem value="promotion">Promotion</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />

            <TextField
              label="Message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              multiline
              rows={4}
              fullWidth
              required
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.requires_ack}
                  onChange={(e) => setFormData({ ...formData, requires_ack: e.target.checked })}
                />
              }
              label="Requires Acknowledgment"
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Delivery Channels (Optional)
              </Typography>
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.send_via_whatsapp}
                      onChange={(e) => setFormData({ ...formData, send_via_whatsapp: e.target.checked })}
                    />
                  }
                  label="WhatsApp"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.send_via_sms}
                      onChange={(e) => setFormData({ ...formData, send_via_sms: e.target.checked })}
                    />
                  }
                  label="SMS"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.send_via_push}
                      onChange={(e) => setFormData({ ...formData, send_via_push: e.target.checked })}
                    />
                  }
                  label="Push"
                />
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSend} variant="contained" startIcon={<Send />}>
            Send Message
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog open={statsDialogOpen} onClose={() => setStatsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Message Statistics
          {selectedMessage && (
            <Chip
              label={selectedMessage.title}
              color={getSeverityColor(selectedMessage.severity) as any}
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {messageStats && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Total Recipients
                </Typography>
                <Typography variant="h4">{messageStats.total}</Typography>
              </Paper>

              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Delivery Status
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Delivered</Typography>
                    <Typography variant="body2">
                      {messageStats.delivered} / {messageStats.total}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(messageStats.delivered / messageStats.total) * 100}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
              </Paper>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h6" color="primary">
                      {messageStats.read}
                    </Typography>
                    <Typography variant="caption">Read</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h6" color="success.main">
                      {messageStats.acknowledged}
                    </Typography>
                    <Typography variant="caption">Acknowledged</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

