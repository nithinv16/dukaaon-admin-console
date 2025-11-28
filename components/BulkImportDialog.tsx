import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  Image as ImageIcon,
  TableChart,
  Delete,
  CheckCircle,
  Error as ErrorIcon,
  Close,
  AutoAwesome,
  Warning
} from '@mui/icons-material';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

export interface ParsedProduct {
  name: string;
  price: number;
  min_order_quantity: number;
  description?: string;
  category?: string;
  subcategory?: string;
  imageUrl?: string;
  stock_level: number;
  brand?: string;
  unit?: string;
  // AI extraction metadata
  confidence?: {
    name: number;
    price: number;
    quantity: number;
    brand: number;
    overall: number;
  };
  needsReview?: boolean;
  aiExtracted?: boolean;
}

export type ImageType = 'receipt' | 'product_list' | 'name_only_list' | 'invoice' | 'unknown';

export interface AIExtractionMetadata {
  imageType: ImageType;
  overallConfidence: number;
  usedFallback: boolean;
  rawText?: string;
}

export interface ImportResult {
  successful: number;
  failed: number;
  errors: Array<{ product: string; error: string }>;
}

interface BulkImportDialogProps {
  open: boolean;
  onClose: () => void;
  sellerId: string;
  onProductsParsed: (products: ParsedProduct[]) => void;
}

type FileType = 'csv' | 'excel' | 'image' | 'unknown';

interface UploadedFile {
  file: File;
  type: FileType;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  products?: ParsedProduct[];
  // AI extraction metadata for images
  aiMetadata?: AIExtractionMetadata;
}

const getFileType = (file: File): FileType => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (extension === 'csv' || mimeType === 'text/csv') {
    return 'csv';
  }
  if (extension === 'xlsx' || extension === 'xls' || 
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel') {
    return 'excel';
  }
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
    return 'image';
  }
  return 'unknown';
};

const getFileIcon = (type: FileType) => {
  switch (type) {
    case 'csv':
    case 'excel':
      return <TableChart color="primary" />;
    case 'image':
      return <ImageIcon color="secondary" />;
    default:
      return <InsertDriveFile />;
  }
};

/**
 * Parse CSV file and extract products
 * Requirements: 3.3 - Parse columns for product name, price, and min order quantity
 */
export const parseCSVFile = (file: File): Promise<ParsedProduct[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => {
        try {
          const products: ParsedProduct[] = [];
          const data = results.data as Record<string, string>[];

          for (const row of data) {
            // Map various column name formats
            const name = row['product_name'] || row['name'] || row['item'] || row['product'] || '';
            const priceStr = row['price'] || row['unit_price'] || row['cost'] || row['amount'] || '0';
            const qtyStr = row['min_order_quantity'] || row['min_qty'] || row['quantity'] || row['qty'] || '1';
            const description = row['description'] || row['desc'] || '';

            if (name.trim()) {
              const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
              const min_order_quantity = parseInt(qtyStr.replace(/[^0-9]/g, ''), 10) || 1;

              products.push({
                name: name.trim(),
                price,
                min_order_quantity,
                description: description.trim(),
                stock_level: 100 // Default stock level as per requirements
              });
            }
          }

          if (products.length === 0) {
            reject(new Error('No valid products found in CSV file. Ensure columns include: product_name, price, min_order_quantity'));
          } else {
            resolve(products);
          }
        } catch (error) {
          reject(new Error('Failed to parse CSV file: ' + (error instanceof Error ? error.message : 'Unknown error')));
        }
      },
      error: (error) => {
        reject(new Error('Failed to read CSV file: ' + error.message));
      }
    });
  });
};

/**
 * Parse Excel file and extract products
 * Requirements: 3.3 - Parse columns for product name, price, and min order quantity
 */
