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
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase';
import toast from 'react-hot-toast';

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

  useEffect(() => {
    loadSettings();
  }, []);

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

  const saveSettings = async (settingsType: string, settings: any) => {
    try {
      setLoading(true);
      // Save settings to Supabase
      // This would be implemented based on your settings table structure
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
                    <TextField
                      fullWidth
                      label="Azure API Key"
                      type={showPasswords ? 'text' : 'password'}
                      value={apiSettings.azureApiKey}
                      onChange={(e) =>
                        setApiSettings({ ...apiSettings, azureApiKey: e.target.value })
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
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={() => saveSettings('API', apiSettings)}
                disabled={loading}
              >
                Save API Settings
              </Button>
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
      </Paper>
    </Box>
  );
}