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
import { CreateVariantInput } from '@/lib/services/products/VariantService';

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

  // Load seller ID from sessionStorage if available (from receipt scan)
  useEffect(() => {
    const storedSellerId = sessionStorage.getItem('receiptScanSellerId');
    if (storedSellerId) {
      setSelectedSellerId(storedSellerId);
    }
  }, []);

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

      // Step 1: Create any new categories/subcategories that were suggested by AI
      // This happens ONLY during submission, not during extraction
      const newCategoriesCreated: string[] = [];
      const newSubcategoriesCreated: string[] = [];

      for (const product of editedProducts) {
        // Create new category if needed
        if (product.category && product.categoryIsNew) {
          try {
            const result = await adminQueries.createCategory(product.category);
            if (result.success) {
              newCategoriesCreated.push(product.category);
              console.log(`✅ Created new category: ${product.category}`);
            }
          } catch (catError) {
            // Category might already exist, that's fine
            console.warn(`⚠️ Could not create category ${product.category}:`, catError);
          }
        }

        // Create new subcategory if needed
        if (product.subcategory && product.subcategoryIsNew && product.category) {
          try {
            // First, get the category ID
            const categoriesData = await adminQueries.getCategories();
            const cat = categoriesData?.categories?.find((c: any) =>
              c.name.toLowerCase() === product.category?.toLowerCase()
            );

            if (cat) {
              const result = await adminQueries.createSubcategory(product.subcategory, cat.id);
              if (result.success) {
                newSubcategoriesCreated.push(product.subcategory);
                console.log(`✅ Created new subcategory: ${product.subcategory} under ${product.category}`);
              }
            }
          } catch (subError) {
            // Subcategory might already exist, that's fine
            console.warn(`⚠️ Could not create subcategory ${product.subcategory}:`, subError);
          }
        }
      }

      if (newCategoriesCreated.length > 0 || newSubcategoriesCreated.length > 0) {
        console.log(`📂 Created ${newCategoriesCreated.length} new categories and ${newSubcategoriesCreated.length} new subcategories`);
      }

      // Step 2: Check for duplicates
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

      // Step 3: Load existing products from seller inventory for AI matching
      let existingProducts: any[] = [];
      try {
        const existingProductsResponse = await adminQueries.getProducts({
          seller_id: selectedSellerId,
          limit: 1000, // Get all products for this seller
        });
        existingProducts = existingProductsResponse?.products || [];
        console.log(`📦 Loaded ${existingProducts.length} existing products for seller ${selectedSellerId}`);
      } catch (error) {
        console.error('Error loading existing products:', error);
      }

      // Step 4: Group products by variantGroupTag
      const { VariantService } = await import('@/lib/services/products/VariantService');

      const groupedProducts = new Map<number | string, typeof productsToAdd>();
      const standaloneProducts: typeof productsToAdd = [];

      productsToAdd.forEach(product => {
        const variantTag = (product as any).variantGroupTag;
        if (variantTag && typeof variantTag === 'number' && variantTag > 0) {
          const key = `group_${variantTag}`;
          if (!groupedProducts.has(key)) {
            groupedProducts.set(key, []);
          }
          groupedProducts.get(key)!.push(product);
        } else {
          standaloneProducts.push(product);
        }
      });

      console.log(`📊 Grouping: ${groupedProducts.size} groups, ${standaloneProducts.length} standalone products`);

      // Step 5: Create grouped products as separate products linked by variant_group_id
      // Each variant becomes a separate product card, but they're linked for variant switching
      const groupedPromises: Promise<any>[] = [];

      groupedProducts.forEach((groupProducts, groupKey) => {
        if (groupProducts.length > 1) {
          // Multiple products with same tag - create separate products linked by variant_group_id
          const firstProduct = groupProducts[0];

          // Generate a unique variant_group_id for this group
          // Helper function to generate UUID
          const generateUUID = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
              return crypto.randomUUID();
            }
            // Fallback UUID v4 generator
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = Math.random() * 16 | 0;
              const v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
          };
          const variantGroupId = generateUUID();

          // Extract base name for matching
          const baseName = firstProduct.name.split(/\s+(250ml|500ml|750ml|1l|1 liter|250g|500g|1kg|small|medium|large|red|blue|black|white)/i)[0].trim() || firstProduct.name;

          // Check if any existing products match this base name (for linking to existing variant groups)
          const matchedProduct = existingProducts.find(ep => {
            const epName = ep.name.toLowerCase();
            const baseNameLower = baseName.toLowerCase();
            return epName.includes(baseNameLower) || baseNameLower.includes(epName) ||
              epName.split(/\s+/)[0] === baseNameLower.split(/\s+/)[0];
          });

          // If we found a matching product, check if it has a variant_group_id
          let existingVariantGroupId: string | null = null;
          if (matchedProduct && (matchedProduct as any).variant_group_id) {
            existingVariantGroupId = (matchedProduct as any).variant_group_id;
            console.log(`✅ Found existing variant group: ${existingVariantGroupId} for "${matchedProduct.name}"`);
          }

          const groupedPromise = (async () => {
            // Use existing variant_group_id if found, otherwise use the new one
            const finalVariantGroupId = existingVariantGroupId || variantGroupId;

            // Create a separate product for each variant
            const createdProducts: any[] = [];

            for (const p of groupProducts) {
              // Check if this exact product already exists
              const existingExactMatch = existingProducts.find(ep =>
                ep.name.toLowerCase() === p.name.toLowerCase() &&
                ep.seller_id === selectedSellerId
              );

              if (existingExactMatch) {
                // Update existing product to link it to the variant group
                try {
                  const { getAdminSupabaseClient } = await import('@/lib/supabase-admin');
                  const supabase = getAdminSupabaseClient();

                  await supabase
                    .from('products')
                    .update({ variant_group_id: finalVariantGroupId })
                    .eq('id', existingExactMatch.id);

                  createdProducts.push({
                    id: existingExactMatch.id,
                    name: p.name,
                    isExisting: true,
                    product: p // Keep reference for variant creation
                  });
                  console.log(`✅ Linked existing product "${p.name}" to variant group ${finalVariantGroupId}`);
                } catch (error) {
                  console.error(`Error linking existing product "${p.name}":`, error);
                }
                continue;
              }

              // Create new product for this variant
              const productData = {
                name: p.name, // Full name with variant (e.g., "Coca Cola 250ml")
                brand: p.brand || firstProduct.brand || '',
                description: p.description || p.name || 'Product extracted from receipt',
                price: p.unitPrice || (p.netAmount / p.quantity) || 0,
                category: p.category || firstProduct.category || category || '',
                subcategory: p.subcategory || firstProduct.subcategory || subcategory || '',
                seller_id: selectedSellerId,
                stock_available: p.stockAvailable ?? p.quantity ?? 100,
                unit: p.unit || firstProduct.unit || 'piece',
                min_order_quantity: p.minOrderQuantity || firstProduct.minOrderQuantity || 1,
                images: p.imageUrl ? [p.imageUrl] : (firstProduct.imageUrl ? [firstProduct.imageUrl] : []),
                status: 'available',
                variant_group_id: finalVariantGroupId, // Link all variants together
              };

              const createdProduct = await adminQueries.addProduct(productData);
              if (createdProduct?.id) {
                createdProducts.push({
                  id: createdProduct.id,
                  name: p.name,
                  isExisting: false,
                  product: p // Keep reference to original product data for variant creation
                });
                console.log(`✅ Created variant product: "${p.name}" (ID: ${createdProduct.id}, Group: ${finalVariantGroupId})`);
              } else {
                console.error(`Failed to create product "${p.name}"`);
              }
            }

            // Now create entries in product_variants table to link all variants together
            // Use the first product as the "base" product for product_variants.product_id
            if (createdProducts.length > 0) {
              try {
                const { getAdminSupabaseClient } = await import('@/lib/supabase-admin');
                const supabase = getAdminSupabaseClient();
                const { VariantService } = await import('@/lib/services/products/VariantService');

                // Check if there's an existing base product for this variant group
                // (if we linked to an existing variant group, there might already be a base product)
                let baseProductId: string;
                let baseName: string;

                if (existingVariantGroupId && matchedProduct) {
                  // Use the matched product as base if it exists
                  baseProductId = matchedProduct.id;
                  baseName = matchedProduct.name.split(/\s+(250ml|500ml|750ml|1l|1 liter|250g|500g|1kg|small|medium|large|red|blue|black|white)/i)[0].trim() || matchedProduct.name;
                } else {
                  // Designate first product as base product
                  const baseProduct = createdProducts[0];
                  baseProductId = baseProduct.id;
                  baseName = baseProduct.name.split(/\s+(250ml|500ml|750ml|1l|1 liter|250g|500g|1kg|small|medium|large|red|blue|black|white)/i)[0].trim() || baseProduct.name;
                }

                // Check for existing variants to avoid duplicates
                const { data: existingVariants, error: existingVariantsError } = await supabase
                  .from('product_variants')
                  .select('variant_product_id, variant_type, variant_value')
                  .eq('product_id', baseProductId);

                if (existingVariantsError) {
                  console.warn('Error checking existing variants:', existingVariantsError);
                  // Continue anyway - we'll try to insert and let the database handle duplicates
                }

                const existingVariantProductIds = new Set(
                  (existingVariants || []).map((v: any) => v.variant_product_id).filter(Boolean)
                );
                const existingVariantKeys = new Set(
                  (existingVariants || []).map((v: any) => `${v.variant_type}_${v.variant_value}`)
                );

                // Create variant entries for each product
                const variantsToCreate: any[] = [];

                for (let i = 0; i < createdProducts.length; i++) {
                  const variantProduct = createdProducts[i];

                  // Skip if variant entry already exists for this product
                  if (existingVariantProductIds.has(variantProduct.id)) {
                    console.log(`⏭️  Skipping variant entry for "${variantProduct.name}" - already exists`);
                    continue;
                  }

                  const variantProductData = variantProduct.product || groupProducts[i];

                  // Extract variant info from product name
                  let variantType: 'size' | 'flavor' | 'color' | 'weight' | 'pack' = 'size';
                  let variantValue = variantProduct.name.replace(baseName, '').trim();

                  // Try to detect variant type
                  if (/ml|l|liter/i.test(variantValue)) {
                    variantType = 'size';
                  } else if (/g|kg|gram|kilogram/i.test(variantValue)) {
                    variantType = 'weight';
                  } else if (/red|blue|black|white|green|yellow|pink|purple/i.test(variantValue)) {
                    variantType = 'color';
                  } else if (/chocolate|vanilla|strawberry|mint|orange/i.test(variantValue)) {
                    variantType = 'flavor';
                  } else if (/pack|box|bottle/i.test(variantValue)) {
                    variantType = 'pack';
                  }

                  // If variant value is empty, use a default
                  if (!variantValue || variantValue.length < 2) {
                    variantValue = `${variantType}_${i + 1}`;
                  }

                  // Check if this variant type/value combination already exists
                  const variantKey = `${variantType}_${variantValue}`;
                  if (existingVariantKeys.has(variantKey)) {
                    console.log(`⏭️  Skipping variant entry "${variantKey}" - already exists`);
                    continue;
                  }

                  // Create variant entry in product_variants table
                  const variantEntry: any = {
                    product_id: baseProductId, // Base product ID
                    sku: VariantService.generateSKU(baseName, variantType, variantValue),
                    variant_type: variantType,
                    variant_value: variantValue,
                    price: variantProductData.unitPrice || (variantProductData.netAmount / variantProductData.quantity) || 0,
                    stock_quantity: variantProductData.stockAvailable ?? variantProductData.quantity ?? 100,
                    is_default: variantsToCreate.length === 0 && i === 0, // First variant is default (only if no existing variants)
                    display_order: (existingVariants?.length || 0) + variantsToCreate.length,
                    is_active: true,
                  };

                  // Add variant_product_id if column exists (from migration)
                  // This links the variant entry to the actual variant product
                  variantEntry.variant_product_id = variantProduct.id;

                  variantsToCreate.push(variantEntry);
                }

                // Insert all variant entries
                if (variantsToCreate.length > 0) {
                  console.log(`📝 Attempting to insert ${variantsToCreate.length} variant entries into product_variants table...`);
                  console.log('Variant entries to create:', JSON.stringify(variantsToCreate, null, 2));

                  const { data: insertedVariants, error: variantError } = await supabase
                    .from('product_variants')
                    .insert(variantsToCreate)
                    .select();

                  if (variantError) {
                    console.error('❌ Error creating product_variants entries:', variantError);
                    console.error('Error code:', variantError.code);
                    console.error('Error message:', variantError.message);
                    console.error('Error details:', JSON.stringify(variantError, null, 2));

                    // If error is about missing column, try without variant_product_id
                    if (variantError.message?.includes('variant_product_id') || variantError.code === '42703') {
                      console.log('⚠️  variant_product_id column may not exist, trying without it...');
                      const variantsWithoutProductId = variantsToCreate.map((v: any) => {
                        const { variant_product_id, ...rest } = v;
                        return rest;
                      });

                      const { data: retryInserted, error: retryError } = await supabase
                        .from('product_variants')
                        .insert(variantsWithoutProductId)
                        .select();

                      if (retryError) {
                        console.error('❌ Retry also failed:', retryError);
                        toast.error(`Products created but variant links failed: ${retryError.message}`);
                      } else {
                        console.log(`✅ Created ${retryInserted?.length || variantsToCreate.length} variant entries (without variant_product_id)`);
                        toast.success(`Created ${retryInserted?.length || variantsToCreate.length} variant link(s)`);
                      }
                    } else {
                      toast.error(`Products created but variant links failed: ${variantError.message}`);
                    }
                  } else {
                    console.log(`✅ Successfully created ${insertedVariants?.length || variantsToCreate.length} variant entries in product_variants table`);
                    console.log('Inserted variants:', JSON.stringify(insertedVariants, null, 2));
                    toast.success(`Created ${insertedVariants?.length || variantsToCreate.length} variant link(s) in product_variants table`);
                  }
                } else {
                  console.log('⚠️  No variant entries to create (all may have been skipped as duplicates)');
                }
              } catch (variantError) {
                console.error('❌ Exception creating product_variants entries:', variantError);
                console.error('Exception details:', variantError);
                toast.error(`Error creating variant links: ${variantError instanceof Error ? variantError.message : 'Unknown error'}`);
                // Don't fail the entire operation if variant linking fails
              }
            }

            return {
              variantGroupId: finalVariantGroupId,
              productsCreated: createdProducts.length,
              productIds: createdProducts.map(p => p.id)
            };
          })();

          groupedPromises.push(groupedPromise);
        } else {
          // Only one product in group - treat as standalone
          standaloneProducts.push(groupProducts[0]);
        }
      });

      // Step 6: Create standalone products (no grouping or manual variants)
      const standalonePromises = standaloneProducts.map(async (product) => {
        // Check if this product matches an existing product (for variant addition)
        const baseName = product.name.split(/\s+(250ml|500ml|750ml|1l|1 liter|250g|500g|1kg|small|medium|large|red|blue|black|white)/i)[0].trim() || product.name;

        const matchedProduct = existingProducts.find(ep => {
          const epName = ep.name.toLowerCase();
          const baseNameLower = baseName.toLowerCase();
          return epName.includes(baseNameLower) || baseNameLower.includes(epName) ||
            epName.split(/\s+/)[0] === baseNameLower.split(/\s+/)[0];
        });

        // If product has manual variants, create as new product with variants
        if ((product as any).variants && Array.isArray((product as any).variants) && (product as any).variants.length > 0) {
          const productData = {
            name: product.name,
            brand: product.brand || '',
            description: product.description || product.name || 'Product extracted from receipt',
            price: product.unitPrice || (product.netAmount / product.quantity) || 0,
            category: product.category || category || '',
            subcategory: product.subcategory || subcategory || '',
            seller_id: selectedSellerId,
            stock_available: 0, // Stock managed at variant level
            unit: product.unit || 'piece',
            min_order_quantity: product.minOrderQuantity || 1,
            images: product.imageUrl ? [product.imageUrl] : [],
            status: 'available'
          };

          const createdProduct = await adminQueries.addProduct(productData);

          if (createdProduct?.id) {
            try {
              const variantsWithProductId = (product as any).variants.map((v: CreateVariantInput) => ({
                ...v,
                product_id: createdProduct.id,
              }));
              await VariantService.createVariants(variantsWithProductId);
            } catch (variantError) {
              console.error('Error creating variants:', variantError);
            }
          }

          return createdProduct;
        }

        // If matches existing product, create as new product but link to same variant group
        let variantGroupIdToUse: string | undefined = undefined;
        if (matchedProduct && (matchedProduct as any).variant_group_id) {
          // Link to existing variant group
          variantGroupIdToUse = (matchedProduct as any).variant_group_id;
          console.log(`✅ Linking new product "${product.name}" to existing variant group: ${variantGroupIdToUse}`);
        } else if (matchedProduct) {
          // Create new variant group for matched product and this new one
          const generateUUID = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
              return crypto.randomUUID();
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = Math.random() * 16 | 0;
              const v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
          };
          variantGroupIdToUse = generateUUID();

          // Update the matched product to have this variant_group_id
          try {
            const { getAdminSupabaseClient } = await import('@/lib/supabase-admin');
            const supabase = getAdminSupabaseClient();
            await supabase
              .from('products')
              .update({ variant_group_id: variantGroupIdToUse })
              .eq('id', matchedProduct.id);
            console.log(`✅ Created variant group ${variantGroupIdToUse} and linked "${matchedProduct.name}"`);
          } catch (error) {
            console.error('Error linking matched product to variant group:', error);
          }
        }

        // Create as new standalone product (or variant product if linked)
        const productData = {
          name: product.name,
          brand: product.brand || '',
          description: product.description || product.name || 'Product extracted from receipt',
          price: product.unitPrice || (product.netAmount / product.quantity) || 0,
          category: product.category || category || '',
          subcategory: product.subcategory || subcategory || '',
          seller_id: selectedSellerId,
          stock_available: product.stockAvailable ?? 100,
          unit: product.unit || 'piece',
          min_order_quantity: product.minOrderQuantity || 1,
          images: product.imageUrl ? [product.imageUrl] : [],
          status: 'available',
          variant_group_id: variantGroupIdToUse, // Link to variant group if applicable
        };

        return adminQueries.addProduct(productData);
      });

      // Execute all promises
      const allPromises = [...groupedPromises, ...standalonePromises];
      const results = await Promise.all(allPromises);

      const totalProductsCreated = results.filter(r => r && r.id).length;
      toast.success(`Successfully added ${totalProductsCreated} product(s) to inventory!`);

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

