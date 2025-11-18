'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
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
  Email,
  Sms,
  WhatsApp,
  Preview,
  Save,
  Send,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'whatsapp' | 'push';
  subject?: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    type: 'email' as 'email' | 'sms' | 'whatsapp' | 'push',
    subject: '',
    content: '',
    variables: [] as string[],
    is_active: true,
  });

  useEffect(() => {
    loadTemplates();
  }, [tabValue]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/templates?type=${['email', 'sms', 'whatsapp', 'push'][tabValue]}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      type: ['email', 'sms', 'whatsapp', 'push'][tabValue] as any,
      subject: '',
      content: '',
      variables: [],
      is_active: true,
    });
    setEditDialogOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      subject: template.subject || '',
      content: template.content,
      variables: template.variables || [],
      is_active: template.is_active,
    });
    setEditDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      setLoading(true);
      const url = editingTemplate
        ? `/api/admin/templates/${editingTemplate.id}`
        : '/api/admin/templates';
      const method = editingTemplate ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save template');
      }

      toast.success(`Template ${editingTemplate ? 'updated' : 'created'} successfully!`);
      setEditDialogOpen(false);
      loadTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(error.message || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/admin/templates/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete template');
      }

      toast.success('Template deleted successfully!');
      loadTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error(error.message || 'Failed to delete template');
    }
  };

  const handlePreview = (template: Template) => {
    setPreviewTemplate(template);
    // Extract variables from template content
    const variableRegex = /\{\{(\w+)\}\}/g;
    const matches = Array.from(template.content.matchAll(variableRegex));
    const vars: Record<string, string> = {};
    for (const match of matches) {
      vars[match[1]] = `Sample ${match[1]}`;
    }
    setPreviewVariables(vars);
    setPreviewDialogOpen(true);
  };

  const renderPreview = (template: Template, variables: Record<string, string>) => {
    let content = template.content;
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });
    return content;
  };

  const extractVariables = (content: string): string[] => {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const matches = Array.from(content.matchAll(variableRegex));
    const variables = new Set<string>();
    for (const match of matches) {
      variables.add(match[1]);
    }
    return Array.from(variables);
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const icons: Record<string, any> = {
          email: <Email />,
          sms: <Sms />,
          whatsapp: <WhatsApp />,
          push: <Send />,
        };
        return (
          <Chip
            icon={icons[params.value]}
            label={params.value}
            size="small"
            color={params.value === 'email' ? 'primary' : params.value === 'whatsapp' ? 'success' : 'default'}
          />
        );
      },
    },
    {
      field: 'subject',
      headerName: 'Subject',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'variables',
      headerName: 'Variables',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          {params.value?.map((v: string, i: number) => (
            <Chip key={i} label={v} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
          ))}
        </Box>
      ),
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'Active' : 'Inactive'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handlePreview(params.row)}
          >
            <Preview />
          </IconButton>
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleEditTemplate(params.row)}
          >
            <Edit />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteTemplate(params.row.id)}
          >
            <Delete />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Message Templates</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateTemplate}
        >
          Create Template
        </Button>
      </Box>

      <Paper>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab icon={<Email />} label="Email" />
          <Tab icon={<Sms />} label="SMS" />
          <Tab icon={<WhatsApp />} label="WhatsApp" />
          <Tab icon={<Send />} label="Push" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Card>
            <CardContent>
              <DataGrid
                rows={templates.filter((t) => t.type === 'email')}
                columns={columns}
                loading={loading}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                getRowId={(row) => row.id}
              />
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Card>
            <CardContent>
              <DataGrid
                rows={templates.filter((t) => t.type === 'sms')}
                columns={columns}
                loading={loading}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                getRowId={(row) => row.id}
              />
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Card>
            <CardContent>
              <DataGrid
                rows={templates.filter((t) => t.type === 'whatsapp')}
                columns={columns}
                loading={loading}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                getRowId={(row) => row.id}
              />
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Card>
            <CardContent>
              <DataGrid
                rows={templates.filter((t) => t.type === 'push')}
                columns={columns}
                loading={loading}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                getRowId={(row) => row.id}
              />
            </CardContent>
          </Card>
        </TabPanel>
      </Paper>

      {/* Edit/Create Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingTemplate ? 'Edit Template' : 'Create Template'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Template Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                label="Type"
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="whatsapp">WhatsApp</MenuItem>
                <MenuItem value="push">Push Notification</MenuItem>
              </Select>
            </FormControl>
            {(formData.type === 'email' || formData.type === 'push') && (
              <TextField
                label="Subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                fullWidth
              />
            )}
            <TextField
              label="Content"
              value={formData.content}
              onChange={(e) => {
                const content = e.target.value;
                const variables = extractVariables(content);
                setFormData({ ...formData, content, variables });
              }}
              fullWidth
              multiline
              rows={8}
              helperText="Use {{variable_name}} for dynamic variables"
            />
            {formData.variables.length > 0 && (
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  Variables detected:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.variables.map((v) => (
                    <Chip key={v} label={v} size="small" />
                  ))}
                </Box>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveTemplate} variant="contained" startIcon={<Save />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Template Preview</DialogTitle>
        <DialogContent>
          {previewTemplate && (
            <Stack spacing={2}>
              <Typography variant="subtitle2">Name: {previewTemplate.name}</Typography>
              {previewTemplate.subject && (
                <Typography variant="subtitle2">Subject: {previewTemplate.subject}</Typography>
              )}
              <Divider />
              <Typography variant="subtitle2" gutterBottom>
                Variables:
              </Typography>
              {Object.entries(previewVariables).map(([key, value]) => (
                <TextField
                  key={key}
                  label={key}
                  value={value}
                  onChange={(e) =>
                    setPreviewVariables({ ...previewVariables, [key]: e.target.value })
                  }
                  size="small"
                />
              ))}
              <Divider />
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                  {renderPreview(previewTemplate, previewVariables)}
                </Typography>
              </Paper>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

