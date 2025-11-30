'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Autocomplete,
  Badge
} from '@mui/material';
import {
  Delete,
  CheckCircle,
  Error as ErrorIcon,
  Image as ImageIcon,
  Search,
  Refresh,
  CloudUpload,
  Warning,
  AutoAwesome,
  RateReview,
  LocalOffer
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import CategorySelector, {
  Category,
  Subcategory,
  CategorySelectorValue
} from './CategorySelector';
import { ParsedProduct, ImportResult } from './BulkImportDialog';
import { adminQueries } from '../lib/supabase-browser';
import DebouncedTextField from './DebouncedTextField';

export interface BulkImportPreviewProps {
  products: ParsedProduct[];
  sellerId: string;
  onConfirm: (results: ImportResult) => void;
  onCancel: () => void;
}

interface EditableProduct extends ParsedProduct {
  id: string;
  isLoadingImage: boolean;
  hasError: boolean;
  errorMessage?: string;
  categoryValue: CategorySelectorValue;
  unit?: string;
  uploadingImage?: boolean;
  // AI-related fields
  aiExtracted?: boolean;
  needsReview?: boolean;
  confidence?: {
    name: number;
    price: number;
    quantity: number;
    brand: number;
    overall: number;
  };
  brand?: string;
  // AI category suggestions
  categorySuggestions?: Array<{
    category: Category;
    confidence: number;
    reason: string;
  }>;
  subcategorySuggestions?: Array<{
    subcategory?: Subcategory;
    suggestedName?: string;
    isNew: boolean;
    confidence: number;
    reason: string;
  }>;
}

/**
 * Enhanced category auto-matching utility
 * Uses improved algorithm with fuzzy matching and better keyword coverage
 */
export function matchProductToCategory(
  productName: string,
  categories: Category[],
  subcategories: Subcategory[]
): { category?: Category; subcategory?: Subcategory } {
  const nameLower = productName.toLowerCase().trim();
  const words = nameLower.split(/\s+/);

  // Enhanced keyword mappings with better coverage
  const categoryKeywords: Record<string, string[]> = {
    'electronics': ['phone', 'mobile', 'laptop', 'tablet', 'camera', 'headphone', 'earphone', 'speaker', 'tv', 'television', 'computer', 'charger', 'cable', 'battery', 'powerbank', 'adapter'],
    'clothing': ['shirt', 't-shirt', 'pant', 'pants', 'dress', 'shoe', 'shoes', 'jacket', 'sweater', 'jeans', 'skirt', 'sock', 'socks', 'underwear', 'kurta', 'saree', 'salwar'],
    'home care': ['detergent', 'cleaner', 'soap', 'dishwash', 'dishwasher', 'floor', 'laundry', 'fabric', 'bleach', 'mop', 'broom', 'brush', 'tissue', 'napkin', 'wiper'],
    'personal care': ['shampoo', 'conditioner', 'lotion', 'cream', 'toothpaste', 'toothbrush', 'deodorant', 'perfume', 'body wash', 'face wash', 'moisturizer', 'serum', 'sunscreen', 'soap'],
    'beauty': ['makeup', 'lipstick', 'mascara', 'foundation', 'nail', 'nail polish', 'cosmetic', 'beauty', 'kajal', 'eyeliner', 'lip balm', 'face powder'],
    'food': ['biscuit', 'biscuits', 'cookie', 'cookies', 'snack', 'chips', 'chocolate', 'candy', 'cereal', 'rice', 'wheat', 'flour', 'atta', 'oil', 'ghee', 'sugar', 'salt', 'spice'],
    'beverages': ['tea', 'coffee', 'juice', 'water', 'soda', 'drink', 'milk', 'lassi', 'buttermilk', 'soft drink', 'energy drink'],
    'grocery': ['grocery', 'masala', 'dal', 'pulse', 'lentil', 'turmeric', 'cumin', 'coriander', 'red chilli', 'pepper', 'black pepper'],
    'fruits': ['apple', 'banana', 'orange', 'mango', 'grapes', 'strawberry', 'watermelon', 'papaya', 'pineapple', 'guava'],
    'vegetables': ['onion', 'potato', 'tomato', 'carrot', 'cabbage', 'cauliflower', 'brinjal', 'ladyfinger', 'beans', 'peas']
  };

  // Score-based matching for better accuracy
  let bestMatch: { category?: Category; score: number } = { score: 0 };

  // First pass: keyword matching with scoring
  for (const [categoryKey, keywords] of Object.entries(categoryKeywords)) {
    let score = 0;

    // Count keyword matches
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        // Longer keywords get higher score
        score += keyword.length;
      }
    }

    // Check word-by-word matching for better accuracy
    for (const word of words) {
      if (keywords.some(keyword => word.includes(keyword) || keyword.includes(word))) {
        score += word.length * 2; // Word matches get double score
      }
    }

    if (score > bestMatch.score) {
      // Find matching category in database
      const matchedCat = categories.find(c => {
        const catLower = c.name.toLowerCase();
        return catLower.includes(categoryKey) ||
          categoryKey.includes(catLower) ||
          catLower.split(' ').some(word => categoryKeywords[categoryKey].includes(word));
      });

      if (matchedCat) {
        bestMatch = { category: matchedCat, score };
      }
    }
  }

  // Second pass: fuzzy matching with category names
  if (!bestMatch.category) {
    for (const category of categories) {
      const catLower = category.name.toLowerCase();
      const catWords = catLower.split(/\s+/);

      // Check if any product word matches category word
      let matchCount = 0;
      for (const word of words) {
        if (catWords.some(catWord => {
          return word.length > 3 && (catWord.includes(word) || word.includes(catWord));
        })) {
          matchCount++;
        }
      }

      if (matchCount > 0 && matchCount > bestMatch.score) {
        bestMatch = { category, score: matchCount };
      }
    }
  }

  // Try to match subcategory if category found
  let matchedSubcategory: Subcategory | undefined;
  if (bestMatch.category) {
    const categorySubcategories = subcategories.filter(s => s.category_id === bestMatch.category!.id);

    // Score subcategories
    let bestSubcat: { subcategory?: Subcategory; score: number } = { score: 0 };

    for (const subcat of categorySubcategories) {
      const subcatLower = subcat.name.toLowerCase();
      let score = 0;

      // Exact match
      if (nameLower.includes(subcatLower)) {
        score = 100;
      }
      // Word matching
      else {
        const subcatWords = subcatLower.split(/\s+/);
        for (const word of words) {
          if (word.length > 3 && subcatWords.some(sw => sw.includes(word) || word.includes(sw))) {
            score += word.length;
          }
        }
      }

      if (score > bestSubcat.score) {
        bestSubcat = { subcategory: subcat, score };
      }
    }

    matchedSubcategory = bestSubcat.subcategory;
  }

  return { category: bestMatch.category, subcategory: matchedSubcategory };
}

