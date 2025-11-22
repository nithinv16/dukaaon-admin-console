'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { CircularProgress, Box } from '@mui/material';
import Layout from '@/components/Layout';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log('🛡️ ProtectedRoute effect:', { loading, user: !!user, isAdmin, pathname });
    
    if (!loading) {
      if (!user || !isAdmin) {
        // No user or not admin, redirect to login
        console.log('🚫 No user or not admin, redirecting to login');
        if (pathname !== '/login') {
          router.push('/login');
        }
      } else if (user && isAdmin && pathname === '/login') {
        // Admin user on login page, redirect to dashboard
        console.log('✅ Admin user on login page, redirecting to dashboard');
        router.push('/');
      } else if (user && isAdmin) {
        console.log('✅ Authenticated user, allowing access to:', pathname);
      }
    }
  }, [user, loading, isAdmin, pathname, router]);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Show login page without layout
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Show protected pages with layout only if user is admin
  if (user && isAdmin) {
    return <Layout>{children}</Layout>;
  }

  // Return null while redirecting
  return null;
}