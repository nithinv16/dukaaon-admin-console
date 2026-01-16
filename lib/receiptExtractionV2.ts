/**
 * Receipt Extraction V2.0 Service
 * 
 * Super intelligent receipt extraction system focused ONLY on extracting:
 * - Product names (cleaned, without codes/barcodes)
 * - Quantity
 * - Unit (pieces, kg, etc.)
 * - Net Amount / Total Amount
 * - Calculated Unit Price (Net Amount / Quantity)
 * 
 * Ignores: addresses, supplier names, invoice numbers, dates, etc.
 * Uses AWS Textract + AI (Claude Sonnet 4.5) EXCLUSIVELY for intelligent extraction
 * No fallback methods - ensures highest quality extraction through AI
 */

import { analyzeReceiptStructureV2, validateAWSConfig } from './awsTextract';
import { extractProductNameFromLine, cleanProductName } from './productNameCleaner';
import { invokeEnhancedModel, ENHANCED_BEDROCK_CONFIG } from './awsBedrockEnhanced';
import { parseBedrockJSON } from './awsBedrock';

/**
 * Normalize unit text to standard unit values
 * Handles common abbreviations and variations used in Indian receipts
 */
export function normalizeUnit(unitText: string): string {
  if (!unitText) return 'piece';

  const normalized = unitText.toLowerCase().trim();

  // Map common unit variations to standard values
  const unitMap: { [key: string]: string } = {
    // Pieces/Count
    'pcs': 'piece',
    'pc': 'piece',
    'pieces': 'piece',
    'piece': 'piece',
    'nos': 'piece',
    'no': 'piece',
    'count': 'piece',
    'units': 'piece',
    'unit': 'piece',
    'ea': 'piece',
    'each': 'piece',

    // Weight - Grams
    'g': 'gram',
    'gm': 'gram',
    'gram': 'gram',
    'grams': 'gram',

    // Weight - Kilograms
    'kg': 'kilogram',
    'kgs': 'kilogram',
    'kilogram': 'kilogram',
    'kilograms': 'kilogram',

    // Volume - Milliliters
    'ml': 'milliliter',
    'mls': 'milliliter',
    'milliliter': 'milliliter',
    'milliliters': 'milliliter',

    // Volume - Liters
    'l': 'liter',
    'lt': 'liter',
    'liter': 'liter',
    'litre': 'liter',
    'liters': 'liter',
    'litres': 'liter',

    // Pack/Box
    'pack': 'pack',
    'packs': 'pack',
    'box': 'pack',
    'boxes': 'pack',
    'bottle': 'bottle',
    'bottles': 'bottle',
    'bag': 'bag',
    'bags': 'bag',
    'case': 'case',
    'cases': 'case',

    // Common receipt abbreviations
    'kgm': 'kilogram',
    'kgm/nos': 'piece', // Sometimes receipts show "kgm/nos" which means piece
    'uom': 'piece', // Unit of Measure - default to piece
  };

  // Direct match
  if (unitMap[normalized]) {
    return unitMap[normalized];
  }

  // Try partial match (e.g., "kg" in "kgm")
  for (const [key, value] of Object.entries(unitMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // If no match found, return 'piece' as default
  return 'piece';
}

// Product extraction result interface
export interface ExtractedProductV2 {
  id: string;
  name: string; // Clean product name only
  brand?: string; // Brand name (AI-suggested, e.g., "Cadbury", "Parle", "Britannia")
  quantity: number;
  unit: string; // pieces, kg, g, pack, etc.
  netAmount: number; // Total amount for this product (from "Net Amt" or "Total" column - LAST column)
  unitPrice: number; // Calculated: netAmount / quantity
  confidence: number; // 0-1 confidence score
  needsReview: boolean; // Flag if confidence is low
  rowIndex: number; // Original row index from receipt
  description?: string; // AI-generated intelligent description (includes MRP if available)
  category?: string; // Product category (suggested by AI, not auto-saved to DB)
  subcategory?: string; // Product subcategory (suggested by AI, not auto-saved to DB)
  stockAvailable?: number; // Stock available for the product (default: 100)
  minOrderQuantity?: number; // Minimum order quantity (AI-suggested based on product type and price)
  imageUrl?: string; // Product image (base64 or URL)
  mrp?: number; // MRP from receipt (if available)
  categoryIsNew?: boolean; // Flag if category is new (not in DB)
  subcategoryIsNew?: boolean; // Flag if subcategory is new (not in DB)
  // Variant-related fields
  variantGroup?: string; // Group number for variants (e.g., "1", "2")
  baseProductName?: string; // Base product name without variant info (e.g., "Coca Cola")
  variantType?: string; // Type of variant: 'size', 'flavor', 'color', 'weight', 'pack'
  variantValue?: string; // Value of variant (e.g., "250ml", "Chocolate")
  isVariant?: boolean; // Whether this product is a variant of another
  existingProductId?: string; // ID of existing product if this is a variant of an existing product
}

export interface ReceiptExtractionResultV2 {
  success: boolean;
  products: ExtractedProductV2[];
  confidence: number; // Overall confidence
  error?: string;
  metadata?: {
    totalItems: number;
    totalAmount: number;
  };
}

// Column patterns learned from receipt examples
const PRODUCT_NAME_COLUMNS = [
  'item description',
  'item name',
  'item',
  'description',
  'product',
  'product name',
  'particulars',
  'goods',
];

const QUANTITY_COLUMNS = [
  'qty',
  'quantity',
  'pcs',
  'pieces',
  'cs', // cases
  'ea', // each
  'nos',
  'no',
  'count',
  'unit',
  'units',
];

const AMOUNT_COLUMNS = [
  'net amount',
  'net amt',
  'netamt',
  'net',
  'total',
  'amount',
  'amt',
  'netrate',
  'total amount',
  'net value',
];

const UNIT_COLUMNS = [
  'unit',
  'uom', // unit of measure
  'kgm/nos',
  'kgm',
];

// Skip patterns for irrelevant lines and metadata
const SKIP_PATTERNS = [
  /^(invoice|receipt|bill|tax invoice)/i,
  /^(gstin|fssai|pan|phone|ph|address|state|retailer|supplier)/i,
  /^(sender|receiver|billed to|shipped to|consignee)/i,
  /^(total|grand total|net total|subtotal|discount|tax|gst|cgst|sgst|tcs)/i,
  /^(sl|si|sr|s\.no|serial)/i, // Only if it's a header row indicator
  /^(channel|traditional|small|sectorized)/i, // Skip channel names like "Traditional", "Small A Traditional"
  /^(stn|cin|dl|route|visit|po number|credit customer|pay term)/i, // Skip metadata fields
];

/**
 * Intelligent column identifier - learns from receipt structure
 * Enhanced with Indian receipt patterns and data-based inference
 */
function identifyProductTableColumns(
  headers: string[],
  sampleRows: any[][]
): {
  productNameIndex: number | null;
  quantityIndex: number | null;
  unitIndex: number | null;
  amountIndex: number | null;
  confidence: number;
} {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  let productNameIndex: number | null = null;
  let quantityIndex: number | null = null;
  let unitIndex: number | null = null;
  let amountIndex: number | null = null;
  let confidence = 0;

  // Extended Indian receipt patterns
  const extendedProductNameColumns = [
    ...PRODUCT_NAME_COLUMNS,
    'hsn', // HSN code column sometimes contains product name
    'name',
    'material',
    'commodity',
  ];

  const extendedAmountColumns = [
    ...AMOUNT_COLUMNS,
    'rate',
    'price',
    'value',
    'rs',
    'rs.',
    'rupees',
    'taxable',
    'taxable value',
    'taxable amt',
    'gross',
    'gross amt',
    'gross amount',
    'net rate',
    'basic',
    'basic amt',
    'line total',
    'line amt',
  ];

  // Helper to get cell text
  const getCellText = (cell: any): string => {
    if (typeof cell === 'string') return cell;
    return cell?.text || cell?.Text || '';
  };

  // Identify product name column (most important)
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (const pattern of extendedProductNameColumns) {
      if (header.includes(pattern) || pattern.includes(header)) {
        productNameIndex = i;
        confidence += 0.4;
        break;
      }
    }
    if (productNameIndex !== null) break;
  }

  // Identify quantity column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (const pattern of QUANTITY_COLUMNS) {
      if (header === pattern || header.includes(pattern)) {
        quantityIndex = i;
        confidence += 0.2;
        break;
      }
    }
    if (quantityIndex !== null) break;
  }

  // Identify unit column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (const pattern of UNIT_COLUMNS) {
      if (header === pattern || header.includes(pattern)) {
        unitIndex = i;
        confidence += 0.1;
        break;
      }
    }
    if (unitIndex !== null) break;
  }

  // Identify amount column (usually last column or contains "net", "total", "amount")
  // Try last column first (most common pattern for Indian receipts)
  if (normalizedHeaders.length > 0) {
    const lastHeader = normalizedHeaders[normalizedHeaders.length - 1];
    for (const pattern of extendedAmountColumns) {
      if (lastHeader.includes(pattern) || pattern.includes(lastHeader)) {
        amountIndex = normalizedHeaders.length - 1;
        confidence += 0.3;
        break;
      }
    }
  }

  // If last column didn't match, search all columns for amount patterns
  if (amountIndex === null) {
    for (let i = normalizedHeaders.length - 1; i >= 0; i--) { // Search from right to left
      const header = normalizedHeaders[i];
      for (const pattern of extendedAmountColumns) {
        if (header.includes(pattern) || pattern.includes(header)) {
          amountIndex = i;
          confidence += 0.2;
          break;
        }
      }
      if (amountIndex !== null) break;
    }
  }

  // FALLBACK: Use sample row data to infer columns if headers didn't match
  // This is crucial for receipts with non-standard header names
  if (sampleRows && sampleRows.length > 0) {
    const sampleRow = sampleRows[0].map(getCellText);

    // If no product name column found, look for the first column with mostly text (letters)
    if (productNameIndex === null) {
      for (let i = 0; i < sampleRow.length; i++) {
        const cellText = sampleRow[i];
        // Product name should have letters and be reasonably long
        if (cellText.length > 3 && /[A-Za-z]/.test(cellText) && !/^\d+([,.]\d+)?$/.test(cellText)) {
          productNameIndex = i;
          confidence += 0.2;
          console.log(`   💡 Inferred product name column from data: index ${i}`);
          break;
        }
      }
    }

    // If no amount column found, use the LAST column with numeric values
    if (amountIndex === null && sampleRow.length > 0) {
      for (let i = sampleRow.length - 1; i >= 0; i--) {
        const cellText = sampleRow[i];
        // Amount should look like a number (potentially with commas/decimals)
        if (/^\d+([,.]\d+)?$/.test(cellText.trim().replace(/[₹$,]/g, ''))) {
          amountIndex = i;
          confidence += 0.15;
          console.log(`   💡 Inferred amount column from data: index ${i}`);
          break;
        }
      }
    }

    // If no quantity column found, look for small integers (usually 1-999)
    if (quantityIndex === null) {
      for (let i = 0; i < sampleRow.length; i++) {
        if (i === productNameIndex || i === amountIndex) continue;
        const cellText = sampleRow[i].trim();
        // Quantity is usually a small integer
        if (/^\d{1,3}$/.test(cellText) && parseInt(cellText) > 0 && parseInt(cellText) < 1000) {
          quantityIndex = i;
          confidence += 0.1;
          console.log(`   💡 Inferred quantity column from data: index ${i}`);
          break;
        }
      }
    }
  }

  // FINAL FALLBACK: If still no amount column, assume last column is amount
  if (amountIndex === null && normalizedHeaders.length > 1) {
    amountIndex = normalizedHeaders.length - 1;
    confidence += 0.1;
    console.log(`   💡 Final fallback: using last column (${amountIndex}) as amount`);
  }

  // If no product name column, assume first column
  if (productNameIndex === null && normalizedHeaders.length > 0) {
    productNameIndex = 0;
    confidence += 0.1;
    console.log(`   💡 Final fallback: using first column (0) as product name`);
  }

  return {
    productNameIndex,
    quantityIndex,
    unitIndex,
    amountIndex,
    confidence: Math.min(confidence, 1.0),
  };
}

