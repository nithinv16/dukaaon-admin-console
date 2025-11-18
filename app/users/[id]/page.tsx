'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Chip,
  Avatar,
  Divider,
  Stack,
  Paper,
  Tabs,
  Tab,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Edit,
  LocationOn,
  Business,
  Person,
  VerifiedUser,
  Warning,
  ShoppingCart,
  Inventory,
  Map,
  Phone,
  Email,
  Image as ImageIcon,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';

interface Profile {
  id: string;
  phone_number: string;
  role: string;
  status: string;
  business_details?: any;
  latitude?: number;
  longitude?: number;
  location_address?: string;
  shop_image_url?: string;
  profile_image_url?: string;
  kyc_document_urls?: any;
  created_at: string;
  updated_at: string;
}

interface SellerDetails {
  id: string;
  user_id: string;
  seller_type: string;
  business_name?: string;
  owner_name?: string;
  address?: any;
  location_address?: string;
  latitude?: number;
  longitude?: number;
  gstin?: string;
  pan_number?: string;
  bank_details?: any;
  image_url?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [sellerDetails, setSellerDetails] = useState<SellerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    phone_number: '',
    role: '',
    status: '',
    business_details: {
      shopName: '',
      address: '',
      ownerName: '',
      gstin: '',
      panNumber: '',
    },
    latitude: '',
    longitude: '',
    location_address: '',
    kyc_status: 'pending',
  });

  const [sellerFormData, setSellerFormData] = useState({
    business_name: '',
    owner_name: '',
    seller_type: 'wholesaler',
    gstin: '',
    pan_number: '',
    location_address: '',
    latitude: '',
    longitude: '',
    bank_details: {
      account_number: '',
      ifsc: '',
      bank_name: '',
      account_holder_name: '',
    },
  });

  useEffect(() => {
    if (userId) {
      loadUserProfile();
    }
  }, [userId]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const result = await adminQueries.getAllUsers();
      const users = result.data || result;
      const user = Array.isArray(users) ? users.find((u: any) => u.id === userId) : null;

      if (!user) {
        toast.error('User not found');
        router.push('/users');
        return;
      }

      setProfile(user);

      // Parse business_details if it's a string
      let businessDetails: {
        shopName?: string;
        business_name?: string;
        address?: string;
        ownerName?: string;
        owner_name?: string;
        gstin?: string;
        panNumber?: string;
        pan_number?: string;
      } = {};
      if (user.business_details) {
        businessDetails = typeof user.business_details === 'string'
          ? JSON.parse(user.business_details)
          : user.business_details;
      }

      setFormData({
        phone_number: user.phone_number || '',
        role: user.role || '',
        status: user.status || 'active',
        business_details: {
          shopName: businessDetails?.shopName || businessDetails?.business_name || '',
          address: businessDetails?.address || user.location_address || '',
          ownerName: businessDetails?.ownerName || businessDetails?.owner_name || '',
          gstin: businessDetails?.gstin || '',
          panNumber: businessDetails?.panNumber || businessDetails?.pan_number || '',
        },
        latitude: user.latitude?.toString() || '',
        longitude: user.longitude?.toString() || '',
        location_address: user.location_address || '',
        kyc_status: user.kyc_status || 'pending',
      });

      // Load seller details if user is a seller
      if (user.role === 'wholesaler' || user.role === 'manufacturer') {
        await loadSellerDetails(userId);
      }

      // Load user orders and products
      await loadUserOrders(userId);
      await loadUserProducts(userId);
    } catch (error: any) {
      console.error('Error loading user profile:', error);
      toast.error(error.message || 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const loadSellerDetails = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/seller-details`);
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setSellerDetails(data);
          setSellerFormData({
            business_name: data.business_name || '',
            owner_name: data.owner_name || '',
            seller_type: data.seller_type || 'wholesaler',
            gstin: data.gstin || '',
            pan_number: data.pan_number || '',
            location_address: data.location_address || '',
            latitude: data.latitude?.toString() || '',
            longitude: data.longitude?.toString() || '',
            bank_details: data.bank_details || {
              account_number: '',
              ifsc: '',
              bank_name: '',
              account_holder_name: '',
            },
          });
        }
      }
    } catch (error) {
      console.error('Error loading seller details:', error);
    }
  };

  const loadUserOrders = async (userId: string) => {
    try {
      const result = await adminQueries.getOrders({});
      const orders = result.orders || [];
      const userOrders = orders.filter((o: any) => 
        o.retailer_id === userId || o.seller_id === userId || o.user_id === userId
      );
      setOrders(userOrders);
    } catch (error) {
      console.error('Error loading user orders:', error);
    }
  };

  const loadUserProducts = async (userId: string) => {
    try {
      const result = await adminQueries.getProducts({ seller_id: userId });
      setProducts(result.products || []);
    } catch (error) {
      console.error('Error loading user products:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const businessDetails = {
        shopName: formData.business_details.shopName,
        address: formData.business_details.address,
        ownerName: formData.business_details.ownerName,
        gstin: formData.business_details.gstin,
        panNumber: formData.business_details.panNumber,
      };

      await adminQueries.updateUser(userId, {
        phone_number: formData.phone_number,
        status: formData.status,
        business_details: businessDetails,
        // Note: latitude, longitude, location_address, kyc_status would need to be added to updateUser
      });

      toast.success('Profile updated successfully!');
      setEditMode(false);
      loadUserProfile();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">User not found</Alert>
      </Box>
    );
  }

  const businessDetails = typeof profile.business_details === 'string'
    ? JSON.parse(profile.business_details || '{}')
    : profile.business_details || {};

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => router.push('/users')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4">
            {businessDetails.shopName || businessDetails.business_name || 'User Profile'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {profile.phone_number} • {profile.role}
          </Typography>
        </Box>
        {!editMode && (
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => setEditMode(true)}
          >
            Edit Profile
          </Button>
        )}
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab icon={<Person />} label="Profile" />
          <Tab icon={<Business />} label="Business Details" />
          <Tab icon={<ShoppingCart />} label="Orders" />
          <Tab icon={<Inventory />} label="Products" />
          {sellerDetails && <Tab icon={<VerifiedUser />} label="Seller Details" />}
        </Tabs>

        {/* Profile Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Avatar
                    src={profile.profile_image_url || profile.shop_image_url}
                    sx={{ width: 120, height: 120, mx: 'auto', mb: 2 }}
                  >
                    {businessDetails.shopName?.[0] || 'U'}
                  </Avatar>
                  <Typography variant="h6">
                    {businessDetails.shopName || businessDetails.business_name || 'No Name'}
                  </Typography>
                  <Chip
                    label={profile.role}
                    color={profile.role === 'retailer' ? 'primary' : 'secondary'}
                    sx={{ mt: 1 }}
                  />
                  <Chip
                    label={profile.status}
                    color={profile.status === 'active' ? 'success' : 'default'}
                    sx={{ mt: 1, ml: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Basic Information
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField
                      label="Phone Number"
                      value={editMode ? formData.phone_number : profile.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      fullWidth
                      disabled={!editMode}
                      InputProps={{
                        startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                    <FormControl fullWidth disabled={!editMode}>
                      <InputLabel>Role</InputLabel>
                      <Select
                        value={editMode ? formData.role : profile.role}
                        label="Role"
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      >
                        <MenuItem value="retailer">Retailer</MenuItem>
                        <MenuItem value="wholesaler">Wholesaler</MenuItem>
                        <MenuItem value="manufacturer">Manufacturer</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl fullWidth disabled={!editMode}>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={editMode ? formData.status : profile.status}
                        label="Status"
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                        <MenuItem value="suspended">Suspended</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl fullWidth disabled={!editMode}>
                      <InputLabel>KYC Status</InputLabel>
                      <Select
                        value={editMode ? formData.kyc_status : (profile as any).kyc_status || 'pending'}
                        label="KYC Status"
                        onChange={(e) => setFormData({ ...formData, kyc_status: e.target.value })}
                      >
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="verified">Verified</MenuItem>
                        <MenuItem value="rejected">Rejected</MenuItem>
                      </Select>
                    </FormControl>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Created: {new Date(profile.created_at).toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Updated: {new Date(profile.updated_at).toLocaleString()}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {editMode && (
            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button onClick={() => setEditMode(false)}>Cancel</Button>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                onClick={handleSave}
                disabled={saving}
              >
                Save Changes
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* Business Details Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Business Information
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField
                      label="Shop/Business Name"
                      value={editMode ? formData.business_details.shopName : (businessDetails.shopName || businessDetails.business_name || '')}
                      onChange={(e) => setFormData({
                        ...formData,
                        business_details: { ...formData.business_details, shopName: e.target.value }
                      })}
                      fullWidth
                      disabled={!editMode}
                    />
                    <TextField
                      label="Owner Name"
                      value={editMode ? formData.business_details.ownerName : (businessDetails.ownerName || businessDetails.owner_name || '')}
                      onChange={(e) => setFormData({
                        ...formData,
                        business_details: { ...formData.business_details, ownerName: e.target.value }
                      })}
                      fullWidth
                      disabled={!editMode}
                    />
                    <TextField
                      label="GSTIN"
                      value={editMode ? formData.business_details.gstin : (businessDetails.gstin || '')}
                      onChange={(e) => setFormData({
                        ...formData,
                        business_details: { ...formData.business_details, gstin: e.target.value }
                      })}
                      fullWidth
                      disabled={!editMode}
                    />
                    <TextField
                      label="PAN Number"
                      value={editMode ? formData.business_details.panNumber : (businessDetails.panNumber || businessDetails.pan_number || '')}
                      onChange={(e) => setFormData({
                        ...formData,
                        business_details: { ...formData.business_details, panNumber: e.target.value }
                      })}
                      fullWidth
                      disabled={!editMode}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Location
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField
                      label="Address"
                      value={editMode ? formData.location_address : (profile.location_address || businessDetails.address || '')}
                      onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                      fullWidth
                      multiline
                      rows={3}
                      disabled={!editMode}
                      InputProps={{
                        startAdornment: <LocationOn sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          label="Latitude"
                          type="number"
                          value={editMode ? formData.latitude : (profile.latitude?.toString() || '')}
                          onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                          fullWidth
                          disabled={!editMode}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Longitude"
                          type="number"
                          value={editMode ? formData.longitude : (profile.longitude?.toString() || '')}
                          onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                          fullWidth
                          disabled={!editMode}
                        />
                      </Grid>
                    </Grid>
                    {profile.latitude && profile.longitude && (
                      <Alert severity="info">
                        Location: {profile.latitude}, {profile.longitude}
                      </Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* KYC Documents */}
            {profile.kyc_document_urls && Object.keys(profile.kyc_document_urls).length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      KYC Documents
                    </Typography>
                    <List>
                      {Object.entries(profile.kyc_document_urls).map(([type, url]: [string, any]) => (
                        <ListItem key={type}>
                          <ListItemIcon>
                            <ImageIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={type.replace(/_/g, ' ').toUpperCase()}
                            secondary={
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                View Document
                              </a>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Orders Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            User Orders ({orders.length})
          </Typography>
          {orders.length === 0 ? (
            <Alert severity="info">No orders found for this user</Alert>
          ) : (
            <List>
              {orders.map((order: any) => (
                <ListItem key={order.id} divider>
                  <ListItemText
                    primary={`Order #${order.id.slice(-8)}`}
                    secondary={`${new Date(order.created_at).toLocaleString()} • ₹${order.total_amount}`}
                  />
                  <Chip label={order.status} color="primary" size="small" />
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        {/* Products Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            User Products ({products.length})
          </Typography>
          {products.length === 0 ? (
            <Alert severity="info">No products found for this user</Alert>
          ) : (
            <Grid container spacing={2}>
              {products.map((product: any) => (
                <Grid item xs={12} sm={6} md={4} key={product.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1">{product.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        ₹{product.price} • Stock: {product.stock_available || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        {/* Seller Details Tab */}
        {sellerDetails && (
          <TabPanel value={tabValue} index={4}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Seller Information
                    </Typography>
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <TextField
                        label="Business Name"
                        value={sellerFormData.business_name}
                        onChange={(e) => setSellerFormData({ ...sellerFormData, business_name: e.target.value })}
                        fullWidth
                        disabled={!editMode}
                      />
                      <TextField
                        label="Owner Name"
                        value={sellerFormData.owner_name}
                        onChange={(e) => setSellerFormData({ ...sellerFormData, owner_name: e.target.value })}
                        fullWidth
                        disabled={!editMode}
                      />
                      <FormControl fullWidth disabled={!editMode}>
                        <InputLabel>Seller Type</InputLabel>
                        <Select
                          value={sellerFormData.seller_type}
                          label="Seller Type"
                          onChange={(e) => setSellerFormData({ ...sellerFormData, seller_type: e.target.value })}
                        >
                          <MenuItem value="wholesaler">Wholesaler</MenuItem>
                          <MenuItem value="manufacturer">Manufacturer</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        label="GSTIN"
                        value={sellerFormData.gstin}
                        onChange={(e) => setSellerFormData({ ...sellerFormData, gstin: e.target.value })}
                        fullWidth
                        disabled={!editMode}
                      />
                      <TextField
                        label="PAN Number"
                        value={sellerFormData.pan_number}
                        onChange={(e) => setSellerFormData({ ...sellerFormData, pan_number: e.target.value })}
                        fullWidth
                        disabled={!editMode}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Bank Details
                    </Typography>
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <TextField
                        label="Account Number"
                        value={sellerFormData.bank_details.account_number}
                        onChange={(e) => setSellerFormData({
                          ...sellerFormData,
                          bank_details: { ...sellerFormData.bank_details, account_number: e.target.value }
                        })}
                        fullWidth
                        disabled={!editMode}
                      />
                      <TextField
                        label="IFSC Code"
                        value={sellerFormData.bank_details.ifsc}
                        onChange={(e) => setSellerFormData({
                          ...sellerFormData,
                          bank_details: { ...sellerFormData.bank_details, ifsc: e.target.value }
                        })}
                        fullWidth
                        disabled={!editMode}
                      />
                      <TextField
                        label="Bank Name"
                        value={sellerFormData.bank_details.bank_name}
                        onChange={(e) => setSellerFormData({
                          ...sellerFormData,
                          bank_details: { ...sellerFormData.bank_details, bank_name: e.target.value }
                        })}
                        fullWidth
                        disabled={!editMode}
                      />
                      <TextField
                        label="Account Holder Name"
                        value={sellerFormData.bank_details.account_holder_name}
                        onChange={(e) => setSellerFormData({
                          ...sellerFormData,
                          bank_details: { ...sellerFormData.bank_details, account_holder_name: e.target.value }
                        })}
                        fullWidth
                        disabled={!editMode}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        )}
      </Paper>
    </Box>
  );
}


