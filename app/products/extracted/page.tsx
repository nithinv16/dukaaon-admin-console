'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Container,
  Paper,
  Button,
  Alert,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { ArrowBack } from '@mui/icons-material';
import ReceiptProductEditorV2 from '@/components/ReceiptProductEditorV2';
import ReceiptProductEditor from '@/components/ReceiptProductEditor';
import { ExtractedProductV2 } from '@/lib/receiptExtractionV2';
import { ExtractedReceiptProduct, ScanReceiptResponse } from '@/lib/receiptTypes';
import { adminQueries } from '@/lib/supabase-browser';
import toast from 'react-hot-toast';

type ProductType = 'v2' | 'old';

export default function ExtractedProductsPage() {
  const router = useRouter();
  const [productsV2, setProductsV2] = useState<ExtractedProductV2[]>([]);
  const [productsOld, setProductsOld] = useState<ExtractedReceiptProduct[]>([]);
  const [productType, setProductType] = useState<ProductType>('v2');
  const [receiptMetadata, setReceiptMetadata] = useState<any>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string>('');

  useEffect(() => {
    // Load extracted products from sessionStorage
    const storedProducts = sessionStorage.getItem('extractedProducts');
    const storedReceiptResult = sessionStorage.getItem('extractedReceiptResult');

    const loadAndValidateProducts = async () => {
      if (storedProducts) {
        try {
          const parsed = JSON.parse(storedProducts);
          // Check if it's V2 format (has unit field) or old format
          if (parsed.length > 0 && 'unit' in parsed[0]) {
            // V2 format - validate categories client-side
            const { validateAndCorrectCategories } = await import('@/lib/categoryMapping');
            console.log('🔍 Validating categories for extracted products...');
            const validatedProducts = await validateAndCorrectCategories<ExtractedProductV2>(parsed as ExtractedProductV2[]);
            setProductsV2(validatedProducts);
            setProductType('v2');
          } else {
            setProductsOld(parsed);
            setProductType('old');
          }
        } catch (error) {
          console.error('Error parsing stored products:', error);
          toast.error('Failed to load extracted products');
          router.push('/products');
        }
      } else if (storedReceiptResult) {
        try {
          const result: ScanReceiptResponse = JSON.parse(storedReceiptResult);
          if (result.products && result.products.length > 0) {
            setProductsOld(result.products);
            setReceiptMetadata(result.metadata);
            setProductType('old');
          } else {
            toast.error('No products found in receipt');
            router.push('/products');
          }
        } catch (error) {
          console.error('Error parsing stored receipt result:', error);
          toast.error('Failed to load extracted products');
          router.push('/products');
        }
      } else {
        // No products found, redirect back
        toast.error('No extracted products found');
        router.push('/products');
      }
    };

    loadAndValidateProducts();

    // Load sellers
    const loadSellers = async () => {
      try {
        setLoadingSellers(true);
        const sellersData = await adminQueries.getSellersWithDetails();
        setSellers(sellersData || []);
      } catch (error) {
        console.error('Error loading sellers:', error);
        toast.error('Failed to load sellers');
      } finally {
        setLoadingSellers(false);
      }
    };

    loadSellers();
  }, [router]);

  const handleConfirmV2 = async (editedProducts: ExtractedProductV2[]) => {
    try {
      if (!selectedSellerId) {
        toast.error('Please select a seller first');
        return;
      }

      // Check for duplicates first
      const duplicateChecks = await Promise.all(
        editedProducts.map(async (product) => {
          const response = await fetch('/api/admin/products/check-duplicate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: product.name.trim(),
              seller_id: selectedSellerId,
            }),
          });
          if (response.ok) {
            return await response.json();
          }
          return { isDuplicate: false };
        })
      );

      // Filter out duplicates
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

      // Add non-duplicate products
      const addPromises = productsToAdd.map(async (product) => {
        const productData = {
          name: product.name,
          description: product.description || product.name || 'Product extracted from receipt',
          price: product.unitPrice || (product.netAmount / product.quantity) || 0,
          category: product.category || category || '',
          subcategory: product.subcategory || subcategory || '',
          seller_id: selectedSellerId,
          stock_available: product.stockAvailable ?? 100, // Use stock field with default 100
          unit: product.unit || 'piece',
          min_order_quantity: product.minOrderQuantity || 1,
          images: product.imageUrl ? [product.imageUrl] : [],
          status: 'available'
        };

        return adminQueries.addProduct(productData);
      });

      await Promise.all(addPromises);

      toast.success(`Successfully added ${productsToAdd.length} products to inventory!`);

      // 🧠 AI LEARNING: Capture corrections for feedback loop
      try {
        const { captureProductCorrections } = await import('@/lib/feedbackLearning');

        // Convert ExtractedProductV2 to ExtractedProduct format
        const originalProducts = productsV2.map(p => ({
          name: p.name,
          description: p.description,
          category: p.category,
          subcategory: p.subcategory,
          quantity: p.quantity,
          unit: p.unit,
          unitPrice: p.unitPrice,
          confidence: p.confidence,
        }));

        const submittedProductsForLearning = editedProducts.map(p => ({
          name: p.name,
          description: p.description || p.name,
          category: p.category || category,
          subcategory: p.subcategory || subcategory,
          quantity: p.quantity,
          unit: p.unit,
          unitPrice: p.unitPrice,
        }));

        const result = await captureProductCorrections(
          originalProducts,
          submittedProductsForLearning,
          {
            receiptId: `receipt_${Date.now()}`,
            sellerId: selectedSellerId,
          }
        );

        if (result.success && result.capturedCount > 0) {
          console.log(`✅ AI Learning: Captured ${result.capturedCount} corrections`);
        }
      } catch (learningError) {
        // Don't fail the main flow if learning fails
        console.error('⚠️ Failed to capture corrections for AI learning:', learningError);
      }

      // Set flag to indicate products were added
      sessionStorage.setItem('productsAdded', 'true');

      // Clear sessionStorage and navigate back
      sessionStorage.removeItem('extractedProducts');
      router.push('/products');
    } catch (error: any) {
      console.error('Error adding extracted products:', error);
      toast.error(error.message || 'Failed to add some products. Please try again.');
    }
  };

  const handleConfirmOld = async (editedProducts: ExtractedReceiptProduct[]) => {
    try {
      if (!selectedSellerId) {
        toast.error('Please select a seller first');
        return;
      }

      // Check for duplicates first
      const duplicateChecks = await Promise.all(
        editedProducts.map(async (product) => {
          const response = await fetch('/api/admin/products/check-duplicate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: product.name.trim(),
              seller_id: selectedSellerId,
            }),
          });
          if (response.ok) {
            return await response.json();
          }
          return { isDuplicate: false };
        })
      );

      // Filter out duplicates
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

      // Add non-duplicate products
      const addPromises = productsToAdd.map(async (product) => {
        const productData = {
          name: product.name,
          description: product.name || 'Product extracted from receipt',
          price: product.unitPrice || (product.netAmount / product.quantity) || 0,
          category: category || '',
          subcategory: subcategory || '',
          seller_id: selectedSellerId,
          stock_available: product.quantity || 0,
          unit: 'piece',
          min_order_quantity: 1,
          images: [],
          status: 'available'
        };

        return adminQueries.addProduct(productData);
      });

      await Promise.all(addPromises);

      toast.success(`Successfully added ${productsToAdd.length} products to inventory!`);

      // Set flag to indicate products were added
      sessionStorage.setItem('productsAdded', 'true');

      // Clear sessionStorage and navigate back
      sessionStorage.removeItem('extractedProducts');
      sessionStorage.removeItem('extractedReceiptResult');
      router.push('/products');
    } catch (error: any) {
      console.error('Error adding extracted products:', error);
      toast.error(error.message || 'Failed to add some products. Please try again.');
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem('extractedProducts');
    sessionStorage.removeItem('extractedReceiptResult');
    router.push('/products');
  };

  const hasProducts = (productType === 'v2' && productsV2.length > 0) || (productType === 'old' && productsOld.length > 0);

  if (!hasProducts) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="info">Loading extracted products...</Alert>
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
          Back to Products
        </Button>
        <Typography variant="h4" gutterBottom>
          Review & Edit Extracted Products
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Review the extracted products from your receipt and make any necessary corrections before adding them to inventory.
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Select Seller *</InputLabel>
          <Select
            value={selectedSellerId}
            onChange={(e) => setSelectedSellerId(e.target.value)}
            label="Select Seller"
            disabled={loadingSellers}
          >
            {sellers.map((seller) => (
              <MenuItem key={seller.id} value={seller.id}>
                {seller.business_name || seller.display_name || seller.phone_number || `Seller ${seller.id}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {productType === 'v2' ? (
        <ReceiptProductEditorV2
          products={productsV2}
          onConfirm={handleConfirmV2}
          onCancel={handleCancel}
          showTitle={false}
        />
      ) : (
        <ReceiptProductEditor
          products={productsOld}
          onConfirm={handleConfirmOld}
          onCancel={handleCancel}
          showTitle={false}
        />
      )}
    </Container>
  );
}