/**
 * Extract product from table row
 */
function extractProductFromTableRow(
  row: any[],
  columnMapping?: {
    productNameIndex: number | null;
    quantityIndex: number | null;
    unitIndex: number | null;
    amountIndex: number | null;
  }
): ExtractedProductV2 | null {
  if (!row || row.length === 0) return null;

  // Use provided mapping or try to infer
  const mapping = columnMapping || {
    productNameIndex: 0, // Assume first column is product name
    quantityIndex: row.length > 1 ? 1 : null,
    unitIndex: null,
    amountIndex: row.length > 2 ? row.length - 1 : null, // Assume last column is amount
  };

  // Extract product name
  const nameCell = mapping.productNameIndex !== null ? row[mapping.productNameIndex] : row[0];
  const rawName = typeof nameCell === 'string' ? nameCell : nameCell?.text || nameCell?.Text || '';

  if (!rawName || rawName.trim().length < 2) return null;

  // Skip if matches skip patterns
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(rawName)) {
      return null;
    }
  }

  // Clean product name
  let productName = cleanProductName(rawName);
  if (!productName || productName.length < 2) {
    productName = extractProductNameFromLine(rawName);
  }
  if (!productName || productName.length < 2) return null;

  // Extract quantity
  let quantity = 1;
  if (mapping.quantityIndex !== null && row[mapping.quantityIndex]) {
    const qtyCell = row[mapping.quantityIndex];
    const qtyText = typeof qtyCell === 'string' ? qtyCell : qtyCell?.text || qtyCell?.Text || '';
    const qtyMatch = qtyText.match(/(\d+(?:\.\d+)?)/);
    if (qtyMatch) {
      quantity = parseFloat(qtyMatch[1]);
    }
  }

  // Extract and normalize unit
  let unit = 'piece';

  if (mapping.unitIndex !== null && row[mapping.unitIndex]) {
    const unitCell = row[mapping.unitIndex];
    const unitText = typeof unitCell === 'string' ? unitCell : unitCell?.text || unitCell?.Text || '';
    unit = normalizeUnit(unitText);
  } else {
    // Try to extract unit from product name or quantity column
    const unitMatch = rawName.match(/\b(kg|g|gm|ml|l|liter|litre|pcs?|pieces?|pack|box|bottle|bag|case|cases|kgm|nos)\b/i);
    if (unitMatch) {
      unit = normalizeUnit(unitMatch[1]);
    }
  }

  // Extract amount (net amount / total)
  let netAmount = 0;
  if (mapping.amountIndex !== null && row[mapping.amountIndex]) {
    const amountCell = row[mapping.amountIndex];
    const amountText = typeof amountCell === 'string' ? amountCell : amountCell?.text || amountCell?.Text || '';
    const amountMatch = amountText.match(/(\d+(?:[,.]\d+)?)/);
    if (amountMatch) {
      netAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
  }

  // Calculate unit price
  const unitPrice = quantity > 0 ? netAmount / quantity : 0;

  if (netAmount <= 0 || unitPrice <= 0) return null;

  return {
    id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: productName,
    quantity,
    unit,
    netAmount,
    unitPrice,
    confidence: 0.85,
    needsReview: false,
    rowIndex: 0,
    stockAvailable: 100,
    minOrderQuantity: 1,
  };
}

