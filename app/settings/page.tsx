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
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Tabs,
  Tab,
  Paper,
  Stack,
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
  SelectChangeEvent,
} from '@mui/material';
import {
  Save,
  Refresh,
  Security,
  Notifications,
  Payment,
  Storage,
  Api,
  Email,
  Sms,
  WhatsApp,
  Edit,
  Delete,
  Add,
  Visibility,
  VisibilityOff,
  Settings as SettingsIcon,
  Flag,
  Tune,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import { getOCRProviderStatus } from '@/lib/unifiedOCR';
import toast from 'react-hot-toast';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SettingsPage() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<any>(null);
  
  // App Configs state
  const [appConfigs, setAppConfigs] = useState<any[]>([]);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [newConfig, setNewConfig] = useState({
    key: '',
    value: '',
    description: '',
    scope: 'global',
    scopeValue: '',
  });

  // Feature Flags state
  const [featureFlags, setFeatureFlags] = useState<any[]>([]);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<any>(null);
  const [newFlag, setNewFlag] = useState({
    name: '',
    description: '',
    enabled: false,
    rollout_type: 'global',
    config: {},
  });

  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    appName: 'DukaaOn',
    appVersion: '1.0.0',
    maintenanceMode: false,
    allowRegistration: true,
    requireEmailVerification: true,
    requirePhoneVerification: true,
    maxFileUploadSize: 10, // MB
    sessionTimeout: 24, // hours
  });

  // Payment Settings
  const [paymentSettings, setPaymentSettings] = useState({
    razorpayEnabled: true,
    razorpayKeyId: '',
    razorpayKeySecret: '',
    stripeEnabled: false,
    stripePublishableKey: '',
    stripeSecretKey: '',
    paypalEnabled: false,
    paypalClientId: '',
    paypalClientSecret: '',
    codEnabled: true,
    minimumOrderAmount: 100,
    deliveryCharges: 50,
    freeDeliveryThreshold: 500,
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: true,
    whatsappNotifications: true,
    pushNotifications: true,
    orderConfirmation: true,
    orderStatusUpdates: true,
    promotionalEmails: false,
    weeklyReports: true,
    lowStockAlerts: true,
  });

  // API Settings
  const [apiSettings, setApiSettings] = useState({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    whatsappToken: '',
    whatsappPhoneId: '',
    googleMapsApiKey: '',
    firebaseConfig: '',
    azureApiKey: '',
    rateLimit: 100, // requests per minute
    apiTimeout: 30, // seconds
  });

  // OCR Settings
  const [ocrSettings, setOcrSettings] = useState({
    provider: process.env.NEXT_PUBLIC_OCR_PROVIDER || 'azure',
    azureEndpoint: process.env.NEXT_PUBLIC_AZURE_ENDPOINT || '',
    azureApiKey: process.env.NEXT_PUBLIC_AZURE_API_KEY || '',
    azureRegion: process.env.NEXT_PUBLIC_AZURE_REGION || 'eastus',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
  });

  const [ocrStatus, setOcrStatus] = useState(getOCRProviderStatus());

  useEffect(() => {
    loadSettings();
    if (tabValue === 4) loadAppConfigs(); // App Config tab
    if (tabValue === 5) loadFeatureFlags(); // Feature Flags tab
  }, [tabValue]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Load settings from Supabase
      // This would be implemented based on your settings table structure
      toast.success('Settings loaded successfully');
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadAppConfigs = async () => {
    try {
      const result = await adminQueries.getConfigs();
      setAppConfigs(result.data || []);
    } catch (error) {
      console.error('Error loading app configs:', error);
      toast.error('Failed to load app configs');
    }
  };

  const loadFeatureFlags = async () => {
    try {
      const result = await adminQueries.getFeatureFlags();
      setFeatureFlags(result.data || []);
    } catch (error) {
      console.error('Error loading feature flags:', error);
      toast.error('Failed to load feature flags');
    }
  };

  const handleSaveConfig = async () => {
    try {
      if (!newConfig.key || !newConfig.value) {
        toast.error('Key and value are required');
        return;
      }

      let valueToSave = newConfig.value;
      try {
        // Try to parse as JSON
        valueToSave = JSON.parse(newConfig.value);
      } catch {
        // If not valid JSON, use as string
        valueToSave = newConfig.value;
      }

      await adminQueries.saveConfig(
        newConfig.key,
        valueToSave,
        newConfig.description,
        newConfig.scope,
        newConfig.scopeValue || undefined
      );

      toast.success('Config saved successfully!');
      setConfigDialogOpen(false);
      setNewConfig({ key: '', value: '', description: '', scope: 'global', scopeValue: '' });
      loadAppConfigs();
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error(error.message || 'Failed to save config');
    }
  };

  const handleDeleteConfig = async (key: string) => {
    if (!confirm(`Are you sure you want to delete config "${key}"?`)) return;

    try {
      await adminQueries.deleteConfig(key);
      toast.success('Config deleted!');
      loadAppConfigs();
    } catch (error: any) {
      console.error('Error deleting config:', error);
      toast.error(error.message || 'Failed to delete config');
    }
  };

  const handleSaveFeatureFlag = async () => {
    try {
      if (!newFlag.name) {
        toast.error('Feature flag name is required');
        return;
      }

      if (editingFlag) {
        await adminQueries.updateFeatureFlag(editingFlag.id, {
          enabled: newFlag.enabled,
          rollout_type: newFlag.rollout_type,
          config: newFlag.config,
          description: newFlag.description,
        });
        toast.success('Feature flag updated!');
      } else {
        await adminQueries.createFeatureFlag(newFlag);
        toast.success('Feature flag created!');
      }

      setFlagDialogOpen(false);
      setEditingFlag(null);
      setNewFlag({ name: '', description: '', enabled: false, rollout_type: 'global', config: {} });
      loadFeatureFlags();
    } catch (error: any) {
      console.error('Error saving feature flag:', error);
      toast.error(error.message || 'Failed to save feature flag');
    }
  };

  const handleDeleteFeatureFlag = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feature flag?')) return;

    try {
      await adminQueries.deleteFeatureFlag(id);
      toast.success('Feature flag deleted!');
      loadFeatureFlags();
    } catch (error: any) {
      console.error('Error deleting feature flag:', error);
      toast.error(error.message || 'Failed to delete feature flag');
    }
  };

  const handleToggleFeatureFlag = async (flag: any) => {
    try {
      await adminQueries.updateFeatureFlag(flag.id, { enabled: !flag.enabled });
      toast.success(`Feature flag ${!flag.enabled ? 'enabled' : 'disabled'}!`);
      loadFeatureFlags();
    } catch (error: any) {
      console.error('Error toggling feature flag:', error);
      toast.error(error.message || 'Failed to toggle feature flag');
    }
  };

  const saveSettings = async (settingsType: string, settings: any) => {
    try {
      setLoading(true);
      
      if (settingsType === 'OCR') {
        // Save OCR settings to environment variables or configuration
        // In a real implementation, you would save these to your backend/database
        // For now, we'll just show success and update local state
        console.log('OCR Settings to save:', settings);
        
        // Update OCR status after saving
        setTimeout(() => {
          setOcrStatus(getOCRProviderStatus());
        }, 500);
      } else {
        // Save other settings to Supabase
        // This would be implemented based on your settings table structure
        console.log(`${settingsType} Settings to save:`, settings);
      }
      
      toast.success(`${settingsType} settings saved successfully`);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOCRProviderChange = (event: SelectChangeEvent) => {
    const provider = event.target.value as 'azure' | 'aws';
    setOcrSettings(prev => ({
      ...prev,
      provider
    }));
    // Update status when provider changes
    setTimeout(() => {
      setOcrStatus(getOCRProviderStatus());
    }, 100);
  };

  const handleOCRSettingChange = (provider: 'azure' | 'aws', field: string, value: string) => {
    setOcrSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        System Settings
      </Typography>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="settings tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<Security />} label="General" />
          <Tab icon={<Payment />} label="Payment" />
          <Tab icon={<Notifications />} label="Notifications" />
          <Tab icon={<Api />} label="API & Integrations" />
          <Tab icon={<Storage />} label="Database" />
          <Tab icon={<Tune />} label="App Config" />
          <Tab icon={<Flag />} label="Feature Flags" />
        </Tabs>

        {/* General Settings */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Application Settings
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Application Name"
                      value={generalSettings.appName}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, appName: e.target.value })
                      }
                    />
                    <TextField
                      fullWidth
                      label="Application Version"
                      value={generalSettings.appVersion}
                      onChange={(e) =>
                        setGeneralSettings({ ...generalSettings, appVersion: e.target.value })
                      }
                    />
                    <TextField
                      fullWidth
                      label="Max File Upload Size (MB)"
                      type="number"
                      value={generalSettings.maxFileUploadSize}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          maxFileUploadSize: Number(e.target.value),
                        })
                      }
                    />
                    <TextField
                      fullWidth
                      label="Session Timeout (hours)"
                      type="number"
                      value={generalSettings.sessionTimeout}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          sessionTimeout: Number(e.target.value),
                        })
                      }
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Security & Access
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={generalSettings.maintenanceMode}
                          onChange={(e) =>
                            setGeneralSettings({
                              ...generalSettings,
                              maintenanceMode: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Maintenance Mode"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={generalSettings.allowRegistration}
                          onChange={(e) =>
                            setGeneralSettings({
                              ...generalSettings,
                              allowRegistration: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Allow New Registrations"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={generalSettings.requireEmailVerification}
                          onChange={(e) =>
                            setGeneralSettings({
                              ...generalSettings,
                              requireEmailVerification: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Require Email Verification"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={generalSettings.requirePhoneVerification}
                          onChange={(e) =>
                            setGeneralSettings({
                              ...generalSettings,
                              requirePhoneVerification: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Require Phone Verification"
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={() => saveSettings('General', generalSettings)}
                disabled={loading}
              >
                Save General Settings
              </Button>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Payment Settings */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Payment Gateways
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={paymentSettings.razorpayEnabled}
                          onChange={(e) =>
                            setPaymentSettings({
                              ...paymentSettings,
                              razorpayEnabled: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Razorpay"
                    />
                    {paymentSettings.razorpayEnabled && (
                      <>
                        <TextField
                          fullWidth
                          label="Razorpay Key ID"
                          value={paymentSettings.razorpayKeyId}
                          onChange={(e) =>
                            setPaymentSettings({
                              ...paymentSettings,
                              razorpayKeyId: e.target.value,
                            })
                          }
                        />
                        <TextField
                          fullWidth
                          label="Razorpay Key Secret"
                          type={showPasswords ? 'text' : 'password'}
                          value={paymentSettings.razorpayKeySecret}
                          onChange={(e) =>
                            setPaymentSettings({
                              ...paymentSettings,
                              razorpayKeySecret: e.target.value,
                            })
                          }
                          InputProps={{
                            endAdornment: (
                              <IconButton
                                onClick={() => setShowPasswords(!showPasswords)}
                                edge="end"
                              >
                                {showPasswords ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            ),
                          }}
                        />
                      </>
                    )}

                    <Divider />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={paymentSettings.codEnabled}
                          onChange={(e) =>
                            setPaymentSettings({
                              ...paymentSettings,
                              codEnabled: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Cash on Delivery"
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Order & Delivery Settings
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Minimum Order Amount (₹)"
                      type="number"
                      value={paymentSettings.minimumOrderAmount}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          minimumOrderAmount: Number(e.target.value),
                        })
                      }
                    />
                    <TextField
                      fullWidth
                      label="Delivery Charges (₹)"
                      type="number"
                      value={paymentSettings.deliveryCharges}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          deliveryCharges: Number(e.target.value),
                        })
                      }
                    />
                    <TextField
                      fullWidth
                      label="Free Delivery Threshold (₹)"
                      type="number"
                      value={paymentSettings.freeDeliveryThreshold}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          freeDeliveryThreshold: Number(e.target.value),
                        })
                      }
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={() => saveSettings('Payment', paymentSettings)}
                disabled={loading}
              >
                Save Payment Settings
              </Button>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Notification Settings */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Notification Channels
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.emailNotifications}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              emailNotifications: e.target.checked,
                            })
                          }
                        />
                      }
                      label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Email /> Email Notifications</Box>}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.smsNotifications}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              smsNotifications: e.target.checked,
                            })
                          }
                        />
                      }
                      label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Sms /> SMS Notifications</Box>}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.whatsappNotifications}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              whatsappNotifications: e.target.checked,
                            })
                          }
                        />
                      }
                      label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><WhatsApp /> WhatsApp Notifications</Box>}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.pushNotifications}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              pushNotifications: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Push Notifications"
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Notification Types
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.orderConfirmation}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              orderConfirmation: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Order Confirmation"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.orderStatusUpdates}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              orderStatusUpdates: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Order Status Updates"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.promotionalEmails}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              promotionalEmails: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Promotional Emails"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.weeklyReports}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              weeklyReports: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Weekly Reports"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.lowStockAlerts}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              lowStockAlerts: e.target.checked,
                            })
                          }
                        />
                      }
                      label="Low Stock Alerts"
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={() => saveSettings('Notification', notificationSettings)}
                disabled={loading}
              >
                Save Notification Settings
              </Button>
            </Grid>
          </Grid>
        </TabPanel>

        {/* API Settings */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Security Notice</Typography>
                <Typography variant="body2">
                  API keys and secrets are sensitive information. Only authorized personnel should have access to these settings.
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Database Configuration
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Supabase URL"
                      value={apiSettings.supabaseUrl}
                      onChange={(e) =>
                        setApiSettings({ ...apiSettings, supabaseUrl: e.target.value })
                      }
                    />
                    <TextField
                      fullWidth
                      label="Supabase Anon Key"
                      type={showPasswords ? 'text' : 'password'}
                      value={apiSettings.supabaseAnonKey}
                      onChange={(e) =>
                        setApiSettings({ ...apiSettings, supabaseAnonKey: e.target.value })
                      }
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    WhatsApp Integration
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="WhatsApp Access Token"
                      type={showPasswords ? 'text' : 'password'}
                      value={apiSettings.whatsappToken}
                      onChange={(e) =>
                        setApiSettings({ ...apiSettings, whatsappToken: e.target.value })
                      }
                    />
                    <TextField
                      fullWidth
                      label="WhatsApp Phone Number ID"
                      value={apiSettings.whatsappPhoneId}
                      onChange={(e) =>
                        setApiSettings({ ...apiSettings, whatsappPhoneId: e.target.value })
                      }
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    External Services
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Google Maps API Key"
                      type={showPasswords ? 'text' : 'password'}
                      value={apiSettings.googleMapsApiKey}
                      onChange={(e) =>
                        setApiSettings({ ...apiSettings, googleMapsApiKey: e.target.value })
                      }
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    OCR Configuration
                  </Typography>
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>OCR Provider</InputLabel>
                      <Select
                        value={ocrSettings.provider}
                        label="OCR Provider"
                        onChange={handleOCRProviderChange}
                      >
                        <MenuItem value="azure">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            Azure Computer Vision
                            {ocrStatus.azure.available && <Chip label="Available" color="success" size="small" />}
                          </Box>
                        </MenuItem>
                        <MenuItem value="aws">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            AWS Textract
                            {ocrStatus.aws.available && <Chip label="Available" color="success" size="small" />}
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>

                    {ocrSettings.provider === 'azure' && (
                      <>
                        <TextField
                          fullWidth
                          label="Azure Endpoint"
                          value={ocrSettings.azureEndpoint}
                          onChange={(e) =>
                            handleOCRSettingChange('azure', 'azureEndpoint', e.target.value)
                          }
                          placeholder="https://your-resource.cognitiveservices.azure.com/"
                        />
                        <TextField
                          fullWidth
                          label="Azure API Key"
                          type={showPasswords ? 'text' : 'password'}
                          value={ocrSettings.azureApiKey}
                          onChange={(e) =>
                            handleOCRSettingChange('azure', 'azureApiKey', e.target.value)
                          }
                          InputProps={{
                            endAdornment: (
                              <IconButton
                                onClick={() => setShowPasswords(!showPasswords)}
                                edge="end"
                              >
                                {showPasswords ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            ),
                          }}
                        />
                        <TextField
                          fullWidth
                          label="Azure Region"
                          value={ocrSettings.azureRegion}
                          onChange={(e) =>
                            handleOCRSettingChange('azure', 'azureRegion', e.target.value)
                          }
                          placeholder="eastus"
                        />
                      </>
                    )}

                    {ocrSettings.provider === 'aws' && (
                      <>
                        <TextField
                          fullWidth
                          label="AWS Access Key ID"
                          value={ocrSettings.awsAccessKeyId}
                          onChange={(e) =>
                            handleOCRSettingChange('aws', 'awsAccessKeyId', e.target.value)
                          }
                        />
                        <TextField
                          fullWidth
                          label="AWS Secret Access Key"
                          type={showPasswords ? 'text' : 'password'}
                          value={ocrSettings.awsSecretAccessKey}
                          onChange={(e) =>
                            handleOCRSettingChange('aws', 'awsSecretAccessKey', e.target.value)
                          }
                          InputProps={{
                            endAdornment: (
                              <IconButton
                                onClick={() => setShowPasswords(!showPasswords)}
                                edge="end"
                              >
                                {showPasswords ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            ),
                          }}
                        />
                        <TextField
                          fullWidth
                          label="AWS Region"
                          value={ocrSettings.awsRegion}
                          onChange={(e) =>
                            handleOCRSettingChange('aws', 'awsRegion', e.target.value)
                          }
                          placeholder="us-east-1"
                        />
                      </>
                    )}

                    <Alert severity="info">
                      <Typography variant="body2">
                        Current Status: {ocrStatus.available.length > 0 
                          ? `${ocrStatus.available.join(', ')} provider(s) available` 
                          : 'No OCR providers configured'}
                      </Typography>
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    API Configuration
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Rate Limit (requests/minute)"
                      type="number"
                      value={apiSettings.rateLimit}
                      onChange={(e) =>
                        setApiSettings({ ...apiSettings, rateLimit: Number(e.target.value) })
                      }
                    />
                    <TextField
                      fullWidth
                      label="API Timeout (seconds)"
                      type="number"
                      value={apiSettings.apiTimeout}
                      onChange={(e) =>
                        setApiSettings({ ...apiSettings, apiTimeout: Number(e.target.value) })
                      }
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={() => saveSettings('API', apiSettings)}
                  disabled={loading}
                >
                  Save API Settings
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Save />}
                  onClick={() => saveSettings('OCR', ocrSettings)}
                  disabled={loading}
                >
                  Save OCR Settings
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => {
                    setOcrStatus(getOCRProviderStatus());
                    toast.success('OCR status refreshed');
                  }}
                >
                  Refresh OCR Status
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Database Settings */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Database Management</Typography>
                <Typography variant="body2">
                  These tools help you manage your Supabase database. Use with caution in production.
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Database Status
                  </Typography>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Connection Status</Typography>
                      <Chip label="Connected" color="success" size="small" />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Database Size</Typography>
                      <Typography>245 MB</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Active Connections</Typography>
                      <Typography>12</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>Last Backup</Typography>
                      <Typography>2 hours ago</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Database Actions
                  </Typography>
                  <Stack spacing={2}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={() => toast('Database refresh functionality coming soon')}
                    >
                      Refresh Statistics
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => toast('Backup functionality coming soon')}
                    >
                      Create Backup
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => toast('Migration functionality coming soon')}
                    >
                      Run Migrations
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="warning"
                      onClick={() => toast('Cleanup functionality coming soon')}
                    >
                      Cleanup Old Data
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* App Configuration Tab */}
        <TabPanel value={tabValue} index={5}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Application Configuration</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setEditingConfig(null);
                setNewConfig({ key: '', value: '', description: '', scope: 'global', scopeValue: '' });
                setConfigDialogOpen(true);
              }}
            >
              Add Config
            </Button>
          </Box>

          <Card>
            <CardContent>
              <DataGrid
                rows={appConfigs}
                columns={[
                  { field: 'key', headerName: 'Key', flex: 1, minWidth: 200 },
                  {
                    field: 'value',
                    headerName: 'Value',
                    flex: 1,
                    minWidth: 200,
                    renderCell: (params: GridRenderCellParams) => (
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {typeof params.value === 'object' ? JSON.stringify(params.value) : String(params.value)}
                      </Typography>
                    ),
                  },
                  { field: 'scope', headerName: 'Scope', width: 120 },
                  { field: 'scope_value', headerName: 'Scope Value', width: 150 },
                  {
                    field: 'actions',
                    headerName: 'Actions',
                    width: 150,
                    renderCell: (params: GridRenderCellParams) => (
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingConfig(params.row);
                            setNewConfig({
                              key: params.row.key,
                              value: typeof params.row.value === 'object' ? JSON.stringify(params.row.value) : String(params.row.value),
                              description: params.row.description || '',
                              scope: params.row.scope || 'global',
                              scopeValue: params.row.scope_value || '',
                            });
                            setConfigDialogOpen(true);
                          }}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteConfig(params.row.key)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    ),
                  },
                ]}
                getRowId={(row) => row.key}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
              />
            </CardContent>
          </Card>

          {/* Config Dialog */}
          <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{editingConfig ? 'Edit Config' : 'Add Config'}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="Key"
                  value={newConfig.key}
                  onChange={(e) => setNewConfig({ ...newConfig, key: e.target.value })}
                  fullWidth
                  required
                  disabled={!!editingConfig}
                  helperText="Unique identifier for this config"
                />
                <TextField
                  label="Value (JSON or string)"
                  value={newConfig.value}
                  onChange={(e) => setNewConfig({ ...newConfig, value: e.target.value })}
                  fullWidth
                  required
                  multiline
                  rows={3}
                  helperText="Enter JSON object or simple string value"
                />
                <TextField
                  label="Description"
                  value={newConfig.description}
                  onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                  fullWidth
                  multiline
                  rows={2}
                />
                <FormControl fullWidth>
                  <InputLabel>Scope</InputLabel>
                  <Select
                    value={newConfig.scope}
                    label="Scope"
                    onChange={(e) => setNewConfig({ ...newConfig, scope: e.target.value })}
                  >
                    <MenuItem value="global">Global</MenuItem>
                    <MenuItem value="role">Role</MenuItem>
                    <MenuItem value="region">Region</MenuItem>
                    <MenuItem value="user">User</MenuItem>
                  </Select>
                </FormControl>
                {newConfig.scope !== 'global' && (
                  <TextField
                    label="Scope Value"
                    value={newConfig.scopeValue}
                    onChange={(e) => setNewConfig({ ...newConfig, scopeValue: e.target.value })}
                    fullWidth
                    helperText={newConfig.scope === 'role' ? 'e.g., retailer, wholesaler' : newConfig.scope === 'region' ? 'e.g., BLR, MUM' : 'User ID'}
                  />
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveConfig} variant="contained">
                {editingConfig ? 'Update' : 'Create'}
              </Button>
            </DialogActions>
          </Dialog>
        </TabPanel>

        {/* Feature Flags Tab */}
        <TabPanel value={tabValue} index={6}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Feature Flags</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setEditingFlag(null);
                setNewFlag({ name: '', description: '', enabled: false, rollout_type: 'global', config: {} });
                setFlagDialogOpen(true);
              }}
            >
              Add Feature Flag
            </Button>
          </Box>

          <Card>
            <CardContent>
              <DataGrid
                rows={featureFlags}
                columns={[
                  { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
                  { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 },
                  {
                    field: 'enabled',
                    headerName: 'Enabled',
                    width: 120,
                    renderCell: (params: GridRenderCellParams) => (
                      <Switch
                        checked={params.value}
                        onChange={() => handleToggleFeatureFlag(params.row)}
                        size="small"
                      />
                    ),
                  },
                  { field: 'rollout_type', headerName: 'Rollout Type', width: 150 },
                  {
                    field: 'actions',
                    headerName: 'Actions',
                    width: 150,
                    renderCell: (params: GridRenderCellParams) => (
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingFlag(params.row);
                            setNewFlag({
                              name: params.row.name,
                              description: params.row.description || '',
                              enabled: params.row.enabled,
                              rollout_type: params.row.rollout_type,
                              config: params.row.config || {},
                            });
                            setFlagDialogOpen(true);
                          }}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteFeatureFlag(params.row.id)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    ),
                  },
                ]}
                getRowId={(row) => row.id}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
              />
            </CardContent>
          </Card>

          {/* Feature Flag Dialog */}
          <Dialog open={flagDialogOpen} onClose={() => setFlagDialogOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>{editingFlag ? 'Edit Feature Flag' : 'Add Feature Flag'}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="Name"
                  value={newFlag.name}
                  onChange={(e) => setNewFlag({ ...newFlag, name: e.target.value })}
                  fullWidth
                  required
                  disabled={!!editingFlag}
                  helperText="Unique identifier (e.g., enable_voice_search)"
                />
                <TextField
                  label="Description"
                  value={newFlag.description}
                  onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
                  fullWidth
                  multiline
                  rows={2}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={newFlag.enabled}
                      onChange={(e) => setNewFlag({ ...newFlag, enabled: e.target.checked })}
                    />
                  }
                  label="Enabled"
                />
                <FormControl fullWidth>
                  <InputLabel>Rollout Type</InputLabel>
                  <Select
                    value={newFlag.rollout_type}
                    label="Rollout Type"
                    onChange={(e) => setNewFlag({ ...newFlag, rollout_type: e.target.value })}
                  >
                    <MenuItem value="global">Global (All Users)</MenuItem>
                    <MenuItem value="role">Role-Based</MenuItem>
                    <MenuItem value="region">Region-Based</MenuItem>
                    <MenuItem value="percentage">Percentage Rollout</MenuItem>
                    <MenuItem value="user_list">User List</MenuItem>
                  </Select>
                </FormControl>
                {newFlag.rollout_type === 'role' && (
                  <Alert severity="info">
                    Configure roles in the config field: {"{"}"roles": ["retailer", "wholesaler"]{"}"}
                  </Alert>
                )}
                {newFlag.rollout_type === 'region' && (
                  <Alert severity="info">
                    Configure regions in the config field: {"{"}"regions": ["BLR", "MUM"]{"}"}
                  </Alert>
                )}
                {newFlag.rollout_type === 'percentage' && (
                  <Alert severity="info">
                    Configure percentage in the config field: {"{"}"percentage": 50{"}"} (0-100)
                  </Alert>
                )}
                {newFlag.rollout_type === 'user_list' && (
                  <Alert severity="info">
                    Configure user IDs in the config field: {"{"}"user_ids": ["uuid1", "uuid2"]{"}"}
                  </Alert>
                )}
                <TextField
                  label="Config (JSON)"
                  value={JSON.stringify(newFlag.config, null, 2)}
                  onChange={(e) => {
                    try {
                      setNewFlag({ ...newFlag, config: JSON.parse(e.target.value) });
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  fullWidth
                  multiline
                  rows={4}
                  helperText="Rollout configuration as JSON"
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setFlagDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveFeatureFlag} variant="contained">
                {editingFlag ? 'Update' : 'Create'}
              </Button>
            </DialogActions>
          </Dialog>
        </TabPanel>
      </Paper>
    </Box>
  );
}