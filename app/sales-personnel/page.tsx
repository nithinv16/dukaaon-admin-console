'use client';

import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Tabs, Tab, Button, TextField,
    Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Alert, CircularProgress, Stack, Tooltip, LinearProgress, Avatar, Divider,
    FormControl, InputLabel, Select, MenuItem, Autocomplete,
} from '@mui/material';
import {
    Refresh, PersonAdd, CheckCircle, LocationOn, AccessTime, TrendingUp,
    People, Route, Visibility, Edit, Phone, Today, DirectionsWalk, Map, Timer,
    Add, Delete, Save, Close, CardGiftcard, ContentCopy,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

function TabPanel(props: any) {
    const { children, value, index, ...other } = props;
    return <div role="tabpanel" hidden={value !== index} {...other}>{value === index && <Box sx={{ py: 3 }}>{children}</Box>}</div>;
}

export default function SalesPersonnelPage() {
    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [adminUsers, setAdminUsers] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [selectedPerson, setSelectedPerson] = useState<any>(null);
    const [performance, setPerformance] = useState<any>(null);
    const [visits, setVisits] = useState<any[]>([]);
    const [routes, setRoutes] = useState<any[]>([]);
    const [allRoutes, setAllRoutes] = useState<any[]>([]);
    const [targets, setTargets] = useState<any[]>([]);
    const [referralStats, setReferralStats] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Dialog states
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [addPersonnelDialogOpen, setAddPersonnelDialogOpen] = useState(false);
    const [editPersonnelDialogOpen, setEditPersonnelDialogOpen] = useState(false);
    const [addRouteDialogOpen, setAddRouteDialogOpen] = useState(false);

    // Form states
    const [personnelForm, setPersonnelForm] = useState({
        adminId: '',
        employeeCode: '',
        phone: '',
        territory: '',
        hireDate: new Date().toISOString().split('T')[0],
    });
    const [routeForm, setRouteForm] = useState({
        salesPersonId: '',
        routeName: '',
        routeDate: new Date().toISOString().split('T')[0],
        plannedVisits: 0,
        notes: '',
    });

    useEffect(() => { loadPersonnel(); loadAttendance(); loadAdminUsers(); }, []);
    useEffect(() => { loadAttendance(); }, [selectedDate]);

    const loadPersonnel = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/sales-personnel');
            const result = await response.json();
            if (response.ok) setPersonnel(result.data || []);
        } catch (error) { console.error('Error:', error); } finally { setLoading(false); }
    };

    const loadAdminUsers = async () => {
        try {
            const response = await fetch('/api/admin/admin-users');
            const result = await response.json();
            if (response.ok) setAdminUsers(result.admins || []);
        } catch (error) { console.error('Error:', error); }
    };

    const loadAttendance = async () => {
        try {
            const response = await fetch(`/api/admin/sales-personnel?action=attendance&date=${selectedDate}`);
            const result = await response.json();
            if (response.ok) setAttendance(result.data || []);
        } catch (error) { console.error('Error:', error); }
    };

    const loadPerformance = async (salesPersonId: string) => {
        try {
            const response = await fetch(`/api/admin/sales-personnel?action=performance&salesPersonId=${salesPersonId}`);
            const result = await response.json();
            if (response.ok) setPerformance(result.data);
        } catch (error) { console.error('Error:', error); }
    };

    const loadVisits = async (salesPersonId: string) => {
        try {
            const response = await fetch(`/api/admin/sales-personnel?action=visits&salesPersonId=${salesPersonId}`);
            const result = await response.json();
            if (response.ok) setVisits(result.data || []);
        } catch (error) { console.error('Error:', error); }
    };

    const loadRoutes = async (salesPersonId?: string) => {
        try {
            const url = salesPersonId
                ? `/api/admin/sales-personnel?action=routes&salesPersonId=${salesPersonId}`
                : '/api/admin/sales-personnel?action=routes';
            const response = await fetch(url);
            const result = await response.json();
            if (response.ok) {
                if (salesPersonId) setRoutes(result.data || []);
                else setAllRoutes(result.data || []);
            }
        } catch (error) { console.error('Error:', error); }
    };

    const loadTargets = async (salesPersonId: string) => {
        try {
            const response = await fetch(`/api/admin/sales-personnel?action=targets&salesPersonId=${salesPersonId}`);
            const result = await response.json();
            if (response.ok) setTargets(result.data || []);
        } catch (error) { console.error('Error:', error); }
    };

    const openPersonDetail = async (person: any) => {
        setSelectedPerson(person);
        setReferralStats(null);
        setDetailDialogOpen(true);
        await Promise.all([
            loadPerformance(person.id),
            loadVisits(person.id),
            loadRoutes(person.id),
            loadTargets(person.id),
            loadReferralStats(person.id)
        ]);
    };

    const loadReferralStats = async (salesPersonId: string) => {
        try {
            const response = await fetch(`/api/admin/sales-personnel?action=referral_stats&salesPersonId=${salesPersonId}`);
            const result = await response.json();
            if (response.ok) setReferralStats(result.data);
        } catch (error) { console.error('Error:', error); }
    };

    const handleCreateReferralCode = async (salesPersonId: string, customCode?: string) => {
        try {
            setProcessing(true);
            const response = await fetch('/api/admin/sales-personnel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_referral_code', salesPersonId, customCode }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast.success(`Referral code created: ${result.data?.code}`);
            loadReferralStats(salesPersonId);
            loadPersonnel();
        } catch (error: any) {
            toast.error(error.message || 'Failed to create referral code');
        } finally {
            setProcessing(false);
        }
    };

    const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

    const handleAddPersonnel = async () => {
        if (!personnelForm.adminId || !personnelForm.employeeCode) {
            toast.error('Admin user and employee code are required');
            return;
        }
        try {
            setProcessing(true);
            const response = await fetch('/api/admin/sales-personnel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_personnel',
                    adminId: personnelForm.adminId,
                    employeeCode: personnelForm.employeeCode,
                    phone: personnelForm.phone,
                    territory: personnelForm.territory,
                    hireDate: personnelForm.hireDate,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast.success('Sales personnel added successfully!');
            setAddPersonnelDialogOpen(false);
            setPersonnelForm({ adminId: '', employeeCode: '', phone: '', territory: '', hireDate: new Date().toISOString().split('T')[0] });
            loadPersonnel();
        } catch (error: any) {
            toast.error(error.message || 'Failed to add personnel');
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdatePersonnel = async () => {
        if (!selectedPerson) return;
        try {
            setProcessing(true);
            const response = await fetch('/api/admin/sales-personnel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_personnel',
                    id: selectedPerson.id,
                    employee_code: personnelForm.employeeCode,
                    phone: personnelForm.phone,
                    territory: personnelForm.territory,
                    status: selectedPerson.status,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast.success('Personnel updated successfully!');
            setEditPersonnelDialogOpen(false);
            loadPersonnel();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update personnel');
        } finally {
            setProcessing(false);
        }
    };

    const handleAddRoute = async () => {
        if (!routeForm.salesPersonId || !routeForm.routeName || !routeForm.routeDate) {
            toast.error('Sales person, route name, and date are required');
            return;
        }
        try {
            setProcessing(true);
            const response = await fetch('/api/admin/sales-personnel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_route',
                    salesPersonId: routeForm.salesPersonId,
                    routeName: routeForm.routeName,
                    routeDate: routeForm.routeDate,
                    plannedVisits: routeForm.plannedVisits,
                    notes: routeForm.notes,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast.success('Route assigned successfully!');
            setAddRouteDialogOpen(false);
            setRouteForm({ salesPersonId: '', routeName: '', routeDate: new Date().toISOString().split('T')[0], plannedVisits: 0, notes: '' });
            loadRoutes();
        } catch (error: any) {
            toast.error(error.message || 'Failed to assign route');
        } finally {
            setProcessing(false);
        }
    };

    const openEditPersonnel = (person: any) => {
        setSelectedPerson(person);
        setPersonnelForm({
            adminId: person.admin_id,
            employeeCode: person.employee_code || '',
            phone: person.phone || '',
            territory: person.territory || '',
            hireDate: person.hire_date || new Date().toISOString().split('T')[0],
        });
        setEditPersonnelDialogOpen(true);
    };

    const formatTime = (time: string | null) => time ? new Date(time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';
    const formatDuration = (minutes: number | null) => minutes ? `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m` : '-';
    const formatCurrency = (amount: number) => `₹${(amount || 0).toLocaleString('en-IN')}`;

    // Summary stats
    const activeToday = attendance.filter(a => a.is_active).length;
    const totalVisitsToday = attendance.reduce((sum, a) => sum + (a.visits_today || 0), 0);
    const totalHoursToday = attendance.reduce((sum, a) => sum + (a.duration_minutes || 0), 0) / 60;

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h4" fontWeight="bold">Sales Personnel Dashboard</Typography>
                <Stack direction="row" spacing={1}>
                    <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setAddPersonnelDialogOpen(true)}>Add Personnel</Button>
                    <Button variant="outlined" startIcon={<Route />} onClick={() => { loadRoutes(); setAddRouteDialogOpen(true); }}>Assign Route</Button>
                    <Button variant="outlined" startIcon={<Refresh />} onClick={() => { loadPersonnel(); loadAttendance(); }}>Refresh</Button>
                </Stack>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                    <Card sx={{ bgcolor: 'primary.light' }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <People sx={{ fontSize: 40, color: 'primary.main' }} />
                            <Typography variant="h4" fontWeight="bold">{personnel.length}</Typography>
                            <Typography variant="body2">Total Team</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card sx={{ bgcolor: 'success.light' }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <CheckCircle sx={{ fontSize: 40, color: 'success.main' }} />
                            <Typography variant="h4" fontWeight="bold">{activeToday}</Typography>
                            <Typography variant="body2">Active Now</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card sx={{ bgcolor: 'info.light' }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <DirectionsWalk sx={{ fontSize: 40, color: 'info.main' }} />
                            <Typography variant="h4" fontWeight="bold">{totalVisitsToday}</Typography>
                            <Typography variant="body2">Visits Today</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card sx={{ bgcolor: 'warning.light' }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Timer sx={{ fontSize: 40, color: 'warning.main' }} />
                            <Typography variant="h4" fontWeight="bold">{totalHoursToday.toFixed(1)}h</Typography>
                            <Typography variant="body2">Total Hours</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Card>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab icon={<Today />} label="Attendance" iconPosition="start" />
                    <Tab icon={<People />} label="Team" iconPosition="start" />
                    <Tab icon={<Route />} label="Routes" iconPosition="start" />
                    <Tab icon={<TrendingUp />} label="Performance" iconPosition="start" />
                </Tabs>

                {/* Attendance Tab */}
                <TabPanel value={tabValue} index={0}>
                    <Box sx={{ p: 2 }}>
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                            <TextField type="date" label="Date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
                        </Stack>
                        {loading ? <LinearProgress /> : attendance.length === 0 ? (
                            <Alert severity="info">No attendance records for this date</Alert>
                        ) : (
                            <TableContainer component={Paper} variant="outlined">
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Employee</TableCell>
                                            <TableCell>Code</TableCell>
                                            <TableCell>Login</TableCell>
                                            <TableCell>Logout</TableCell>
                                            <TableCell>Duration</TableCell>
                                            <TableCell align="center">Visits</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {attendance.map((a) => (
                                            <TableRow key={a.sales_person_id} hover>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Avatar sx={{ width: 32, height: 32, bgcolor: a.is_active ? 'success.main' : 'grey.400' }}>{a.name?.[0] || '?'}</Avatar>
                                                        <Typography>{a.name || 'Unknown'}</Typography>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell><Chip label={a.employee_code || 'N/A'} size="small" variant="outlined" /></TableCell>
                                                <TableCell>{formatTime(a.login_time)}</TableCell>
                                                <TableCell>{formatTime(a.logout_time)}</TableCell>
                                                <TableCell>{formatDuration(a.duration_minutes)}</TableCell>
                                                <TableCell align="center"><Chip label={a.visits_today || 0} size="small" color="info" /></TableCell>
                                                <TableCell>
                                                    <Chip label={a.is_active ? 'Active' : a.logout_time ? 'Logged Out' : 'Not Logged In'} color={a.is_active ? 'success' : 'default'} size="small" />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title="View Details">
                                                        <IconButton size="small" onClick={() => {
                                                            const person = personnel.find(p => p.id === a.sales_person_id);
                                                            if (person) openPersonDetail(person);
                                                        }}><Visibility /></IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Track Location">
                                                        <IconButton size="small" color="info"><LocationOn /></IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                </TabPanel>

                {/* Team Tab */}
                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6">Sales Team Members</Typography>
                            <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setAddPersonnelDialogOpen(true)}>Add Personnel</Button>
                        </Box>
                        {loading ? <LinearProgress /> : personnel.length === 0 ? (
                            <Alert severity="info">No sales personnel found. Click "Add Personnel" to create one.</Alert>
                        ) : (
                            <Grid container spacing={2}>
                                {personnel.map((person) => (
                                    <Grid item xs={12} sm={6} md={4} key={person.id}>
                                        <Card variant="outlined" sx={{ '&:hover': { boxShadow: 3 } }}>
                                            <CardContent>
                                                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                                                    <Avatar sx={{ bgcolor: person.status === 'active' ? 'primary.main' : 'grey.400' }}>{person.admin?.name?.[0] || '?'}</Avatar>
                                                    <Box flex={1}>
                                                        <Typography fontWeight="bold">{person.admin?.name || 'Unknown'}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{person.employee_code || 'No Code'}</Typography>
                                                    </Box>
                                                    <IconButton size="small" onClick={() => openEditPersonnel(person)}><Edit /></IconButton>
                                                </Stack>
                                                <Chip label={person.status} size="small" color={person.status === 'active' ? 'success' : 'default'} sx={{ mb: 1 }} />
                                                <Divider sx={{ my: 1 }} />
                                                <Stack spacing={0.5}>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Phone fontSize="small" color="action" />
                                                        <Typography variant="body2">{person.phone || 'N/A'}</Typography>
                                                    </Stack>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <LocationOn fontSize="small" color="action" />
                                                        <Typography variant="body2">{person.territory || 'N/A'}</Typography>
                                                    </Stack>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <AccessTime fontSize="small" color="action" />
                                                        <Typography variant="body2">Hired: {person.hire_date ? new Date(person.hire_date).toLocaleDateString() : 'N/A'}</Typography>
                                                    </Stack>
                                                </Stack>
                                                {/* Referral Code Section */}
                                                <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <CardGiftcard fontSize="small" color="secondary" />
                                                        {person.referral_code ? (
                                                            <>
                                                                <Chip label={person.referral_code} size="small" color="secondary" />
                                                                <IconButton size="small" onClick={() => copyToClipboard(person.referral_code)}><ContentCopy fontSize="small" /></IconButton>
                                                            </>
                                                        ) : (
                                                            <Button size="small" variant="text" onClick={() => handleCreateReferralCode(person.id)} disabled={processing}>
                                                                Create Referral Code
                                                            </Button>
                                                        )}
                                                    </Stack>
                                                </Box>
                                                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                    <Button size="small" variant="outlined" startIcon={<Visibility />} onClick={() => openPersonDetail(person)}>Details</Button>
                                                    <Button size="small" variant="outlined" startIcon={<Route />} onClick={() => { setRouteForm({ ...routeForm, salesPersonId: person.id }); setAddRouteDialogOpen(true); }}>Assign Route</Button>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </Box>
                </TabPanel>

                {/* Routes Tab */}
                <TabPanel value={tabValue} index={2}>
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6">Assigned Routes</Typography>
                            <Button variant="contained" startIcon={<Add />} onClick={() => setAddRouteDialogOpen(true)}>Assign New Route</Button>
                        </Box>
                        {allRoutes.length === 0 ? (
                            <Alert severity="info">No routes assigned yet. Click "Assign New Route" to create one.</Alert>
                        ) : (
                            <TableContainer component={Paper} variant="outlined">
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Route Name</TableCell>
                                            <TableCell>Date</TableCell>
                                            <TableCell>Sales Person</TableCell>
                                            <TableCell align="center">Planned Visits</TableCell>
                                            <TableCell align="center">Completed</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Notes</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {allRoutes.map((r) => {
                                            const person = personnel.find(p => p.id === r.sales_person_id);
                                            return (
                                                <TableRow key={r.id} hover>
                                                    <TableCell><Typography fontWeight="bold">{r.route_name}</Typography></TableCell>
                                                    <TableCell>{new Date(r.route_date).toLocaleDateString()}</TableCell>
                                                    <TableCell>{person?.admin?.name || 'Unknown'}</TableCell>
                                                    <TableCell align="center">{r.planned_visits || 0}</TableCell>
                                                    <TableCell align="center"><Chip label={r.completed_visits || 0} color={r.completed_visits >= r.planned_visits ? 'success' : 'default'} size="small" /></TableCell>
                                                    <TableCell><Chip label={r.status} color={r.status === 'completed' ? 'success' : r.status === 'in_progress' ? 'warning' : 'default'} size="small" /></TableCell>
                                                    <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>{r.notes || '-'}</Typography></TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                </TabPanel>

                {/* Performance Tab */}
                <TabPanel value={tabValue} index={3}>
                    <Box sx={{ p: 2 }}>
                        <Alert severity="info" sx={{ mb: 2 }}>Select a team member from the Team tab to view their detailed performance.</Alert>
                        <Typography variant="h6" gutterBottom>Team Performance Overview</Typography>
                        <Typography variant="body2" color="text.secondary">Performance metrics will be available once sales visits are recorded.</Typography>
                    </Box>
                </TabPanel>
            </Card>

            {/* Add Personnel Dialog */}
            <Dialog open={addPersonnelDialogOpen} onClose={() => setAddPersonnelDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Sales Personnel</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel>Select Admin User</InputLabel>
                            <Select value={personnelForm.adminId} label="Select Admin User" onChange={(e) => setPersonnelForm({ ...personnelForm, adminId: e.target.value })}>
                                {adminUsers.filter(u => !personnel.some(p => p.admin_id === u.id)).map((user) => (
                                    <MenuItem key={user.id} value={user.id}>{user.name} ({user.email})</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField label="Employee Code" value={personnelForm.employeeCode} onChange={(e) => setPersonnelForm({ ...personnelForm, employeeCode: e.target.value.toUpperCase() })} placeholder="e.g., EMP001" fullWidth />
                        <TextField label="Phone Number" value={personnelForm.phone} onChange={(e) => setPersonnelForm({ ...personnelForm, phone: e.target.value })} fullWidth />
                        <TextField label="Territory / Area" value={personnelForm.territory} onChange={(e) => setPersonnelForm({ ...personnelForm, territory: e.target.value })} placeholder="e.g., South Delhi, Bangalore North" fullWidth />
                        <TextField type="date" label="Hire Date" value={personnelForm.hireDate} onChange={(e) => setPersonnelForm({ ...personnelForm, hireDate: e.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddPersonnelDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddPersonnel} disabled={processing}>{processing ? <CircularProgress size={20} /> : 'Add Personnel'}</Button>
                </DialogActions>
            </Dialog>

            {/* Edit Personnel Dialog */}
            <Dialog open={editPersonnelDialogOpen} onClose={() => setEditPersonnelDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit Sales Personnel</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Employee Code" value={personnelForm.employeeCode} onChange={(e) => setPersonnelForm({ ...personnelForm, employeeCode: e.target.value.toUpperCase() })} fullWidth />
                        <TextField label="Phone Number" value={personnelForm.phone} onChange={(e) => setPersonnelForm({ ...personnelForm, phone: e.target.value })} fullWidth />
                        <TextField label="Territory / Area" value={personnelForm.territory} onChange={(e) => setPersonnelForm({ ...personnelForm, territory: e.target.value })} fullWidth />
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select value={selectedPerson?.status || 'active'} label="Status" onChange={(e) => setSelectedPerson({ ...selectedPerson, status: e.target.value })}>
                                <MenuItem value="active">Active</MenuItem>
                                <MenuItem value="inactive">Inactive</MenuItem>
                                <MenuItem value="on_leave">On Leave</MenuItem>
                                <MenuItem value="terminated">Terminated</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditPersonnelDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleUpdatePersonnel} disabled={processing}>{processing ? <CircularProgress size={20} /> : 'Save Changes'}</Button>
                </DialogActions>
            </Dialog>

            {/* Assign Route Dialog */}
            <Dialog open={addRouteDialogOpen} onClose={() => setAddRouteDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Assign Route to Sales Person</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel>Select Sales Person</InputLabel>
                            <Select value={routeForm.salesPersonId} label="Select Sales Person" onChange={(e) => setRouteForm({ ...routeForm, salesPersonId: e.target.value })}>
                                {personnel.filter(p => p.status === 'active').map((p) => (
                                    <MenuItem key={p.id} value={p.id}>{p.admin?.name} ({p.employee_code})</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField label="Route Name" value={routeForm.routeName} onChange={(e) => setRouteForm({ ...routeForm, routeName: e.target.value })} placeholder="e.g., South Delhi Route 1" fullWidth />
                        <TextField type="date" label="Route Date" value={routeForm.routeDate} onChange={(e) => setRouteForm({ ...routeForm, routeDate: e.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
                        <TextField type="number" label="Planned Visits" value={routeForm.plannedVisits} onChange={(e) => setRouteForm({ ...routeForm, plannedVisits: parseInt(e.target.value) || 0 })} fullWidth />
                        <TextField label="Notes (optional)" value={routeForm.notes} onChange={(e) => setRouteForm({ ...routeForm, notes: e.target.value })} multiline rows={2} fullWidth />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddRouteDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddRoute} disabled={processing}>{processing ? <CircularProgress size={20} /> : 'Assign Route'}</Button>
                </DialogActions>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: 'primary.main' }}>{selectedPerson?.admin?.name?.[0] || '?'}</Avatar>
                        <Box>
                            <Typography variant="h6">{selectedPerson?.admin?.name || 'Unknown'}</Typography>
                            <Typography variant="caption" color="text.secondary">{selectedPerson?.employee_code} | {selectedPerson?.territory}</Typography>
                        </Box>
                    </Stack>
                </DialogTitle>
                <DialogContent dividers>
                    {/* Performance Summary */}
                    {performance && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Performance (Last 30 Days)</Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={6} sm={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1 }}><Typography variant="h5" color="primary">{performance.total_visits || 0}</Typography><Typography variant="caption">Total Visits</Typography></CardContent></Card></Grid>
                                <Grid item xs={6} sm={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1 }}><Typography variant="h5" color="success.main">{performance.orders_placed || 0}</Typography><Typography variant="caption">Orders Placed</Typography></CardContent></Card></Grid>
                                <Grid item xs={6} sm={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1 }}><Typography variant="h5" color="info.main">{formatCurrency(performance.total_order_value || 0)}</Typography><Typography variant="caption">Order Value</Typography></CardContent></Card></Grid>
                                <Grid item xs={6} sm={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1 }}><Typography variant="h5" color="warning.main">{performance.customers_onboarded || 0}</Typography><Typography variant="caption">Onboarded</Typography></CardContent></Card></Grid>
                            </Grid>
                        </Box>
                    )}

                    {/* Referral Statistics */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            <CardGiftcard sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Referral Statistics
                        </Typography>
                        {referralStats?.has_code ? (
                            <Card variant="outlined" sx={{ bgcolor: 'secondary.light' }}>
                                <CardContent>
                                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                                        <Chip label={referralStats.referral_code} color="secondary" sx={{ fontWeight: 'bold', fontSize: '1rem' }} />
                                        <IconButton size="small" onClick={() => copyToClipboard(referralStats.referral_code)}><ContentCopy /></IconButton>
                                    </Stack>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="h5" color="secondary">{referralStats.total_signups || 0}</Typography>
                                            <Typography variant="caption">Total Signups</Typography>
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="h5" color="info.main">{referralStats.total_referrals || 0}</Typography>
                                            <Typography variant="caption">Total Referrals</Typography>
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="h5" color="warning.main">{referralStats.pending_referrals || 0}</Typography>
                                            <Typography variant="caption">Pending</Typography>
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="h5" color="success.main">{referralStats.rewarded_referrals || 0}</Typography>
                                            <Typography variant="caption">Rewarded</Typography>
                                        </Grid>
                                    </Grid>
                                    {referralStats.recent_signups && referralStats.recent_signups.length > 0 && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="body2" fontWeight="bold" gutterBottom>Recent Signups</Typography>
                                            <Stack spacing={0.5}>
                                                {referralStats.recent_signups.slice(0, 5).map((s: any) => (
                                                    <Stack key={s.id} direction="row" justifyContent="space-between" alignItems="center">
                                                        <Typography variant="body2">{s.referee_phone || 'Unknown'}</Typography>
                                                        <Chip label={s.status} size="small" color={s.status === 'rewarded' ? 'success' : 'default'} />
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <Alert severity="info" action={
                                <Button color="inherit" size="small" onClick={() => selectedPerson && handleCreateReferralCode(selectedPerson.id)} disabled={processing}>
                                    Create Code
                                </Button>
                            }>
                                No referral code assigned. Create one to track referrals.
                            </Alert>
                        )}
                    </Box>
                    {/* Routes */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Assigned Routes</Typography>
                        {routes.length === 0 ? (
                            <Alert severity="info">No routes assigned</Alert>
                        ) : (
                            <Stack spacing={1}>
                                {routes.slice(0, 5).map((r) => (
                                    <Card key={r.id} variant="outlined">
                                        <CardContent sx={{ py: 1 }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Box>
                                                    <Typography fontWeight="bold">{r.route_name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{new Date(r.route_date).toLocaleDateString()}</Typography>
                                                </Box>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Chip label={`${r.completed_visits || 0}/${r.planned_visits || 0} visits`} size="small" />
                                                    <Chip label={r.status} color={r.status === 'completed' ? 'success' : 'default'} size="small" />
                                                </Stack>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        )}
                    </Box>

                    {/* Recent Visits */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Recent Visits</Typography>
                        {visits.length === 0 ? (
                            <Alert severity="info">No visits recorded yet</Alert>
                        ) : (
                            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Customer</TableCell><TableCell>Type</TableCell><TableCell>Outcome</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {visits.slice(0, 5).map((v) => (
                                            <TableRow key={v.id} hover>
                                                <TableCell>{new Date(v.visit_date).toLocaleDateString()}</TableCell>
                                                <TableCell>{v.customer_name || v.shop_name || 'N/A'}</TableCell>
                                                <TableCell><Chip label={v.visit_type || 'N/A'} size="small" variant="outlined" /></TableCell>
                                                <TableCell><Chip label={v.outcome || 'N/A'} size="small" color={v.outcome === 'successful' ? 'success' : 'default'} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>

                    {/* Targets */}
                    <Box>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Active Targets</Typography>
                        {targets.length === 0 ? (
                            <Alert severity="info">No active targets set</Alert>
                        ) : (
                            <Stack spacing={1}>
                                {targets.map((t) => (
                                    <Card key={t.id} variant="outlined">
                                        <CardContent sx={{ py: 1 }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body2" fontWeight="bold">{t.target_period} ({new Date(t.period_start).toLocaleDateString()} - {new Date(t.period_end).toLocaleDateString()})</Typography>
                                                <Chip label={t.status} size="small" color={t.status === 'active' ? 'success' : 'default'} />
                                            </Stack>
                                            <Grid container spacing={1} sx={{ mt: 1 }}>
                                                <Grid item xs={4}><Typography variant="caption" color="text.secondary">Visits</Typography><Typography variant="body2">{t.achieved_visits || 0} / {t.target_visits}</Typography></Grid>
                                                <Grid item xs={4}><Typography variant="caption" color="text.secondary">Orders</Typography><Typography variant="body2">{t.achieved_orders || 0} / {t.target_orders}</Typography></Grid>
                                                <Grid item xs={4}><Typography variant="caption" color="text.secondary">Revenue</Typography><Typography variant="body2">{formatCurrency(t.achieved_revenue || 0)} / {formatCurrency(t.target_revenue)}</Typography></Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