export const parseExcelFile = (file: File): Promise<ParsedProduct[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { 
          raw: false,
          defval: ''
        });

        const products: ParsedProduct[] = [];

        for (const row of jsonData) {
          // Normalize keys to lowercase with underscores
          const normalizedRow: Record<string, string> = {};
          for (const key of Object.keys(row)) {
            normalizedRow[key.trim().toLowerCase().replace(/\s+/g, '_')] = String(row[key]);
          }

          // Map various column name formats
          const name = normalizedRow['product_name'] || normalizedRow['name'] || normalizedRow['item'] || normalizedRow['product'] || '';
          const priceStr = normalizedRow['price'] || normalizedRow['unit_price'] || normalizedRow['cost'] || normalizedRow['amount'] || '0';
          const qtyStr = normalizedRow['min_order_quantity'] || normalizedRow['min_qty'] || normalizedRow['quantity'] || normalizedRow['qty'] || '1';
          const description = normalizedRow['description'] || normalizedRow['desc'] || '';

          if (name.trim()) {
            const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
            const min_order_quantity = parseInt(qtyStr.replace(/[^0-9]/g, ''), 10) || 1;

            products.push({
              name: name.trim(),
              price,
              min_order_quantity,
              description: description.trim(),
              stock_level: 100 // Default stock level as per requirements
            });
          }
        }

        if (products.length === 0) {
          reject(new Error('No valid products found in Excel file. Ensure columns include: product_name, price, min_order_quantity'));
        } else {
          resolve(products);
        }
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + (error instanceof Error ? error.message : 'Unknown error')));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parse image file using AI-enhanced extraction (AWS Textract + AWS Bedrock)
 * Requirements: 1.1, 1.2, 1.3 - Use AWS Textract OCR combined with AWS Bedrock AI for intelligent parsing
 * Requirements: 2.1, 2.2 - AI-based category tagging
 * Requirements: 4.1, 4.2 - AI-based brand identification
 */
export const parseImageFile = async (file: File): Promise<{ products: ParsedProduct[]; metadata: AIExtractionMetadata }> => {
  // Convert file to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    // Try AI-enhanced extraction first (Textract + Bedrock)
    const { extractFromImage, matchProductsWithMasterData } = await import('../lib/aiExtractionService');
    
    const result = await extractFromImage(buffer);

    if (!result.success) {
      throw new Error(result.error || 'AI extraction failed');
    }

    // Enrich products with master product data if available
    const enrichedProducts = await matchProductsWithMasterData(result.products);

    let products: ParsedProduct[] = enrichedProducts.map(p => ({
      name: p.name,
      price: p.price,
      min_order_quantity: p.quantity || 1,
      description: p.masterProductMatch?.description || '',
      category: p.category,
      subcategory: p.subcategory,
      brand: p.brand || p.masterProductMatch?.brand,
      unit: p.unit,
      stock_level: 100, // Default stock level as per requirements
      confidence: p.confidence,
      needsReview: p.needsReview,
      aiExtracted: true
    }));

    if (products.length === 0) {
      throw new Error('No products could be extracted from the image. Try a clearer image or use CSV/Excel format.');
    }

    // Call AI Brand Identification API (Requirements 4.1, 4.2)
    try {
      console.log('Calling AI brand identification for', products.length, 'products...');
      const brandResponse = await fetch('/api/admin/ai-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: products.map(p => ({ name: p.name }))
        })
      });

      if (brandResponse.ok) {
        const brandResult = await brandResponse.json();
        if (brandResult.success && brandResult.data?.results) {
          // Update products with identified brands
          products = products.map((p, index) => {
            const brandInfo = brandResult.data.results.find(
              (r: any) => r.productName.toLowerCase() === p.name.toLowerCase()
            ) || brandResult.data.results[index];
            
            if (brandInfo?.identifiedBrand) {
              return {
                ...p,
                brand: brandInfo.identifiedBrand,
                confidence: p.confidence ? {
                  ...p.confidence,
                  brand: brandInfo.confidence
                } : undefined
              };
            }
            return p;
          });
          console.log('Brand identification complete');
        }
      }
    } catch (brandError) {
      console.warn('Brand identification failed, continuing without brands:', brandError);
    }

    // Call AI Categorization API (Requirements 2.1, 2.2)
    try {
      console.log('Calling AI categorization for', products.length, 'products...');
      const categorizeResponse = await fetch('/api/admin/ai-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: products.map(p => ({
            name: p.name,
            price: p.price,
            brand: p.brand
          })),
          batch: true
        })
      });

      if (categorizeResponse.ok) {
        const categorizeResult = await categorizeResponse.json();
        if (categorizeResult.success && categorizeResult.data?.products) {
          // Update products with AI-suggested categories
          products = products.map((p, index) => {
            const catProduct = categorizeResult.data.products.find(
              (cp: any) => cp.name.toLowerCase() === p.name.toLowerCase()
            ) || categorizeResult.data.products[index];
            
            if (catProduct) {
              return {
                ...p,
                category: catProduct.selectedCategory || catProduct.category || p.category,
                subcategory: catProduct.selectedSubcategory || catProduct.subcategory || p.subcategory
              };
            }
            return p;
          });
          console.log('Categorization complete');
        }
      }
    } catch (catError) {
      console.warn('Categorization failed, continuing without categories:', catError);
    }

    const metadata: AIExtractionMetadata = {
      imageType: result.imageType,
      overallConfidence: result.confidence,
      usedFallback: result.usedFallback,
      rawText: result.rawText
    };

    return { products, metadata };
  } catch (aiError) {
    // Fallback to rule-based extraction if AI fails
    console.warn('AI extraction failed, falling back to rule-based extraction:', aiError);
    
    const { processReceiptImageAWS, validateAWSConfig } = await import('../lib/awsTextract');

    if (!validateAWSConfig()) {
      throw new Error('AWS Textract is not configured. Please check your AWS credentials.');
    }

    const result = await processReceiptImageAWS(buffer);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to extract products from image');
    }

    const products: ParsedProduct[] = result.data.products.map(p => ({
      name: p.name,
      price: p.price,
      min_order_quantity: p.quantity || 1,
      description: '',
      stock_level: 100,
      aiExtracted: false,
      needsReview: true // Mark all fallback products for review
    }));

    if (products.length === 0) {
      throw new Error('No products could be extracted from the image. Try a clearer image or use CSV/Excel format.');
    }

    const metadata: AIExtractionMetadata = {
      imageType: 'unknown',
      overallConfidence: result.data.confidence || 0.5,
      usedFallback: true
    };

    return { products, metadata };
  }
};

