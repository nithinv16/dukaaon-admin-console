'use client';

import React from 'react';
import { Button, Snackbar, Alert } from '@mui/material';
import { Notifications as BellIcon } from '@mui/icons-material';

interface TestNotificationButtonProps {
  onTestNotification?: (notification: any) => void;
}

export default function TestNotificationButton({ onTestNotification }: TestNotificationButtonProps) {
  const [showSuccess, setShowSuccess] = React.useState(false);

  const handleTestNotification = () => {
    const testNotification = {
      id: `test-${Date.now()}`,
      title: 'Test Order Notification! 🎉',
      message: `Test order #ORD${Date.now()} for ₹${Math.floor(Math.random() * 5000) + 500} from Test Customer`,
      type: 'order',
      created_at: new Date().toISOString(),
      read: false,
      order_id: `test-order-${Date.now()}`,
      order_number: `ORD${Date.now()}`
    };

    if (onTestNotification) {
      onTestNotification(testNotification);
    }

    setShowSuccess(true);
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<BellIcon />}
        onClick={handleTestNotification}
        sx={{ mr: 2 }}
      >
        Test Notification
      </Button>
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          Test notification sent! Check the notification bell.
        </Alert>
      </Snackbar>
    </>
  );
}