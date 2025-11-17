'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Paper,
  Tabs,
  Tab,
  Stack,
  Autocomplete,
  Alert,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Schedule,
  Public,
  Image as ImageIcon,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

interface ContentSlot {
  id: string;
  code: string;
  name: string;
  description?: string;
  allowed_types: string[];
  max_items: number;
}

interface ContentItem {
  id: string;
  slot_id: string;
  type: string;
  title?: string;
  subtitle?: string;
  image_url?: string;
  deeplink?: string;
  payload?: any;
  targeting?: any;
  start_at?: string;
  end_at?: string;
  priority: number;
  is_active: boolean;
  dynamic_content_slots?: {
    code: string;
    name: string;
  };
}

export default function DynamicContentPage() {
  const [slots, setSlots] = useState<ContentSlot[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const [formData, setFormData] = useState({
    slot_id: '',
    type: 'banner',
    title: '',
    subtitle: '',
    image_url: '',
    deeplink: '',
    priority: 0,
    is_active: true,
    targeting: {
      roles: [] as string[],
      regions: [] as string[],
      user_ids: [] as string[],
    },
    start_at: null as Date | null,
    end_at: null as Date | null,
    payload: {} as any,
  });

  useEffect(() => {
    loadSlots();
  }, []);

  useEffect(() => {
    if (selectedSlot || tabValue === 1) {
      loadItems();
    }
  }, [selectedSlot, tabValue]);

  const loadSlots = async () => {
    try {
      const result = await adminQueries.getContentSlots();
      setSlots(result.data || []);
      if (result.data && result.data.length > 0 && !selectedSlot) {
        setSelectedSlot(result.data[0].id);
      }
    } catch (error) {
      console.error('Error loading slots:', error);
      toast.error('Failed to load content slots');
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const result = await adminQueries.getContentItems(selectedSlot || undefined);
      setItems(result.items || []);
    } catch (error) {
      console.error('Error loading content items:', error);
      toast.error('Failed to load content items');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (item?: ContentItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        slot_id: item.slot_id,
        type: item.type,
        title: item.title || '',
        subtitle: item.subtitle || '',
        image_url: item.image_url || '',
        deeplink: item.deeplink || '',
        priority: item.priority,
        is_active: item.is_active,
        targeting: item.targeting || { roles: [], regions: [], user_ids: [] },
        start_at: item.start_at ? new Date(item.start_at) : null,
        end_at: item.end_at ? new Date(item.end_at) : null,
        payload: item.payload || {},
      });
    } else {
      setEditingItem(null);
      setFormData({
        slot_id: selectedSlot || '',
        type: 'banner',
        title: '',
        subtitle: '',
        image_url: '',
        deeplink: '',
        priority: 0,
        is_active: true,
        targeting: { roles: [], regions: [], user_ids: [] },
        start_at: null,
        end_at: null,
        payload: {},
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.slot_id || !formData.type) {
        toast.error('Please select a slot and type');
        return;
      }

      await adminQueries.upsertContentItem({
        id: editingItem?.id,
        slot_id: formData.slot_id,
        type: formData.type,
        title: formData.title,
        subtitle: formData.subtitle,
        image_url: formData.image_url,
        deeplink: formData.deeplink,
        priority: formData.priority,
        is_active: formData.is_active,
        targeting: formData.targeting,
        start_at: formData.start_at?.toISOString(),
        end_at: formData.end_at?.toISOString(),
        payload: formData.payload,
      });

      toast.success(editingItem ? 'Content updated!' : 'Content created!');
      setDialogOpen(false);
      loadItems();
    } catch (error: any) {
      console.error('Error saving content:', error);
      toast.error(error.message || 'Failed to save content');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content item?')) return;

    try {
      await adminQueries.deleteContentItem(id);
      toast.success('Content deleted!');
      loadItems();
    } catch (error: any) {
      console.error('Error deleting content:', error);
      toast.error(error.message || 'Failed to delete content');
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'image_url',
      headerName: 'Image',
      width: 80,
      renderCell: (params: GridRenderCellParams) => (
        params.value ? (
          <img src={params.value} alt="" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <ImageIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
        )
      ),
    },
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} size="small" />
      ),
    },
    {
      field: 'dynamic_content_slots',
      headerName: 'Slot',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        params.value?.name || 'N/A'
      ),
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 100,
    },
    {
      field: 'is_active',
      headerName: 'Active',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton size="small" onClick={() => handleOpenDialog(params.row)}>
            <Edit />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => handleDelete(params.row.id)}>
            <Delete />
          </IconButton>
        </Box>
      ),
    },
  ];

  const selectedSlotData = slots.find(s => s.id === selectedSlot);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h4" gutterBottom>
          Dynamic Content Management
        </Typography>

        <Paper sx={{ mt: 3 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="Content Slots" />
            <Tab label="Content Items" />
          </Tabs>

          {/* Content Slots Tab */}
          {tabValue === 0 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Content Slots
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Content slots define where dynamic content can be displayed in your app.
              </Typography>

              <List>
                {slots.map((slot) => (
                  <ListItem
                    key={slot.id}
                    button
                    selected={selectedSlot === slot.id}
                    onClick={() => setSelectedSlot(slot.id)}
                    sx={{
                      border: selectedSlot === slot.id ? 2 : 1,
                      borderColor: selectedSlot === slot.id ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemText
                      primary={slot.name}
                      secondary={
                        <>
                          <Typography variant="caption" display="block">
                            Code: {slot.code}
                          </Typography>
                          {slot.description && (
                            <Typography variant="caption" display="block">
                              {slot.description}
                            </Typography>
                          )}
                          <Typography variant="caption" display="block">
                            Types: {slot.allowed_types.join(', ')} • Max: {slot.max_items}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Content Items Tab */}
          {tabValue === 1 && (
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                  <Typography variant="h6">
                    Content Items
                  </Typography>
                  {selectedSlotData && (
                    <Typography variant="body2" color="text.secondary">
                      Slot: {selectedSlotData.name}
                    </Typography>
                  )}
                </Box>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => handleOpenDialog()}
                  disabled={!selectedSlot}
                >
                  Add Content
                </Button>
              </Box>

              {!selectedSlot && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Please select a content slot from the "Content Slots" tab first.
                </Alert>
              )}

              <DataGrid
                rows={items}
                columns={columns}
                loading={loading}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
              />
            </Box>
          )}
        </Paper>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingItem ? 'Edit Content Item' : 'Add Content Item'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <FormControl fullWidth required>
                <InputLabel>Content Slot</InputLabel>
                <Select
                  value={formData.slot_id}
                  label="Content Slot"
                  onChange={(e) => setFormData({ ...formData, slot_id: e.target.value })}
                >
                  {slots.map((slot) => (
                    <MenuItem key={slot.id} value={slot.id}>
                      {slot.name} ({slot.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Type"
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <MenuItem value="banner">Banner</MenuItem>
                  <MenuItem value="carousel_item">Carousel Item</MenuItem>
                  <MenuItem value="html_block">HTML Block</MenuItem>
                  <MenuItem value="product_grid">Product Grid</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                fullWidth
              />

              <TextField
                label="Subtitle"
                value={formData.subtitle}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                fullWidth
              />

              <TextField
                label="Image URL"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                fullWidth
                helperText="URL to the image for this content"
              />

              <TextField
                label="Deeplink"
                value={formData.deeplink}
                onChange={(e) => setFormData({ ...formData, deeplink: e.target.value })}
                fullWidth
                helperText="e.g., dukaaon://category/xyz or https://..."
              />

              <TextField
                label="Priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                fullWidth
                helperText="Higher priority items are shown first"
              />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Targeting (Optional)
                </Typography>
                <Autocomplete
                  multiple
                  options={['retailer', 'wholesaler', 'manufacturer']}
                  value={formData.targeting.roles}
                  onChange={(e, newValue) =>
                    setFormData({
                      ...formData,
                      targeting: { ...formData.targeting, roles: newValue },
                    })
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Target Roles" placeholder="Select roles" />
                  )}
                />
              </Box>

              <Box>
                <DateTimePicker
                  label="Start Date (Optional)"
                  value={formData.start_at}
                  onChange={(newValue) => setFormData({ ...formData, start_at: newValue })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Box>

              <Box>
                <DateTimePicker
                  label="End Date (Optional)"
                  value={formData.end_at}
                  onChange={(newValue) => setFormData({ ...formData, end_at: newValue })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <Typography>Active</Typography>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} variant="contained">
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}

