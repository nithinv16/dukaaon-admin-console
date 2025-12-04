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
    Avatar,
    LinearProgress,
    IconButton,
    Tooltip,
    Badge,
} from '@mui/material';
import {
    Person,
    AccessTime,
    Inventory,
    TrendingUp,
    Refresh,
    Circle,
    Computer,
    Coffee,
    PowerSettingsNew,
    Speed,
    Groups,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface EmployeeStatus {
    id: string;
    name: string;
    email: string;
    role: string;
    status: 'active' | 'idle' | 'offline';
    last_activity: string | null;
    current_page: string | null;
    current_action: string | null;
    session_id: string | null;
    login_time: string | null;
    today_stats: {
        active_time_minutes: number;
        products_created: number;
        products_updated: number;
        master_products_created: number;
        bulk_uploads: number;
        receipt_scans: number;
        total_items_processed: number;
    };
}

interface LiveData {
    employees: EmployeeStatus[];
    summary: {
        total: number;
        active: number;
        idle: number;
        offline: number;
    };
    team_today_stats: {
        total_active_time_minutes: number;
        total_products_created: number;
        total_products_updated: number;
        total_items_processed: number;
    };
    last_updated: string;
}

const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds

export default function LiveDashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<LiveData | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);
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

    const loadData = useCallback(async () => {
        // Don't load data if access denied
        if (accessDenied) return;
        
        try {
            const response = await fetch('/api/admin/live-status');
            if (response.ok) {
                const result = await response.json();
                setData(result);
                setLastRefresh(new Date());
            } else {
                throw new Error('Failed to fetch live status');
            }
        } catch (error) {
            console.error('Error loading live status:', error);
        } finally {
            setLoading(false);
        }
    }, [accessDenied]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(loadData, AUTO_REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [autoRefresh, loadData]);

    const formatDuration = (minutes: number) => {
        if (!minutes) return '0m';
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    const formatTimeAgo = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        const diff = Date.now() - new Date(dateStr).getTime();
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'success';
            case 'idle':
                return 'warning';
            case 'offline':
            default:
                return 'default';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <Computer fontSize="small" />;
            case 'idle':
                return <Coffee fontSize="small" />;
            case 'offline':
            default:
                return <PowerSettingsNew fontSize="small" />;
        }
    };

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
                        Real-Time Activity Dashboard
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Live monitoring of employee activity and productivity
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                        Last updated: {lastRefresh.toLocaleTimeString()}
                    </Typography>
                    <Tooltip title="Refresh now">
                        <IconButton onClick={loadData} disabled={loading}>
                            <Refresh />
                        </IconButton>
                    </Tooltip>
                    <Chip
                        label={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                        color={autoRefresh ? 'success' : 'default'}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        size="small"
                    />
                </Box>
            </Box>

            {loading && !data ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : data ? (
                <>
                    {/* Summary Cards */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        <Grid item xs={6} sm={3}>
                            <Card sx={{ bgcolor: 'success.light' }}>
                                <CardContent>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Badge badgeContent={data.summary.active} color="success">
                                            <Avatar sx={{ bgcolor: 'success.main' }}>
                                                <Computer />
                                            </Avatar>
                                        </Badge>
                                        <Box>
                                            <Typography variant="h4" color="success.dark">
                                                {data.summary.active}
                                            </Typography>
                                            <Typography variant="body2" color="success.dark">
                                                Active Now
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={6} sm={3}>
                            <Card sx={{ bgcolor: 'warning.light' }}>
                                <CardContent>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Badge badgeContent={data.summary.idle} color="warning">
                                            <Avatar sx={{ bgcolor: 'warning.main' }}>
                                                <Coffee />
                                            </Avatar>
                                        </Badge>
                                        <Box>
                                            <Typography variant="h4" color="warning.dark">
                                                {data.summary.idle}
                                            </Typography>
                                            <Typography variant="body2" color="warning.dark">
                                                Idle
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={6} sm={3}>
                            <Card sx={{ bgcolor: 'grey.200' }}>
                                <CardContent>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Badge badgeContent={data.summary.offline} color="default">
                                            <Avatar sx={{ bgcolor: 'grey.500' }}>
                                                <PowerSettingsNew />
                                            </Avatar>
                                        </Badge>
                                        <Box>
                                            <Typography variant="h4" color="text.secondary">
                                                {data.summary.offline}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Offline
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={6} sm={3}>
                            <Card sx={{ bgcolor: 'primary.light' }}>
                                <CardContent>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                                            <Groups />
                                        </Avatar>
                                        <Box>
                                            <Typography variant="h4" color="primary.dark">
                                                {data.summary.total}
                                            </Typography>
                                            <Typography variant="body2" color="primary.dark">
                                                Total Team
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Team Today Stats */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Team Today's Progress
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={3}>
                                <Grid item xs={6} md={3}>
                                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
                                        <AccessTime color="primary" sx={{ fontSize: 32 }} />
                                        <Typography variant="h5" color="primary">
                                            {formatDuration(data.team_today_stats.total_active_time_minutes)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Total Active Time
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                                        <Inventory color="success" sx={{ fontSize: 32 }} />
                                        <Typography variant="h5" color="success.main">
                                            {data.team_today_stats.total_products_created}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Products Created
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
                                        <TrendingUp color="info" sx={{ fontSize: 32 }} />
                                        <Typography variant="h5" color="info.main">
                                            {data.team_today_stats.total_products_updated}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Products Updated
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}>
                                        <Speed color="warning" sx={{ fontSize: 32 }} />
                                        <Typography variant="h5" color="warning.main">
                                            {data.team_today_stats.total_items_processed}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Items Processed
                                        </Typography>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>

                    {/* Employee Status Cards */}
                    <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                        Employee Status
                    </Typography>
                    <Grid container spacing={2}>
                        {data.employees
                            .sort((a, b) => {
                                // Sort by status: active first, then idle, then offline
                                const order = { active: 0, idle: 1, offline: 2 };
                                return order[a.status] - order[b.status];
                            })
                            .map((employee) => (
                                <Grid item xs={12} sm={6} md={4} key={employee.id}>
                                    <Card
                                        sx={{
                                            borderLeft: 4,
                                            borderColor:
                                                employee.status === 'active'
                                                    ? 'success.main'
                                                    : employee.status === 'idle'
                                                    ? 'warning.main'
                                                    : 'grey.400',
                                        }}
                                    >
                                        <CardContent>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Avatar
                                                        sx={{
                                                            bgcolor:
                                                                employee.status === 'active'
                                                                    ? 'success.main'
                                                                    : employee.status === 'idle'
                                                                    ? 'warning.main'
                                                                    : 'grey.400',
                                                        }}
                                                    >
                                                        {employee.name.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="subtitle1" fontWeight="bold">
                                                            {employee.name}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {employee.role}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Chip
                                                    icon={getStatusIcon(employee.status)}
                                                    label={employee.status}
                                                    color={getStatusColor(employee.status) as any}
                                                    size="small"
                                                />
                                            </Box>

                                            {employee.status !== 'offline' && (
                                                <>
                                                    {employee.current_page && (
                                                        <Typography
                                                            variant="body2"
                                                            sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}
                                                        >
                                                            <Circle sx={{ fontSize: 8, color: 'success.main' }} />
                                                            On: <strong>{employee.current_page}</strong>
                                                        </Typography>
                                                    )}
                                                    {employee.current_action && (
                                                        <Typography variant="body2" color="primary" sx={{ mb: 1 }}>
                                                            {employee.current_action}
                                                        </Typography>
                                                    )}
                                                </>
                                            )}

                                            <Typography variant="caption" color="text.secondary" display="block">
                                                Last activity: {formatTimeAgo(employee.last_activity)}
                                            </Typography>

                                            <Divider sx={{ my: 1.5 }} />

                                            <Typography variant="caption" color="text.secondary" gutterBottom>
                                                Today's Stats
                                            </Typography>
                                            <Grid container spacing={1} sx={{ mt: 0.5 }}>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2">
                                                        <AccessTime sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                                        {formatDuration(employee.today_stats.active_time_minutes)}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2">
                                                        <Inventory sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                                        {employee.today_stats.products_created} created
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2">
                                                        <TrendingUp sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                                        {employee.today_stats.products_updated} updated
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2">
                                                        <Speed sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                                        {employee.today_stats.total_items_processed} items
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                    </Grid>
                </>
            ) : (
                <Alert severity="error">Failed to load live status data</Alert>
            )}
        </Box>
    );
}

