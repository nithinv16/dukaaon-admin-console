'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    CircularProgress,
    Alert,
    Chip,
    Paper,
    Stack,
    Divider,
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    LinearProgress,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    Add,
    Edit,
    Delete,
    Flag,
    CheckCircle,
    Cancel,
    TrendingUp,
    AccessTime,
    Inventory,
    Receipt,
    Speed,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface EmployeeTarget {
    id: string;
    admin_id: string;
    admin: { id: string; name: string; email: string };
    period_type: 'daily' | 'weekly' | 'monthly';
    period_start: string;
    period_end: string;
    target_products_created: number;
    target_products_updated: number;
    target_master_products_created: number;
    target_receipts_scanned: number;
    target_active_hours: number;
    target_items_processed: number;
    actual_products_created: number;
    actual_products_updated: number;
    actual_master_products_created: number;
    actual_receipts_scanned: number;
    actual_active_hours: number;
    actual_items_processed: number;
    status: 'active' | 'completed' | 'missed' | 'exceeded';
    completion_percentage: number;
    notes: string;
    created_at: string;
}

const defaultFormData = {
    admin_id: '',
    period_type: 'daily' as const,
    period_start: new Date().toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
    target_products_created: 10,
    target_products_updated: 5,
    target_master_products_created: 5,
    target_receipts_scanned: 3,
    target_active_hours: 6,
    target_items_processed: 50,
    notes: '',
};

