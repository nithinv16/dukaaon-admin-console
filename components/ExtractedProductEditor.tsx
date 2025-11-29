import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Save,
  Cancel
} from '@mui/icons-material';
import { List } from 'react-window';
import { UnifiedExtractedProduct as ExtractedProduct } from '../lib/unifiedOCR';
import { toast } from 'react-hot-toast';
import { getSupabaseClient } from '../lib/supabase-browser';
import ProductCard, { EditableProduct } from './ProductCard';

// EditableProduct interface is now imported from ProductCard

interface ExtractedProductEditorProps {
  open: boolean;
  onClose: () => void;
  extractedProducts: ExtractedProduct[];
  onConfirm: (products: EditableProduct[]) => void;
  sellers: any[];
  categories?: string[]; // Deprecated - kept for backward compatibility
  subcategories?: { [key: string]: string[] }; // Deprecated - kept for backward compatibility
  fullPage?: boolean; // If true, render without Dialog wrapper for full page use
}

// Constants for virtualization
// Each product card row contains 2 cards (md:6 grid) with estimated height
const PRODUCT_ROW_HEIGHT = 580; // Height of a row containing product cards
const VIRTUALIZATION_THRESHOLD = 6; // Only virtualize when more than this many products

const ExtractedProductEditor: React.FC<ExtractedProductEditorProps> = ({
  open,
  onClose,
  extractedProducts,
  onConfirm,
  sellers,
  fullPage = false
}) => {
  const [editableProducts, setEditableProducts] = useState<EditableProduct[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Ref to track current editable products for non-blocking image search
  // This allows handleImageSearch to access current state without stale closures
  // Requirements: 2.5 - Don't block text input during image search
  const editableProductsRef = useRef<EditableProduct[]>([]);

  // Keep ref in sync with state for non-blocking image search access
  // Requirements: 2.5 - Separate loading state per product, don't block text input
  useEffect(() => {
    editableProductsRef.current = editableProducts;
  }, [editableProducts]);

  // Track container dimensions for virtualization
  useEffect(() => {
    if (!open || !containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
        // Calculate available height (dialog content minus seller card and padding)
        const dialogContent = containerRef.current.closest('.MuiDialogContent-root');
        if (dialogContent) {
          const sellerCard = dialogContent.querySelector('.seller-selection-card');
          const sellerCardHeight = sellerCard ? sellerCard.getBoundingClientRect().height + 24 : 150;
          const availableHeight = dialogContent.clientHeight - sellerCardHeight - 48;
          setContainerHeight(Math.max(availableHeight, 400));
        }
      }
    };

    // Initial measurement after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(updateDimensions, 100);
    
    // Set up resize observer
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [open]);

  // Fetch brands from both products and master_products tables
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          console.error('Supabase client not available');
          // Fallback brands (common Indian FMCG brands)
          setBrands(['HUL', 'ITC', 'Nestle', 'Britannia', 'Parle', 'Dabur', 'Colgate', 'P&G', 'Amul', 'Marico']);
          return;
        }
        
        // Common/prefilled brands (popular Indian FMCG brands)
        const prefilledBrands = [
          // Major FMCG Companies
          'HUL', 'Hindustan Unilever', 'Unilever',
          'ITC',
          'Nestle', 'Nestlé', 'Nestlé India',
          'Britannia',
          'Parle',
          'Dabur',
          'Colgate', 'Colgate-Palmolive',
          'P&G', 'Procter & Gamble',
          'Amul',
          'Marico',
          'Godrej',
          'Tata',
          'Coca-Cola',
          'Pepsi',
          'Cadbury',
          'Mondelez',
          // Popular Indian Brands
          'Red Label', 'Taj Mahal', 'Brooke Bond',
          'Maggi', 'KitKat', 'Nescafe',
          'Sunfeast', 'Yippee', 'Bingo',
          'Lay\'s', 'Kurkure', 'Cheetos',
          'Thums Up', 'Sprite', 'Fanta', 'Limca',
          'Horlicks', 'Boost', 'Complan',
          'Oreo', 'Parle-G', 'Monaco', 'Krackjack',
          'Bournvita', 'Lactogen',
          'Dettol', 'Savlon', 'Harpic', 'Lizol',
          'Pepsodent', 'Sensodyne', 'Close-Up',
          'Ariel', 'Surf Excel', 'Tide', 'Rin',
          'Fair & Lovely', 'Ponds', 'Lakme',
          'Vim', 'Lux', 'Dove', 'Lifebuoy',
          'Himalaya', 'Dabur Real', 'Tropicana',
          'Mother Dairy', 'Kwality',
          'Dairy Milk', 'Perk', '5 Star', 'Gems',
          'Haldiram\'s',
        ];
        
        const allBrands = new Set<string>();
        
        // Add prefilled brands
        prefilledBrands.forEach(brand => {
          if (brand) allBrands.add(brand.trim());
        });
        
        // Fetch unique brands from products table
        try {
          const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('brand')
            .not('brand', 'is', null)
            .neq('brand', '')
            .order('brand', { ascending: true });
          
          if (!productsError && productsData) {
            productsData.forEach((item: any) => {
              if (item.brand && typeof item.brand === 'string' && item.brand.trim()) {
                // Normalize brand name: trim and capitalize first letter
                const normalizedBrand = item.brand.trim();
                allBrands.add(normalizedBrand);
              }
            });
          } else if (productsError) {
            console.warn('Error fetching brands from products table:', productsError);
          }
        } catch (error) {
          console.warn('Error fetching brands from products table:', error);
        }
        
        // Fetch unique brands from master_products table
        try {
          const { data: masterProductsData, error: masterProductsError } = await supabase
            .from('master_products')
            .select('brand')
            .not('brand', 'is', null)
            .neq('brand', '')
            .order('brand', { ascending: true });
        
          if (!masterProductsError && masterProductsData) {
            masterProductsData.forEach((item: any) => {
              if (item.brand && typeof item.brand === 'string' && item.brand.trim()) {
                // Normalize brand name: trim
                const normalizedBrand = item.brand.trim();
                allBrands.add(normalizedBrand);
              }
            });
          } else if (masterProductsError) {
            console.warn('Error fetching brands from master_products table:', masterProductsError);
          }
        } catch (error) {
          console.warn('Error fetching brands from master_products table:', error);
        }
        
        // Convert to sorted array (case-insensitive sort, but preserve original case)
        const uniqueBrands = Array.from(allBrands)
          .filter(Boolean)
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        
        console.log('Fetched unique brands:', uniqueBrands.length, uniqueBrands.slice(0, 10));
        
        if (uniqueBrands.length > 0) {
          setBrands(uniqueBrands);
        } else {
        // If no brands found in database, use fallback brands
          setBrands(prefilledBrands);
        }
      } catch (error) {
        console.error('Error fetching brands:', error);
        // Set fallback brands if there's an exception
        setBrands(['HUL', 'ITC', 'Nestle', 'Britannia', 'Parle', 'Dabur', 'Colgate', 'P&G', 'Amul', 'Marico']);
      }
    };

    if (open) {
      fetchBrands();
    }
  }, [open]);

  // Initialize editable products when dialog opens
  useEffect(() => {
    if (open && extractedProducts.length > 0) {
      const products = extractedProducts.map((product, index) => ({
        ...product,
        id: `extracted_${index}`,
        category: '',
        subcategory: '',
        brand: '',
        description: `Product extracted from receipt: ${product.name}`,
        seller_id: '',
        min_order_quantity: 1,
        unit_type: 'pieces',
        edited: false
      }));
      setEditableProducts(products);
    }
  }, [open, extractedProducts]);

  const updateProduct = useCallback((id: string, field: string, value: any) => {
    setEditableProducts(prev => prev.map(product => 
      product.id === id 
        ? { ...product, [field]: value, edited: true }
        : product
    ));

    // If updating brand field, check if it's a new brand and add it to the brands list
    if (field === 'brand' && value && typeof value === 'string' && value.trim()) {
      const brandName = value.trim();
      setBrands(prev => {
        // Check if brand already exists (case-insensitive)
        const exists = prev.some(b => b.toLowerCase() === brandName.toLowerCase());
        if (!exists) {
          // Add new brand to list and sort
          const updatedBrands = [...prev, brandName].sort();
          return updatedBrands;
        }
        return prev;
      });
    }
  }, []);

  // Search for product image using API route
  const searchForProductImage = async (productName: string) => {
    try {
      // Call existing API route for image search (server-side only)
      const response = await fetch('/api/admin/scrape-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName }),
      });

      if (!response.ok) {
        throw new Error('Image search failed');
      }

      const data = await response.json();
      return data.imageUrl || 'https://via.placeholder.com/400x400/cccccc/666666?text=No+Image';
    } catch (error) {
      console.error('Error searching for image:', error);
      return 'https://via.placeholder.com/400x400/cccccc/666666?text=No+Image';
    }
  };

  /**
   * Handle image search for a product - runs in background without blocking UI
   * Requirements: 2.5 - Image search runs in background, doesn't block text input
   * 
   * Uses a ref to access current product state to avoid stale closures,
   * and runs the search asynchronously without awaiting in the main flow.
   */
  const handleImageSearch = useCallback((productId: string) => {
    // Get product name from current state using a ref-like pattern
    // This avoids the problematic setState-to-read pattern
    const product = editableProductsRef.current.find(p => p.id === productId);
    if (!product) {
      toast.error('Product not found');
      return;
    }

    const productName = product.name;
    if (!productName) {
      toast.error('Product name is required for image search');
      return;
    }

    // Set loading state immediately (synchronous, non-blocking)
    setEditableProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, imageSearching: true } : p
    ));
    
    // Run search in background - fire and forget pattern
    // This ensures the search doesn't block any UI interactions
    const runBackgroundSearch = async () => {
      try {
        const imageUrl = await searchForProductImage(productName);
        
        // Update state with result - only affects this specific product
        setEditableProducts(prev => prev.map(p => 
          p.id === productId 
            ? { ...p, imageUrl, imageSearching: false, edited: true }
            : p
        ));
        
        toast.success('Image found successfully!');
      } catch (error) {
        console.error('Error searching for image:', error);
        setEditableProducts(prev => prev.map(p => 
          p.id === productId ? { ...p, imageSearching: false } : p
        ));
        toast.error('Failed to find image');
      }
    };

    // Execute without awaiting - truly non-blocking
    runBackgroundSearch();
  }, []);

  const handleManualImageUrl = useCallback((productId: string, imageUrl: string) => {
    if (imageUrl.trim()) {
      setEditableProducts(prev => prev.map(product => 
        product.id === productId 
          ? { 
              ...product, 
              imageUrl: imageUrl.trim(), 
              edited: true 
            }
          : product
      ));
      toast.success('Image URL updated!');
    }
  }, []);

  const handleImageUpload = useCallback((productId: string, file: File) => {
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }

      // Create a data URL for the image
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setEditableProducts(prev => prev.map(product => 
          product.id === productId 
            ? { 
                ...product, 
                imageUrl, 
                edited: true 
              }
            : product
        ));
        toast.success('Image uploaded successfully!');
      };
      
      reader.onerror = () => {
        toast.error('Failed to read image file');
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }
  }, []);

  const handleFileInputChange = useCallback((productId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(productId, file);
    }
    // Reset the input value to allow selecting the same file again
    event.target.value = '';
  }, [handleImageUpload]);

  const handleDeleteProduct = useCallback((productId: string) => {
    setEditableProducts(prev => prev.filter(p => p.id !== productId));
    toast.success('Product removed from list');
  }, []);

  const handleConfirm = async () => {
    // Validate required fields
    const invalidProducts = editableProducts.filter(product => 
      !product.category
    );

    if (invalidProducts.length > 0) {
      toast.error('Please fill in category for all products');
      return;
    }

    if (!selectedSeller) {
      toast.error('Please select a seller for all products');
      return;
    }

    setLoading(true);
    try {
      // Apply selected seller to all products
      const productsWithSeller = editableProducts.map(product => ({
        ...product,
        seller_id: selectedSeller
      }));
      
      await onConfirm(productsWithSeller);
      onClose();
    } catch (error) {
      console.error('Error confirming products:', error);
      toast.error('Failed to add products to inventory');
    } finally {
      setLoading(false);
    }
  };

  // Row props for virtualized list - contains all data needed by row component
  // Note: index, style, and ariaAttributes are automatically provided by List component
  interface VirtualizedRowProps {
    products: EditableProduct[];
    rowBrands: string[];
    rowUpdateProduct: (id: string, field: string, value: any) => void;
    rowImageSearch: (productId: string) => void;
    rowImageUpload: (productId: string, event: React.ChangeEvent<HTMLInputElement>) => void;
    rowDelete: (productId: string) => void;
    rowManualImageUrl: (productId: string, imageUrl: string) => void;
  }

  // Virtualized row renderer - renders 2 products per row (matching md:6 grid)
  const VirtualizedRow = useCallback((props: { 
    index: number; 
    style: React.CSSProperties;
    ariaAttributes: {
      'aria-posinset': number;
      'aria-setsize': number;
      role: 'listitem';
    };
  } & VirtualizedRowProps) => {
    const { 
      index, 
      style,
      products,
      rowBrands,
      rowUpdateProduct,
      rowImageSearch,
      rowImageUpload,
      rowDelete,
      rowManualImageUrl
    } = props;
    
    const startIndex = index * 2;
    const product1 = products[startIndex];
    const product2 = products[startIndex + 1];

    return (
      <div style={{ ...style, paddingRight: 8 }}>
        <Grid container spacing={3}>
          {product1 && (
            <Grid item xs={12} md={6}>
              <ProductCard
                product={product1}
                brands={rowBrands}
                onUpdateProduct={rowUpdateProduct}
                onImageSearch={rowImageSearch}
                onImageUpload={rowImageUpload}
                onDelete={rowDelete}
                onManualImageUrl={rowManualImageUrl}
              />
            </Grid>
          )}
          {product2 && (
            <Grid item xs={12} md={6}>
              <ProductCard
                product={product2}
                brands={rowBrands}
                onUpdateProduct={rowUpdateProduct}
                onImageSearch={rowImageSearch}
                onImageUpload={rowImageUpload}
                onDelete={rowDelete}
                onManualImageUrl={rowManualImageUrl}
              />
            </Grid>
          )}
        </Grid>
      </div>
    );
  }, []);

  // Calculate number of rows for virtualization (2 products per row)
  const rowCount = Math.ceil(editableProducts.length / 2);
  const shouldVirtualize = editableProducts.length > VIRTUALIZATION_THRESHOLD;

  const content = (
    <>
      {!fullPage && (
        <DialogTitle>
          <Typography variant="h5" component="div">
            Edit Extracted Products ({editableProducts.length})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review and edit the extracted product details before adding to inventory
          </Typography>
        </DialogTitle>
      )}
      
      <Box sx={fullPage ? { width: '100%' } : {}}>
        {/* Global Seller Selection */}
        <Card className="seller-selection-card" sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent sx={{ pb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Seller Selection
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select a seller for all products in this batch
            </Typography>
            <FormControl fullWidth size="medium">
              <InputLabel id="extracted-product-seller-select-label">Select Seller for All Products *</InputLabel>
              <Select
                labelId="extracted-product-seller-select-label"
                value={selectedSeller}
                onChange={(e) => {
                  console.log('Seller selected in ExtractedProductEditor:', e.target.value);
                  setSelectedSeller(e.target.value);
                }}
                label="Select Seller for All Products *"
                required
                sx={{ minHeight: 56 }}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
              >
                {sellers.length === 0 ? (
                  <MenuItem disabled>No sellers available</MenuItem>
                ) : (
                  sellers.map((seller) => (
                    <MenuItem 
                      key={seller.id} 
                      value={seller.id}
                      sx={{ 
                        minHeight: 48,
                        whiteSpace: 'normal',
                        wordWrap: 'break-word'
                      }}
                    >
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {seller.display_name || seller.business_info?.business_name || seller.business_name || seller.phone_number || 'Unknown Seller'}
                        </Typography>
                        {(seller.business_info?.owner_name || seller.owner_name) && (
                          <Typography variant="body2" color="text.secondary">
                            {seller.business_info?.owner_name || seller.owner_name}
                          </Typography>
                        )}
                        {seller.phone_number && (
                          <Typography variant="body2" color="text.secondary">
                            {seller.phone_number}
                          </Typography>
                        )}
                      </Box>
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        {/* Product Cards - Using virtualization for large lists, regular grid for small lists */}
        <div ref={containerRef} style={{ width: '100%' }}>
          {editableProducts.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No products extracted from receipt. Please try scanning again with a clearer image.
            </Alert>
          ) : shouldVirtualize ? (
            /* Virtualized list for large product lists - Requirements: 2.4 */
            <List
              style={{ height: containerHeight, width: containerWidth || '100%' }}
              rowCount={rowCount}
              rowHeight={PRODUCT_ROW_HEIGHT}
              overscanCount={2}
              rowComponent={VirtualizedRow}
              rowProps={{
                products: editableProducts,
                rowBrands: brands,
                rowUpdateProduct: updateProduct,
                rowImageSearch: handleImageSearch,
                rowImageUpload: handleFileInputChange,
                rowDelete: handleDeleteProduct,
                rowManualImageUrl: handleManualImageUrl
              }}
            />
          ) : (
            /* Regular grid for small product lists */
            <Grid container spacing={3}>
              {editableProducts.map((product) => (
                <Grid item xs={12} md={6} key={product.id}>
                  <ProductCard
                    product={product}
                    brands={brands}
                    onUpdateProduct={updateProduct}
                    onImageSearch={handleImageSearch}
                    onImageUpload={handleFileInputChange}
                    onDelete={handleDeleteProduct}
                    onManualImageUrl={handleManualImageUrl}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </div>
      </Box>
      
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', p: fullPage ? 0 : 3, mt: fullPage ? 3 : 0 }}>
        <Button 
          onClick={onClose} 
          startIcon={<Cancel />}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          startIcon={loading ? <CircularProgress size={16} /> : <Save />}
          disabled={loading || editableProducts.length === 0}
        >
          {loading ? 'Adding Products...' : `Add ${editableProducts.length} Products to Inventory`}
        </Button>
      </Box>
    </>
  );

  if (fullPage) {
    return <Box>{content}</Box>;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      {content}
    </Dialog>
  );
};

export default ExtractedProductEditor;