/**
 * Automatic unit detection from product name
 * Extracts units like kg, g, ml, l, box, pack, pieces, etc.
 */
export function detectUnitFromProductName(productName: string): string {
  const nameLower = productName.toLowerCase().trim();

  // Unit patterns with priority order
  const unitPatterns: Array<{ pattern: RegExp; unit: string }> = [
    // Weight units
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:kg|kilogram|kilograms|kgs)\b/i, unit: 'kg' },
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:g|gram|grams|gm|gms)\b/i, unit: 'g' },
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:mg|milligram|milligrams)\b/i, unit: 'g' },

    // Volume units
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:l|liter|litre|liters|litres|lt)\b/i, unit: 'l' },
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:ml|milliliter|millilitre|milliliters|millilitres)\b/i, unit: 'ml' },

    // Packaging units
    { pattern: /\b(\d+)\s*(?:box|boxes)\b/i, unit: 'box' },
    { pattern: /\b(\d+)\s*(?:pack|packs|pkt|pkts|packet|packets)\b/i, unit: 'pack' },
    { pattern: /\b(\d+)\s*(?:carton|cartons|ctn|ctns)\b/i, unit: 'carton' },
    { pattern: /\b(\d+)\s*(?:bottle|bottles|btl|btls)\b/i, unit: 'bottle' },
    { pattern: /\b(\d+)\s*(?:can|cans|tin|tins)\b/i, unit: 'can' },
    { pattern: /\b(\d+)\s*(?:jar|jars)\b/i, unit: 'bottle' },
    { pattern: /\b(\d+)\s*(?:pouch|pouches)\b/i, unit: 'pack' },

    // Count units
    { pattern: /\b(\d+)\s*(?:pcs?|pc|pieces?|piece|unit|units|nos?|no|count)\b/i, unit: 'pieces' },
    { pattern: /\b(\d+)\s*(?:dozen|dz)\b/i, unit: 'dozen' },

    // Area/Volume units
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:sq\s*ft|square\s*feet)\b/i, unit: 'square meter' },
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:sq\s*m|square\s*meter)\b/i, unit: 'square meter' },

    // Length units
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:m|meter|metre|meters|metres)\b/i, unit: 'meter' },
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:cm|centimeter|centimetre|centimeters|centimetres)\b/i, unit: 'cm' },
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:ft|feet|foot)\b/i, unit: 'meter' },
  ];

  // Try to match patterns (higher priority first)
  for (const { pattern, unit } of unitPatterns) {
    if (pattern.test(nameLower)) {
      return unit;
    }
  }

  // Fallback: check common keywords that suggest units
  if (/\b(loose|bulk|wholesale)\b/i.test(nameLower)) {
    return 'kg';
  }

  if (/\b(ready\s*to\s*cook|instant|mix)\b/i.test(nameLower)) {
    return 'pack';
  }

  // Default to pieces
  return 'pieces';
}

/**
 * Generate unique ID for products
 */
