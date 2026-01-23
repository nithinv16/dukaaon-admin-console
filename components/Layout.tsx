'use client';

import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import NotificationBell from './notifications/NotificationBell';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Person,
  ShoppingCart,
  Inventory,
  Payment,
  Notifications,
  Settings,
  Analytics,
  Assessment,
  ExitToApp,
  AccountCircle,
  WhatsApp,
  Category,
  Campaign,
  Warning,
  Storage,
  History,
  Store,
  Security,
  Send,
  Speed,
  Flag,
  AssignmentTurnedIn,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const drawerWidth = 280;

interface LayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  text: string;
  icon: React.ReactElement;
  path: string;
  adminOnly: boolean;
}

const menuItems: MenuItem[] = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/', adminOnly: false },
  { text: 'Users', icon: <People />, path: '/users', adminOnly: false },
  { text: 'Profile Approvals', icon: <AssignmentTurnedIn />, path: '/profile-approvals', adminOnly: false },
  { text: 'Orders', icon: <ShoppingCart />, path: '/orders', adminOnly: false },
  { text: 'Products', icon: <Inventory />, path: '/products', adminOnly: false },
  { text: 'Categories', icon: <Category />, path: '/categories', adminOnly: false },
  { text: 'Dynamic Content', icon: <Campaign />, path: '/dynamic-content', adminOnly: false },
  { text: 'Warnings', icon: <Warning />, path: '/warnings', adminOnly: false },
  { text: 'Payments', icon: <Payment />, path: '/payments', adminOnly: false },
  { text: 'WhatsApp', icon: <WhatsApp />, path: '/whatsapp', adminOnly: false },
  { text: 'Notifications', icon: <Notifications />, path: '/notifications', adminOnly: false },
  { text: 'Analytics', icon: <Analytics />, path: '/analytics', adminOnly: false },
  { text: 'Database Tools', icon: <Storage />, path: '/database-tools', adminOnly: false },
  { text: 'Audit Log', icon: <History />, path: '/audit-log', adminOnly: true },
  { text: 'Live Dashboard', icon: <Speed />, path: '/live-dashboard', adminOnly: true },
  { text: 'Employee Tracking', icon: <Assessment />, path: '/employee-tracking', adminOnly: true },
  { text: 'Employee Targets', icon: <Flag />, path: '/employee-targets', adminOnly: true },
  { text: 'Seller Inventory', icon: <Store />, path: '/seller-inventory', adminOnly: false },
  { text: 'Bulk Operations', icon: <People />, path: '/bulk-operations', adminOnly: false },
  { text: 'Templates', icon: <Campaign />, path: '/templates', adminOnly: false },
  { text: 'Send Messages', icon: <Send />, path: '/send-message', adminOnly: false },
  { text: 'Roles & Permissions', icon: <Security />, path: '/roles-permissions', adminOnly: true },
  { text: 'Admin Users', icon: <Person />, path: '/admin-users', adminOnly: true },
  { text: 'Settings', icon: <Settings />, path: '/settings', adminOnly: false },
];

export default function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, signOut } = useAuth();

  // Import and use activity tracking for logged-in employees
  const { useActivityTracking } = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      return require('@/lib/useActivityTracking');
    }
    return { useActivityTracking: () => ({}) };
  }, []);

  // Import and use page tracking for logged-in employees
  const { usePageTracking } = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      return require('@/lib/usePageTracking');
    }
    return { usePageTracking: () => ({}) };
  }, []);

  // Track activity for all authenticated users
  useActivityTracking();

  // Track page visits for all authenticated users
  usePageTracking();



  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleProfileMenuClose();
    await signOut();
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 40,
              height: 40,
              fontSize: '1.2rem',
            }}
          >
            D
          </Avatar>
          <Typography variant="h6" noWrap component="div" color="primary">
            DukaaOn Admin
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {menuItems
          .filter((item) => {
            // Show all items to Super Admin
            if (user?.role === 'Super Admin') return true;
            // Hide admin-only items from employees
            if (item.adminOnly && user?.role === 'Employee') return false;
            // Show everything else
            return true;
          })
          .map((item) => {
            const isActive = pathname === item.path;
            return (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  component={Link}
                  href={item.path}
                  selected={isActive}
                  sx={{
                    mx: 1,
                    borderRadius: 1,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'white',
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isActive ? 'white' : 'inherit',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            );
          })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === pathname)?.text || 'Admin Console'}
          </Typography>

          <NotificationBell />
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="profile-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
            sx={{ ml: 1 }}
          >
            <AccountCircle />
          </IconButton>
          <Menu
            id="profile-menu"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem onClick={handleProfileMenuClose}>
              <AccountCircle sx={{ mr: 1 }} />
              Profile
            </MenuItem>
            <MenuItem onClick={handleProfileMenuClose}>
              <Settings sx={{ mr: 1 }} />
              Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ExitToApp sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'grey.50',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}