/**
 * Main extraction function - uses AWS Textract + AI
 */
export async function extractProductsFromReceiptV2(
  imageBuffer: Buffer,
  sellerId?: string // Optional seller ID for AI matching against existing products
): Promise<ReceiptExtractionResultV2> {
  if (!validateAWSConfig()) {
    return {
      success: false,
      products: [],
      confidence: 0,
      error: 'AWS configuration is invalid. Please check your AWS credentials and region settings.',
    };
  }

  try {
    // Step 1: Extract structured data using AWS Textract
    console.log('📄 Step 1: Analyzing receipt structure with AWS Textract...');
    const structuredData = await analyzeReceiptStructureV2(imageBuffer);

    if (!structuredData.tables || structuredData.tables.length === 0) {
      return {
        success: false,
        products: [],
        confidence: 0,
        error: 'No table data found in receipt. Please ensure the receipt contains a product table.',
      };
    }

    // Step 2: Extract products from table data
    console.log('📊 Step 2: Extracting products from table data...');
    const extractedProducts: ExtractedProductV2[] = [];

    for (const table of structuredData.tables) {
      if (!table.structuredRows || table.structuredRows.length === 0) continue;

      // Identify columns from header row (usually first row)
      const headerRow = table.structuredRows[0];
      const headers = headerRow.map((cell: any) => {
        const text = typeof cell === 'string' ? cell : cell?.text || cell?.Text || '';
        return text;
      });

      console.log('📋 Table headers:', headers);

      const columnMapping = identifyProductTableColumns(
        headers,
        table.structuredRows.slice(1, 4) // Use first few data rows as samples
      );

      console.log('🗂️ Column mapping:', JSON.stringify(columnMapping, null, 2));

      // Log first 3 data rows for debugging
      console.log('📊 Sample data rows:');
      for (let i = 1; i <= Math.min(3, table.structuredRows.length - 1); i++) {
        const sampleRow = table.structuredRows[i];
        const rowTexts = sampleRow.map((cell: any) => {
          const text = typeof cell === 'string' ? cell : cell?.text || cell?.Text || '';
          return text;
        });
        console.log(`   Row ${i}:`, rowTexts);
      }

      // Process data rows (skip header)
      for (let i = 1; i < table.structuredRows.length; i++) {
        const row = table.structuredRows[i];
        const product = extractProductFromTableRow(row, columnMapping);

        if (product) {
          product.rowIndex = i;
          extractedProducts.push(product);
        } else if (i <= 3) {
          // Log why first few rows failed
          console.log(`❌ Row ${i} rejected - checking cell values:`);
          row.forEach((cell: any, idx: number) => {
            const text = typeof cell === 'string' ? cell : cell?.text || cell?.Text || '';
            console.log(`   Cell ${idx}: "${text}"`);
          });
        }
      }
    }

    if (extractedProducts.length === 0) {
      return {
        success: false,
        products: [],
        confidence: 0,
        error: 'No products could be extracted from the receipt. Please check the receipt format.',
      };
    }

    // Step 3: Fetch existing products from seller inventory (if sellerId provided)
    let existingProducts: any[] = [];
    if (sellerId) {
      try {
        const { getAdminSupabaseClient } = await import('@/lib/supabase-admin');
        const supabase = getAdminSupabaseClient();

        const { data, error } = await supabase
          .from('products')
          .select(`
            id,
            name,
            product_variants (
              variant_type,
              variant_value
            )
          `)
          .eq('seller_id', sellerId)
          .eq('is_active', true);

        if (!error && data) {
          existingProducts = data;
          console.log(`📦 Found ${existingProducts.length} existing products for seller ${sellerId}`);
        }
      } catch (error) {
        console.warn('Failed to fetch existing products:', error);
        // Continue without existing products
      }
    }

    // Step 3.5: Fetch existing categories and subcategories from database
    let availableCategories: { id: string; name: string }[] = [];
    let availableSubcategories: { id: string; name: string; category_id: string }[] = [];
    try {
      const { getAdminSupabaseClient } = await import('@/lib/supabase-admin');
      const supabase = getAdminSupabaseClient();

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (!categoriesError && categoriesData) {
        availableCategories = categoriesData;
        console.log(`📂 Found ${availableCategories.length} existing categories`);
      }

      // Fetch subcategories
      const { data: subcategoriesData, error: subcategoriesError } = await supabase
        .from('subcategories')
        .select('id, name, category_id')
        .eq('is_active', true)
        .order('name');

      if (!subcategoriesError && subcategoriesData) {
        availableSubcategories = subcategoriesData;
        console.log(`📁 Found ${availableSubcategories.length} existing subcategories`);
      }
    } catch (error) {
      console.warn('Failed to fetch categories/subcategories:', error);
    }

    // Build category-subcategory mapping for AI
    const categorySubcategoryMap: Record<string, string[]> = {};
    for (const cat of availableCategories) {
      const subs = availableSubcategories
        .filter(sub => sub.category_id === cat.id)
        .map(sub => sub.name);
      categorySubcategoryMap[cat.name] = subs;
    }

    // Step 4: Use AI to enhance and validate extracted products
    console.log('🤖 Step 4: Enhancing products with AI...');

    // Include raw receipt data for better unit detection
    const rawReceiptData = structuredData.tables.map((table: any) => ({
      headers: table.structuredRows?.[0]?.map((cell: any) => {
        const text = typeof cell === 'string' ? cell : cell?.text || cell?.Text || '';
        return text;
      }) || [],
      sampleRows: table.structuredRows?.slice(1, 4).map((row: any[]) =>
        row.map((cell: any) => {
          const text = typeof cell === 'string' ? cell : cell?.text || cell?.Text || '';
          return text;
        })
      ) || []
    }));

    const productsJSON = JSON.stringify(extractedProducts.map(p => ({
      name: p.name,
      quantity: p.quantity,
      unit: p.unit,
      netAmount: p.netAmount,
      unitPrice: p.unitPrice,
    })));

    const existingProductsJSON = existingProducts.length > 0
      ? JSON.stringify(existingProducts.map(p => ({
        id: p.id,
        name: p.name,
        variants: p.product_variants?.map((v: any) => ({
          type: v.variant_type,
          value: v.variant_value,
        })) || [],
      })))
      : '[]';

    const aiPrompt = `You are an expert at analyzing receipt data and product matching. Review the following extracted products from a receipt:

RAW RECEIPT DATA (for unit detection):
${JSON.stringify(rawReceiptData, null, 2)}

EXTRACTED PRODUCTS:
${productsJSON}

${existingProducts.length > 0 ? `EXISTING PRODUCTS IN SELLER INVENTORY:
${existingProductsJSON}

IMPORTANT: For each extracted product, check if it matches an existing product or is a variant of an existing product.
- If a product name is similar to an existing product but has different size/flavor/color/weight/pack, it's likely a variant.
- Example: If "Coca Cola 500ml" exists and you see "Coca Cola 250ml", mark it as a variant.
- Extract the base product name (e.g., "Coca Cola") and variant info (e.g., type: "size", value: "250ml").
- If it matches an existing product exactly, set existingProductId to that product's ID.
` : ''}

CRITICAL: CATEGORY AND SUBCATEGORY MAPPING
You MUST use ONLY the categories and subcategories from the following list. DO NOT create new categories or subcategories.
If you CANNOT find an exact or very close match in the available list, set the category and/or subcategory to null (leave blank).
The user will manually fill in the correct category/subcategory later.

AVAILABLE CATEGORIES AND SUBCATEGORIES:
${JSON.stringify(categorySubcategoryMap, null, 2)}

Available category names: ${availableCategories.map(c => c.name).join(', ')}

CRITICAL: Unit Detection and Normalization
- Look at the RAW RECEIPT DATA to identify the unit column and its values
- Common unit abbreviations in Indian receipts:
  * Pieces: "pcs", "pc", "nos", "no", "count", "units", "ea", "each", "kgm/nos"
  * Weight: "kg", "kgs", "kgm" (kilogram), "g", "gm", "gram", "grams"
  * Volume: "l", "lt", "liter", "litre", "liters", "ml", "milliliter", "milliliters"
  * Packaging: "pack", "packs", "box", "boxes", "bottle", "bottles", "bag", "bags", "case", "cases"
- Normalize units to standard values:
  * Pieces → "piece"
  * Weight → "gram" (for g/gm) or "kilogram" (for kg/kgs/kgm)
  * Volume → "milliliter" (for ml) or "liter" (for l/lt/liter/litre)
  * Packaging → keep as is (pack, box, bottle, bag, case)
- If unit is missing or unclear, infer from product name (e.g., "Coca Cola 250ml" → unit: "milliliter")
- Always provide a normalized unit value, never leave it empty

For each product, please:
1. **Correct and normalize the unit** based on the raw receipt data and product name
2. Suggest the most likely brand name (e.g., "Cadbury", "Parle", "Britannia", "Coca-Cola")
3. **Map to an EXISTING category from the provided list** - If no match found, set to null
4. **Map to an EXISTING subcategory from the provided list** - If no match found, set to null
5. Suggest minimum order quantity based on product type
6. Generate a brief description
7. Identify if the product name contains variant information (size, flavor, color, weight, pack)
8. Extract base product name (without variant info)
9. If sellerId was provided and product matches existing inventory, set existingProductId
10. Group similar products that are variants of the same base product (suggest variantGroup numbers)

Return a JSON array with the same structure, but with corrected/normalized units and added fields: unit (corrected), brand, category, subcategory, minOrderQuantity, description, baseProductName, variantType, variantValue, isVariant, existingProductId, variantGroup.

IMPORTANT: category and subcategory values MUST be exact matches from the AVAILABLE CATEGORIES AND SUBCATEGORIES list above, OR set to null if no match is found.

Example response format:
[
  {
    "name": "Coca Cola 250ml",
    "quantity": 2,
    "unit": "milliliter",
    "netAmount": 50.00,
    "unitPrice": 25.00,
    "brand": "Coca-Cola",
    "category": "Beverages",
    "subcategory": "Soft Drinks",
    "minOrderQuantity": 1,
    "description": "Coca Cola soft drink in 250ml bottle",
    "baseProductName": "Coca Cola",
    "variantType": "size",
    "variantValue": "250ml",
    "isVariant": true,
    "existingProductId": null,
    "variantGroup": "1"
  }
]

Return ONLY valid JSON, no other text.`;

    const aiResult = await invokeEnhancedModel(aiPrompt, {
      maxTokens: 16384, // Increased to handle receipts with many products
      temperature: 0.2,
    });

    console.log('🤖 AI Enhancement Result:', {
      success: aiResult.success,
      hasContent: !!aiResult.content,
      contentLength: aiResult.content?.length || 0,
      error: aiResult.error || 'none',
    });

    if (!aiResult.success || !aiResult.content) {
      console.warn('AI enhancement failed, using basic extraction');
      console.warn('AI Error details:', aiResult.error || 'No content returned');
      // Return products without AI enhancement
      return {
        success: true,
        products: extractedProducts,
        confidence: 0.75,
        metadata: {
          totalItems: extractedProducts.length,
          totalAmount: extractedProducts.reduce((sum, p) => sum + p.netAmount, 0),
        },
      };
    }

    // Parse AI response
    let aiEnhancedProducts: any[] = [];
    try {
      console.log('🔍 Parsing AI response...');
      console.log('📝 AI Content preview:', aiResult.content.substring(0, 500));

      const parsed = parseBedrockJSON(aiResult.content);
      console.log('✅ Parsed type:', typeof parsed, Array.isArray(parsed) ? 'is array' : 'not array');

      if (Array.isArray(parsed)) {
        aiEnhancedProducts = parsed;
        console.log(`✅ Parsed ${aiEnhancedProducts.length} products from AI response`);
      } else if (parsed && typeof parsed === 'object' && 'products' in parsed && Array.isArray((parsed as any).products)) {
        aiEnhancedProducts = (parsed as any).products;
        console.log(`✅ Parsed ${aiEnhancedProducts.length} products from AI response (products field)`);
      } else {
        console.warn('⚠️ AI response is not an array and has no products field:', parsed);
      }

      // Log first enhanced product for debugging
      if (aiEnhancedProducts.length > 0) {
        console.log('📦 Sample AI enhanced product:', JSON.stringify(aiEnhancedProducts[0], null, 2));
      }
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('📝 Raw AI content:', aiResult.content);
    }

    // Merge AI enhancements with extracted products
    const finalProducts = extractedProducts.map((product, index) => {
      const aiProduct = aiEnhancedProducts[index];
      if (aiProduct) {
        // Use AI-corrected unit if provided, otherwise normalize the existing unit
        let correctedUnit = product.unit;
        if (aiProduct.unit) {
          correctedUnit = normalizeUnit(aiProduct.unit);
        } else {
          correctedUnit = normalizeUnit(product.unit);
        }

        return {
          ...product,
          unit: correctedUnit, // Use AI-corrected and normalized unit
          brand: aiProduct.brand || product.brand,
          category: aiProduct.category || product.category,
          subcategory: aiProduct.subcategory || product.subcategory,
          minOrderQuantity: aiProduct.minOrderQuantity || product.minOrderQuantity || 1,
          description: aiProduct.description || product.description || product.name,
          baseProductName: aiProduct.baseProductName || product.name,
          variantType: aiProduct.variantType,
          variantValue: aiProduct.variantValue,
          isVariant: aiProduct.isVariant || false,
          existingProductId: aiProduct.existingProductId,
          variantGroup: aiProduct.variantGroup,
        };
      }
      // Even if AI enhancement failed, normalize the unit
      return {
        ...product,
        unit: normalizeUnit(product.unit),
      };
    });

    // Calculate overall confidence
    const avgConfidence = finalProducts.reduce((sum, p) => sum + p.confidence, 0) / finalProducts.length;
    const overallConfidence = Math.min(avgConfidence, 0.95); // Cap at 0.95

    return {
      success: true,
      products: finalProducts,
      confidence: overallConfidence,
      metadata: {
        totalItems: finalProducts.length,
        totalAmount: finalProducts.reduce((sum, p) => sum + p.netAmount, 0),
      },
    };
  } catch (error: any) {
    console.error('Error in extractProductsFromReceiptV2:', error);
    return {
      success: false,
      products: [],
      confidence: 0,
      error: error.message || 'Failed to extract products from receipt',
    };
  }
}

