'use client';

import React, { useState } from 'react';
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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Storage,
  PlayArrow,
  History,
  Refresh,
  Build,
  Warning,
  CheckCircle,
} from '@mui/icons-material';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';

interface DbFunction {
  name: string;
  description: string;
  parameters: Array<{ name: string; type: string; description: string }>;
  category: string;
  requires_confirmation: boolean;
}

const AVAILABLE_FUNCTIONS: DbFunction[] = [
  {
    name: 'recalculate_user_stats',
    description: 'Recalculate statistics for a specific user (orders, revenue, etc.)',
    parameters: [
      { name: 'user_id', type: 'uuid', description: 'User ID to recalculate stats for' }
    ],
    category: 'User Management',
    requires_confirmation: false,
  },
  {
    name: 'rebuild_order_totals',
    description: 'Recalculate order totals and update order records',
    parameters: [
      { name: 'order_id', type: 'uuid', description: 'Order ID to recalculate (optional, leave empty for all)' }
    ],
    category: 'Order Management',
    requires_confirmation: false,
  },
  {
    name: 'cleanup_old_notifications',
    description: 'Delete notifications older than specified days',
    parameters: [
      { name: 'days_old', type: 'integer', description: 'Delete notifications older than this many days' }
    ],
    category: 'Maintenance',
    requires_confirmation: true,
  },
  {
    name: 'reindex_products',
    description: 'Rebuild product search indexes for better performance',
    parameters: [],
    category: 'Performance',
    requires_confirmation: false,
  },
  {
    name: 'sync_master_products',
    description: 'Sync master products catalog with seller inventories',
    parameters: [],
    category: 'Data Sync',
    requires_confirmation: false,
  },
];

export default function DatabaseToolsPage() {
  const [selectedFunction, setSelectedFunction] = useState<DbFunction | null>(null);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleFunctionSelect = (func: DbFunction) => {
    setSelectedFunction(func);
    setParameters({});
    setResult(null);
  };

  const handleExecute = async () => {
    if (!selectedFunction) return;

    if (selectedFunction.requires_confirmation) {
      setConfirmDialogOpen(true);
      return;
    }

    await executeFunction();
  };

  const executeFunction = async () => {
    if (!selectedFunction) return;

    try {
      setExecuting(true);
      setResult(null);

      // This would call a new API endpoint
      const response = await fetch('/api/admin/db/run-function', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function_name: selectedFunction.name,
          parameters: parameters,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Function execution failed');
      }

      const data = await response.json();
      setResult(data);
      toast.success('Function executed successfully!');
      setConfirmDialogOpen(false);
    } catch (error: any) {
      console.error('Error executing function:', error);
      toast.error(error.message || 'Failed to execute function');
      setResult({ error: error.message });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" gutterBottom>
        Database Tools
      </Typography>

      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="subtitle2">⚠️ Use with Caution</Typography>
        <Typography variant="body2">
          These tools execute database functions directly. Only use functions you understand and trust.
          All actions are logged in the audit log.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* Function List */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Available Functions
              </Typography>
              <List>
                {AVAILABLE_FUNCTIONS.map((func) => (
                  <ListItem
                    key={func.name}
                    button
                    selected={selectedFunction?.name === func.name}
                    onClick={() => handleFunctionSelect(func)}
                    sx={{
                      border: selectedFunction?.name === func.name ? 2 : 1,
                      borderColor: selectedFunction?.name === func.name ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemText
                      primary={func.name}
                      secondary={
                        <>
                          <Typography variant="caption" display="block">
                            {func.description}
                          </Typography>
                          <Chip label={func.category} size="small" sx={{ mt: 0.5 }} />
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Function Details & Execution */}
        <Grid item xs={12} md={8}>
          {selectedFunction ? (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Execute Function: {selectedFunction.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {selectedFunction.description}
                </Typography>

                {selectedFunction.parameters.length > 0 && (
                  <Stack spacing={2} sx={{ mb: 3 }}>
                    {selectedFunction.parameters.map((param) => (
                      <TextField
                        key={param.name}
                        label={param.name}
                        value={parameters[param.name] || ''}
                        onChange={(e) => setParameters({ ...parameters, [param.name]: e.target.value })}
                        fullWidth
                        helperText={param.description}
                        type={param.type === 'integer' ? 'number' : 'text'}
                      />
                    ))}
                  </Stack>
                )}

                {selectedFunction.parameters.length === 0 && (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    This function requires no parameters.
                  </Alert>
                )}

                <Button
                  variant="contained"
                  startIcon={executing ? <CircularProgress size={20} /> : <PlayArrow />}
                  onClick={handleExecute}
                  disabled={executing}
                  color={selectedFunction.requires_confirmation ? 'warning' : 'primary'}
                >
                  {executing ? 'Executing...' : 'Execute Function'}
                </Button>

                {result && (
                  <Paper sx={{ mt: 3, p: 2, bgcolor: result.error ? 'error.light' : 'success.light' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {result.error ? 'Error' : 'Result'}
                    </Typography>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </Paper>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <Alert severity="info">
                  Select a function from the list to execute it.
                </Alert>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>
          <Warning color="warning" sx={{ mr: 1, verticalAlign: 'middle' }} />
          Confirm Function Execution
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to execute <strong>{selectedFunction?.name}</strong>?
          </Typography>
          {selectedFunction?.requires_confirmation && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This function may modify or delete data. Please verify this is the correct action.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={executeFunction} variant="contained" color="warning">
            Execute
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

