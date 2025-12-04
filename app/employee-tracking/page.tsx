'use client';

import React, { useState, useEffect } from 'react';
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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
} from '@mui/material';
import {
    Person,
    AccessTime,
    Assessment,
    Timeline,
    CheckCircle,
    Error as ErrorIcon,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface ActivitySummary {
    total_sessions: number;
    total_time_worked_minutes: number;
    active_time_minutes: number;
    idle_time_minutes: number;
    total_login_time: string;
    last_logout_time: string;
    products_created: number;
    products_updated: number;
    master_products_created: number;
    master_products_updated: number;
    bulk_uploads: number;
    scan_receipts: number;
    total_items_processed: number;
    avg_time_per_item_seconds: number;
    avg_time_per_product_seconds: number;
}

interface Session {
    id: string;
    login_time: string;
    logout_time: string | null;
    duration_minutes: number | null;
    ip_address: string;
    location_city: string;
    location_country: string;
    is_active: boolean;
}

interface Activity {
    id: string;
    action_type: string;
    entity_type: string;
    operation_start_time: string;
    operation_end_time: string | null;
    duration_ms: number | null;
    duration_seconds: number | null;
    items_processed: number;
    operation_status: string;
}

export default function EmployeeTrackingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<ActivitySummary | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [breakdown, setBreakdown] = useState<Record<string, number>>({});
    const [dailyBreakdown, setDailyBreakdown] = useState<any[]>([]);
    const [pageStats, setPageStats] = useState<any[]>([]);
    const [activeTargets, setActiveTargets] = useState<any[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string }>>([]);
    const [dateRange, setDateRange] = useState({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });
    const [accessDenied, setAccessDenied] = useState(false);

    // Access control: redirect employees immediately
    useEffect(() => {
        if (!authLoading && user) {
            if (user.role === 'Employee') {
                setAccessDenied(true);
                toast.error('Access denied: You do not have permission to view this page');
                router.push('/');
            }
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        loadEmployees();
    }, []);

    useEffect(() => {
        if (selectedEmployee) {
            loadMetrics();
        }
    }, [selectedEmployee, dateRange]);

    const loadEmployees = async () => {
        try {
            const response = await fetch('/api/admin/admin-users');
            if (response.ok) {
                const data = await response.json();
                setEmployees(data.admins || []);
                // Auto-select first employee
                if (data.admins?.length > 0) {
                    setSelectedEmployee(data.admins[0].id);
                }
            }
        } catch (error) {
            console.error('Error loading employees:', error);
            toast.error('Failed to load employees');
        }
    };

    const loadMetrics = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                admin_id: selectedEmployee,
                start_date: `${dateRange.start}T00:00:00Z`,
                end_date: `${dateRange.end}T23:59:59Z`,
            });

            const response = await fetch(`/api/admin/employee-tracking?${params}`);
            if (response.ok) {
                const data = await response.json();
                setSummary(data.summary);
                setSessions(data.sessions || []);
                setActivities(data.activities || []);
                setBreakdown(data.breakdown || {});
                setDailyBreakdown(data.dailyBreakdown || []);
                setPageStats(data.pageStats || []);
                setActiveTargets(data.activeTargets || []);
            } else {
                throw new Error('Failed to fetch metrics');
            }
        } catch (error) {
            console.error('Error loading metrics:', error);
            toast.error('Failed to load employee metrics');
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        return `${hours}h ${mins}m`;
    };

    const formatSeconds = (seconds: number | null | undefined) => {
        if (seconds === null || seconds === undefined) return 'N/A';
        if (seconds < 0.01) return 'N/A';
        if (seconds < 1) return '< 1s';
        if (seconds < 60) return `${seconds.toFixed(1)}s`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}m ${secs}s`;
    };

    const selectedEmployeeName = employees.find((e) => e.id === selectedEmployee)?.name || 'Employee';

    // Show loading while checking authentication
    if (authLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    // Show access denied for employees
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
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Employee Activity Tracking {selectedEmployee && `- ${selectedEmployeeName}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Monitor employee productivity, work hours, and activity metrics
                </Typography>
            </Box>

            {/* Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                            <FormControl fullWidth>
                                <InputLabel>Employee</InputLabel>
                                <Select
                                    value={selectedEmployee}
                                    onChange={(e) => setSelectedEmployee(e.target.value)}
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
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="Start Date"
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="End Date"
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : summary ? (
                <>
                    {/* Summary Cards */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <AccessTime color="primary" sx={{ fontSize: 40 }} />
                                        <Box>
                                            <Typography variant="h4">
                                                {formatDuration(summary.active_time_minutes)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Active Work Time
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatDuration(summary.idle_time_minutes)} idle • {summary.total_sessions} sessions
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Assessment color="success" sx={{ fontSize: 40 }} />
                                        <Box>
                                            <Typography variant="h4">{summary.products_created}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Products Created
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {summary.products_updated} updated
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <CheckCircle color="info" sx={{ fontSize: 40 }} />
                                        <Box>
                                            <Typography variant="h4">{summary.master_products_created}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Master Products Created
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {summary.master_products_updated} updated
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Timeline color="warning" sx={{ fontSize: 40 }} />
                                        <Box>
                                            <Typography variant="h4">{summary.total_items_processed}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Items Processed
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {summary.bulk_uploads} bulk uploads, {summary.scan_receipts} scans
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Performance Metrics */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Performance Metrics
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                                        <Typography variant="body2">Average Time Per Product</Typography>
                                        <Typography variant="h5">
                                            {formatSeconds(summary.avg_time_per_product_seconds)}
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                                        <Typography variant="body2">Average Time Per Item</Typography>
                                        <Typography variant="h5">
                                            {formatSeconds(summary.avg_time_per_item_seconds)}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>

                    {/* Daily Breakdown Table */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Daily Work Breakdown
                            </Typography>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Date</TableCell>
                                            <TableCell>Active Time</TableCell>
                                            <TableCell>Idle Time</TableCell>
                                            <TableCell>Sessions</TableCell>
                                            <TableCell>Products Created</TableCell>
                                            <TableCell>Products Updated</TableCell>
                                            <TableCell>First Login</TableCell>
                                            <TableCell>Last Logout</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {dailyBreakdown.slice(0, 30).map((day: any) => (
                                            <TableRow key={day.work_date}>
                                                <TableCell>
                                                    {new Date(day.work_date).toLocaleDateString('en-US', {
                                                        weekday: 'short',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight="bold" color="primary">
                                                        {formatDuration(day.active_time_minutes)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {formatDuration(day.idle_time_minutes)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>{day.sessions_count}</TableCell>
                                                <TableCell>{day.products_created}</TableCell>
                                                <TableCell>{day.products_updated}</TableCell>
                                                <TableCell>
                                                    {day.first_login || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {day.last_logout || 'N/A'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {dailyBreakdown.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} align="center">
                                                    <Typography color="text.secondary">
                                                        No activity data available for the selected date range
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>

                    {/* Active Targets */}
                    {activeTargets.length > 0 && (
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Active Targets
                                </Typography>
                                <Grid container spacing={2}>
                                    {activeTargets.map((target: any) => (
                                        <Grid item xs={12} md={6} key={target.id}>
                                            <Paper sx={{ p: 2, border: 1, borderColor: 'primary.light' }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                    <Typography variant="subtitle2">
                                                        {target.period_type.charAt(0).toUpperCase() + target.period_type.slice(1)} Target
                                                    </Typography>
                                                    <Chip
                                                        label={`${target.completion_percentage || 0}%`}
                                                        color={target.completion_percentage >= 80 ? 'success' : target.completion_percentage >= 50 ? 'warning' : 'error'}
                                                        size="small"
                                                    />
                                                </Box>
                                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                                    {new Date(target.period_start).toLocaleDateString()} - {new Date(target.period_end).toLocaleDateString()}
                                                </Typography>
                                                <Grid container spacing={1} sx={{ mt: 1 }}>
                                                    <Grid item xs={6}>
                                                        <Typography variant="body2">
                                                            Products: {target.actual_products_created || 0}/{target.target_products_created}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="body2">
                                                            Hours: {(target.actual_active_hours || 0).toFixed(1)}/{target.target_active_hours}h
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </Paper>
                                        </Grid>
                                    ))}
                                </Grid>
                            </CardContent>
                        </Card>
                    )}

                    {/* Page Visit Statistics */}
                    {pageStats.length > 0 && (
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Page Visit Statistics
                                </Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Page</TableCell>
                                                <TableCell align="right">Visits</TableCell>
                                                <TableCell align="right">Total Time</TableCell>
                                                <TableCell align="right">Avg Time</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {pageStats.slice(0, 10).map((page: any) => (
                                                <TableRow key={page.page_path}>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight="medium">
                                                            {page.page_name}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {page.page_path}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">{page.visit_count}</TableCell>
                                                    <TableCell align="right">
                                                        {formatDuration(Math.round(page.total_duration_seconds / 60))}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {page.avg_duration_seconds < 60
                                                            ? `${page.avg_duration_seconds}s`
                                                            : formatDuration(Math.round(page.avg_duration_seconds / 60))}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Sessions Table */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Session History
                            </Typography>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Login Time</TableCell>
                                            <TableCell>Logout Time</TableCell>
                                            <TableCell>Duration</TableCell>
                                            <TableCell>Location</TableCell>
                                            <TableCell>IP Address</TableCell>
                                            <TableCell>Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {sessions.slice(0, 10).map((session) => (
                                            <TableRow key={session.id}>
                                                <TableCell>
                                                    {new Date(session.login_time).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    {session.logout_time
                                                        ? new Date(session.logout_time).toLocaleString()
                                                        : 'Active'}
                                                </TableCell>
                                                <TableCell>{formatDuration(session.duration_minutes)}</TableCell>
                                                <TableCell>
                                                    {session.location_city
                                                        ? `${session.location_city}, ${session.location_country}`
                                                        : 'N/A'}
                                                </TableCell>
                                                <TableCell>{session.ip_address || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={session.is_active ? 'Active' : 'Ended'}
                                                        color={session.is_active ? 'success' : 'default'}
                                                        size="small"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>

                    {/* Recent Activities */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Recent Activities
                            </Typography>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Action</TableCell>
                                            <TableCell>Entity</TableCell>
                                            <TableCell>Time</TableCell>
                                            <TableCell>Duration</TableCell>
                                            <TableCell>Items</TableCell>
                                            <TableCell>Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {activities.slice(0, 20).map((activity) => (
                                            <TableRow key={activity.id}>
                                                <TableCell>
                                                    <Chip label={activity.action_type.replace(/_/g, ' ')} size="small" />
                                                </TableCell>
                                                <TableCell>{activity.entity_type}</TableCell>
                                                <TableCell>
                                                    {new Date(activity.operation_start_time).toLocaleString()}
                                                </TableCell>
                                                <TableCell>{formatSeconds(activity.duration_seconds)}</TableCell>
                                                <TableCell>{activity.items_processed}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={activity.operation_status}
                                                        color={
                                                            activity.operation_status === 'success'
                                                                ? 'success'
                                                                : activity.operation_status === 'failed'
                                                                    ? 'error'
                                                                    : 'warning'
                                                        }
                                                        size="small"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <Alert severity="info">Select an employee and date range to view metrics</Alert>
            )}
        </Box>
    );
}
