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
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Send,
  Email,
  Sms,
  WhatsApp,
  People,
  Preview,
  Clear,
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

export default function SendMessagePage() {
  const [tabValue, setTabValue] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [recipients, setRecipients] = useState<string>('');
  const [recipientType, setRecipientType] = useState<'users' | 'roles' | 'custom'>('users');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadTemplates();
    loadUsers();
  }, [tabValue]);

  const loadTemplates = async () => {
    try {
      const type = ['email', 'sms', 'whatsapp', 'push'][tabValue];
      const response = await fetch(`/api/admin/templates?type=${type}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const result = await adminQueries.getAllUsers();
      const usersList = result.data || result;
      setUsers(Array.isArray(usersList) ? usersList : []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    // Initialize variables
    const vars: Record<string, string> = {};
    template.variables.forEach((v) => {
      vars[v] = '';
    });
    setVariables(vars);
  };

  const renderPreview = (template: Template, vars: Record<string, string>) => {
    let content = template.content;
    Object.entries(vars).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
    });
    return content;
  };

  const handleSend = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    // Validate variables
    const missingVars = selectedTemplate.variables.filter((v) => !variables[v]);
    if (missingVars.length > 0) {
      toast.error(`Please fill in all variables: ${missingVars.join(', ')}`);
      return;
    }

    // Determine recipients
    let recipientList: string[] = [];
    if (recipientType === 'custom') {
      recipientList = recipients.split(',').map((r) => r.trim()).filter(Boolean);
    } else if (recipientType === 'roles') {
      // Get users with selected roles
      const roleUsers = users
        .filter((u) => selectedRoles.includes(u.role))
        .map((u) => u.phone_number || u.id);
      recipientList = roleUsers;
    } else if (recipientType === 'users') {
      recipientList = selectedUserIds;
    }

    if (recipientList.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    try {
      setSending(true);
      const response = await fetch('/api/admin/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          template_type: selectedTemplate.type,
          variables,
          recipients: recipientList,
          recipient_type: recipientType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send messages');
      }

      const result = await response.json();
      toast.success(`Successfully sent ${result.sent} messages`);
      
      // Reset form
      setSelectedTemplate(null);
      setVariables({});
      setRecipients('');
      setSelectedRoles([]);
      setSelectedUserIds([]);
    } catch (error: any) {
      console.error('Error sending messages:', error);
      toast.error(error.message || 'Failed to send messages');
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" gutterBottom>
        Send Messages
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Send emails, SMS, WhatsApp messages, or push notifications using templates
      </Typography>

      <Paper>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab icon={<Email />} label="Email" />
          <Tab icon={<Sms />} label="SMS" />
          <Tab icon={<WhatsApp />} label="WhatsApp" />
          <Tab icon={<Send />} label="Push" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Stack spacing={3}>
            {/* Template Selection */}
            <FormControl fullWidth>
              <InputLabel>Select Template</InputLabel>
              <Select
                value={selectedTemplate?.id || ''}
                label="Select Template"
                onChange={(e) => {
                  const template = templates.find((t) => t.id === e.target.value);
                  if (template) handleTemplateSelect(template);
                }}
              >
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedTemplate && (
              <>
                {/* Variables */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Fill Template Variables
                    </Typography>
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      {selectedTemplate.variables.map((variable) => (
                        <TextField
                          key={variable}
                          label={variable.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          value={variables[variable] || ''}
                          onChange={(e) =>
                            setVariables({ ...variables, [variable]: e.target.value })
                          }
                          fullWidth
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Preview */}
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Preview</Typography>
                      <Button
                        size="small"
                        startIcon={<Preview />}
                        onClick={() => setPreviewDialogOpen(true)}
                      >
                        View Full Preview
                      </Button>
                    </Box>
                    {selectedTemplate.subject && (
                      <Typography variant="subtitle2" gutterBottom>
                        Subject: {selectedTemplate.subject}
                      </Typography>
                    )}
                    <Paper sx={{ p: 2, bgcolor: 'grey.50', mt: 1 }}>
                      <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                        {renderPreview(selectedTemplate, variables)}
                      </Typography>
                    </Paper>
                  </CardContent>
                </Card>

                {/* Recipients */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Select Recipients
                    </Typography>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Recipient Type</InputLabel>
                      <Select
                        value={recipientType}
                        label="Recipient Type"
                        onChange={(e) => setRecipientType(e.target.value as any)}
                      >
                        <MenuItem value="users">Specific Users</MenuItem>
                        <MenuItem value="roles">By Role</MenuItem>
                        <MenuItem value="custom">Custom (Phone/Email)</MenuItem>
                      </Select>
                    </FormControl>

                    {recipientType === 'custom' && (
                      <TextField
                        fullWidth
                        label="Recipients (comma-separated)"
                        value={recipients}
                        onChange={(e) => setRecipients(e.target.value)}
                        placeholder="+1234567890, +0987654321"
                        helperText="Enter phone numbers or email addresses separated by commas"
                      />
                    )}

                    {recipientType === 'roles' && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Select Roles:
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {['retailer', 'wholesaler', 'manufacturer'].map((role) => (
                            <FormControlLabel
                              key={role}
                              control={
                                <Checkbox
                                  checked={selectedRoles.includes(role)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedRoles([...selectedRoles, role]);
                                    } else {
                                      setSelectedRoles(selectedRoles.filter((r) => r !== role));
                                    }
                                  }}
                                />
                              }
                              label={role.charAt(0).toUpperCase() + role.slice(1)}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {recipientType === 'users' && (
                      <TextField
                        fullWidth
                        label="User IDs (comma-separated)"
                        value={selectedUserIds.join(', ')}
                        onChange={(e) =>
                          setSelectedUserIds(
                            e.target.value.split(',').map((id) => id.trim()).filter(Boolean)
                          )
                        }
                        placeholder="user-id-1, user-id-2"
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Send Button */}
                <Button
                  variant="contained"
                  size="large"
                  startIcon={sending ? <CircularProgress size={20} /> : <Send />}
                  onClick={handleSend}
                  disabled={sending}
                  fullWidth
                >
                  {sending ? 'Sending...' : 'Send Messages'}
                </Button>
              </>
            )}
          </Stack>
        </TabPanel>

        {/* Other tabs would have similar structure */}
        <TabPanel value={tabValue} index={1}>
          <Alert severity="info">SMS sending - similar interface as Email</Alert>
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <Alert severity="info">WhatsApp sending - similar interface as Email</Alert>
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <Alert severity="info">Push notifications - similar interface as Email</Alert>
        </TabPanel>
      </Paper>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Message Preview</DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Stack spacing={2}>
              {selectedTemplate.subject && (
                <Box>
                  <Typography variant="subtitle2">Subject:</Typography>
                  <Typography>{selectedTemplate.subject}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Content:
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                    {renderPreview(selectedTemplate, variables)}
                  </Typography>
                </Paper>
              </Box>
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

