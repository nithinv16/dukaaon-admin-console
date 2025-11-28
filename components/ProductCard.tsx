import React, { memo, useCallback, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  IconButton,
  CircularProgress,
  Divider,
  TextField,
  Tooltip,
  Button
} from '@mui/material';
import {
  Image,
  CheckCircle,
  Link,
  PhotoLibrary,
  Delete,
  CloudUpload,
  ImageSearch
} from '@mui/icons-material';
import CategorySelector from './CategorySelector';
import DebouncedTextField from './DebouncedTextField';

export interface EditableProduct {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  unit?: string;
  confidence: number;
  category: string;
  subcategory: string;
  brand: string;
  description: string;
  seller_id: string;
  min_order_quantity: number;
  unit_type: string;
  imageUrl?: string;
  imageSearching?: boolean;
  imageScraping?: boolean;
  edited?: boolean;
}

export interface ProductCardProps {
  product: EditableProduct;
  brands: string[];
  onUpdateProduct: (id: string, field: string, value: any) => void;
  onImageSearch: (productId: string) => void;
  onImageUpload: (productId: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (productId: string) => void;
  onManualImageUrl: (productId: string, imageUrl: string) => void;
  onScrapeImage?: (productId: string) => void;
}


/**
 * ProductCard component - Memoized for performance optimization
 * 
 * This component is wrapped with React.memo to prevent unnecessary re-renders
 * when sibling products are updated. It only re-renders when its own props change.
 * 
 * Requirements: 2.2 - Render updates without blocking the main thread
 */
const ProductCard: React.FC<ProductCardProps> = memo(({
  product,
  brands,
  onUpdateProduct,
  onImageSearch,
  onImageUpload,
  onDelete,
  onManualImageUrl,
  onScrapeImage
}) => {
  // Memoized handlers to prevent unnecessary re-renders
  const handleCategoryChange = useCallback((value: { category: string; subcategory: string }) => {
    onUpdateProduct(product.id, 'category', value.category);
    onUpdateProduct(product.id, 'subcategory', value.subcategory);
  }, [product.id, onUpdateProduct]);

  const handleBrandChange = useCallback((_event: any, newValue: string | null) => {
    onUpdateProduct(product.id, 'brand', newValue || '');
  }, [product.id, onUpdateProduct]);

  const handleUnitTypeChange = useCallback((e: any) => {
    onUpdateProduct(product.id, 'unit_type', e.target.value);
  }, [product.id, onUpdateProduct]);

  const handleImageSearchClick = useCallback(() => {
    onImageSearch(product.id);
  }, [product.id, onImageSearch]);

  // Handler for scraping image using Python web scraper
  // Requirements: 5.1, 5.8 - Scrape Image button with loading state
  const handleScrapeImageClick = useCallback(() => {
    if (onScrapeImage) {
      onScrapeImage(product.id);
    }
  }, [product.id, onScrapeImage]);

  const handleDeleteClick = useCallback(() => {
    onDelete(product.id);
  }, [product.id, onDelete]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onImageUpload(product.id, e);
  }, [product.id, onImageUpload]);

  const handleManualImageUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onManualImageUrl(product.id, e.target.value);
  }, [product.id, onManualImageUrl]);

  // Field update handlers using useCallback
  const handleNameChange = useCallback((value: string | number) => {
    onUpdateProduct(product.id, 'name', value);
  }, [product.id, onUpdateProduct]);

  const handlePriceChange = useCallback((value: string | number) => {
    onUpdateProduct(product.id, 'price', value);
  }, [product.id, onUpdateProduct]);

  const handleQuantityChange = useCallback((value: string | number) => {
    onUpdateProduct(product.id, 'quantity', value);
  }, [product.id, onUpdateProduct]);

  const handleMinOrderQuantityChange = useCallback((value: string | number) => {
    onUpdateProduct(product.id, 'min_order_quantity', typeof value === 'number' ? Math.floor(value) : value);
  }, [product.id, onUpdateProduct]);

  const handleDescriptionChange = useCallback((value: string | number) => {
    onUpdateProduct(product.id, 'description', value);
  }, [product.id, onUpdateProduct]);

  return (
    <Card 
      sx={{ 
        height: '100%',
        border: product.edited ? '2px solid' : '1px solid',
        borderColor: product.edited ? 'success.main' : 'divider',
        overflow: 'visible', // Allow buttons to be accessible
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ width: '100%', overflow: 'hidden' }}>
        {/* Product Header */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          mb: 2, 
          gap: 2, 
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
          width: '100%',
          overflow: 'hidden',
        }}>
          {product.imageUrl ? (
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <Avatar 
                src={product.imageUrl} 
                sx={{ 
                  width: 60, 
                  height: 60,
                  border: '2px solid',
                  borderColor: product.imageUrl.startsWith('data:') ? 'success.main' : 'primary.main'
                }}
                variant="rounded"
              />
              {product.imageUrl.startsWith('data:') && (
                <Chip
                  size="small"
                  label="Uploaded"
                  color="success"
                  sx={{ 
                    position: 'absolute', 
                    bottom: -8, 
                    left: '50%', 
                    transform: 'translateX(-50%)',
                    fontSize: '0.6rem',
                    height: 16
                  }}
                />
              )}
            </Box>
          ) : (
            <Avatar 
              sx={{ width: 60, height: 60, flexShrink: 0, bgcolor: 'grey.300' }}
              variant="rounded"
            >
              <Image />
            </Avatar>
          )}
          <Box sx={{ flex: '1 1 auto', minWidth: 0, maxWidth: { xs: '100%', sm: 'calc(100% - 200px)' }, overflow: 'hidden' }}>
            <Typography 
              variant="h6" 
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
              title={product.name}
            >
              {product.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Chip 
                size="small" 
                label={`₹${product.price}`} 
                color="primary" 
              />
              <Chip 
                size="small" 
                label={`${product.quantity || 0} ${product.unit || 'units'}`} 
                variant="outlined" 
              />
              <Chip 
                size="small" 
                label={`${Math.round(product.confidence * 100)}% confidence`} 
                color={product.confidence > 0.8 ? 'success' : 'warning'}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}>
            {/* Scrape Image button - Requirements: 5.1, 5.8 */}
            {onScrapeImage && (
              <Tooltip title="Scrape image from web (uses Python scraper)">
                <IconButton 
                  onClick={handleScrapeImageClick}
                  disabled={product.imageScraping || product.imageSearching}
                  color="success"
                  size="small"
                >
                  {product.imageScraping ? (
                    <CircularProgress size={20} color="success" />
                  ) : (
                    <ImageSearch />
                  )}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Search for product image">
              <IconButton 
                onClick={handleImageSearchClick}
                disabled={product.imageSearching || product.imageScraping}
                color="primary"
                size="small"
              >
                {product.imageSearching ? (
                  <CircularProgress size={20} />
                ) : (
                  <PhotoLibrary />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Upload product image">
              <IconButton 
                component="label"
                color="secondary"
                disabled={product.imageSearching || product.imageScraping}
                size="small"
              >
                <CloudUpload />
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </IconButton>
            </Tooltip>
            <Tooltip title="Remove product">
              <IconButton 
                onClick={handleDeleteClick}
                color="error"
                size="small"
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />


        {/* Editable Fields */}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <DebouncedTextField
              fullWidth
              label="Product Name"
              value={product.name}
              onChange={handleNameChange}
              size="small"
              debounceMs={150}
            />
          </Grid>
          
          <Grid item xs={6}>
            <DebouncedTextField
              fullWidth
              label="Unit Price (₹)"
              type="number"
              value={product.price || ''}
              onChange={handlePriceChange}
              size="small"
              debounceMs={150}
              parseAsNumber
            />
          </Grid>
          
          <Grid item xs={6}>
            <DebouncedTextField
              fullWidth
              label="Quantity"
              type="number"
              value={product.quantity || ''}
              onChange={handleQuantityChange}
              size="small"
              debounceMs={150}
              parseAsNumber
            />
          </Grid>

          <Grid item xs={12}>
            <CategorySelector
              value={{
                category: product.category,
                subcategory: product.subcategory
              }}
              onChange={handleCategoryChange}
              allowNew={true}
              size="small"
            />
          </Grid>

          <Grid item xs={6}>
            <Autocomplete
              fullWidth
              size="small"
              options={brands}
              value={product.brand}
              onChange={handleBrandChange}
              freeSolo
              autoHighlight={false}
              openOnFocus={false}
              filterOptions={(options, params) => {
                const { inputValue } = params;
                const input = inputValue.toLowerCase().trim();
                
                // Don't show suggestions for very short inputs (less than 3 characters)
                // This prevents showing "H", "HU" etc. while typing "HUL"
                if (input.length < 3) {
                  return [];
                }
                
                // Check for exact match first (case-insensitive)
                const exactMatch = options.find((option) => 
                  String(option).toLowerCase() === input
                );
                
                // If exact match found, only show that one
                if (exactMatch) {
                  return [exactMatch];
                }
                
                // Show brands that start with the input (exact prefix match)
                const filtered = options.filter((option) => {
                  const brand = String(option).toLowerCase();
                  return brand.startsWith(input);
                });
                
                // Limit to top 5 suggestions to avoid clutter
                return filtered.slice(0, 5);
              }}
              onInputChange={(event, newInputValue, reason) => {
                // Only update on input, not on selection
                if (reason === 'input' && newInputValue.trim()) {
                  handleBrandChange(event, newInputValue);
                }
              }}
              renderInput={(params) => {
                const brandValue = product.brand?.trim() || '';
                const isNewBrand = brandValue && !brands.some(b => b.toLowerCase() === brandValue.toLowerCase());
                return (
                  <TextField
                    {...params}
                    label="Brand"
                    placeholder="Select or enter brand"
                    helperText={isNewBrand ? "New brand - will be added to list" : undefined}
                  />
                );
              }}
            />
          </Grid>

          <Grid item xs={4}>
            <DebouncedTextField
              fullWidth
              label="Min Order Quantity"
              type="number"
              value={product.min_order_quantity || ''}
              onChange={handleMinOrderQuantityChange}
              size="small"
              debounceMs={150}
              parseAsNumber
            />
          </Grid>

          <Grid item xs={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Unit</InputLabel>
              <Select
                value={product.unit_type}
                onChange={handleUnitTypeChange}
                label="Unit"
              >
                <MenuItem value="pieces">Pieces</MenuItem>
                <MenuItem value="g">g</MenuItem>
                <MenuItem value="kg">kg</MenuItem>
                <MenuItem value="ml">ml</MenuItem>
                <MenuItem value="l">L</MenuItem>
                <MenuItem value="box">Box</MenuItem>
                <MenuItem value="carton">Carton</MenuItem>
                <MenuItem value="pack">Pack</MenuItem>
                <MenuItem value="bottle">Bottle</MenuItem>
                <MenuItem value="can">Can</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <DebouncedTextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={product.description}
              onChange={handleDescriptionChange}
              size="small"
              debounceMs={150}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Product Image URL (Optional)"
              value={product.imageUrl && !product.imageUrl.startsWith('data:') ? product.imageUrl : ''}
              onChange={handleManualImageUrlChange}
              size="small"
              placeholder="https://example.com/product-image.jpg"
              InputProps={{
                startAdornment: <Link sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              helperText={product.imageUrl?.startsWith('data:') 
                ? "Image uploaded successfully. You can also enter a URL to replace it." 
                : "Enter a direct image URL, upload an image using the upload button, or search for one using the gallery button above"
              }
              disabled={product.imageSearching}
            />
          </Grid>
        </Grid>

        {/* Status Indicator */}
        {product.edited && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, color: 'success.main' }}>
            <CheckCircle sx={{ mr: 1, fontSize: 16 }} />
            <Typography variant="caption">
              Product has been edited
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if the product data or brands have changed
  return (
    prevProps.product === nextProps.product &&
    prevProps.brands === nextProps.brands &&
    prevProps.onUpdateProduct === nextProps.onUpdateProduct &&
    prevProps.onImageSearch === nextProps.onImageSearch &&
    prevProps.onImageUpload === nextProps.onImageUpload &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onManualImageUrl === nextProps.onManualImageUrl &&
    prevProps.onScrapeImage === nextProps.onScrapeImage
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