const BulkImportDialog: React.FC<BulkImportDialogProps> = ({
  open,
  onClose,
  sellerId,
  onProductsParsed
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const addFiles = (files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => {
      const type = getFileType(file);
      return {
        file,
        type,
        status: type === 'unknown' ? 'error' : 'pending',
        error: type === 'unknown' ? 'Unsupported file type. Use CSV, Excel, or image files.' : undefined
      };
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please upload at least one file');
      return;
    }

    setIsProcessing(true);
    const allProducts: ParsedProduct[] = [];
    const updatedFiles = [...uploadedFiles];
    let aiExtractedCount = 0;
    let needsReviewCount = 0;

    for (let i = 0; i < updatedFiles.length; i++) {
      const uploadedFile = updatedFiles[i];
      
      if (uploadedFile.status === 'error') continue;

      updatedFiles[i] = { ...uploadedFile, status: 'processing' };
      setUploadedFiles([...updatedFiles]);

      try {
        let products: ParsedProduct[] = [];
        let aiMetadata: AIExtractionMetadata | undefined;

        switch (uploadedFile.type) {
          case 'csv':
            products = await parseCSVFile(uploadedFile.file);
            break;
          case 'excel':
            products = await parseExcelFile(uploadedFile.file);
            break;
          case 'image':
            const imageResult = await parseImageFile(uploadedFile.file);
            products = imageResult.products;
            aiMetadata = imageResult.metadata;
            
            // Count AI-extracted and needs-review products
            products.forEach(p => {
              if (p.aiExtracted) aiExtractedCount++;
              if (p.needsReview) needsReviewCount++;
            });
            break;
        }

        updatedFiles[i] = { 
          ...uploadedFile, 
          status: 'success', 
          products,
          aiMetadata
        };
        allProducts.push(...products);
      } catch (error) {
        updatedFiles[i] = { 
          ...uploadedFile, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }

      setUploadedFiles([...updatedFiles]);
    }

    setIsProcessing(false);

    if (allProducts.length > 0) {
      // Show detailed success message for AI extraction
      const successCount = updatedFiles.filter(f => f.status === 'success').length;
      let message = `Extracted ${allProducts.length} products from ${successCount} file(s)`;
      
      if (aiExtractedCount > 0) {
        message += ` (${aiExtractedCount} AI-enhanced)`;
      }
      
      toast.success(message);
      
      // Show warning if products need review
      if (needsReviewCount > 0) {
        toast(`${needsReviewCount} product(s) flagged for review due to low confidence`, {
          icon: '⚠️',
          duration: 5000
        });
      }
      
      onProductsParsed(allProducts);
    } else {
      toast.error('No products could be extracted from the uploaded files');
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setUploadedFiles([]);
      onClose();
    }
  };

  const pendingFiles = uploadedFiles.filter(f => f.status === 'pending');
  const hasValidFiles = pendingFiles.length > 0 || uploadedFiles.some(f => f.status === 'success');

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ sx: { minHeight: 400 } }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Bulk Import Products</Typography>
          <IconButton onClick={handleClose} disabled={isProcessing} size="small">
            <Close />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Upload Excel, CSV, or image files to import products
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {/* Drop Zone */}
        <Paper
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            p: 4,
            mb: 3,
            border: '2px dashed',
            borderColor: isDragging ? 'primary.main' : 'grey.300',
            bgcolor: isDragging ? 'primary.50' : 'grey.50',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'primary.50'
            }
          }}
        >
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <CloudUpload sx={{ fontSize: 48, color: isDragging ? 'primary.main' : 'grey.400' }} />
            <Typography variant="h6" color={isDragging ? 'primary.main' : 'text.secondary'}>
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              or click to browse
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center">
              <Chip label="CSV" size="small" variant="outlined" />
              <Chip label="Excel (.xlsx, .xls)" size="small" variant="outlined" />
              <Chip label="Images (JPG, PNG)" size="small" variant="outlined" />
            </Box>
          </Box>
        </Paper>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* File List */}
        {uploadedFiles.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Uploaded Files ({uploadedFiles.length})
            </Typography>
            <List dense>
              {uploadedFiles.map((uploadedFile, index) => (
                <ListItem
                  key={index}
                  sx={{
                    bgcolor: uploadedFile.status === 'error' ? 'error.50' : 
                             uploadedFile.status === 'success' ? 'success.50' : 'grey.50',
                    borderRadius: 1,
                    mb: 1
                  }}
                >
                  <ListItemIcon>
                    {getFileIcon(uploadedFile.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={uploadedFile.file.name}
                    secondary={
                      <Box component="span">
                        {uploadedFile.status === 'processing' && (
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress sx={{ width: 100, display: 'inline-block' }} />
                            <Typography variant="caption">Processing...</Typography>
                          </Box>
                        )}
                        {uploadedFile.status === 'success' && (
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                            <CheckCircle color="success" sx={{ fontSize: 16 }} />
                            <Typography variant="caption" color="success.main">
                              {uploadedFile.products?.length || 0} products extracted
                            </Typography>
                            {/* AI extraction metadata display */}
                            {uploadedFile.aiMetadata && (
                              <>
                                <Tooltip title={`Image type: ${uploadedFile.aiMetadata.imageType}`}>
                                  <Chip 
                                    icon={<AutoAwesome sx={{ fontSize: 12 }} />}
                                    label={uploadedFile.aiMetadata.imageType.replace('_', ' ')}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{ height: 18, fontSize: '0.65rem', ml: 0.5 }}
                                  />
                                </Tooltip>
                                <Tooltip title={`AI confidence: ${Math.round(uploadedFile.aiMetadata.overallConfidence * 100)}%`}>
                                  <Chip 
                                    label={`${Math.round(uploadedFile.aiMetadata.overallConfidence * 100)}%`}
                                    size="small"
                                    color={uploadedFile.aiMetadata.overallConfidence >= 0.7 ? 'success' : 'warning'}
                                    sx={{ height: 18, fontSize: '0.65rem' }}
                                  />
                                </Tooltip>
                                {uploadedFile.aiMetadata.usedFallback && (
                                  <Tooltip title="Used fallback extraction (AI unavailable)">
                                    <Warning color="warning" sx={{ fontSize: 14 }} />
                                  </Tooltip>
                                )}
                              </>
                            )}
                            {/* Show review needed indicator */}
                            {uploadedFile.products?.some(p => p.needsReview) && (
                              <Tooltip title={`${uploadedFile.products.filter(p => p.needsReview).length} product(s) need review`}>
                                <Chip 
                                  label="Review needed"
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.65rem' }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                        )}
                        {uploadedFile.status === 'error' && (
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <ErrorIcon color="error" sx={{ fontSize: 16 }} />
                            <Typography variant="caption" color="error.main">
                              {uploadedFile.error}
                            </Typography>
                          </Box>
                        )}
                        {uploadedFile.status === 'pending' && (
                          <Typography variant="caption" color="text.secondary">
                            Ready to process
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      onClick={() => removeFile(index)}
                      disabled={isProcessing}
                      size="small"
                    >
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Expected Format Info */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Expected CSV/Excel Format:</Typography>
          <Typography variant="body2" component="div">
            Columns: <code>product_name</code>, <code>price</code>, <code>min_order_quantity</code>
            <br />
            Optional: <code>description</code>
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={processFiles}
          disabled={!hasValidFiles || isProcessing}
          startIcon={isProcessing ? undefined : <CloudUpload />}
        >
          {isProcessing ? 'Processing...' : `Process ${pendingFiles.length} File(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkImportDialog;
