'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
} from '@mui/material';
import {
  Payment,
  CreditCard,
  Add,
} from '@mui/icons-material';

export default function PaymentsPage() {
  const [stats] = useState({
    totalTransactions: 1250,
    successfulTransactions: 1180,
    failedTransactions: 70,
    totalAmount: 2500000,
  });

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Payment Management
        </Typography>
        <Button variant="contained" startIcon={<Add />}>
          Add Payment Method
        </Button>
      </Box>

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Transactions
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalTransactions.toLocaleString()}
                  </Typography>
                </Box>
                <Payment color="primary" sx={{ fontSize: 40 }} />
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
                    Successful
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats.successfulTransactions.toLocaleString()}
                  </Typography>
                </Box>
                <CreditCard color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Payment Methods
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Payment configuration and management features will be available here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}