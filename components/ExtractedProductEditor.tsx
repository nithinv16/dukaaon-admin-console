import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
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
  Alert,
  Divider
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  Search,
  Image,
  CheckCircle,
  ErrorOutline,
  Link,
  PhotoLibrary,
  Delete,
  Upload,
  CloudUpload
} from '@mui/icons-material';
import { ExtractedProduct } from '../lib/azureOCR';
import { searchProductImage } from '../lib/imageSearcher';
import { toast } from 'react-hot-toast';

interface EditableProduct extends ExtractedProduct {
  id: string;
  category: string;
  subcategory: string;
  description: string;
  seller_id: string;
  min_order_quantity: number;
  imageUrl?: string;
  imageSearching?: boolean;
  edited?: boolean;
}

interface ExtractedProductEditorProps {
  open: boolean;
  onClose: () => void;
  extractedProducts: ExtractedProduct[];
  onConfirm: (products: EditableProduct[]) => void;
  sellers: any[];
  categories: string[];
  subcategories: { [key: string]: string[] };
}

const ExtractedProductEditor: React.FC<ExtractedProductEditorProps> = ({
  open,
  onClose,
  extractedProducts,
  onConfirm,
  sellers,
  categories,
  subcategories
}) => {
  const [editableProducts, setEditableProducts] = useState<EditableProduct[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Initialize editable products when dialog opens
  useEffect(() => {
    if (open && extractedProducts.length > 0) {
      const products = extractedProducts.map((product, index) => ({
        ...product,
        id: `extracted_${index}`,
        category: '',
        subcategory: '',
        description: `Product extracted from receipt: ${product.name}`,
        seller_id: '',
        min_order_quantity: 1,
        edited: false
      }));
      setEditableProducts(products);
    }
  }, [open, extractedProducts]);

  const updateProduct = (id: string, field: string, value: any) => {
    setEditableProducts(prev => prev.map(product => 
      product.id === id 
        ? { ...product, [field]: value, edited: true }
        : product
    ));
  };

  // Search for product image using the image searcher
  const searchForProductImage = async (productName: string) => {
    try {
      const imageUrl = await searchProductImage(productName);
      return imageUrl;
    } catch (error) {
      console.error('Error searching for image:', error);
      return 'https://via.placeholder.com/400x400/cccccc/666666?text=No+Image';
    }
  };

  const handleImageSearch = async (productId: string) => {
    setEditableProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, imageSearching: true } : p
    ));
    
    try {
      const product = editableProducts.find(p => p.id === productId);
      if (product) {
        const imageUrl = await searchForProductImage(product.name);
        
        setEditableProducts(prev => prev.map(p => 
          p.id === productId 
            ? { ...p, imageUrl, imageSearching: false, edited: true }
            : p
        ));
        
        toast.success('Image found successfully!');
      }
    } catch (error) {
      console.error('Error searching for image:', error);
      setEditableProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, imageSearching: false } : p
      ));
      toast.error('Failed to find image');
    }
  };

  const handleManualImageUrl = (productId: string, imageUrl: string) => {
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
  };

  const handleImageUpload = async (productId: string, file: File) => {
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
  };

  const handleFileInputChange = (productId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(productId, file);
    }
    // Reset the input value to allow selecting the same file again
    event.target.value = '';
  };

  const handleDeleteProduct = (productId: string) => {
    setEditableProducts(prev => prev.filter(p => p.id !== productId));
    toast.success('Product removed from list');
  };

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

  const getAvailableSubcategories = (category: string) => {
    return subcategories[category] || [];
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Typography variant="h5" component="div">
          Edit Extracted Products ({editableProducts.length})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review and edit the extracted product details before adding to inventory
        </Typography>
      </DialogTitle>
      
      <DialogContent dividers>
        {/* Global Seller Selection */}
        <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent sx={{ pb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Seller Selection
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select a seller for all products in this batch
            </Typography>
            <FormControl fullWidth size="medium">
              <InputLabel>Select Seller for All Products *</InputLabel>
              <Select
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
                label="Select Seller for All Products *"
                required
                sx={{ minHeight: 56 }}
              >
                {sellers.map((seller) => (
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
                        {seller.business_info?.business_name || seller.display_name || seller.phone_number || 'Unknown Seller'}
                      </Typography>
                      {seller.business_info?.owner_name && (
                        <Typography variant="body2" color="text.secondary">
                          {seller.business_info.owner_name}
                        </Typography>
                      )}
                      {seller.phone_number && (
                        <Typography variant="body2" color="text.secondary">
                          {seller.phone_number}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        {/* Product Cards */}
        <Grid container spacing={3}>
          {editableProducts.map((product) => (
            <Grid item xs={12} md={6} key={product.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  border: product.edited ? '2px solid' : '1px solid',
                  borderColor: product.edited ? 'success.main' : 'divider'
                }}
              >
                <CardContent>
                  {/* Product Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {product.imageUrl ? (
                      <Box sx={{ position: 'relative', mr: 2 }}>
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
                        sx={{ width: 60, height: 60, mr: 2, bgcolor: 'grey.300' }}
                        variant="rounded"
                      >
                        <Image />
                      </Avatar>
                    )}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" noWrap>
                        {product.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip 
                          size="small" 
                          label={`₹${product.price}`} 
                          color="primary" 
                        />
                        <Chip 
                          size="small" 
                          label={`${product.quantity} ${product.unit}`} 
                          variant="outlined" 
                        />
                        <Chip 
                          size="small" 
                          label={`${Math.round(product.confidence * 100)}% confidence`} 
                          color={product.confidence > 0.8 ? 'success' : 'warning'}
                        />
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton 
                        onClick={() => handleImageSearch(product.id)}
                        disabled={product.imageSearching}
                        color="primary"
                        title="Search for product image"
                      >
                        {product.imageSearching ? (
                          <CircularProgress size={20} />
                        ) : (
                          <PhotoLibrary />
                        )}
                      </IconButton>
                      <IconButton 
                        component="label"
                        color="secondary"
                        title="Upload product image"
                      >
                        <CloudUpload />
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={(e) => handleFileInputChange(product.id, e)}
                        />
                      </IconButton>
                      <IconButton 
                        onClick={() => handleDeleteProduct(product.id)}
                        color="error"
                        title="Remove product"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  {/* Editable Fields */}
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Product Name"
                        value={product.name}
                        onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                        size="small"
                      />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        label="Unit Price (₹)"
                        type="number"
                        value={product.price}
                        onChange={(e) => updateProduct(product.id, 'price', parseFloat(e.target.value) || 0)}
                        size="small"
                      />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        label="Quantity"
                        type="number"
                        value={product.quantity}
                        onChange={(e) => updateProduct(product.id, 'quantity', parseFloat(e.target.value) || 0)}
                        size="small"
                      />
                    </Grid>

                    <Grid item xs={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Category</InputLabel>
                        <Select
                          value={product.category}
                          onChange={(e) => {
                            updateProduct(product.id, 'category', e.target.value);
                            updateProduct(product.id, 'subcategory', ''); // Reset subcategory
                          }}
                          label="Category"
                        >
                          {categories.map((category) => (
                            <MenuItem key={category} value={category}>
                              {category}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Subcategory</InputLabel>
                        <Select
                          value={product.subcategory}
                          onChange={(e) => updateProduct(product.id, 'subcategory', e.target.value)}
                          label="Subcategory"
                          disabled={!product.category}
                        >
                          {getAvailableSubcategories(product.category).map((subcategory) => (
                            <MenuItem key={subcategory} value={subcategory}>
                              {subcategory}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        label="Min Order Quantity"
                        type="number"
                        value={product.min_order_quantity}
                        onChange={(e) => updateProduct(product.id, 'min_order_quantity', parseInt(e.target.value) || 1)}
                        size="small"
                      />
                    </Grid>



                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Description"
                        multiline
                        rows={2}
                        value={product.description}
                        onChange={(e) => updateProduct(product.id, 'description', e.target.value)}
                        size="small"
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Product Image URL (Optional)"
                        value={product.imageUrl && !product.imageUrl.startsWith('data:') ? product.imageUrl : ''}
                        onChange={(e) => handleManualImageUrl(product.id, e.target.value)}
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
            </Grid>
          ))}
        </Grid>

        {editableProducts.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No products extracted from receipt. Please try scanning again with a clearer image.
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 3 }}>
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
      </DialogActions>
    </Dialog>
  );
};

export default ExtractedProductEditor;