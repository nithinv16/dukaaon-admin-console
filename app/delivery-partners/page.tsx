'use client';

import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Container,
    Grid,
    IconButton,
    Paper,
    Tab,
    Tabs,
    Typography,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack,
    Avatar,
    CircularProgress,
    Tooltip,
    Divider,
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Refresh as RefreshIcon,
    TwoWheeler as BikeIcon,
    LocalShipping as TruckIcon,
    Person as PersonIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    AccessTime as TimeIcon,
    History as HistoryIcon,
    Map as MapIcon,
    BatteryStd as BatteryIcon,
    Speed as SpeedIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

interface DeliveryPartner {
    id: string;
    name: string;
    full_name?: string;
    phone_number: string;
    vehicle_type: string;
    vehicle_number: string;
    is_active: boolean;
    is_online: boolean;
    is_available: boolean;
    rating: number;
    total_deliveries: number;
    latitude?: number;
    longitude?: number;
    profile_image_url?: string;
}

interface LocationLog {
    id: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    battery_level?: number;
    speed?: number;
    heading?: number;
}

interface Rejection {
    id: string;
    reason: string;
    rejected_at: string;
    batch_id?: string;
}

export default function DeliveryPartnersPage() {
    const [tabValue, setTabValue] = useState(0);
    const [partners, setPartners] = useState<DeliveryPartner[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPartner, setSelectedPartner] = useState<DeliveryPartner | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [openDetailDialog, setOpenDetailDialog] = useState(false);
    const [trackingLogs, setTrackingLogs] = useState<LocationLog[]>([]);
    const [rejections, setRejections] = useState<Rejection[]>([]);
    const [dashboardStats, setDashboardStats] = useState({
        total: 0,
        active: 0,
        online: 0,
        available: 0,
        pending: 0,
    });

    // Form State
    const [formData, setFormData] = useState<Partial<DeliveryPartner>>({
        name: '',
        phone_number: '',
        vehicle_type: 'bike',
        vehicle_number: '',
        is_active: true,
    });

    useEffect(() => {
        loadPartners();
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const response = await fetch('/api/admin/delivery-partners?action=stats');
            const result = await response.json();
            if (response.ok) {
                setDashboardStats(prev => ({
                    ...prev,
                    total: result.total,
                    active: result.active,
                    online: result.online,
                    pending: result.pending
                }));
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadPartners = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/delivery-partners?action=list');
            const result = await response.json();
            if (response.ok) {
                setPartners(result.partners);
                // Update available count from loaded list
                setDashboardStats(prev => ({
                    ...prev,
                    available: result.partners.filter((p: DeliveryPartner) => p.is_available).length
                }));
            } else {
                toast.error(result.error || 'Failed to load partners');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to load partners');
        } finally {
            setLoading(false);
        }
    };

    const loadPartnerDetails = async (partnerId: string) => {
        try {
            // Load Tracking Logs
            const trackingRes = await fetch(`/api/admin/delivery-partners?action=tracking&id=${partnerId}`);
            const trackingData = await trackingRes.json();
            if (trackingRes.ok) setTrackingLogs(trackingData.logs || []);

            // Load Rejections
            const rejectionsRes = await fetch(`/api/admin/delivery-partners?action=rejections&id=${partnerId}`);
            const rejectionsData = await rejectionsRes.json();
            if (rejectionsRes.ok) setRejections(rejectionsData.rejections || []);

        } catch (error) {
            console.error('Error loading details:', error);
            toast.error('Failed to load partner details');
        }
    };

    const handleCreateOrUpdate = async () => {
        try {
            const isEdit = !!formData.id;
            const action = isEdit ? 'update_partner' : 'create_partner';

            const response = await fetch(`/api/admin/delivery-partners?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const result = await response.json();
            if (response.ok) {
                toast.success(isEdit ? 'Partner updated' : 'Partner created');
                setOpenDialog(false);
                loadPartners();
                setFormData({ name: '', phone_number: '', vehicle_type: 'bike', vehicle_number: '', is_active: true });
            } else {
                toast.error(result.error || 'Operation failed');
            }
        } catch (error) {
            toast.error('Operation failed');
        }
    };

    const openPartnerDetail = (partner: DeliveryPartner) => {
        setSelectedPartner(partner);
        setOpenDetailDialog(true);
        loadPartnerDetails(partner.id);
    };

    const columns: GridColDef[] = [
        {
            field: 'status', headerName: 'Status', width: 100,
            renderCell: (params: GridRenderCellParams) => (
                <Box display="flex" gap={1}>
                    {params.row.is_online ?
                        <Tooltip title="Online"><Chip size="small" label="ON" color="success" /></Tooltip> :
                        <Tooltip title="Offline"><Chip size="small" label="OFF" color="default" /></Tooltip>
                    }
                </Box>
            )
        },
        {
            field: 'name', headerName: 'Name', width: 200, renderCell: (params: GridRenderCellParams) => (
                <Box display="flex" alignItems="center" gap={1}>
                    <Avatar src={params.row.profile_image_url}>{params.row.name?.charAt(0)}</Avatar>
                    <Typography variant="body2">{params.row.name}</Typography>
                </Box>
            )
        },
        { field: 'phone_number', headerName: 'Phone', width: 150 },
        {
            field: 'vehicle_type', headerName: 'Vehicle', width: 120, renderCell: (params) => (
                <Stack direction="row" alignItems="center" gap={1}>
                    {params.value === 'bike' ? <BikeIcon fontSize="small" /> : <TruckIcon fontSize="small" />}
                    <Typography variant="body2" style={{ textTransform: 'capitalize' }}>{params.value}</Typography>
                </Stack>
            )
        },
        { field: 'rating', headerName: 'Rating', width: 100 },
        { field: 'total_deliveries', headerName: 'Deliveries', width: 120 },
        {
            field: 'actions', headerName: 'Actions', width: 150,
            renderCell: (params: GridRenderCellParams) => (
                <Stack direction="row">
                    <IconButton size="small" onClick={() => {
                        setFormData(params.row);
                        setOpenDialog(true);
                    }}><EditIcon fontSize="small" /></IconButton>
                    <Button size="small" onClick={() => openPartnerDetail(params.row)}>Details</Button>
                </Stack>
            )
        },
    ];

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">Delivery Partners</Typography>
                    <Typography variant="body2" color="text.secondary">Manage fleet, track location, and monitor performance</Typography>
                </Box>
                <Stack direction="row" gap={2}>
                    <Button startIcon={<RefreshIcon />} onClick={loadPartners}>Refresh</Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
                        setFormData({ name: '', phone_number: '', vehicle_type: 'bike', vehicle_number: '', is_active: true });
                        setOpenDialog(true);
                    }}>Add Partner</Button>
                </Stack>
            </Stack>

            {/* Summary Cards */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>Total Partners</Typography>
                            <Typography variant="h3">{dashboardStats.total}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>Online Now</Typography>
                            <Typography variant="h3" color="success.main">{dashboardStats.online}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>Available</Typography>
                            <Typography variant="h3" color="primary.main">{dashboardStats.available}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>Active Accounts</Typography>
                            <Typography variant="h3">{dashboardStats.active}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>Pending Orders</Typography>
                            <Typography variant="h3" color="error.main">{dashboardStats.pending}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Main Content */}
            <Paper sx={{ width: '100%', mb: 2 }}>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label="All Partners" />
                    <Tab label="Online / Map" />
                    <Tab label="Rejections" />
                </Tabs>

                {/* Tab 0: List */}
                {tabValue === 0 && (
                    <Box sx={{ height: 600, width: '100%' }}>
                        <DataGrid
                            rows={partners}
                            columns={columns}
                            loading={loading}
                            getRowId={(row) => row.id}
                            disableRowSelectionOnClick
                        />
                    </Box>
                )}

                {/* Tab 1: Live Map (Simplified List for now) */}
                {tabValue === 1 && (
                    <Box p={3}>
                        <Typography variant="h6" mb={2}>Online Partners ({partners.filter(p => p.is_online).length})</Typography>
                        <Grid container spacing={2}>
                            {partners.filter(p => p.is_online).map(partner => (
                                <Grid item xs={12} md={4} key={partner.id}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Stack direction="row" spacing={2} alignItems="center">
                                                <Avatar src={partner.profile_image_url} />
                                                <Box>
                                                    <Typography variant="subtitle1">{partner.name}</Typography>
                                                    <Typography variant="caption" display="block">Lat: {partner.latitude?.toFixed(4)}, Lng: {partner.longitude?.toFixed(4)}</Typography>
                                                    <Button size="small" startIcon={<MapIcon />} href={`https://www.google.com/maps/search/?api=1&query=${partner.latitude},${partner.longitude}`} target="_blank">View on Google Maps</Button>
                                                </Box>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                            {partners.filter(p => p.is_online).length === 0 && (
                                <Grid item xs={12}><Typography color="text.secondary">No partners are currently online.</Typography></Grid>
                            )}
                        </Grid>
                    </Box>
                )}

                {/* Tab 2: Rejections (Global View could go here, but for now just placeholder or partner specific) */}
                {tabValue === 2 && (
                    <Box p={3}>
                        <Typography color="text.secondary">Select a partner to view their specific rejection history.</Typography>
                    </Box>
                )}
            </Paper>

            {/* Add/Edit Dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{formData.id ? 'Edit Partner' : 'Add New Partner'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField label="Name" fullWidth value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                        <TextField label="Phone Number" fullWidth value={formData.phone_number} onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} />
                        <FormControl fullWidth>
                            <InputLabel>Vehicle Type</InputLabel>
                            <Select value={formData.vehicle_type} label="Vehicle Type" onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}>
                                <MenuItem value="bike">Bike</MenuItem>
                                <MenuItem value="scooter">Scooter</MenuItem>
                                <MenuItem value="truck">Truck/Van</MenuItem>
                                <MenuItem value="bicycle">Bicycle</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField label="Vehicle Number" fullWidth value={formData.vehicle_number} onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateOrUpdate}>Save</Button>
                </DialogActions>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={openDetailDialog} onClose={() => setOpenDetailDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                        {selectedPartner?.name} - Details
                        <IconButton onClick={() => setOpenDetailDialog(false)}><CloseIcon /></IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" gutterBottom>Performance</Typography>
                            <Stack spacing={2}>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Total Deliveries</Typography>
                                    <Typography variant="h5">{selectedPartner?.total_deliveries}</Typography>
                                </Paper>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Rating</Typography>
                                    <Typography variant="h5">{selectedPartner?.rating} / 5.0</Typography>
                                </Paper>
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" gutterBottom>Recent Location Logs</Typography>
                            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                                {trackingLogs.length > 0 ? (
                                    <Stack spacing={1}>
                                        {trackingLogs.map(log => (
                                            <Box key={log.id} sx={{ display: 'flex', justifyContent: 'space-between', p: 1, borderBottom: '1px solid #eee' }}>
                                                <Typography variant="body2">{format(new Date(log.timestamp), 'MMM dd, HH:mm')}</Typography>
                                                <Box display="flex" gap={1} alignItems="center">
                                                    {log.battery_level && <Chip icon={<BatteryIcon sx={{ fontSize: 14 }} />} label={`${log.battery_level}%`} size="small" />}
                                                    {log.speed && <Chip icon={<SpeedIcon sx={{ fontSize: 14 }} />} label={`${log.speed} km/h`} size="small" />}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Stack>
                                ) : <Typography color="text.secondary">No logs found.</Typography>}
                            </Box>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>Rejection History</Typography>
                            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                                {rejections.length > 0 ? (
                                    <Stack spacing={1}>
                                        {rejections.map(rej => (
                                            <Paper key={rej.id} variant="outlined" sx={{ p: 1 }}>
                                                <Typography variant="subtitle2" color="error">{rej.reason}</Typography>
                                                <Typography variant="caption">{format(new Date(rej.rejected_at), 'MMM dd, HH:mm')}</Typography>
                                            </Paper>
                                        ))}
                                    </Stack>
                                ) : <Typography color="text.secondary">No rejections recorded.</Typography>}
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
            </Dialog>
        </Container>
    );
}
