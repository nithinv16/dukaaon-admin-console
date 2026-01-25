'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Tooltip,
  Badge,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Stack,
} from '@mui/material';
import {
  WhatsApp,
  Send,
  Message,
  Search,
  Refresh,
  Edit,
  CheckCircle,
  Cancel,
  Warning,
  TrendingUp,
  TrendingDown,
  Schedule,
  Person,
  ShoppingCart,
  Payment,
  LocalShipping,
  Campaign,
  Support,
  ExpandMore,
  ExpandLess,
  Visibility,
  ContentCopy,
  RestartAlt,
  Analytics,
  Chat,
  Settings,
  Timer,
  Speed,
  FilterList,
  Download,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';

// Types
interface Template {
  id: string;
  template_key: string;
  template_name: string;
  authkey_template_id: string;
  category: string;
  description: string;
  variable_count: number;
  variable_mapping: Record<string, string>;
  is_automatic: boolean;
  is_enabled: boolean;
  trigger_event: string;
  trigger_conditions: Record<string, any>;
  send_time_preference: string;
  cooldown_minutes: number;
  max_sends_per_day: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

interface MessageRecord {
  id: string;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string;
  template_key: string;
  template_variables: Record<string, any>;
  related_order_id: string;
  related_user_id: string;
  ai_intent: string;
  ai_confidence: number;
  ai_response: string;
  language: string;
  status: string;
  error_message: string;
  authkey_message_id: string;
  created_at: string;
  processed_at: string;
}

interface Conversation {
  id: string;
  phone_number: string;
  user_id: string;
  user_role: string;
  last_message_at: string;
  last_message_content: string;
  last_message_direction: string;
  context: Record<string, any>;
  pending_action: string;
  pending_order_id: string;
  total_messages: number;
  ai_interactions: number;
}

interface OrderResponse {
  id: string;
  order_id: string;
  seller_id: string;
  phone_number: string;
  action: string;
  reason: string;
  items_affected: Record<string, any>;
  new_eta: string;
  message_id: string;
  processed: boolean;
  processed_at: string;
  created_at: string;
  profiles?: {
    id: string;
    business_details: {
      shopName?: string;
      [key: string]: any;
    };
  };
}

interface TemplateSend {
  id: string;
  template_key: string;
  phone_number: string;
  user_id: string;
  related_order_id: string;
  variables_used: Record<string, any>;
  language_used: string;
  status: string;
  authkey_response: Record<string, any>;
  error_message: string;
  created_at: string;
}

interface Analytics {
  summary: {
    totalMessages: number;
    outboundMessages: number;
    inboundMessages: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    activeConversations: number;
    pendingResponses: number;
    deliveryRate: number | string;
  };
  templateUsage: Array<{
    templateKey: string;
    total: number;
    delivered: number;
    failed: number;
    deliveryRate: number | string;
  }>;
  dailyStats: Array<{
    date: string;
    messages: number;
    delivered: number;
    failed: number;
  }>;
}

// Tab Panel Component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// Category colors and icons
const categoryConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  order: { color: '#2196f3', icon: <ShoppingCart /> },
  payment: { color: '#4caf50', icon: <Payment /> },
  delivery: { color: '#ff9800', icon: <LocalShipping /> },
  marketing: { color: '#9c27b0', icon: <Campaign /> },
  support: { color: '#607d8b', icon: <Support /> },
};

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  sent: 'info',
  delivered: 'success',
  read: 'success',
  failed: 'error',
  pending: 'warning',
  processed: 'default',
};

const CHART_COLORS = ['#25D366', '#128C7E', '#075E54', '#34B7F1', '#ECE5DD'];

