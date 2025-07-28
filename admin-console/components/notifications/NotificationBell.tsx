'use client';

import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Notifications as BellIcon,
  Close as CloseIcon,
  ShoppingCart,
  Payment,
  Settings,
  Campaign,
} from '@mui/icons-material';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'system' | 'promotion';
  created_at: string;
  read: boolean;
  order_id?: string;
  order_number?: string;
}

interface NotificationBellProps {
  onNotificationReceived?: (callback: (notification: Notification) => void) => void;
}

export default function NotificationBell({ onNotificationReceived }: NotificationBellProps = {}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isOpen = Boolean(anchorEl);

  // Function to add external notifications
  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Show browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico'
      });
    }
  };

  useEffect(() => {
    // Register callback for external notifications
    if (onNotificationReceived) {
      onNotificationReceived(addNotification);
    }

    // Subscribe to new orders from multiple tables
    const orderSubscription = supabase
      .channel('new-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        async (payload) => {
          console.log('New order received:', payload);
          await handleNewOrder(payload.new);
        }
      )
      .subscribe();

    // Subscribe to master orders
    const masterOrderSubscription = supabase
      .channel('new-master-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'master_orders'
        },
        async (payload) => {
          console.log('New master order received:', payload);
          await handleNewMasterOrder(payload.new);
        }
      )
      .subscribe();

    // Subscribe to order batches
    const orderBatchSubscription = supabase
      .channel('new-order-batches')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_batches'
        },
        async (payload) => {
          console.log('New order batch received:', payload);
          await handleNewOrderBatch(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderSubscription);
      supabase.removeChannel(masterOrderSubscription);
      supabase.removeChannel(orderBatchSubscription);
    };
  }, []);

  // Initialize with empty notifications - will be populated by real-time events or test button
  const initializeNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleNewOrder = async (order: any) => {
    try {
      const notification: Notification = {
        id: order.id,
        title: 'New Order Received! 🎉',
        message: `Order #${order.order_number} for ₹${order.total_amount} from Customer`,
        type: 'order',
        created_at: order.created_at,
        read: false,
        order_id: order.id,
        order_number: order.order_number
      };

      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error('Error handling new order:', error);
    }
  };

  const handleNewMasterOrder = async (masterOrder: any) => {
    try {
      const notification: Notification = {
        id: `master-${masterOrder.id}`,
        title: 'New Master Order Created! 📦',
        message: `Master Order #${masterOrder.order_number} for ₹${masterOrder.total_amount}`,
        type: 'order',
        created_at: masterOrder.created_at,
        read: false,
        order_id: masterOrder.id,
        order_number: masterOrder.order_number
      };

      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error('Error handling new master order:', error);
    }
  };

  const handleNewOrderBatch = async (orderBatch: any) => {
    try {
      const notification: Notification = {
        id: `batch-${orderBatch.id}`,
        title: 'New Order Batch Ready! 🚚',
        message: `Order Batch #${orderBatch.batch_number} with ${orderBatch.order_count || 'multiple'} orders`,
        type: 'order',
        created_at: orderBatch.created_at,
        read: false,
        order_id: orderBatch.id,
        order_number: orderBatch.batch_number
      };

      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error('Error handling new order batch:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    markAsRead(notification.id);
    
    // Navigate to order details if it's an order notification
    if (notification.type === 'order' && notification.order_id) {
      router.push(`/orders/${notification.order_id}`);
      handleClose(); // Close the notification menu
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    setUnreadCount(0);
  };

  const clearNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingCart color="primary" />;
      case 'payment':
        return <Payment color="success" />;
      case 'system':
        return <Settings color="action" />;
      case 'promotion':
        return <Campaign color="secondary" />;
      default:
        return <BellIcon color="action" />;
    }
  };

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{ mr: 1 }}
      >
        <Badge badgeContent={unreadCount > 99 ? '99+' : unreadCount} color="error">
          <BellIcon />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
          },
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Notifications</Typography>
            {unreadCount > 0 && (
              <Button size="small" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
          </Box>
        </Box>
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No notifications yet
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {notifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    sx={{
                      bgcolor: notification.read ? 'grey.50' : 'background.paper',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'grey.100',
                      },
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <ListItemIcon>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2">
                            {notification.title}
                          </Typography>
                          {!notification.read && (
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: 'primary.main',
                              }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </Typography>
                        </>
                      }
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearNotification(notification.id);
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Menu>
    </>
  );
}