'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircularProgress, Box } from '@mui/material';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const checkStoredSession = () => {
    try {
      const adminData = localStorage.getItem('admin_session');
      console.log('🔍 Checking stored session:', adminData ? 'Found data' : 'No data');
      
      if (adminData) {
        const admin = JSON.parse(adminData);
        console.log('📋 Parsed admin data:', admin);
        console.log('🔑 Admin has email?', !!admin?.email);
        console.log('🔑 Admin role:', admin?.role);
        console.log('🔑 Role check:', admin?.role === 'admin');
        
        // Check if role is any admin type (admin, Super Admin, etc.)
        const isAdminRole = admin?.role && 
          (admin.role.toLowerCase().includes('admin') || 
           admin.role === 'admin' || 
           admin.role === 'Super Admin');
        
        if (admin && admin.email && isAdminRole) {
          console.log('✅ Valid admin session found, setting user');
          setUser(admin);
          setIsAdmin(true);
        } else {
          console.warn('⚠️ Invalid admin session data, clearing');
          localStorage.removeItem('admin_session');
          setUser(null);
          setIsAdmin(false);
        }
      } else {
        console.log('ℹ️ No stored session found');
        setUser(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('❌ Error parsing stored session:', error);
      localStorage.removeItem('admin_session');
      setUser(null);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    checkStoredSession();
    setLoading(false);
  }, []);

  const refreshAuth = () => {
    checkStoredSession();
  };

  const signOut = async () => {
    localStorage.removeItem('admin_session');
    setUser(null);
    setIsAdmin(false);
    router.push('/login');
  };

  const value = {
    user,
    loading,
    signOut,
    isAdmin,
    refreshAuth,
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}