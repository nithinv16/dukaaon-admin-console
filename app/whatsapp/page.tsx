'use client';

import React, { useState, useEffect } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from '@mui/material';
import {
  WhatsApp,
  Send,
  Group,
  Message,
  Settings,
  Add,
  Edit,
  Delete,
} from '@mui/icons-material';

interface WhatsAppStats {
  totalMessages: number;
  deliveredMessages: number;
  readMessages: number;
  activeChats: number;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  status: 'active' | 'inactive';
}

export default function WhatsAppPage() {
  const [stats, setStats] = useState<WhatsAppStats>({
    totalMessages: 0,
    deliveredMessages: 0,
    readMessages: 0,
    activeChats: 0,
  });
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadTemplates();
  }, []);

  const loadStats = async () => {
    try {
      // Mock stats for now
      setStats({
        totalMessages: 2450,
        deliveredMessages: 2380,
        readMessages: 2100,
        activeChats: 156,
      });
    } catch (error) {
      console.error('Error loading WhatsApp stats:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      // Mock templates for now
      setTemplates([
        {
          id: '1',
          name: 'Order Confirmation',
          content: 'Your order #{orderNumber} has been confirmed. Thank you for shopping with us!',
          status: 'active',
        },
        {
          id: '2',
          name: 'Delivery Update',
          content: 'Your order is out for delivery and will reach you within 2 hours.',
          status: 'active',
        },
        {
          id: '3',
          name: 'Payment Reminder',
          content: 'Hi {customerName}, your payment of ₹{amount} is pending. Please complete it to avoid order cancellation.',
          status: 'inactive',
        },
      ]);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          WhatsApp Management
        </Typography>
        <Box display="flex" gap={2}>
          <FormControlLabel
            control={
              <Switch
                checked={whatsappEnabled}
                onChange={(e) => setWhatsappEnabled(e.target.checked)}
              />
            }
            label="WhatsApp Integration"
          />
          <Button variant="contained" startIcon={<Add />}>
            Add Template
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Messages
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalMessages.toLocaleString()}
                  </Typography>
                </Box>
                <Message color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Delivered
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats.deliveredMessages.toLocaleString()}
                  </Typography>
                </Box>
                <Send color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Read Messages
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    {stats.readMessages.toLocaleString()}
                  </Typography>
                </Box>
                <WhatsApp color="info" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Active Chats
                  </Typography>
                  <Typography variant="h4">
                    {stats.activeChats.toLocaleString()}
                  </Typography>
                </Box>
                <Group color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Message Templates */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Message Templates
            </Typography>
            <Button startIcon={<Settings />} size="small">
              Configure
            </Button>
          </Box>
          <List>
            {templates.map((template) => (
              <ListItem key={template.id} divider>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1">{template.name}</Typography>
                      <Chip
                        label={template.status}
                        color={template.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                  }
                  secondary={template.content}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" aria-label="edit" sx={{ mr: 1 }}>
                    <Edit />
                  </IconButton>
                  <IconButton edge="end" aria-label="delete">
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );
}