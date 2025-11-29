'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { UnifiedExtractedProduct as ExtractedProduct } from '@/lib/unifiedOCR';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';
import ExtractedProductEditor from '@/components/ExtractedProductEditor';
import { EditableProduct } from '@/components/ProductCard';

export default function ExtractedProductsPage() {
  const router = useRouter();
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load extracted products from sessionStorage
    const storedProducts = sessionStorage.getItem('extractedProducts');
    if (storedProducts) {
      try {
        const parsed = JSON.parse(storedProducts);
        setExtractedProducts(parsed);
      } catch (error) {
        console.error('Error parsing stored products:', error);
        toast.error('Failed to load extracted products');
        router.push('/products/scan-receipt');
      }
    } else {
      // No products found, redirect back to scan receipt
      toast.error('No extracted products found');
      router.push('/products/scan-receipt');
    }

    // Load sellers
    const loadSellers = async () => {
      try {
        setLoadingSellers(true);
        const sellersData = await adminQueries.getSellersWithDetails();
        if (sellersData && Array.isArray(sellersData)) {
          const validSellers = sellersData.filter(seller => seller && seller.id);
          setSellers(validSellers);
        }
      } catch (error) {
        console.error('Error loading sellers:', error);
        toast.error('Failed to load sellers');
      } finally {
        setLoadingSellers(false);
        setLoading(false);
      }
    };

    loadSellers();
  }, [router]);

  const handleConfirm = async (editedProducts: EditableProduct[]) => {
    try {
      // Get admin and session info for tracking
      const adminSession = localStorage.getItem('admin_session');
      const sessionId = localStorage.getItem('tracking_session_id');
      const admin = adminSession ? JSON.parse(adminSession) : null;

      // Check for duplicates first
      const duplicateChecks = await Promise.all(
        editedProducts.map(async (product) => {
          if (!product.seller_id) return null;
          const response = await fetch('/api/admin/products/check-duplicate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: product.name.trim(),
              seller_id: product.seller_id,
            }),
          });
          if (response.ok) {
            return await response.json();
          }
          return { isDuplicate: false };
        })
      );

      // Filter out duplicates and show warnings
      const productsToAdd: any[] = [];
      const duplicateProducts: any[] = [];

      editedProducts.forEach((product, index) => {
        const duplicateCheck = duplicateChecks[index];
        if (duplicateCheck?.isDuplicate) {
          duplicateProducts.push({
            product,
            reason: duplicateCheck.reason,
          });
        } else {
          productsToAdd.push(product);
        }
      });

      // Show warning for duplicates
      if (duplicateProducts.length > 0) {
        const duplicateNames = duplicateProducts.map(d => d.product.name).join(', ');
        const message = `${duplicateProducts.length} product(s) already exist: ${duplicateNames}\n\nDo you want to add the remaining ${productsToAdd.length} product(s)?`;
        if (!window.confirm(message)) {
          return;
        }
      }

      // Add non-duplicate products with tracking
      const addPromises = productsToAdd.map(async (product) => {
        const productData = {
          name: product.name,
          description: product.description || 'Product extracted from receipt',
          price: product.price,
          category: product.category,
          subcategory: product.subcategory,
          seller_id: product.seller_id,
          stock_available: product.quantity || 0,
          unit: product.unit || 'piece',
          min_order_quantity: product.min_order_quantity || 1,
          images: product.imageUrl ? [product.imageUrl] : [],
          status: 'available',
          // Add tracking info
          admin_id: admin?.id,
          session_id: sessionId,
        };

        return adminQueries.addProduct(productData);
      });

      await Promise.all(addPromises);

      toast.success(`Successfully added ${productsToAdd.length} products to inventory!`);

      // Set flag to refresh stats on products page
      sessionStorage.setItem('productsAdded', 'true');

      // Clear sessionStorage and navigate back to products page
      sessionStorage.removeItem('extractedProducts');
      router.push('/products');
    } catch (error: any) {
      console.error('Error adding extracted products:', error);
      toast.error(error.message || 'Failed to add some products. Please try again.');
      throw error;
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem('extractedProducts');
    router.push('/products/scan-receipt');
  };

  if (loading || loadingSellers) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (extractedProducts.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="info">No extracted products found. Redirecting...</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleCancel}
          sx={{ mb: 2 }}
        >
          Back to Scan Receipt
        </Button>
        <Typography variant="h4" gutterBottom>
          Review & Edit Extracted Products
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Review and edit the extracted products from your receipt before adding them to inventory.
        </Typography>
      </Box>

      <ExtractedProductEditor
        open={true}
        onClose={handleCancel}
        extractedProducts={extractedProducts}
        onConfirm={handleConfirm}
        sellers={sellers}
        categories={[]}
        subcategories={{}}
        fullPage={true}
      />
    </Container>
  );
}