export default function EmployeeTargetsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [targets, setTargets] = useState<EmployeeTarget[]>([]);
    const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string }>>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTarget, setEditingTarget] = useState<EmployeeTarget | null>(null);
    const [formData, setFormData] = useState(defaultFormData);
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPeriod, setFilterPeriod] = useState('all');
    const [saving, setSaving] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);

    // Access control - redirect employees immediately
    useEffect(() => {
        if (!authLoading && user) {
            if (user.role === 'Employee') {
                setAccessDenied(true);
                toast.error('Access denied: You do not have permission to view this page');
                router.push('/');
            }
        }
    }, [user, authLoading, router]);

    const loadEmployees = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/admin-users');
            if (response.ok) {
                const data = await response.json();
                setEmployees(data.admins || []);
            }
        } catch (error) {
            console.error('Error loading employees:', error);
        }
    }, []);

    const loadTargets = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterStatus !== 'all') params.append('status', filterStatus);
            if (filterPeriod !== 'all') params.append('period_type', filterPeriod);

            const response = await fetch(`/api/admin/employee-targets?${params}`);
            if (response.ok) {
                const data = await response.json();
                setTargets(data.targets || []);
            }
        } catch (error) {
            console.error('Error loading targets:', error);
            toast.error('Failed to load targets');
        } finally {
            setLoading(false);
        }
    }, [filterStatus, filterPeriod]);

    useEffect(() => {
        loadEmployees();
        loadTargets();
    }, [loadEmployees, loadTargets]);

    const handleOpenDialog = (target?: EmployeeTarget) => {
        if (target) {
            setEditingTarget(target);
            setFormData({
                admin_id: target.admin_id,
                period_type: target.period_type,
                period_start: target.period_start,
                period_end: target.period_end,
                target_products_created: target.target_products_created,
                target_products_updated: target.target_products_updated,
                target_master_products_created: target.target_master_products_created,
                target_receipts_scanned: target.target_receipts_scanned,
                target_active_hours: target.target_active_hours,
                target_items_processed: target.target_items_processed,
                notes: target.notes || '',
            });
        } else {
            setEditingTarget(null);
            setFormData(defaultFormData);
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingTarget(null);
        setFormData(defaultFormData);
    };

    const handleSave = async () => {
        if (!formData.admin_id) {
            toast.error('Please select an employee');
            return;
        }

        try {
            setSaving(true);
            const url = '/api/admin/employee-targets';
            const method = editingTarget ? 'PUT' : 'POST';
            const body = editingTarget
                ? { id: editingTarget.id, ...formData }
                : { ...formData, created_by: user?.id };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                toast.success(editingTarget ? 'Target updated successfully' : 'Target created successfully');
                handleCloseDialog();
                loadTargets();
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to save target');
            }
        } catch (error) {
            console.error('Error saving target:', error);
            toast.error('Failed to save target');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this target?')) return;

        try {
            const response = await fetch(`/api/admin/employee-targets?id=${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Target deleted successfully');
                loadTargets();
            } else {
                toast.error('Failed to delete target');
            }
        } catch (error) {
            console.error('Error deleting target:', error);
            toast.error('Failed to delete target');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'exceeded':
                return 'success';
            case 'completed':
                return 'info';
            case 'active':
                return 'warning';
            case 'missed':
                return 'error';
            default:
                return 'default';
        }
    };

    const getProgressColor = (percentage: number) => {
        if (percentage >= 100) return 'success';
        if (percentage >= 80) return 'info';
        if (percentage >= 50) return 'warning';
        return 'error';
    };

    const columns: GridColDef[] = [
        {
            field: 'admin',
            headerName: 'Employee',
            width: 180,
            renderCell: (params: GridRenderCellParams) => (
                <Box>
                    <Typography variant="body2" fontWeight="bold">
                        {params.value?.name || 'Unknown'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {params.value?.email}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'period_type',
            headerName: 'Period',
            width: 100,
            renderCell: (params: GridRenderCellParams) => (
                <Chip label={params.value} size="small" variant="outlined" />
            ),
        },
        {
            field: 'period_start',
            headerName: 'Duration',
            width: 180,
            renderCell: (params: GridRenderCellParams) => (
                <Typography variant="body2">
                    {new Date(params.row.period_start).toLocaleDateString()} -{' '}
                    {new Date(params.row.period_end).toLocaleDateString()}
                </Typography>
            ),
        },
        {
            field: 'completion_percentage',
            headerName: 'Progress',
            width: 150,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2" fontWeight="bold">
                            {params.value}%
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={Math.min(params.value, 100)}
                        color={getProgressColor(params.value)}
                        sx={{ height: 6, borderRadius: 3 }}
                    />
                </Box>
            ),
        },
        {
            field: 'target_products_created',
            headerName: 'Products Target',
            width: 130,
            renderCell: (params: GridRenderCellParams) => (
                <Typography variant="body2">
                    {params.row.actual_products_created} / {params.value}
                </Typography>
            ),
        },
        {
            field: 'target_active_hours',
            headerName: 'Hours Target',
            width: 120,
            renderCell: (params: GridRenderCellParams) => (
                <Typography variant="body2">
                    {params.row.actual_active_hours?.toFixed(1) || 0} / {params.value}h
                </Typography>
            ),
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 120,
            renderCell: (params: GridRenderCellParams) => (
                <Chip
                    label={params.value}
                    color={getStatusColor(params.value) as any}
                    size="small"
                />
            ),
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 100,
            renderCell: (params: GridRenderCellParams) => (
                <Box>
                    <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenDialog(params.row)}>
                            <Edit fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(params.row.id)}
                        >
                            <Delete fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            ),
        },
    ];

    // Calculate summary stats
    const activeTargets = targets.filter((t) => t.status === 'active');
    const avgCompletion = targets.length > 0
        ? Math.round(targets.reduce((sum, t) => sum + t.completion_percentage, 0) / targets.length)
        : 0;
    const onTrackCount = activeTargets.filter((t) => t.completion_percentage >= 50).length;

    // Show loading while checking authentication
    if (authLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    // Access denied for employees
    if (accessDenied || user?.role === 'Employee') {
        return (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
                <Alert severity="error">
                    Access Denied: You do not have permission to view this page.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Employee Targets & Goals
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Set and track daily, weekly, and monthly targets for employees
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => handleOpenDialog()}
                >
                    Create Target
                </Button>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Flag color="primary" sx={{ fontSize: 32 }} />
                                <Box>
                                    <Typography variant="h4">{activeTargets.length}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Active Targets
                                    </Typography>
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <TrendingUp color="success" sx={{ fontSize: 32 }} />
                                <Box>
                                    <Typography variant="h4">{avgCompletion}%</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Avg Completion
                                    </Typography>
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <CheckCircle color="info" sx={{ fontSize: 32 }} />
                                <Box>
                                    <Typography variant="h4">{onTrackCount}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        On Track
                                    </Typography>
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Cancel color="error" sx={{ fontSize: 32 }} />
                                <Box>
                                    <Typography variant="h4">
                                        {targets.filter((t) => t.status === 'missed').length}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Missed
                                    </Typography>
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    label="Status"
                                >
                                    <MenuItem value="all">All Statuses</MenuItem>
                                    <MenuItem value="active">Active</MenuItem>
                                    <MenuItem value="completed">Completed</MenuItem>
                                    <MenuItem value="exceeded">Exceeded</MenuItem>
                                    <MenuItem value="missed">Missed</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Period Type</InputLabel>
                                <Select
                                    value={filterPeriod}
                                    onChange={(e) => setFilterPeriod(e.target.value)}
                                    label="Period Type"
                                >
                                    <MenuItem value="all">All Periods</MenuItem>
                                    <MenuItem value="daily">Daily</MenuItem>
                                    <MenuItem value="weekly">Weekly</MenuItem>
                                    <MenuItem value="monthly">Monthly</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Targets Table */}
            <Card>
                <CardContent>
                    <DataGrid
                        rows={targets}
                        columns={columns}
                        loading={loading}
                        autoHeight
                        disableRowSelectionOnClick
                        pageSizeOptions={[10, 25, 50]}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 10 } },
                        }}
                        sx={{
                            '& .MuiDataGrid-cell': {
                                py: 1,
                            },
                        }}
                    />
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
                <DialogTitle>
                    {editingTarget ? 'Edit Target' : 'Create New Target'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Employee</InputLabel>
                                <Select
                                    value={formData.admin_id}
                                    onChange={(e) => setFormData({ ...formData, admin_id: e.target.value })}
                                    label="Employee"
                                >
                                    {employees.map((emp) => (
                                        <MenuItem key={emp.id} value={emp.id}>
                                            {emp.name} ({emp.email})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Period Type</InputLabel>
                                <Select
                                    value={formData.period_type}
                                    onChange={(e) => setFormData({ ...formData, period_type: e.target.value as any })}
                                    label="Period Type"
                                >
                                    <MenuItem value="daily">Daily</MenuItem>
                                    <MenuItem value="weekly">Weekly</MenuItem>
                                    <MenuItem value="monthly">Monthly</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Start Date"
                                type="date"
                                value={formData.period_start}
                                onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="End Date"
                                type="date"
                                value={formData.period_end}
                                onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <Divider sx={{ my: 1 }}>
                                <Chip label="Target Metrics" size="small" />
                            </Divider>
                        </Grid>

                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Products to Create"
                                type="number"
                                value={formData.target_products_created}
                                onChange={(e) =>
                                    setFormData({ ...formData, target_products_created: parseInt(e.target.value) || 0 })
                                }
                                fullWidth
                                InputProps={{
                                    startAdornment: <Inventory sx={{ mr: 1, color: 'text.secondary' }} />,
                                }}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Master Products"
                                type="number"
                                value={formData.target_master_products_created}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        target_master_products_created: parseInt(e.target.value) || 0,
                                    })
                                }
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Products to Update"
                                type="number"
                                value={formData.target_products_updated}
                                onChange={(e) =>
                                    setFormData({ ...formData, target_products_updated: parseInt(e.target.value) || 0 })
                                }
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Active Hours"
                                type="number"
                                value={formData.target_active_hours}
                                onChange={(e) =>
                                    setFormData({ ...formData, target_active_hours: parseFloat(e.target.value) || 0 })
                                }
                                fullWidth
                                InputProps={{
                                    startAdornment: <AccessTime sx={{ mr: 1, color: 'text.secondary' }} />,
                                }}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Receipts to Scan"
                                type="number"
                                value={formData.target_receipts_scanned}
                                onChange={(e) =>
                                    setFormData({ ...formData, target_receipts_scanned: parseInt(e.target.value) || 0 })
                                }
                                fullWidth
                                InputProps={{
                                    startAdornment: <Receipt sx={{ mr: 1, color: 'text.secondary' }} />,
                                }}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Items to Process"
                                type="number"
                                value={formData.target_items_processed}
                                onChange={(e) =>
                                    setFormData({ ...formData, target_items_processed: parseInt(e.target.value) || 0 })
                                }
                                fullWidth
                                InputProps={{
                                    startAdornment: <Speed sx={{ mr: 1, color: 'text.secondary' }} />,
                                }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                fullWidth
                                multiline
                                rows={2}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={saving}>
                        {saving ? <CircularProgress size={24} /> : editingTarget ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