const generateProductId = (): string => {
  return `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const BulkImportPreview: React.FC<BulkImportPreviewProps> = ({
  products,
  sellerId,
  onConfirm,
  onCancel
}) => {
  // State for editable products
  const [editableProducts, setEditableProducts] = useState<EditableProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult | null>(null);
  // Batch scraping state - Requirements: 5.9
  const [isBatchScraping, setIsBatchScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState({ current: 0, total: 0 });

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await adminQueries.getCategories();
        setCategories(data.categories || []);
        setSubcategories(data.subcategories || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Failed to load categories');
      }
    };
    fetchCategories();
  }, []);

  // Utility to yield control to browser
  const yieldToBrowser = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        requestIdleCallback(() => resolve(), { timeout: 10 });
      } else {
        setTimeout(() => resolve(), 0);
      }
    });
  }, []);

  // Initialize editable products with auto-tagging when categories are loaded
  useEffect(() => {
    if (categories.length === 0) return;

    const initializeProducts = async () => {
      // First pass: Initialize with rule-based matching (fast)
      const initProducts = products.map(product => {
        let matchedCategory: Category | undefined;
        let matchedSubcategory: Subcategory | undefined;

        // If product has AI-extracted category with high confidence, use it
        if (product.aiExtracted && product.category && product.confidence && product.confidence.overall >= 0.7) {
          matchedCategory = categories.find(c => c.name.toLowerCase() === product.category?.toLowerCase());
          if (matchedCategory && product.subcategory) {
            matchedSubcategory = subcategories.find(
              s => s.category_id === matchedCategory!.id && s.name.toLowerCase() === product.subcategory?.toLowerCase()
            );
          }
        }

        // Fallback to keyword-based matching if no AI match
        if (!matchedCategory) {
          const match = matchProductToCategory(product.name, categories, subcategories);
          matchedCategory = match.category;
          matchedSubcategory = match.subcategory;
        }

        // Auto-detect unit from product name (use AI-extracted unit if available)
        const detectedUnit = product.unit || detectUnitFromProductName(product.name);

        // Use CSV/Excel category/subcategory if provided, otherwise use matched categories
        const finalCategory = product.category || matchedCategory?.name || '';
        const finalSubcategory = product.subcategory || matchedSubcategory?.name || '';
        
        // If CSV/Excel provided category, try to find matching category object
        let finalMatchedCategory = matchedCategory;
        let finalMatchedSubcategory = matchedSubcategory;
        
        if (product.category && !matchedCategory) {
          // Try to find category from CSV/Excel value
          finalMatchedCategory = categories.find(c => 
            c.name.toLowerCase().trim() === product.category?.toLowerCase().trim()
          );
          
          // If category found and subcategory provided, try to find matching subcategory
          if (finalMatchedCategory && product.subcategory) {
            finalMatchedSubcategory = subcategories.find(s => 
              s.category_id === finalMatchedCategory!.id &&
              s.name.toLowerCase().trim() === product.subcategory?.toLowerCase().trim()
            );
          }
        }

        return {
          ...product,
          id: generateProductId(),
          isLoadingImage: false,
          hasError: false,
          uploadingImage: false,
          stock_level: product.stock_level || 100,
          category: finalCategory,
          subcategory: finalSubcategory,
          unit: detectedUnit,
          brand: product.brand || '',
          aiExtracted: product.aiExtracted,
          needsReview: product.needsReview,
          confidence: product.confidence,
          categoryValue: {
            category: finalCategory,
            categoryId: finalMatchedCategory?.id,
            subcategory: finalSubcategory,
            subcategoryId: finalMatchedSubcategory?.id
          }
        };
      });

      // Set initial products immediately (fast rule-based matching)
      setEditableProducts(initProducts);
      setIsLoading(false);

      // Second pass: Enhance with AI + web search for products without category matches (chunked, non-blocking)
      const productsNeedingEnhancement = initProducts.filter(p => !p.category || p.category === '');
      if (productsNeedingEnhancement.length > 0) {
        // Process in chunks to prevent browser freezing
        const CHUNK_SIZE = 3; // Smaller chunks for better responsiveness
        const DELAY_BETWEEN_CHUNKS = 150; // 150ms delay between chunks

        for (let i = 0; i < productsNeedingEnhancement.length; i += CHUNK_SIZE) {
          const chunk = productsNeedingEnhancement.slice(i, i + CHUNK_SIZE);

          // Yield to browser before processing chunk
          await yieldToBrowser();

          try {
            const response = await fetch('/api/admin/enhanced-categorize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                products: chunk.map(p => ({ name: p.name, brand: p.brand })),
                categories: categories.map(c => c.name),
                subcategories: categories.reduce((acc, cat) => {
                  acc[cat.name] = subcategories
                    .filter(s => s.category_id === cat.id)
                    .map(s => s.name);
                  return acc;
                }, {} as Record<string, string[]>),
                batch: true
              })
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.results) {
                // Update products with enhanced categorization results
                setEditableProducts(prev => prev.map(p => {
                  const enhanced = result.results.find((r: any) => r.productName === p.name);
                  if (enhanced && enhanced.success && enhanced.category) {
                    // Case-insensitive category matching
                    const matchedCat = categories.find(c => {
                      const catLower = c.name.toLowerCase().trim();
                      const enhancedLower = enhanced.category.toLowerCase().trim();
                      return catLower === enhancedLower ||
                        catLower.includes(enhancedLower) ||
                        enhancedLower.includes(catLower);
                    });

                    // Case-insensitive subcategory matching
                    const matchedSubcat = matchedCat && enhanced.subcategory ? subcategories.find(
                      s => {
                        if (s.category_id !== matchedCat.id) return false;
                        const subcatLower = s.name.toLowerCase().trim();
                        const enhancedSubLower = enhanced.subcategory.toLowerCase().trim();
                        return subcatLower === enhancedSubLower ||
                          subcatLower.includes(enhancedSubLower) ||
                          enhancedSubLower.includes(subcatLower);
                      }
                    ) : undefined;

                    if (matchedCat) {
                      return {
                        ...p,
                        category: matchedCat.name,
                        subcategory: matchedSubcat?.name || enhanced.subcategory || p.subcategory,
                        categoryValue: {
                          category: matchedCat.name,
                          categoryId: matchedCat.id,
                          subcategory: matchedSubcat?.name || enhanced.subcategory || p.subcategory,
                          subcategoryId: matchedSubcat?.id
                        }
                      };
                    }
                  }
                  return p;
                }));
              }
            }
          } catch (error) {
            console.warn('Enhanced categorization chunk failed:', error);
          }

          // Delay before next chunk (except for last chunk)
          if (i + CHUNK_SIZE < productsNeedingEnhancement.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
          }
        }
      }

      // Third pass: Brand mapping with AI + web search (chunked, non-blocking)
      const productsNeedingBrandMapping = initProducts.filter(p => !p.brand || p.brand.trim() === '');
      if (productsNeedingBrandMapping.length > 0) {
        const CHUNK_SIZE = 3;
        const DELAY_BETWEEN_CHUNKS = 150;

        for (let i = 0; i < productsNeedingBrandMapping.length; i += CHUNK_SIZE) {
          const chunk = productsNeedingBrandMapping.slice(i, i + CHUNK_SIZE);

          // Yield to browser before processing chunk
          await yieldToBrowser();

          try {
            const response = await fetch('/api/admin/enhanced-brand', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                products: chunk.map(p => ({ name: p.name })),
                batch: true
              })
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.results) {
                // Update products with enhanced brand identification
                setEditableProducts(prev => prev.map(p => {
                  const enhanced = result.results.find((r: any) => r.productName === p.name);
                  if (enhanced && enhanced.success && enhanced.brand) {
                    return {
                      ...p,
                      brand: enhanced.brand || p.brand
                    };
                  }
                  return p;
                }));
              }
            }
          } catch (error) {
            console.warn('Enhanced brand mapping chunk failed:', error);
          }

          // Delay before next chunk (except for last chunk)
          if (i + CHUNK_SIZE < productsNeedingBrandMapping.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
          }
        }
      }
    };

    initializeProducts();
  }, [products, categories, subcategories, yieldToBrowser]);

  // Update a single product field
  const updateProduct = useCallback((id: string, field: keyof EditableProduct, value: any) => {
    setEditableProducts(prev =>
      prev.map(p => p.id === id ? { ...p, [field]: value } : p)
    );
  }, []);

  // Update category for a product
  const updateProductCategory = useCallback((id: string, categoryValue: CategorySelectorValue) => {
    setEditableProducts(prev =>
      prev.map(p => p.id === id ? {
        ...p,
        category: categoryValue.category,
        subcategory: categoryValue.subcategory,
        categoryValue
      } : p)
    );
  }, []);

  // Remove a product from the list
  const removeProduct = useCallback((id: string) => {
    setEditableProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  // Search image for a single product using Python scraper
  const searchImageForProduct = useCallback(async (id: string) => {
    const product = editableProducts.find(p => p.id === id);
    if (!product) return;

    updateProduct(id, 'isLoadingImage', true);

    try {
      // Call API route for image search (server-side only)
      const response = await fetch('/api/admin/scrape-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          brandName: product.brand || '',
          productId: id
        }),
      });

      if (!response.ok) {
        throw new Error('Image search failed');
      }

      const result = await response.json();

      if (result.success && result.imageUrl) {
        updateProduct(id, 'imageUrl', result.imageUrl);
      } else {
        throw new Error(result.error || 'No image found');
      }
      updateProduct(id, 'isLoadingImage', false);
    } catch (error) {
      console.error('Image search failed:', error);
      updateProduct(id, 'isLoadingImage', false);
      toast.error(`Failed to find image for ${product.name}`);
    }
  }, [editableProducts, updateProduct]);

  // Handle image upload for a single product
  const handleImageUpload = useCallback(async (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

    const product = editableProducts.find(p => p.id === id);
    if (!product) {
      toast.error('Product not found');
      return;
    }

    updateProduct(id, 'uploadingImage', true);

    try {
      // Create a temporary preview using data URL for immediate display
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target?.result as string;
        updateProduct(id, 'imageUrl', previewUrl);
      };
      reader.readAsDataURL(file);

      // Upload to Supabase storage via API
      const formData = new FormData();
      formData.append('image', file);
      formData.append('productName', product.name);
      formData.append('folder', 'seller-inventory'); // Store in seller-inventory folder

      // Include current image URL if it exists and is from storage (not base64)
      if (product.imageUrl && !product.imageUrl.startsWith('data:')) {
        formData.append('currentImageUrl', product.imageUrl);
      }

      const response = await fetch('/api/upload-product-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload image');
      }

      const result = await response.json();

      if (result.success && result.imageUrl) {
        // Update with the storage URL (replacing the temporary preview)
        updateProduct(id, 'imageUrl', result.imageUrl);
        toast.success('Image uploaded successfully!');
      } else {
        throw new Error('Upload succeeded but no URL returned');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload image';
      toast.error(errorMessage);
      // Keep the preview URL if upload fails
    } finally {
      updateProduct(id, 'uploadingImage', false);
      // Reset input value to allow selecting the same file again
      event.target.value = '';
    }
  }, [editableProducts, updateProduct]);

  // Scrape images for all products without images using batch scraper
  // Requirements: 5.9 - Batch processing with rate limiting and progress tracking
  const scrapeAllImages = useCallback(async () => {
    const productsWithoutImages = editableProducts.filter(p => !p.imageUrl);

    if (productsWithoutImages.length === 0) {
      toast.success('All products already have images');
      return;
    }

    setIsBatchScraping(true);
    setScrapeProgress({ current: 0, total: productsWithoutImages.length });

    // Mark all products as loading
    productsWithoutImages.forEach(p => updateProduct(p.id, 'isLoadingImage', true));

    toast.loading(`Scraping images for ${productsWithoutImages.length} products...`, { id: 'image-scrape' });

    try {
      // Process in batches with progress tracking
      const batchSize = 3;
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < productsWithoutImages.length; i += batchSize) {
        const batch = productsWithoutImages.slice(i, i + batchSize);

        // Process batch in parallel using API route
        const results = await Promise.all(
          batch.map(async (product) => {
            try {
              // Call API route for image search (server-side only)
              const response = await fetch('/api/admin/scrape-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productName: product.name,
                  brandName: product.brand || '',
                  productId: product.id
                }),
              });

              updateProduct(product.id, 'isLoadingImage', false);

              if (response.ok) {
                const result = await response.json();
                if (result.success && result.imageUrl) {
                  updateProduct(product.id, 'imageUrl', result.imageUrl);
                  return { success: true };
                }
              }
              return { success: false };
            } catch {
              updateProduct(product.id, 'isLoadingImage', false);
              return { success: false };
            }
          })
        );

        // Update progress
        results.forEach(r => r.success ? successful++ : failed++);
        setScrapeProgress({ current: i + batch.length, total: productsWithoutImages.length });

        // Rate limiting delay between batches
        if (i + batchSize < productsWithoutImages.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast.dismiss('image-scrape');
      setIsBatchScraping(false);

      if (failed > 0) {
        toast.success(`Scraped images for ${successful} products. ${failed} failed.`);
      } else {
        toast.success(`Scraped images for all ${successful} products!`);
      }
    } catch (error) {
      console.error('Batch image scrape failed:', error);
      // Reset loading states
      productsWithoutImages.forEach(p => updateProduct(p.id, 'isLoadingImage', false));
      toast.dismiss('image-scrape');
      setIsBatchScraping(false);
      toast.error('Image scraping failed. Please try again.');
    }
  }, [editableProducts, updateProduct]);

  // Import all products to seller inventory
  const handleImport = useCallback(async () => {
    if (editableProducts.length === 0) {
      toast.error('No products to import');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    // Get admin and session info for tracking
    const adminSession = localStorage.getItem('admin_session');
    const sessionId = localStorage.getItem('tracking_session_id');
    const admin = adminSession ? JSON.parse(adminSession) : null;

    const results: ImportResult = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Check for duplicates first (batch check)
    const duplicateCheckResponse = await fetch('/api/admin/products/check-duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: editableProducts.map(p => ({ name: p.name.trim() })),
        seller_id: sellerId,
      }),
    });

    const duplicateResults = new Map<string, any>();
    if (duplicateCheckResponse.ok) {
      const duplicateData = await duplicateCheckResponse.json();
      if (duplicateData.results) {
        duplicateData.results.forEach((result: any) => {
          duplicateResults.set(result.name, result.duplicate);
        });
      }
    }

    // Process each product
    for (let i = 0; i < editableProducts.length; i++) {
      const product = editableProducts[i];

      try {
        // Validate required fields
        if (!product.name || product.name.trim() === '') {
          throw new Error('Product name is required');
        }
        if (product.price < 0) {
          throw new Error('Price must be non-negative');
        }

        // Check for duplicate
        const duplicateCheck = duplicateResults.get(product.name.trim());
        if (duplicateCheck?.isDuplicate) {
          throw new Error(duplicateCheck.reason || 'Duplicate product detected');
        }

        // Handle image URL - upload base64 images to storage first
        let finalImageUrl = product.imageUrl || '';

        // If image is a base64 data URL, convert it to a File and upload to storage
        if (finalImageUrl.startsWith('data:image/')) {
          try {
            // Convert base64 to blob
            const response = await fetch(finalImageUrl);
            const blob = await response.blob();

            // Create a File from the blob
            const fileName = `${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`;
            const file = new File([blob], fileName, { type: blob.type });

            // Upload to storage
            const formData = new FormData();
            formData.append('image', file);
            formData.append('productName', product.name);
            formData.append('folder', 'seller-inventory'); // Store in seller-inventory folder

            const uploadResponse = await fetch('/api/upload-product-image', {
              method: 'POST',
              body: formData,
            });

            if (uploadResponse.ok) {
              const uploadResult = await uploadResponse.json();
              if (uploadResult.success && uploadResult.imageUrl) {
                finalImageUrl = uploadResult.imageUrl;
                // Update the product with the storage URL
                updateProduct(product.id, 'imageUrl', finalImageUrl);
              }
            }
          } catch (imageError) {
            console.error('Failed to upload base64 image to storage:', imageError);
            // Continue without image URL if upload fails
            finalImageUrl = '';
          }
        }

        // Add product to seller inventory via API with tracking
        const response = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seller_id: sellerId,
            name: product.name.trim(),
            price: product.price,
            min_order_quantity: product.min_order_quantity || 1,
            description: product.description || '',
            category: product.category || '',
            subcategory: product.subcategory || '',
            image_url: finalImageUrl,
            stock_level: product.stock_level || 100,
            unit: product.unit || 'pieces',
            // Add tracking info
            admin_id: admin?.id,
            session_id: sessionId,
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        results.successful++;
        updateProduct(product.id, 'hasError', false);
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({ product: product.name, error: errorMessage });
        updateProduct(product.id, 'hasError', true);
        updateProduct(product.id, 'errorMessage', errorMessage);
      }

      // Update progress
      setImportProgress(Math.round(((i + 1) / editableProducts.length) * 100));
    }

    setIsImporting(false);
    setImportResults(results);
    setShowResultsDialog(true);
  }, [editableProducts, sellerId, updateProduct]);

  // Handle results dialog close
  const handleResultsClose = useCallback(() => {
    setShowResultsDialog(false);
    if (importResults) {
      onConfirm(importResults);
    }
  }, [importResults, onConfirm]);

  // Retry failed imports
  const retryFailedImports = useCallback(async () => {
    const failedProducts = editableProducts.filter(p => p.hasError);
    if (failedProducts.length === 0) {
      toast.success('No failed products to retry');
      return;
    }

    // Reset error states
    failedProducts.forEach(p => {
      updateProduct(p.id, 'hasError', false);
      updateProduct(p.id, 'errorMessage', undefined);
    });

    setShowResultsDialog(false);

    // Re-run import for failed products only
    setIsImporting(true);
    setImportProgress(0);

    // Get admin and session info for tracking
    const adminSession = localStorage.getItem('admin_session');
    const sessionId = localStorage.getItem('tracking_session_id');
    const admin = adminSession ? JSON.parse(adminSession) : null;

    const results: ImportResult = {
      successful: importResults?.successful || 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < failedProducts.length; i++) {
      const product = failedProducts[i];

      try {
        if (!product.name || product.name.trim() === '') {
          throw new Error('Product name is required');
        }

        // Handle image URL - upload base64 images to storage first
        let finalImageUrl = product.imageUrl || '';

        // If image is a base64 data URL, convert it to a File and upload to storage
        if (finalImageUrl.startsWith('data:image/')) {
          try {
            // Convert base64 to blob
            const response = await fetch(finalImageUrl);
            const blob = await response.blob();

            // Create a File from the blob
            const fileName = `${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`;
            const file = new File([blob], fileName, { type: blob.type });

            // Upload to storage
            const formData = new FormData();
            formData.append('image', file);
            formData.append('productName', product.name);
            formData.append('folder', 'seller-inventory'); // Store in seller-inventory folder

            const uploadResponse = await fetch('/api/upload-product-image', {
              method: 'POST',
              body: formData,
            });

            if (uploadResponse.ok) {
              const uploadResult = await uploadResponse.json();
              if (uploadResult.success && uploadResult.imageUrl) {
                finalImageUrl = uploadResult.imageUrl;
                // Update the product with the storage URL
                updateProduct(product.id, 'imageUrl', finalImageUrl);
              }
            }
          } catch (imageError) {
            console.error('Failed to upload base64 image to storage:', imageError);
            // Continue without image URL if upload fails
            finalImageUrl = '';
          }
        }

        const response = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seller_id: sellerId,
            name: product.name.trim(),
            price: product.price,
            min_order_quantity: product.min_order_quantity || 1,
            description: product.description || '',
            category: product.category || '',
            subcategory: product.subcategory || '',
            image_url: finalImageUrl,
            stock_level: product.stock_level || 100,
            unit: product.unit || 'pieces',
            // Add tracking info
            admin_id: admin?.id,
            session_id: sessionId,
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        results.successful++;
        updateProduct(product.id, 'hasError', false);
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({ product: product.name, error: errorMessage });
        updateProduct(product.id, 'hasError', true);
        updateProduct(product.id, 'errorMessage', errorMessage);
      }

      setImportProgress(Math.round(((i + 1) / failedProducts.length) * 100));
    }

    setIsImporting(false);
    setImportResults(results);
    setShowResultsDialog(true);
  }, [editableProducts, importResults, sellerId, updateProduct]);

  // Count products with/without images and AI stats
  const productStats = useMemo(() => {
    const withImages = editableProducts.filter(p => p.imageUrl).length;
    const withoutImages = editableProducts.length - withImages;
    const aiExtracted = editableProducts.filter(p => p.aiExtracted).length;
    const needsReview = editableProducts.filter(p => p.needsReview).length;
    const withBrand = editableProducts.filter(p => p.brand).length;
    const avgConfidence = editableProducts.length > 0
      ? editableProducts.reduce((sum, p) => sum + (p.confidence?.overall || 0), 0) / editableProducts.length
      : 0;
    return { withImages, withoutImages, aiExtracted, needsReview, withBrand, avgConfidence };
  }, [editableProducts]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading categories...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with stats and actions */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h6">
              Preview Import ({editableProducts.length} products)
            </Typography>
            <Box display="flex" gap={1} mt={1} flexWrap="wrap">
              <Chip
                icon={<ImageIcon />}
                label={`${productStats.withImages} with images`}
                color="success"
                size="small"
              />
              <Chip
                icon={<Warning />}
                label={`${productStats.withoutImages} without images`}
                color="warning"
                size="small"
              />
              {/* AI extraction stats */}
              {productStats.aiExtracted > 0 && (
                <Tooltip title="Products extracted using AI">
                  <Chip
                    icon={<AutoAwesome />}
                    label={`${productStats.aiExtracted} AI-extracted`}
                    color="primary"
                    size="small"
                    variant="outlined"
                  />
                </Tooltip>
              )}
              {productStats.needsReview > 0 && (
                <Tooltip title="Products with low confidence that need review">
                  <Chip
                    icon={<RateReview />}
                    label={`${productStats.needsReview} need review`}
                    color="warning"
                    size="small"
                    variant="outlined"
                  />
                </Tooltip>
              )}
              {productStats.withBrand > 0 && (
                <Tooltip title="Products with identified brands">
                  <Chip
                    icon={<LocalOffer />}
                    label={`${productStats.withBrand} with brand`}
                    color="info"
                    size="small"
                    variant="outlined"
                  />
                </Tooltip>
              )}
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            {/* Scrape All Images button - Requirements: 5.9 */}
            <Button
              variant="outlined"
              startIcon={isBatchScraping ? <CircularProgress size={16} /> : <Search />}
              onClick={scrapeAllImages}
              disabled={isImporting || isBatchScraping || productStats.withoutImages === 0}
            >
              {isBatchScraping
                ? `Scraping ${scrapeProgress.current}/${scrapeProgress.total}...`
                : `Scrape All Images (${productStats.withoutImages})`}
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={onCancel}
              disabled={isImporting || isBatchScraping}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={handleImport}
              disabled={isImporting || isBatchScraping || editableProducts.length === 0}
            >
              Import All
            </Button>
          </Box>
        </Box>

        {/* Progress indicators */}
        {isBatchScraping && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={scrapeProgress.total > 0 ? (scrapeProgress.current / scrapeProgress.total) * 100 : 0}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Scraping images... {scrapeProgress.current}/{scrapeProgress.total}
            </Typography>
          </Box>
        )}
        {isImporting && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={importProgress} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Importing... {importProgress}%
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Product Cards Grid */}
      <Grid container spacing={2}>
        {editableProducts.map((product) => (
          <Grid item xs={12} sm={6} md={4} key={product.id}>
            <Card
              sx={{
                height: '100%',
                border: product.hasError
                  ? '2px solid'
                  : product.needsReview
                    ? '2px dashed'
                    : product.aiExtracted
                      ? '1px solid'
                      : 'none',
                borderColor: product.hasError
                  ? 'error.main'
                  : product.needsReview
                    ? 'warning.main'
                    : product.aiExtracted
                      ? 'primary.light'
                      : 'transparent',
                position: 'relative'
              }}
            >
              {/* AI extraction badge */}
              {product.aiExtracted && (
                <Tooltip title={`AI confidence: ${Math.round((product.confidence?.overall || 0) * 100)}%`}>
                  <Chip
                    icon={<AutoAwesome sx={{ fontSize: 12 }} />}
                    label={`${Math.round((product.confidence?.overall || 0) * 100)}%`}
                    size="small"
                    color={product.confidence?.overall && product.confidence.overall >= 0.7 ? 'success' : 'warning'}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      zIndex: 10,
                      height: 20,
                      fontSize: '0.65rem'
                    }}
                  />
                </Tooltip>
              )}
              {/* Needs review badge */}
              {product.needsReview && (
                <Tooltip title="This product has low confidence fields that need review">
                  <Chip
                    icon={<RateReview sx={{ fontSize: 12 }} />}
                    label="Review"
                    size="small"
                    color="warning"
                    sx={{
                      position: 'absolute',
                      top: product.aiExtracted ? 32 : 8,
                      left: 8,
                      zIndex: 10,
                      height: 20,
                      fontSize: '0.65rem'
                    }}
                  />
                </Tooltip>
              )}
              {/* Product Image */}
              <Box sx={{ position: 'relative', height: 160, bgcolor: 'grey.100' }}>
                {product.imageUrl ? (
                  <CardMedia
                    component="img"
                    height="160"
                    image={product.imageUrl}
                    alt={product.name}
                    sx={{ objectFit: 'contain' }}
                  />
                ) : (
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    height="100%"
                  >
                    <ImageIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                  </Box>
                )}

                {/* Image loading overlay */}
                {(product.isLoadingImage || product.uploadingImage) && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      bgcolor: 'rgba(255,255,255,0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <CircularProgress size={32} />
                  </Box>
                )}

                {/* Image search and upload buttons */}
                <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    component="label"
                    sx={{
                      bgcolor: 'white',
                      '&:hover': { bgcolor: 'grey.100' }
                    }}
                    disabled={product.uploadingImage || product.isLoadingImage}
                    title="Upload image"
                  >
                    <CloudUpload fontSize="small" />
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => handleImageUpload(product.id, e)}
                    />
                  </IconButton>
                  <IconButton
                    size="small"
                    sx={{
                      bgcolor: 'white',
                      '&:hover': { bgcolor: 'grey.100' }
                    }}
                    onClick={() => searchImageForProduct(product.id)}
                    disabled={product.isLoadingImage || product.uploadingImage}
                    title="Search for image"
                  >
                    <Search fontSize="small" />
                  </IconButton>
                </Box>

                {/* Delete button - moved to bottom left to avoid badge overlap */}
                <IconButton
                  size="small"
                  color="error"
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    bgcolor: 'white',
                    '&:hover': { bgcolor: 'error.50' }
                  }}
                  onClick={() => removeProduct(product.id)}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>

              <CardContent sx={{ p: 2 }}>
                {/* Error message */}
                {product.hasError && (
                  <Alert severity="error" sx={{ mb: 2, py: 0 }}>
                    {product.errorMessage || 'Import failed'}
                  </Alert>
                )}

                {/* Product Name - highlight if low confidence */}
                <Tooltip
                  title={product.confidence?.name !== undefined
                    ? `Name confidence: ${Math.round(product.confidence.name * 100)}%`
                    : ''}
                  placement="top"
                >
                  <DebouncedTextField
                    fullWidth
                    size="small"
                    label="Product Name"
                    value={product.name}
                    onChange={(value) => updateProduct(product.id, 'name', value)}
                    debounceMs={300}
                    sx={{
                      mb: 1.5,
                      '& .MuiOutlinedInput-root': {
                        borderColor: product.confidence?.name !== undefined && product.confidence.name < 0.7
                          ? 'warning.main'
                          : undefined
                      }
                    }}
                    color={product.confidence?.name !== undefined && product.confidence.name < 0.7 ? 'warning' : undefined}
                  />
                </Tooltip>

                {/* Brand field - show brand identification results */}
                <Tooltip
                  title={product.confidence?.brand !== undefined
                    ? `Brand confidence: ${Math.round(product.confidence.brand * 100)}%`
                    : 'Brand not identified'}
                  placement="top"
                >
                  <DebouncedTextField
                    fullWidth
                    size="small"
                    label="Brand"
                    value={product.brand || ''}
                    onChange={(value) => updateProduct(product.id, 'brand', value)}
                    debounceMs={300}
                    placeholder="Enter brand name"
                    sx={{
                      mb: 1.5,
                      '& .MuiOutlinedInput-root': {
                        borderColor: product.aiExtracted && !product.brand
                          ? 'info.main'
                          : undefined
                      }
                    }}
                    color={product.aiExtracted && !product.brand ? 'info' : undefined}
                  />
                </Tooltip>

                {/* Price and Quantity Row - highlight if low confidence */}
                <Box display="flex" gap={1} mb={1.5}>
                  <Tooltip
                    title={product.confidence?.price !== undefined
                      ? `Price confidence: ${Math.round(product.confidence.price * 100)}%`
                      : ''}
                    placement="top"
                  >
                    <DebouncedTextField
                      size="small"
                      label="Price"
                      type="number"
                      value={product.price}
                      onChange={(value) => updateProduct(product.id, 'price', typeof value === 'number' ? value : parseFloat(String(value)) || 0)}
                      debounceMs={300}
                      parseAsNumber
                      sx={{ flex: 1 }}
                      InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                      color={product.confidence?.price !== undefined && product.confidence.price < 0.7 ? 'warning' : undefined}
                    />
                  </Tooltip>
                  <Tooltip
                    title={product.confidence?.quantity !== undefined
                      ? `Quantity confidence: ${Math.round(product.confidence.quantity * 100)}%`
                      : ''}
                    placement="top"
                  >
                    <DebouncedTextField
                      size="small"
                      label="Min Qty"
                      type="number"
                      value={product.min_order_quantity}
                      onChange={(value) => updateProduct(product.id, 'min_order_quantity', typeof value === 'number' ? value : parseInt(String(value)) || 1)}
                      debounceMs={300}
                      parseAsNumber
                      sx={{ flex: 1 }}
                      InputProps={{ inputProps: { min: 1 } }}
                      color={product.confidence?.quantity !== undefined && product.confidence.quantity < 0.7 ? 'warning' : undefined}
                    />
                  </Tooltip>
                </Box>

                {/* Unit Selector */}
                <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={product.unit || 'pieces'}
                    onChange={(e) => updateProduct(product.id, 'unit', e.target.value)}
                    label="Unit"
                  >
                    <MenuItem value="pieces">Pieces</MenuItem>
                    <MenuItem value="g">g (grams)</MenuItem>
                    <MenuItem value="kg">kg (kilograms)</MenuItem>
                    <MenuItem value="ml">ml (milliliters)</MenuItem>
                    <MenuItem value="l">L (liters)</MenuItem>
                    <MenuItem value="box">Box</MenuItem>
                    <MenuItem value="carton">Carton</MenuItem>
                    <MenuItem value="pack">Pack</MenuItem>
                    <MenuItem value="bottle">Bottle</MenuItem>
                    <MenuItem value="can">Can</MenuItem>
                    <MenuItem value="dozen">Dozen</MenuItem>
                    <MenuItem value="meter">Meter</MenuItem>
                    <MenuItem value="cm">cm (centimeters)</MenuItem>
                    <MenuItem value="square meter">Square Meter</MenuItem>
                  </Select>
                </FormControl>

                {/* Stock Level */}
                <DebouncedTextField
                  fullWidth
                  size="small"
                  label="Stock Level"
                  type="number"
                  value={product.stock_level}
                  onChange={(value) => updateProduct(product.id, 'stock_level', typeof value === 'number' ? value : parseInt(String(value)) || 100)}
                  debounceMs={300}
                  parseAsNumber
                  sx={{ mb: 1.5 }}
                  InputProps={{ inputProps: { min: 0 } }}
                />

                {/* Category Selector */}
                <CategorySelector
                  value={product.categoryValue}
                  onChange={(value) => updateProductCategory(product.id, value)}
                  size="small"
                  allowNew={true}
                />

                {/* Description */}
                <DebouncedTextField
                  fullWidth
                  size="small"
                  label="Description"
                  multiline
                  rows={2}
                  value={product.description || ''}
                  onChange={(value) => updateProduct(product.id, 'description', value)}
                  debounceMs={400}
                  sx={{ mt: 1.5 }}
                />

                {/* Image URL */}
                <DebouncedTextField
                  fullWidth
                  size="small"
                  label="Image URL"
                  value={product.imageUrl || ''}
                  onChange={(value) => updateProduct(product.id, 'imageUrl', value)}
                  debounceMs={400}
                  sx={{ mt: 1.5 }}
                  placeholder="Enter URL or search for image"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty state */}
      {editableProducts.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No products to preview. Please go back and upload files.
          </Typography>
        </Paper>
      )}

      {/* Import Results Dialog */}
      <Dialog
        open={showResultsDialog}
        onClose={handleResultsClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {importResults?.failed === 0 ? (
              <CheckCircle color="success" />
            ) : (
              <Warning color="warning" />
            )}
            Import Results
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {importResults && (
            <>
              <Box display="flex" gap={2} mb={2}>
                <Paper sx={{ p: 2, flex: 1, textAlign: 'center', bgcolor: 'success.50' }}>
                  <Typography variant="h4" color="success.main">
                    {importResults.successful}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Successful
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, flex: 1, textAlign: 'center', bgcolor: 'error.50' }}>
                  <Typography variant="h4" color="error.main">
                    {importResults.failed}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Failed
                  </Typography>
                </Paper>
              </Box>

              {importResults.errors.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Failed Products:
                  </Typography>
                  <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {importResults.errors.map((error, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <ErrorIcon color="error" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={error.product}
                          secondary={error.error}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {importResults && importResults.failed > 0 && (
            <Button
              onClick={retryFailedImports}
              startIcon={<Refresh />}
            >
              Retry Failed
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleResultsClose}
          >
            {importResults?.failed === 0 ? 'Done' : 'Close'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulkImportPreview;