export default function WhatsAppDashboard() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [templates, setTemplates] = useState<Template[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [orderResponses, setOrderResponses] = useState<OrderResponse[]>([]);
  const [templateSends, setTemplateSends] = useState<TemplateSend[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [messageSearch, setMessageSearch] = useState('');
  const [messageStatus, setMessageStatus] = useState<string>('all');
  const [messageDirection, setMessageDirection] = useState<string>('all');
  const [analyticsDays, setAnalyticsDays] = useState(7);

  // Dialog states
  const [editDialog, setEditDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Template>>({});
  const [conversationDialog, setConversationDialog] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<MessageRecord[]>([]);

  // Expanded template categories
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Fetch data functions
  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/whatsapp?type=templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const result = await response.json();
      setTemplates(result.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams({ type: 'messages', limit: '100' });
      if (messageSearch) params.append('phone', messageSearch);
      if (messageStatus !== 'all') params.append('status', messageStatus);
      if (messageDirection !== 'all') params.append('direction', messageDirection);

      const response = await fetch(`/api/admin/whatsapp?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const result = await response.json();
      setMessages(result.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  }, [messageSearch, messageStatus, messageDirection]);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/whatsapp?type=conversations&active=true&limit=50');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const result = await response.json();
      setConversations(result.data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    }
  }, []);

  const fetchOrderResponses = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/whatsapp?type=order_responses&processed=false&limit=50');
      if (!response.ok) throw new Error('Failed to fetch order responses');
      const result = await response.json();
      setOrderResponses(result.data || []);
    } catch (error) {
      console.error('Error fetching order responses:', error);
      toast.error('Failed to load order responses');
    }
  }, []);

  const fetchTemplateSends = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/whatsapp?type=template_sends&days=${analyticsDays}`);
      if (!response.ok) throw new Error('Failed to fetch template sends');
      const result = await response.json();
      setTemplateSends(result.data || []);
    } catch (error) {
      console.error('Error fetching template sends:', error);
    }
  }, [analyticsDays]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/whatsapp?type=analytics&days=${analyticsDays}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const result = await response.json();
      setAnalytics(result);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    }
  }, [analyticsDays]);

  const fetchConversationMessages = async (phoneNumber: string) => {
    try {
      const response = await fetch(`/api/admin/whatsapp?type=messages&phone=${phoneNumber}&limit=50`);
      if (!response.ok) throw new Error('Failed to fetch conversation messages');
      const result = await response.json();
      setConversationMessages(result.data || []);
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
    }
  };

  // Initial data load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchTemplates(),
        fetchMessages(),
        fetchConversations(),
        fetchOrderResponses(),
        fetchAnalytics(),
      ]);
      setLoading(false);
    };
    loadAll();
  }, [fetchTemplates, fetchMessages, fetchConversations, fetchOrderResponses, fetchAnalytics]);

  // Refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchTemplates(),
      fetchMessages(),
      fetchConversations(),
      fetchOrderResponses(),
      fetchAnalytics(),
    ]);
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  // Template update handlers
  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setEditFormData({
      authkey_template_id: template.authkey_template_id,
      is_enabled: template.is_enabled,
      is_automatic: template.is_automatic,
      cooldown_minutes: template.cooldown_minutes,
      max_sends_per_day: template.max_sends_per_day,
      priority: template.priority,
      send_time_preference: template.send_time_preference,
    });
    setEditDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await fetch('/api/admin/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_key: selectedTemplate.template_key,
          updates: editFormData,
        }),
      });

      if (!response.ok) throw new Error('Failed to update template');

      toast.success('Template updated successfully');
      setEditDialog(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  const handleToggleTemplate = async (template: Template) => {
    try {
      const response = await fetch('/api/admin/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_key: template.template_key,
          updates: { is_enabled: !template.is_enabled },
        }),
      });

      if (!response.ok) throw new Error('Failed to toggle template');

      toast.success(`Template ${!template.is_enabled ? 'enabled' : 'disabled'}`);
      fetchTemplates();
    } catch (error) {
      console.error('Error toggling template:', error);
      toast.error('Failed to toggle template');
    }
  };

  // Order response handler
  const handleProcessResponse = async (responseId: string) => {
    try {
      const response = await fetch('/api/admin/whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_response',
          id: responseId,
        }),
      });

      if (!response.ok) throw new Error('Failed to process response');

      toast.success('Response marked as processed');
      fetchOrderResponses();
    } catch (error) {
      console.error('Error processing response:', error);
      toast.error('Failed to process response');
    }
  };

  // Retry failed send
  const handleRetrySend = async (sendId: string) => {
    try {
      const response = await fetch('/api/admin/whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'retry_send',
          id: sendId,
        }),
      });

      if (!response.ok) throw new Error('Failed to retry send');

      toast.success('Send marked for retry');
      fetchTemplateSends();
    } catch (error) {
      console.error('Error retrying send:', error);
      toast.error('Failed to retry send');
    }
  };

  // Open conversation details
  const handleViewConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    fetchConversationMessages(conv.phone_number);
    setConversationDialog(true);
  };

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    const cat = template.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  // Filter templates
  const filteredTemplates = categoryFilter === 'all'
    ? templates
    : templates.filter(t => t.category === categoryFilter);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={60} sx={{ color: '#25D366' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: '#25D366', width: 56, height: 56 }}>
            <WhatsApp sx={{ fontSize: 32 }} />
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              WhatsApp Automation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage templates, messages, and analytics
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<Chat />}
            onClick={() => window.location.href = '/whatsapp/chat'}
            sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#128C7E' } }}
          >
            Open Live Chat
          </Button>
          <Button
            variant="outlined"
            startIcon={refreshing ? <CircularProgress size={20} /> : <Refresh />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Messages</Typography>
                  <Typography variant="h3" fontWeight="bold">
                    {analytics?.summary?.totalMessages?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                    Last {analyticsDays} days
                  </Typography>
                </Box>
                <Message sx={{ fontSize: 48, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Delivery Rate</Typography>
                  <Typography variant="h3" fontWeight="bold">
                    {analytics?.summary?.deliveryRate || 0}%
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                    <TrendingUp sx={{ fontSize: 16 }} />
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {analytics?.summary?.deliveredCount || 0} delivered
                    </Typography>
                  </Box>
                </Box>
                <Send sx={{ fontSize: 48, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Active Conversations</Typography>
                  <Typography variant="h3" fontWeight="bold">
                    {analytics?.summary?.activeConversations || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                    Last 24 hours
                  </Typography>
                </Box>
                <Chat sx={{ fontSize: 48, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: (analytics?.summary?.pendingResponses || 0) > 0 ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' : 'linear-gradient(135deg, #607d8b 0%, #455a64 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Pending Responses</Typography>
                  <Typography variant="h3" fontWeight="bold">
                    {analytics?.summary?.pendingResponses || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                    {(analytics?.summary?.pendingResponses || 0) > 0 ? 'Needs attention' : 'All processed'}
                  </Typography>
                </Box>
                {(analytics?.summary?.pendingResponses || 0) > 0 ? (
                  <Warning sx={{ fontSize: 48, opacity: 0.7 }} />
                ) : (
                  <CheckCircle sx={{ fontSize: 48, opacity: 0.7 }} />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              minHeight: 64,
              textTransform: 'none',
              fontWeight: 500,
            },
            '& .Mui-selected': { color: '#25D366' },
            '& .MuiTabs-indicator': { bgcolor: '#25D366' }
          }}
        >
          <Tab icon={<Settings />} iconPosition="start" label="Templates" />
          <Tab
            icon={
              <Badge badgeContent={analytics?.summary?.failedCount || 0} color="error">
                <Message />
              </Badge>
            }
            iconPosition="start"
            label="Messages"
          />
          <Tab icon={<Analytics />} iconPosition="start" label="Analytics" />
          <Tab icon={<Chat />} iconPosition="start" label="Conversations" />
          <Tab
            icon={
              <Badge badgeContent={analytics?.summary?.pendingResponses || 0} color="warning">
                <ShoppingCart />
              </Badge>
            }
            iconPosition="start"
            label="Order Responses"
          />
        </Tabs>
      </Paper>

      {/* Tab Panels */}

      {/* Templates Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              label="Category"
            >
              <MenuItem value="all">All Categories</MenuItem>
              {Object.keys(categoryConfig).map(cat => (
                <MenuItem key={cat} value={cat}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {categoryConfig[cat]?.icon}
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            {filteredTemplates.length} templates
          </Typography>
        </Box>

        {Object.entries(templatesByCategory)
          .filter(([cat]) => categoryFilter === 'all' || cat === categoryFilter)
          .map(([category, categoryTemplates]) => (
            <Card key={category} sx={{ mb: 2 }}>
              <Box
                sx={{
                  p: 2,
                  bgcolor: categoryConfig[category]?.color || '#607d8b',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
                onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {categoryConfig[category]?.icon || <Settings />}
                  <Typography variant="h6" fontWeight="bold">
                    {category.charAt(0).toUpperCase() + category.slice(1)} Templates
                  </Typography>
                  <Chip label={categoryTemplates.length} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                </Box>
                {expandedCategories[category] ? <ExpandLess /> : <ExpandMore />}
              </Box>
              <Collapse in={expandedCategories[category] !== false}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Template</TableCell>
                        <TableCell>Authkey ID</TableCell>
                        <TableCell>Trigger</TableCell>
                        <TableCell align="center">Auto</TableCell>
                        <TableCell align="center">Enabled</TableCell>
                        <TableCell align="center">Rate Limit</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {categoryTemplates.map((template) => (
                        <TableRow key={template.id} hover>
                          <TableCell>
                            <Box>
                              <Typography variant="subtitle2">{template.template_name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {template.template_key}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {template.authkey_template_id || '—'}
                              </Typography>
                              {template.authkey_template_id && (
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    navigator.clipboard.writeText(template.authkey_template_id);
                                    toast.success('Copied to clipboard');
                                  }}
                                >
                                  <ContentCopy fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                            {!template.authkey_template_id && (
                              <Typography variant="caption" color="error">Not configured</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{template.trigger_event || '—'}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={template.is_automatic ? 'Auto' : 'Manual'}
                              size="small"
                              color={template.is_automatic ? 'primary' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Switch
                              checked={template.is_enabled}
                              onChange={() => handleToggleTemplate(template)}
                              color="success"
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title={`Cooldown: ${template.cooldown_minutes}min, Max: ${template.max_sends_per_day}/day`}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                                <Timer fontSize="small" color="action" />
                                <Typography variant="body2">
                                  {template.cooldown_minutes}m / {template.max_sends_per_day}d
                                </Typography>
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" onClick={() => handleEditTemplate(template)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
            </Card>
          ))}
      </TabPanel>

      {/* Messages Tab */}
      <TabPanel value={tabValue} index={1}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search by phone number..."
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={messageStatus}
                    onChange={(e) => setMessageStatus(e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="sent">Sent</MenuItem>
                    <MenuItem value="delivered">Delivered</MenuItem>
                    <MenuItem value="read">Read</MenuItem>
                    <MenuItem value="failed">Failed</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Direction</InputLabel>
                  <Select
                    value={messageDirection}
                    onChange={(e) => setMessageDirection(e.target.value)}
                    label="Direction"
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="inbound">Inbound</MenuItem>
                    <MenuItem value="outbound">Outbound</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<FilterList />}
                    onClick={fetchMessages}
                  >
                    Apply Filters
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={() => {
                      const csv = messages.map(m =>
                        `${m.phone_number},${m.direction},${m.status},${m.content?.substring(0, 50)},${m.created_at}`
                      ).join('\n');
                      const blob = new Blob([`Phone,Direction,Status,Content,Date\n${csv}`], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'whatsapp-messages.csv';
                      a.click();
                    }}
                  >
                    Export CSV
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell>Phone</TableCell>
                <TableCell>Direction</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Content</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Time</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      No messages found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                messages.map((msg) => (
                  <TableRow key={msg.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {msg.phone_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={msg.direction === 'inbound' ? <ArrowDownward /> : <ArrowUpward />}
                        label={msg.direction}
                        size="small"
                        color={msg.direction === 'inbound' ? 'info' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{msg.message_type}</Typography>
                      {msg.template_key && (
                        <Typography variant="caption" color="text.secondary">
                          {msg.template_key}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Tooltip title={msg.content}>
                        <Typography variant="body2" noWrap>
                          {msg.content?.substring(0, 60)}...
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={msg.status}
                        size="small"
                        color={statusColors[msg.status] || 'default'}
                      />
                      {msg.error_message && (
                        <Tooltip title={msg.error_message}>
                          <Warning color="error" fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={format(new Date(msg.created_at), 'PPpp')}>
                        <Typography variant="body2">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small">
                        <Visibility fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={analyticsDays}
              onChange={(e) => setAnalyticsDays(e.target.value as number)}
              label="Time Range"
            >
              <MenuItem value={1}>Last 24 hours</MenuItem>
              <MenuItem value={7}>Last 7 days</MenuItem>
              <MenuItem value={14}>Last 14 days</MenuItem>
              <MenuItem value={30}>Last 30 days</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={fetchAnalytics}>
            Update
          </Button>
        </Box>

        <Grid container spacing={3}>
          {/* Daily Messages Chart */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Message Trend</Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics?.dailyStats || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => format(new Date(v), 'MMM d')}
                      />
                      <YAxis />
                      <RechartsTooltip
                        labelFormatter={(v) => format(new Date(v), 'PPP')}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="messages"
                        stroke="#25D366"
                        strokeWidth={2}
                        name="Messages Sent"
                      />
                      <Line
                        type="monotone"
                        dataKey="delivered"
                        stroke="#4caf50"
                        strokeWidth={2}
                        name="Delivered"
                      />
                      <Line
                        type="monotone"
                        dataKey="failed"
                        stroke="#f44336"
                        strokeWidth={2}
                        name="Failed"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Message Type Breakdown */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Message Direction</Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Outbound', value: analytics?.summary?.outboundMessages || 0 },
                          { name: 'Inbound', value: analytics?.summary?.inboundMessages || 0 },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label
                      >
                        {[0, 1].map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Template Usage */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Template Performance</Typography>
                <Box sx={{ height: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics?.templateUsage || []}
                      layout="vertical"
                      margin={{ left: 150 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="templateKey"
                        type="category"
                        width={140}
                        tick={{ fontSize: 11 }}
                      />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="delivered" fill="#4caf50" name="Delivered" stackId="a" />
                      <Bar dataKey="failed" fill="#f44336" name="Failed" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Detailed Stats Grid */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={6} md={2}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="text.secondary" variant="body2">Sent</Typography>
                    <Typography variant="h4" color="info.main">{analytics?.summary?.sentCount || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={2}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="text.secondary" variant="body2">Delivered</Typography>
                    <Typography variant="h4" color="success.main">{analytics?.summary?.deliveredCount || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={2}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="text.secondary" variant="body2">Read</Typography>
                    <Typography variant="h4" color="primary.main">{analytics?.summary?.readCount || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={2}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="text.secondary" variant="body2">Failed</Typography>
                    <Typography variant="h4" color="error.main">{analytics?.summary?.failedCount || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={2}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="text.secondary" variant="body2">Inbound</Typography>
                    <Typography variant="h4">{analytics?.summary?.inboundMessages || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={2}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="text.secondary" variant="body2">Outbound</Typography>
                    <Typography variant="h4">{analytics?.summary?.outboundMessages || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Conversations Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={2}>
          {conversations.length === 0 ? (
            <Grid item xs={12}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <Chat sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography color="text.secondary">
                    No active conversations in the last 24 hours
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ) : (
            conversations.map((conv) => (
              <Grid item xs={12} md={6} lg={4} key={conv.id}>
                <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }} onClick={() => handleViewConversation(conv)}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: '#25D366' }}>
                          <Person />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontFamily: 'monospace' }}>
                            {conv.phone_number}
                          </Typography>
                          <Chip
                            label={conv.user_role || 'unknown'}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 2 }}>
                      {conv.last_message_direction === 'inbound' ? '← ' : '→ '}
                      {conv.last_message_content}
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          <Message fontSize="inherit" /> {conv.total_messages} messages
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          <Speed fontSize="inherit" /> {conv.ai_interactions} AI
                        </Typography>
                      </Box>
                      {conv.pending_action && (
                        <Chip label={conv.pending_action} size="small" color="warning" />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </TabPanel>

      {/* Order Responses Tab */}
      <TabPanel value={tabValue} index={4}>
        {orderResponses.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
              <Typography variant="h6">All Caught Up!</Typography>
              <Typography color="text.secondary">
                No pending order responses to process
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell>Order ID</TableCell>
                  <TableCell>Seller</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell align="center">Process</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orderResponses.map((resp) => (
                  <TableRow key={resp.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {resp.order_id?.substring(0, 8)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {resp.profiles?.business_details?.shopName || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {resp.phone_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={resp.action}
                        size="small"
                        color={
                          resp.action === 'confirm' ? 'success' :
                            resp.action === 'reject' ? 'error' :
                              resp.action === 'partial' ? 'warning' :
                                'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
                        {resp.reason || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={format(new Date(resp.created_at), 'PPpp')}>
                        <Typography variant="body2">
                          {formatDistanceToNow(new Date(resp.created_at), { addSuffix: true })}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircle />}
                        onClick={() => handleProcessResponse(resp.id)}
                      >
                        Process
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Edit Template Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Template: {selectedTemplate?.template_name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Authkey Template ID"
              fullWidth
              value={editFormData.authkey_template_id || ''}
              onChange={(e) => setEditFormData(prev => ({ ...prev, authkey_template_id: e.target.value }))}
              placeholder="Enter Authkey.io template ID"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={editFormData.is_enabled || false}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, is_enabled: e.target.checked }))}
                />
              }
              label="Enabled"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={editFormData.is_automatic || false}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, is_automatic: e.target.checked }))}
                />
              }
              label="Automatic (trigger on event)"
            />

            <TextField
              label="Cooldown (minutes)"
              type="number"
              fullWidth
              value={editFormData.cooldown_minutes || 0}
              onChange={(e) => setEditFormData(prev => ({ ...prev, cooldown_minutes: parseInt(e.target.value) }))}
              helperText="Minimum time between sends to same user"
            />

            <TextField
              label="Max Sends Per Day"
              type="number"
              fullWidth
              value={editFormData.max_sends_per_day || 0}
              onChange={(e) => setEditFormData(prev => ({ ...prev, max_sends_per_day: parseInt(e.target.value) }))}
              helperText="Maximum sends per user per day"
            />

            <TextField
              label="Priority"
              type="number"
              fullWidth
              value={editFormData.priority || 5}
              onChange={(e) => setEditFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
              helperText="1-10, higher = more important"
              inputProps={{ min: 1, max: 10 }}
            />

            <FormControl fullWidth>
              <InputLabel>Send Time Preference</InputLabel>
              <Select
                value={editFormData.send_time_preference || 'immediate'}
                onChange={(e) => setEditFormData(prev => ({ ...prev, send_time_preference: e.target.value }))}
                label="Send Time Preference"
              >
                <MenuItem value="immediate">Immediate</MenuItem>
                <MenuItem value="morning">Morning (8-10 AM)</MenuItem>
                <MenuItem value="evening">Evening (6-8 PM)</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveTemplate} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Conversation Detail Dialog */}
      <Dialog open={conversationDialog} onClose={() => setConversationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: '#25D366' }}>
              <Person />
            </Avatar>
            <Box>
              <Typography variant="h6">{selectedConversation?.phone_number}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedConversation?.user_role} • {selectedConversation?.total_messages} messages
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {conversationMessages.map((msg, index) => (
              <ListItem
                key={msg.id}
                sx={{
                  justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start',
                  px: 0
                }}
              >
                <Paper
                  sx={{
                    p: 1.5,
                    maxWidth: '70%',
                    bgcolor: msg.direction === 'outbound' ? '#dcf8c6' : '#fff',
                    borderRadius: 2
                  }}
                >
                  <Typography variant="body2">{msg.content}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'right' }}>
                    {format(new Date(msg.created_at), 'p')}
                    {msg.ai_response && ' • AI'}
                  </Typography>
                </Paper>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConversationDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}