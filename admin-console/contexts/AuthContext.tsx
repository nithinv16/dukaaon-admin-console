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
      if (adminData) {
        const admin = JSON.parse(adminData);
        if (admin && admin.email && admin.role === 'admin') {
          setUser(admin);
          setIsAdmin(true);
        } else {
          localStorage.removeItem('admin_session');
          setUser(null);
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error parsing stored session:', error);
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