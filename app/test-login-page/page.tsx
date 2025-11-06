'use client';

import { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Alert } from '@mui/material';

export default function TestLoginPage() {
  const [email, setEmail] = useState('admin@dukaaon.in');
  const [password, setPassword] = useState('dukaaon#28');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testDirectAPI = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('Response data:', data);

      setResult({
        status: response.status,
        ok: response.ok,
        data,
      });

      if (!response.ok) {
        setError(`HTTP ${response.status}: ${JSON.stringify(data)}`);
      }
    } catch (err: any) {
      console.error('Test error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testActualAPI = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/validate-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('Actual API Response status:', response.status);
      console.log('Actual API Response ok:', response.ok);

      const data = await response.json();
      console.log('Actual API Response data:', data);

      setResult({
        status: response.status,
        ok: response.ok,
        data,
        diagnosis: {
          hasSuccess: 'success' in data,
          successValue: data.success,
          hasAdmin: 'admin' in data,
          hasError: 'error' in data,
        },
      });

      if (!response.ok) {
        setError(`HTTP ${response.status}: ${JSON.stringify(data)}`);
      } else if (!data.success) {
        setError(`Validation failed: ${data.message}`);
      } else {
        setError(null);
      }
    } catch (err: any) {
      console.error('Actual API test error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testValidateFunction = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Import and use the actual validation function
      const { validateAdminCredentials } = await import('@/lib/supabase-browser');
      
      console.log('Testing validateAdminCredentials function...');
      const validationResult = await validateAdminCredentials(email, password);
      
      console.log('validateAdminCredentials result:', validationResult);
      
      setResult({
        functionResult: validationResult,
        diagnosis: {
          hasSuccess: 'success' in validationResult,
          successValue: validationResult.success,
          hasAdmin: 'admin' in validationResult,
          hasError: 'error' in validationResult,
        },
      });

      if (!validationResult.success) {
        setError(`Validation failed: ${validationResult.message}`);
      }
    } catch (err: any) {
      console.error('Validation function error:', err);
      setError(`Error: ${err.message}`);
      setResult({
        error: err.message,
        stack: err.stack,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Login Debugging Test Page
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Test Credentials
        </Typography>
        
        <TextField
          fullWidth
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          sx={{ mb: 2 }}
        />
        
        <TextField
          fullWidth
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            onClick={testDirectAPI}
            disabled={loading}
          >
            Test Direct API (test-login)
          </Button>

          <Button
            variant="contained"
            color="secondary"
            onClick={testActualAPI}
            disabled={loading}
          >
            Test Actual API (validate-credentials)
          </Button>

          <Button
            variant="contained"
            color="success"
            onClick={testValidateFunction}
            disabled={loading}
          >
            Test Validation Function
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Paper sx={{ p: 3, bgcolor: '#f5f5f5' }}>
          <Typography variant="h6" gutterBottom>
            Result:
          </Typography>
          <pre style={{ overflow: 'auto', fontSize: '12px' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </Paper>
      )}

      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Open browser console (F12) to see detailed logs
        </Typography>
      </Box>
    </Box>
  );
}

