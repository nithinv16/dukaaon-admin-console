'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Avatar,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  AdminPanelSettings,
} from '@mui/icons-material';
import { validateAdminCredentials } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { refreshAuth } = useAuth();

  // Remove the useEffect that checks localStorage to prevent conflicts with ProtectedRoute
  // ProtectedRoute will handle the redirect for authenticated users

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await validateAdminCredentials(email, password);

      if (!result.success) {
        throw new Error(result.message || 'Invalid credentials');
      }

      // Validate admin object before storing
      console.log('📦 Admin object received:', result.admin);
      console.log('📦 Admin email:', result.admin?.email);
      console.log('📦 Admin role:', result.admin?.role);
      
      // Check if role is any admin type (admin, Super Admin, etc.)
      const isAdminRole = result.admin?.role && 
        (result.admin.role.toLowerCase().includes('admin') || 
         result.admin.role === 'admin' || 
         result.admin.role === 'Super Admin');
      
      if (!result.admin || !result.admin.email || !isAdminRole) {
        console.error('❌ Invalid admin object structure:', result.admin);
        throw new Error('Invalid admin data received from server');
      }
      
      // Store admin session in localStorage
      const adminSessionData = JSON.stringify(result.admin);
      localStorage.setItem('admin_session', adminSessionData);
      console.log('💾 Stored admin session in localStorage');
      
      // Verify it was stored correctly
      const stored = localStorage.getItem('admin_session');
      if (!stored) {
        throw new Error('Failed to store admin session');
      }
      
      const parsedStored = JSON.parse(stored);
      console.log('✅ Verified stored session:', parsedStored);
      console.log('✅ Stored session has email?', !!parsedStored?.email);
      console.log('✅ Stored session role:', parsedStored?.role);
      
      toast.success('Login successful!');
      
      // Small delay to ensure localStorage is persisted
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Final verification that data is in localStorage
      const verifyStored = localStorage.getItem('admin_session');
      if (!verifyStored) {
        throw new Error('Session was not persisted correctly');
      }
      
      const verifyParsed = JSON.parse(verifyStored);
      const isVerifyAdminRole = verifyParsed?.role && 
        (verifyParsed.role.toLowerCase().includes('admin') || 
         verifyParsed.role === 'admin' || 
         verifyParsed.role === 'Super Admin');
      
      if (!verifyParsed?.email || !isVerifyAdminRole) {
        console.error('❌ Stored session validation failed:', verifyParsed);
        throw new Error('Stored session data is invalid');
      }
      
      console.log('✅ Session validated, navigating to dashboard...');
      // Use window.location for a hard navigation - this causes full page reload
      // The new page will read from localStorage and initialize auth state
      window.location.replace('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
      toast.error(err.message || 'Login failed');
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    toast('Admin credentials are already configured in the database. Use the default credentials to login.');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 2,
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mb: 3,
              }}
            >
              <Avatar
                sx={{
                  bgcolor: 'primary.main',
                  width: 64,
                  height: 64,
                  mb: 2,
                }}
              >
                <AdminPanelSettings fontSize="large" />
              </Avatar>
              <Typography
                variant="h4"
                component="h1"
                fontWeight="bold"
                color="primary"
                gutterBottom
              >
                DukaaOn Admin
              </Typography>
              <Typography variant="body1" color="text.secondary" textAlign="center">
                Sign in to access the admin console
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  mb: 2,
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1.1rem',
                }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Sign In'
                )}
              </Button>

              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={handleSignUp}
                disabled={loading}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                }}
              >
                Create Admin Account
              </Button>
            </Box>


          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}