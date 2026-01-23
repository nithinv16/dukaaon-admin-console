'use client';

import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Tabs, Tab, Button, TextField,
    Switch, FormControlLabel, Chip, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Alert, CircularProgress, Stack, Tooltip, Divider, InputAdornment,
    FormControl, InputLabel, Select, MenuItem, LinearProgress, Accordion,
    AccordionSummary, AccordionDetails, List, ListItem, ListItemText, ListItemSecondaryAction,
} from '@mui/material';
import {
    Refresh, PersonAdd, CheckCircle, Cancel, TrendingUp, People, AttachMoney,
    Link as LinkIcon, Settings, EmojiEvents, Group, BarChart, Edit, Save,
    ContentCopy, ExpandMore, Palette, Language, Campaign, Gavel, Add, Delete,
    ColorLens, AccessTime, Store, Percent,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

// --- Specialized Editors ---

const StatusEditor = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => (
    <Stack spacing={2}>
        <FormControlLabel
            control={<Switch checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />}
            label={value.enabled ? "Program Enabled" : "Program Disabled"}
        />
        <TextField
            fullWidth
            label="Status Message"
            value={value.message || ''}
            onChange={(e) => onChange({ ...value, message: e.target.value })}
            helperText="Message shown to users when program is disabled"
        />
    </Stack>
);

const LimitsEditor = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => (
    <Grid container spacing={2}>
        <Grid item xs={12}>
            <FormControlLabel
                control={<Switch checked={value.unlimited} onChange={(e) => onChange({ ...value, unlimited: e.target.checked })} />}
                label="Unlimited Referrals"
            />
        </Grid>
        {!value.unlimited && (
            <>
                <Grid item xs={6}>
                    <TextField
                        fullWidth
                        type="number"
                        label="Limit"
                        value={value.limit}
                        onChange={(e) => onChange({ ...value, limit: Number(e.target.value) })}
                    />
                </Grid>
                <Grid item xs={6}>
                    <FormControl fullWidth>
                        <InputLabel>Period</InputLabel>
                        <Select value={value.period} label="Period" onChange={(e) => onChange({ ...value, period: e.target.value })}>
                            <MenuItem value="day">Per Day</MenuItem>
                            <MenuItem value="month">Per Month</MenuItem>
                            <MenuItem value="year">Per Year</MenuItem>
                            <MenuItem value="lifetime">Lifetime</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
            </>
        )}
    </Grid>
);

const OfferEditor = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => (
    <Grid container spacing={2}>
        <Grid item xs={12}>
            <FormControlLabel
                control={<Switch checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />}
                label="Offer Active"
            />
        </Grid>
        <Grid item xs={12}>
            <TextField
                fullWidth
                label="Title"
                value={value.title || ''}
                onChange={(e) => onChange({ ...value, title: e.target.value })}
            />
        </Grid>
        <Grid item xs={12}>
            <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={value.description || ''}
                onChange={(e) => onChange({ ...value, description: e.target.value })}
            />
        </Grid>
        <Grid item xs={6}>
            <TextField
                fullWidth
                type="date"
                label="Start Date"
                InputLabelProps={{ shrink: true }}
                value={value.start_date || ''}
                onChange={(e) => onChange({ ...value, start_date: e.target.value })}
            />
        </Grid>
        <Grid item xs={6}>
            <TextField
                fullWidth
                type="date"
                label="End Date"
                InputLabelProps={{ shrink: true }}
                value={value.end_date || ''}
                onChange={(e) => onChange({ ...value, end_date: e.target.value })}
            />
        </Grid>
        <Grid item xs={6}>
            <TextField
                fullWidth
                type="number"
                label="Bonus Amount"
                value={value.bonus_amount}
                onChange={(e) => onChange({ ...value, bonus_amount: Number(e.target.value) })}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            />
        </Grid>
        <Grid item xs={6}>
            <TextField
                fullWidth
                type="number"
                label="Min Referrals Required"
                value={value.min_referrals}
                onChange={(e) => onChange({ ...value, min_referrals: Number(e.target.value) })}
            />
        </Grid>
    </Grid>
);

const LinksEditor = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => (
    <Stack spacing={2}>
        <TextField
            fullWidth
            label="Play Store URL"
            value={value.play_store || ''}
            onChange={(e) => onChange({ ...value, play_store: e.target.value })}
            InputProps={{ startAdornment: <InputAdornment position="start"><Store /></InputAdornment> }}
        />
        <TextField
            fullWidth
            label="App Store URL (iOS)"
            value={value.app_store || ''}
            onChange={(e) => onChange({ ...value, app_store: e.target.value })}
            InputProps={{ startAdornment: <InputAdornment position="start"><Store /></InputAdornment> }}
        />
        <TextField
            fullWidth
            label="Package Name"
            value={value.package_name || ''}
            onChange={(e) => onChange({ ...value, package_name: e.target.value })}
        />
    </Stack>
);

const MilestoneEditor = ({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) => (
    <Stack spacing={2}>
        {value.map((milestone, idx) => (
            <Card key={idx} variant="outlined">
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="subtitle2" sx={{ minWidth: 20 }}>#{idx + 1}</Typography>
                        <TextField
                            label="Referrals"
                            type="number"
                            size="small"
                            value={milestone.referrals}
                            onChange={(e) => {
                                const newValue = [...value];
                                newValue[idx] = { ...newValue[idx], referrals: Number(e.target.value) };
                                onChange(newValue);
                            }}
                            sx={{ width: 100 }}
                        />
                        <TextField
                            label="Bonus"
                            type="number"
                            size="small"
                            value={milestone.bonus}
                            onChange={(e) => {
                                const newValue = [...value];
                                newValue[idx] = { ...newValue[idx], bonus: Number(e.target.value) };
                                onChange(newValue);
                            }}
                            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                            sx={{ width: 120 }}
                        />
                        <TextField
                            label="Title"
                            size="small"
                            fullWidth
                            value={milestone.title}
                            onChange={(e) => {
                                const newValue = [...value];
                                newValue[idx] = { ...newValue[idx], title: e.target.value };
                                onChange(newValue);
                            }}
                        />
                        <IconButton color="error" onClick={() => onChange(value.filter((_, i) => i !== idx))}>
                            <Delete />
                        </IconButton>
                    </Stack>
                </CardContent>
            </Card>
        ))}
        <Button startIcon={<Add />} onClick={() => onChange([...value, { referrals: 0, bonus: 0, title: 'New Milestone' }])}>
            Add Milestone
        </Button>
    </Stack>
);

const TermsEditor = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => (
    <Stack spacing={3}>
        {['en', 'hi'].map((lang) => (
            <Box key={lang}>
                <Typography variant="subtitle2" gutterBottom>Terms ({lang.toUpperCase()})</Typography>
                <Stack spacing={1}>
                    {(value[lang] || []).map((term: string, idx: number) => (
                        <Stack key={idx} direction="row" spacing={1}>
                            <TextField
                                fullWidth
                                size="small"
                                value={term}
                                onChange={(e) => {
                                    const newTerms = [...(value[lang] || [])];
                                    newTerms[idx] = e.target.value;
                                    onChange({ ...value, [lang]: newTerms });
                                }}
                            />
                            <IconButton size="small" color="error" onClick={() => {
                                const newTerms = (value[lang] || []).filter((_: any, i: number) => i !== idx);
                                onChange({ ...value, [lang]: newTerms });
                            }}>
                                <Delete fontSize="small" />
                            </IconButton>
                        </Stack>
                    ))}
                    <Button startIcon={<Add />} size="small" onClick={() => {
                        const newTerms = [...(value[lang] || []), ''];
                        onChange({ ...value, [lang]: newTerms });
                    }}>
                        Add Term
                    </Button>
                </Stack>
            </Box>
        ))}
    </Stack>
);

const RewardEditor = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => (
    <Grid container spacing={2}>
        <Grid item xs={6}>
            <TextField
                fullWidth
                label="Amount"
                type="number"
                value={value.amount}
                onChange={(e) => onChange({ ...value, amount: Number(e.target.value) })}
                InputProps={{ startAdornment: <InputAdornment position="start">{value.currency === 'USD' ? '$' : '₹'}</InputAdornment> }}
            />
        </Grid>
        <Grid item xs={6}>
            <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select value={value.currency} label="Currency" onChange={(e) => onChange({ ...value, currency: e.target.value })}>
                    <MenuItem value="INR">INR (₹)</MenuItem>
                    <MenuItem value="USD">USD ($)</MenuItem>
                </Select>
            </FormControl>
        </Grid>
        {value.type && (
            <Grid item xs={12}>
                <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select value={value.type} label="Type" onChange={(e) => onChange({ ...value, type: e.target.value })}>
                        <MenuItem value="wallet_credit">Wallet Credit</MenuItem>
                        <MenuItem value="discount">Discount</MenuItem>
                        <MenuItem value="cashback">Cashback</MenuItem>
                    </Select>
                </FormControl>
            </Grid>
        )}
        <Grid item xs={12}>
            <TextField
                fullWidth
                label="Description"
                value={value.description || ''}
                onChange={(e) => onChange({ ...value, description: e.target.value })}
                multiline
                rows={2}
            />
        </Grid>
    </Grid>
);

const MultiLangEditor = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => (
    <Stack spacing={2}>
        {['en', 'hi', 'te', 'ta'].map((lang) => (
            <TextField
                key={lang}
                fullWidth
                label={`Text (${lang.toUpperCase()})`}
                value={value[lang] || ''}
                onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
                multiline={value[lang]?.length > 50}
            />
        ))}
    </Stack>
);

const ColorEditor = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => (
    <Grid container spacing={2}>
        {Object.entries(value).map(([key, color]: [string, any]) => (
            <Grid item xs={12} sm={6} key={key}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                        style={{ width: 50, height: 50, padding: 0, border: 'none', cursor: 'pointer' }}
                    />
                    <TextField
                        fullWidth
                        label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        value={color}
                        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                    />
                </Stack>
            </Grid>
        ))}
    </Grid>
);

const JsonEditor = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => (
    <TextField
        fullWidth
        multiline
        rows={10}
        value={JSON.stringify(value, null, 2)}
        onChange={(e) => {
            try {
                onChange(JSON.parse(e.target.value));
            } catch { }
        }}
        sx={{ fontFamily: 'monospace' }}
    />
);

const SettingEditor = ({ settingKey, value, onChange }: { settingKey: string; value: any; onChange: (v: any) => void }) => {
    if (['referrer_reward', 'referee_reward', 'sales_team_bonus', 'min_order_for_reward'].includes(settingKey)) return <RewardEditor value={value} onChange={onChange} />;
    if (settingKey === 'ui_banner_colors') return <ColorEditor value={value} onChange={onChange} />;
    if (['ui_banner_title', 'ui_banner_subtitle', 'ui_share_button_text', 'ui_copy_code_text', 'share_message_template'].includes(settingKey)) return <MultiLangEditor value={value} onChange={onChange} />;
    if (settingKey === 'program_status') return <StatusEditor value={value} onChange={onChange} />;
    if (settingKey === 'current_offer') return <OfferEditor value={value} onChange={onChange} />;
    if (settingKey === 'milestone_rewards') return <MilestoneEditor value={value} onChange={onChange} />;
    if (settingKey === 'app_store_links') return <LinksEditor value={value} onChange={onChange} />;
    if (settingKey === 'max_referrals_per_user') return <LimitsEditor value={value} onChange={onChange} />;
    if (settingKey === 'terms_and_conditions') return <TermsEditor value={value} onChange={onChange} />;
    return <JsonEditor value={value} onChange={onChange} />;
};

function TabPanel(props: any) {
    const { children, value, index, ...other } = props;
    return <div role="tabpanel" hidden={value !== index} {...other}>{value === index && <Box sx={{ py: 3 }}>{children}</Box>}</div>;
}

export default function ReferralsPage() {
    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [salesTeamCodes, setSalesTeamCodes] = useState<any[]>([]);
    const [referrals, setReferrals] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [referralPage, setReferralPage] = useState(1);
    const [referralTotalPages, setReferralTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('all');
    const [processing, setProcessing] = useState(false);

    // Dialog states
    const [createCodeDialogOpen, setCreateCodeDialogOpen] = useState(false);
    const [newCode, setNewCode] = useState({ code: '', salesPersonName: '', maxUses: '', customRewardAmount: '' });
    const [invalidateDialogOpen, setInvalidateDialogOpen] = useState(false);
    const [selectedReferral, setSelectedReferral] = useState<any>(null);
    const [invalidateReason, setInvalidateReason] = useState('');
    const [editSettingDialog, setEditSettingDialog] = useState<{ open: boolean; key: string; value: any } | null>(null);

    useEffect(() => { loadStats(); loadSettings(); }, []);
    useEffect(() => {
        if (tabValue === 1) loadReferrals();
        if (tabValue === 2) loadSalesTeamCodes();
        if (tabValue === 4) loadLeaderboard();
    }, [tabValue, referralPage, statusFilter]);

    const loadStats = async () => {
        try {
            const response = await fetch('/api/admin/referrals/stats');
            const result = await response.json();
            if (response.ok) setStats(result.data);
        } catch (error) { console.error('Error loading stats:', error); } finally { setLoading(false); }
    };

    const loadSettings = async () => {
        try {
            const response = await fetch('/api/admin/referrals/settings');
            const result = await response.json();
            if (response.ok) setSettings(result.data || {});
        } catch (error) { console.error('Error loading settings:', error); }
    };

    const loadReferrals = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ page: referralPage.toString(), pageSize: '20', status: statusFilter });
            const response = await fetch(`/api/admin/referrals?${params}`);
            const result = await response.json();
            if (response.ok) { setReferrals(result.data || []); setReferralTotalPages(result.totalPages || 1); }
        } catch (error) { console.error('Error loading referrals:', error); } finally { setLoading(false); }
    };

    const loadSalesTeamCodes = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/referrals/sales-team');
            const result = await response.json();
            if (response.ok) setSalesTeamCodes(result.data || []);
        } catch (error) { console.error('Error loading sales team codes:', error); } finally { setLoading(false); }
    };

    const loadLeaderboard = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/referrals/leaderboard?limit=20');
            const result = await response.json();
            if (response.ok) setLeaderboard(result.data || []);
        } catch (error) { console.error('Error loading leaderboard:', error); } finally { setLoading(false); }
    };

    const handleSaveSetting = async () => {
        if (!editSettingDialog) return;
        try {
            setProcessing(true);
            const response = await fetch('/api/admin/referrals/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: editSettingDialog.key, value: editSettingDialog.value }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast.success('Setting updated successfully');
            loadSettings();
            setEditSettingDialog(null);
        } catch (error: any) {
            toast.error(error.message || 'Failed to save setting');
        } finally {
            setProcessing(false);
        }
    };

    const handleCreateCode = async () => {
        if (!newCode.code || !newCode.salesPersonName) { toast.error('Code and sales person name are required'); return; }
        try {
            setProcessing(true);
            const response = await fetch('/api/admin/referrals/sales-team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    code: newCode.code,
                    salesPersonName: newCode.salesPersonName,
                    maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
                    customReward: newCode.customRewardAmount ? { amount: parseInt(newCode.customRewardAmount), currency: 'INR' } : null,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast.success('Sales team code created!');
            setCreateCodeDialogOpen(false);
            setNewCode({ code: '', salesPersonName: '', maxUses: '', customRewardAmount: '' });
            loadSalesTeamCodes();
        } catch (error: any) {
            toast.error(error.message || 'Failed to create code');
        } finally {
            setProcessing(false);
        }
    };

    const handleToggleCode = async (codeId: string, isActive: boolean) => {
        try {
            const response = await fetch('/api/admin/referrals/sales-team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: isActive ? 'deactivate' : 'activate', codeId }),
            });
            if (!response.ok) throw new Error('Failed to update code');
            toast.success(`Code ${isActive ? 'deactivated' : 'activated'}`);
            loadSalesTeamCodes();
        } catch (error: any) { toast.error(error.message); }
    };

    const handleReferralAction = async (action: string, referralId: string) => {
        try {
            setProcessing(true);
            const response = await fetch('/api/admin/referrals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, referralId }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast.success(result.message);
            loadReferrals();
            loadStats();
        } catch (error: any) {
            toast.error(error.message || 'Action failed');
        } finally {
            setProcessing(false);
        }
    };

    const handleInvalidateReferral = async () => {
        if (!selectedReferral || !invalidateReason) return;
        try {
            setProcessing(true);
            const response = await fetch('/api/admin/referrals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'invalidate', referralId: selectedReferral.id, reason: invalidateReason }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast.success('Referral invalidated');
            setInvalidateDialogOpen(false);
            setSelectedReferral(null);
            setInvalidateReason('');
            loadReferrals();
            loadStats();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setProcessing(false);
        }
    };

    const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };
    const getStatusColor = (status: string) => ({ pending: 'warning', verified: 'info', rewarded: 'success', invalid: 'error' }[status] || 'default');
    const formatCurrency = (amount: number) => `₹${(amount || 0).toLocaleString('en-IN')}`;

    const renderSettingValue = (key: string, value: any) => {
        if (['referrer_reward', 'referee_reward', 'sales_team_bonus'].includes(key)) {
            return (
                <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label={`${value.currency === 'USD' ? '$' : '₹'}${value.amount}`} color="primary" size="small" />
                    <Typography variant="body2" color="text.secondary">{value.description}</Typography>
                </Stack>
            );
        }
        if (key === 'program_status') {
            return (
                <Stack spacing={0.5}>
                    <Chip label={value.enabled ? 'Enabled' : 'Disabled'} color={value.enabled ? 'success' : 'error'} size="small" sx={{ width: 'fit-content' }} />
                    <Typography variant="caption" color="text.secondary">{value.message || ''}</Typography>
                </Stack>
            );
        }
        if (key === 'milestone_rewards') {
            return <Chip label={`${Array.isArray(value) ? value.length : 0} Milestones`} size="small" variant="outlined" />;
        }
        if (key === 'current_offer') {
            return (
                <Stack spacing={0.5}>
                    <Chip label={value.enabled ? 'Active Offer' : 'No Active Offer'} color={value.enabled ? 'warning' : 'default'} size="small" sx={{ width: 'fit-content' }} />
                    {value.enabled && <Typography variant="caption" noWrap>{value.title}</Typography>}
                </Stack>
            );
        }
        if (typeof value === 'object') return <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{JSON.stringify(value).substring(0, 50)}...</Typography>;
        return String(value);
    };

    const settingGroups = [
        { title: 'Reward Settings', icon: <AttachMoney />, keys: ['referrer_reward', 'referee_reward', 'min_order_for_reward', 'max_referrals_per_user', 'reward_expiry_days', 'sales_team_bonus'] },
        { title: 'Program Status', icon: <Settings />, keys: ['program_status'] },
        { title: 'UI Content', icon: <Language />, keys: ['ui_banner_title', 'ui_banner_subtitle', 'ui_share_button_text', 'ui_copy_code_text'] },
        { title: 'Share Message', icon: <Campaign />, keys: ['share_message_template'] },
        { title: 'Colors & Design', icon: <Palette />, keys: ['ui_banner_colors'] },
        { title: 'Special Offers', icon: <EmojiEvents />, keys: ['current_offer', 'milestone_rewards'] },
        { title: 'App Links', icon: <LinkIcon />, keys: ['app_store_links'] },
        { title: 'Terms & Conditions', icon: <Gavel />, keys: ['terms_and_conditions'] },
    ];

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">Referral Management</Typography>
                <Button variant="outlined" startIcon={<Refresh />} onClick={() => { loadStats(); loadSettings(); }}>Refresh</Button>
            </Box>

            {/* Stats Cards */}
            {stats && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    {[
                        { label: 'Total Referrals', value: stats.totalReferrals, icon: <People color="primary" /> },
                        { label: 'Pending', value: stats.pendingReferrals, color: 'warning.light' },
                        { label: 'Rewarded', value: stats.successfulReferrals, color: 'success.light' },
                        { label: 'Rewards Paid', value: formatCurrency(stats.totalRewardsPaid), icon: <AttachMoney color="success" /> },
                        { label: 'Link Clicks', value: stats.totalClicks, icon: <LinkIcon color="info" /> },
                        { label: 'Conversion', value: stats.conversionRate, icon: <TrendingUp color="secondary" /> },
                    ].map((stat, idx) => (
                        <Grid item xs={6} sm={4} md={2} key={idx}>
                            <Card sx={{ bgcolor: stat.color }}>
                                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                    {stat.icon}
                                    <Typography variant="h5" fontWeight="bold">{stat.value}</Typography>
                                    <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Card>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab icon={<Settings />} label="Settings" iconPosition="start" />
                    <Tab icon={<People />} label="Referrals" iconPosition="start" />
                    <Tab icon={<Group />} label="Sales Team" iconPosition="start" />
                    <Tab icon={<BarChart />} label="Analytics" iconPosition="start" />
                    <Tab icon={<EmojiEvents />} label="Leaderboard" iconPosition="start" />
                </Tabs>

                {/* Settings Tab */}
                <TabPanel value={tabValue} index={0}>
                    <Box sx={{ p: 2 }}>
                        <Alert severity="info" sx={{ mb: 2 }}>Click "Edit" on any card to update the configuration.</Alert>
                        <Grid container spacing={2}>
                            {settingGroups.map((group) => (
                                <Grid item xs={12} key={group.title}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                                                {group.icon}
                                                <Typography variant="h6">{group.title}</Typography>
                                            </Stack>
                                            <Grid container spacing={2}>
                                                {group.keys.map((key) => {
                                                    const setting = settings[key];
                                                    if (!setting) return null;
                                                    return (
                                                        <Grid item xs={12} sm={6} md={4} key={key}>
                                                            <Card variant="outlined" sx={{ height: '100%', '&:hover': { bgcolor: 'action.hover' } }}>
                                                                <CardContent>
                                                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                                                                        <Typography variant="subtitle2" fontWeight="bold">{key.replace(/_/g, ' ').toUpperCase()}</Typography>
                                                                        <IconButton size="small" onClick={() => setEditSettingDialog({ open: true, key, value: setting.value })} color="primary">
                                                                            <Edit fontSize="small" />
                                                                        </IconButton>
                                                                    </Stack>
                                                                    <Box sx={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
                                                                        {renderSettingValue(key, setting.value)}
                                                                    </Box>
                                                                </CardContent>
                                                            </Card>
                                                        </Grid>
                                                    );
                                                })}
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                </TabPanel>

                {/* Referrals Tab */}
                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ p: 2 }}>
                        <FormControl size="small" sx={{ minWidth: 150, mb: 2 }}>
                            <InputLabel>Status</InputLabel>
                            <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setReferralPage(1); }}>
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="pending">Pending</MenuItem>
                                <MenuItem value="verified">Verified</MenuItem>
                                <MenuItem value="rewarded">Rewarded</MenuItem>
                                <MenuItem value="invalid">Invalid</MenuItem>
                            </Select>
                        </FormControl>
                        {loading ? <LinearProgress /> : referrals.length === 0 ? <Alert severity="info">No referrals found</Alert> : (
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead><TableRow><TableCell>Referrer</TableCell><TableCell>Referee</TableCell><TableCell>Code</TableCell><TableCell>Status</TableCell><TableCell>Reward</TableCell><TableCell>Date</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {referrals.map((r) => (
                                            <TableRow key={r.id} hover>
                                                <TableCell>{r.referrer?.phone_number || 'N/A'}</TableCell>
                                                <TableCell>{r.referee?.phone_number || 'N/A'}</TableCell>
                                                <TableCell><Chip label={r.referral_code_data?.code || 'N/A'} size="small" variant="outlined" /></TableCell>
                                                <TableCell><Chip label={r.status} size="small" color={getStatusColor(r.status) as any} /></TableCell>
                                                <TableCell>{formatCurrency(r.referrer_reward_amount)}</TableCell>
                                                <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell align="right">
                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                        {r.status === 'pending' && <Tooltip title="Approve"><IconButton size="small" color="info" onClick={() => handleReferralAction('approve', r.id)}><CheckCircle /></IconButton></Tooltip>}
                                                        {r.status === 'verified' && <Tooltip title="Reward"><IconButton size="small" color="success" onClick={() => handleReferralAction('reward', r.id)}><AttachMoney /></IconButton></Tooltip>}
                                                        {['pending', 'verified'].includes(r.status) && <Tooltip title="Invalidate"><IconButton size="small" color="error" onClick={() => { setSelectedReferral(r); setInvalidateDialogOpen(true); }}><Cancel /></IconButton></Tooltip>}
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                        {referralTotalPages > 1 && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 1 }}>
                                <Button disabled={referralPage === 1} onClick={() => setReferralPage(p => p - 1)}>Prev</Button>
                                <Typography sx={{ alignSelf: 'center' }}>Page {referralPage} of {referralTotalPages}</Typography>
                                <Button disabled={referralPage === referralTotalPages} onClick={() => setReferralPage(p => p + 1)}>Next</Button>
                            </Box>
                        )}
                    </Box>
                </TabPanel>

                {/* Sales Team Tab */}
                <TabPanel value={tabValue} index={2}>
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6">Sales Team Codes</Typography>
                            <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setCreateCodeDialogOpen(true)}>Create Code</Button>
                        </Box>
                        {loading ? <LinearProgress /> : salesTeamCodes.length === 0 ? <Alert severity="info">No sales team codes</Alert> : (
                            <TableContainer component={Paper} variant="outlined">
                                <Table>
                                    <TableHead><TableRow><TableCell>Code</TableCell><TableCell>Sales Person</TableCell><TableCell align="center">Signups</TableCell><TableCell>Custom Reward</TableCell><TableCell>Status</TableCell><TableCell align="right">Toggle</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {salesTeamCodes.map((c) => (
                                            <TableRow key={c.id} hover>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Typography fontWeight="bold">{c.code}</Typography>
                                                        <IconButton size="small" onClick={() => copyToClipboard(c.code)}><ContentCopy fontSize="small" /></IconButton>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>{c.salesPersonName}</TableCell>
                                                <TableCell align="center"><Chip label={c.totalSignups} size="small" /></TableCell>
                                                <TableCell>{c.customReward ? formatCurrency(c.customReward.amount) : 'Default'}</TableCell>
                                                <TableCell><Chip label={c.isActive ? 'Active' : 'Inactive'} color={c.isActive ? 'success' : 'default'} size="small" /></TableCell>
                                                <TableCell align="right"><Switch checked={c.isActive} onChange={() => handleToggleCode(c.id, c.isActive)} size="small" /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                </TabPanel>

                {/* Analytics Tab */}
                <TabPanel value={tabValue} index={3}>
                    <Box sx={{ p: 2 }}>
                        <Grid container spacing={3}>
                            {[{ label: 'Total Clicks', value: stats?.totalClicks }, { label: 'Converted', value: stats?.convertedClicks }, { label: 'Conversion Rate', value: stats?.conversionRate }].map((s, i) => (
                                <Grid item xs={12} md={4} key={i}>
                                    <Card variant="outlined"><CardContent><Typography variant="subtitle2" color="text.secondary">{s.label}</Typography><Typography variant="h4">{s.value || 0}</Typography></CardContent></Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                </TabPanel>

                {/* Leaderboard Tab */}
                <TabPanel value={tabValue} index={4}>
                    <Box sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Top Referrers</Typography>
                        {loading ? <LinearProgress /> : leaderboard.length === 0 ? <Alert severity="info">No referrers yet</Alert> : (
                            <TableContainer component={Paper} variant="outlined">
                                <Table>
                                    <TableHead><TableRow><TableCell>Rank</TableCell><TableCell>User</TableCell><TableCell>Business</TableCell><TableCell align="center">Referrals</TableCell><TableCell align="right">Earnings</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {leaderboard.map((e) => (
                                            <TableRow key={e.id} hover>
                                                <TableCell>{e.rank <= 3 ? <EmojiEvents color={e.rank === 1 ? 'warning' : 'action'} /> : `#${e.rank}`}</TableCell>
                                                <TableCell>{e.phoneNumber}</TableCell>
                                                <TableCell>{e.businessName}</TableCell>
                                                <TableCell align="center"><Chip label={e.totalReferrals} color="primary" size="small" /></TableCell>
                                                <TableCell align="right">{formatCurrency(e.totalEarnings)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                </TabPanel>
            </Card>

            {/* Edit Setting Dialog - Uses Specialized Editors */}
            <Dialog open={!!editSettingDialog?.open} onClose={() => setEditSettingDialog(null)} maxWidth="md" fullWidth>
                <DialogTitle>Edit Setting: {editSettingDialog?.key.replace(/_/g, ' ').toUpperCase()}</DialogTitle>
                <DialogContent dividers>
                    {editSettingDialog && (
                        <SettingEditor
                            settingKey={editSettingDialog.key}
                            value={editSettingDialog.value}
                            onChange={(newValue) => setEditSettingDialog((prev) => prev ? { ...prev, value: newValue } : null)}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditSettingDialog(null)}>Cancel</Button>
                    <Button variant="contained" startIcon={<Save />} onClick={handleSaveSetting} disabled={processing}>
                        {processing ? <CircularProgress size={20} /> : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Create Code Dialog */}
            <Dialog open={createCodeDialogOpen} onClose={() => setCreateCodeDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Sales Team Code</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Code" value={newCode.code} onChange={(e) => setNewCode((p) => ({ ...p, code: e.target.value.toUpperCase() }))} fullWidth />
                        <TextField label="Sales Person Name" value={newCode.salesPersonName} onChange={(e) => setNewCode((p) => ({ ...p, salesPersonName: e.target.value }))} fullWidth />
                        <TextField label="Max Uses (optional)" type="number" value={newCode.maxUses} onChange={(e) => setNewCode((p) => ({ ...p, maxUses: e.target.value }))} fullWidth />
                        <TextField label="Custom Reward Amount (optional)" type="number" value={newCode.customRewardAmount} onChange={(e) => setNewCode((p) => ({ ...p, customRewardAmount: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} fullWidth />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateCodeDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateCode} disabled={processing}>{processing ? <CircularProgress size={20} /> : 'Create'}</Button>
                </DialogActions>
            </Dialog>

            {/* Invalidate Dialog */}
            <Dialog open={invalidateDialogOpen} onClose={() => setInvalidateDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Invalidate Referral</DialogTitle>
                <DialogContent>
                    <TextField label="Reason" value={invalidateReason} onChange={(e) => setInvalidateReason(e.target.value)} multiline rows={3} fullWidth sx={{ mt: 1 }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setInvalidateDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={handleInvalidateReferral} disabled={processing || !invalidateReason}>{processing ? <CircularProgress size={20} /> : 'Invalidate'}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
