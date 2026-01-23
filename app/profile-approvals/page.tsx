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
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Tooltip,
    Divider,
    Badge,
} from '@mui/material';
import {
    CheckCircle,
    Cancel,
    Visibility,
    Refresh,
    FilterList,
    ArrowForward,
    Person,
    Store,
    Phone,
    Email,
    LocationOn,
    Business,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileChangeRequest {
    id: string;
    user_id: string;
    user_role: 'seller' | 'retailer';
    current_values: Record<string, any>;
    requested_changes: Record<string, any>;
    status: 'pending' | 'approved' | 'rejected';
    processed_by: string | null;
    processed_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
    user_phone: string;
    user_email: string;
    business_name: string;
    owner_name: string;
}

interface Stats {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
}

const fieldLabels: Record<string, string> = {
    business_name: 'Business Name',
    owner_name: 'Owner Name',
    shopName: 'Shop Name',
    ownerName: 'Owner Name',
    phone_number: 'Phone Number',
    email: 'Email Address',
    gst_number: 'GST Number',
    gstNumber: 'GST Number',
    address: 'Address',
    latitude: 'Latitude',
    longitude: 'Longitude',
};

const getFieldIcon = (field: string) => {
    switch (field) {
        case 'phone_number':
            return <Phone fontSize="small" />;
        case 'email':
            return <Email fontSize="small" />;
        case 'latitude':
        case 'longitude':
        case 'address':
            return <LocationOn fontSize="small" />;
        case 'business_name':
        case 'shopName':
            return <Store fontSize="small" />;
        case 'owner_name':
        case 'ownerName':
            return <Person fontSize="small" />;
        case 'gst_number':
        case 'gstNumber':
            return <Business fontSize="small" />;
        default:
            return null;
    }
};

export default function ProfileApprovalsPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<ProfileChangeRequest[]>([]);
    const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, rejected: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [roleFilter, setRoleFilter] = useState('all');
    const [selectedRequest, setSelectedRequest] = useState<ProfileChangeRequest | null>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadRequests();
    }, [statusFilter, roleFilter]);

    const loadRequests = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.set('status', statusFilter);
            if (roleFilter !== 'all') {
                params.set('role', roleFilter);
            }

            const response = await fetch(`/api/admin/profile-change-requests?${params.toString()}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to fetch requests');
            }

            setRequests(result.data || []);

            // Also fetch stats
            const allResponse = await fetch('/api/admin/profile-change-requests?status=all');
            const allResult = await allResponse.json();
            if (allResponse.ok && allResult.data) {
                const allData = allResult.data as ProfileChangeRequest[];
                setStats({
                    pending: allData.filter(r => r.status === 'pending').length,
                    approved: allData.filter(r => r.status === 'approved').length,
                    rejected: allData.filter(r => r.status === 'rejected').length,
                    total: allData.length,
                });
            }
        } catch (error: any) {
            console.error('Error loading requests:', error);
            toast.error(error.message || 'Failed to load profile change requests');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (request: ProfileChangeRequest) => {
        try {
            setProcessing(true);
            const response = await fetch('/api/admin/profile-change-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: request.id,
                    action: 'approve',
                    adminUserId: user?.id,
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to approve request');
            }

            toast.success('Profile changes approved and applied!');
            loadRequests();
            setDetailsDialogOpen(false);
        } catch (error: any) {
            console.error('Error approving request:', error);
            toast.error(error.message || 'Failed to approve request');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        if (!rejectionReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }

        try {
            setProcessing(true);
            const response = await fetch('/api/admin/profile-change-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: selectedRequest.id,
                    action: 'reject',
                    rejectionReason: rejectionReason.trim(),
                    adminUserId: user?.id,
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to reject request');
            }

            toast.success('Profile change request rejected');
            setRejectDialogOpen(false);
            setRejectionReason('');
            loadRequests();
            setDetailsDialogOpen(false);
        } catch (error: any) {
            console.error('Error rejecting request:', error);
            toast.error(error.message || 'Failed to reject request');
        } finally {
            setProcessing(false);
        }
    };

    const openRejectDialog = (request: ProfileChangeRequest) => {
        setSelectedRequest(request);
        setRejectionReason('');
        setRejectDialogOpen(true);
    };

    const openDetailsDialog = (request: ProfileChangeRequest) => {
        setSelectedRequest(request);
        setDetailsDialogOpen(true);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'warning';
            case 'approved':
                return 'success';
            case 'rejected':
                return 'error';
            default:
                return 'default';
        }
    };

    const getRoleColor = (role: string) => {
        return role === 'seller' ? 'primary' : 'secondary';
    };

    const formatValue = (value: any): string => {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        return String(value);
    };

    const getChangedFields = (request: ProfileChangeRequest) => {
        return Object.keys(request.requested_changes || {});
    };

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">
                    Profile Change Approvals
                </Typography>
                <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={loadRequests}
                    disabled={loading}
                >
                    Refresh
                </Button>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                    <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                        <CardContent>
                            <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                                Pending
                            </Typography>
                            <Typography variant="h4" fontWeight="bold">
                                {stats.pending}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
                        <CardContent>
                            <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                                Approved
                            </Typography>
                            <Typography variant="h4" fontWeight="bold">
                                {stats.approved}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card sx={{ bgcolor: 'error.light', color: 'error.contrastText' }}>
                        <CardContent>
                            <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                                Rejected
                            </Typography>
                            <Typography variant="h4" fontWeight="bold">
                                {stats.rejected}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">
                                Total Requests
                            </Typography>
                            <Typography variant="h4" fontWeight="bold">
                                {stats.total}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={statusFilter}
                                    label="Status"
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <MenuItem value="pending">Pending</MenuItem>
                                    <MenuItem value="approved">Approved</MenuItem>
                                    <MenuItem value="rejected">Rejected</MenuItem>
                                    <MenuItem value="all">All</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>User Role</InputLabel>
                                <Select
                                    value={roleFilter}
                                    label="User Role"
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                >
                                    <MenuItem value="all">All Roles</MenuItem>
                                    <MenuItem value="seller">Sellers</MenuItem>
                                    <MenuItem value="retailer">Retailers</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<FilterList />}
                                onClick={loadRequests}
                            >
                                Apply Filters
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Requests Table */}
            <Card>
                <CardContent>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : requests.length === 0 ? (
                        <Alert severity="info">
                            No profile change requests found with the current filters.
                        </Alert>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>User</TableCell>
                                        <TableCell>Role</TableCell>
                                        <TableCell>Changes Requested</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Submitted</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {requests.map((request) => (
                                        <TableRow key={request.id} hover>
                                            <TableCell>
                                                <Box>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {request.business_name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {request.user_phone}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={request.user_role === 'seller' ? 'Seller' : 'Retailer'}
                                                    color={getRoleColor(request.user_role)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                    {getChangedFields(request).slice(0, 3).map((field) => (
                                                        <Chip
                                                            key={field}
                                                            label={fieldLabels[field] || field}
                                                            size="small"
                                                            variant="outlined"
                                                            icon={getFieldIcon(field) || undefined}
                                                        />
                                                    ))}
                                                    {getChangedFields(request).length > 3 && (
                                                        <Chip
                                                            label={`+${getChangedFields(request).length - 3} more`}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                </Stack>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                                    color={getStatusColor(request.status)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {new Date(request.created_at).toLocaleDateString()}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(request.created_at).toLocaleTimeString()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                    <Tooltip title="View Details">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => openDetailsDialog(request)}
                                                        >
                                                            <Visibility />
                                                        </IconButton>
                                                    </Tooltip>
                                                    {request.status === 'pending' && (
                                                        <>
                                                            <Tooltip title="Approve">
                                                                <IconButton
                                                                    size="small"
                                                                    color="success"
                                                                    onClick={() => handleApprove(request)}
                                                                    disabled={processing}
                                                                >
                                                                    <CheckCircle />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Reject">
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={() => openRejectDialog(request)}
                                                                    disabled={processing}
                                                                >
                                                                    <Cancel />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </>
                                                    )}
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            {/* Details Dialog */}
            <Dialog
                open={detailsDialogOpen}
                onClose={() => setDetailsDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6">Profile Change Request Details</Typography>
                        {selectedRequest && (
                            <Chip
                                label={selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                                color={getStatusColor(selectedRequest.status)}
                            />
                        )}
                    </Box>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedRequest && (
                        <Box>
                            {/* User Info */}
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                    User Information
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="body2" color="text.secondary">
                                            Business Name
                                        </Typography>
                                        <Typography variant="body1">{selectedRequest.business_name}</Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="body2" color="text.secondary">
                                            Phone Number
                                        </Typography>
                                        <Typography variant="body1">{selectedRequest.user_phone}</Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="body2" color="text.secondary">
                                            User Role
                                        </Typography>
                                        <Chip
                                            label={selectedRequest.user_role === 'seller' ? 'Seller' : 'Retailer'}
                                            color={getRoleColor(selectedRequest.user_role)}
                                            size="small"
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="body2" color="text.secondary">
                                            Submitted
                                        </Typography>
                                        <Typography variant="body1">
                                            {new Date(selectedRequest.created_at).toLocaleString()}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            {/* Changes Comparison */}
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Requested Changes
                            </Typography>
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Field</TableCell>
                                            <TableCell>Current Value</TableCell>
                                            <TableCell align="center" sx={{ width: 50 }}>
                                                <ArrowForward />
                                            </TableCell>
                                            <TableCell>New Value</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {Object.entries(selectedRequest.requested_changes || {}).map(([field, newValue]) => (
                                            <TableRow key={field}>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        {getFieldIcon(field)}
                                                        <Typography variant="body2" fontWeight="medium">
                                                            {fieldLabels[field] || field}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            bgcolor: 'error.lighter',
                                                            p: 1,
                                                            borderRadius: 1,
                                                            maxWidth: 300,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                        }}
                                                    >
                                                        {formatValue(selectedRequest.current_values?.[field])}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <ArrowForward color="action" />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            bgcolor: 'success.lighter',
                                                            p: 1,
                                                            borderRadius: 1,
                                                            maxWidth: 300,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                        }}
                                                    >
                                                        {formatValue(newValue)}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* Rejection Reason if rejected */}
                            {selectedRequest.status === 'rejected' && selectedRequest.rejection_reason && (
                                <Box sx={{ mt: 3 }}>
                                    <Alert severity="error">
                                        <Typography variant="subtitle2">Rejection Reason:</Typography>
                                        <Typography variant="body2">{selectedRequest.rejection_reason}</Typography>
                                    </Alert>
                                </Box>
                            )}

                            {/* Processed Info if not pending */}
                            {selectedRequest.status !== 'pending' && selectedRequest.processed_at && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Processed on: {new Date(selectedRequest.processed_at).toLocaleString()}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
                    {selectedRequest?.status === 'pending' && (
                        <>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<Cancel />}
                                onClick={() => {
                                    setDetailsDialogOpen(false);
                                    openRejectDialog(selectedRequest);
                                }}
                                disabled={processing}
                            >
                                Reject
                            </Button>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<CheckCircle />}
                                onClick={() => handleApprove(selectedRequest)}
                                disabled={processing}
                            >
                                {processing ? <CircularProgress size={20} /> : 'Approve'}
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog
                open={rejectDialogOpen}
                onClose={() => setRejectDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Reject Profile Change Request</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Please provide a reason for rejecting this profile change request. This will be visible to the user.
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        multiline
                        rows={4}
                        label="Rejection Reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter the reason for rejection..."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleReject}
                        disabled={processing || !rejectionReason.trim()}
                    >
                        {processing ? <CircularProgress size={20} /> : 'Reject Request'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
