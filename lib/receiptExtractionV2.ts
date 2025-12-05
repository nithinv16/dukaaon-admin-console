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

  // Identify product name column (most important)
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (const pattern of PRODUCT_NAME_COLUMNS) {
      if (header.includes(pattern) || pattern.includes(header)) {
        productNameIndex = i;
        confidence += 0.4;
        break;
      }
    }
  }

  // Identify quantity column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (const pattern of QUANTITY_COLUMNS) {
      if (header === pattern || header.includes(pattern)) {
        quantityIndex = i;
        confidence += 0.3;
        break;
      }
    }
  }

  // Identify amount column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (const pattern of AMOUNT_COLUMNS) {
      if (header === pattern || header.includes(pattern)) {
        amountIndex = i;
        confidence += 0.3;
        break;
      }
    }
  }

  // Identify unit column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    for (const pattern of UNIT_COLUMNS) {
      if (header === pattern || header.includes(pattern)) {
        unitIndex = i;
        break;
      }
    }
  }

  // If product name not found, try heuristics from sample data
  if (!productNameIndex && sampleRows.length > 0) {
    // Find column with longest text (usually product names)
    const columnLengths = headers.map((_, colIdx) => {
      const avgLength = sampleRows
        .slice(0, 3)
        .map(row => (row[colIdx] || '').toString().length)
        .reduce((a, b) => a + b, 0) / Math.min(3, sampleRows.length);
      return { index: colIdx, avgLength };
    });

    columnLengths.sort((a, b) => b.avgLength - a.avgLength);
    if (columnLengths[0] && columnLengths[0].avgLength > 10) {
      productNameIndex = columnLengths[0].index;
      confidence += 0.2;
    }
  }

  // If quantity not found, try to find numeric-only column
  if (!quantityIndex && sampleRows.length > 0) {
    for (let i = 0; i < headers.length; i++) {
      const isNumeric = sampleRows
        .slice(0, 3)
        .every(row => /^\d+(\.\d+)?$/.test((row[i] || '').toString().trim()));
      if (isNumeric && sampleRows[0][i] && parseFloat(sampleRows[0][i]) < 1000) {
        quantityIndex = i;
        confidence += 0.2;
        break;
      }
    }
  }

  // If amount not found, find column with price-like values
  if (!amountIndex && sampleRows.length > 0) {
    for (let i = 0; i < headers.length; i++) {
      const hasPricePattern = sampleRows
        .slice(0, 3)
        .some(row => {
          const val = (row[i] || '').toString();
          return /^\d+\.\d{2}$/.test(val) || (parseFloat(val) > 10 && parseFloat(val) < 100000);
        });
      if (hasPricePattern) {
        amountIndex = i;
        confidence += 0.2;
        break;
      }
    }
  }

  return {
    productNameIndex,
    quantityIndex,
    unitIndex,
    amountIndex,
    confidence: Math.min(confidence, 1),
  };
}

/**
 * Check if a line should be skipped (header, footer, metadata)
 */
function shouldSkipLine(line: string, lineIndex: number, totalLines: number): boolean {
  const trimmed = line.trim();

  // Skip empty lines
  if (!trimmed) return true;

  // Skip if matches skip patterns
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  // Skip if it's clearly a header line (usually first 5 lines)
  if (lineIndex < 5) {
    if (trimmed.toLowerCase().includes('gstin') ||
      trimmed.toLowerCase().includes('address') ||
      trimmed.toLowerCase().includes('phone') ||
      /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return true;
    }
  }

  // Skip if it's clearly a total/footer line (usually last 5 lines)
  if (lineIndex >= totalLines - 5) {
    if (trimmed.toLowerCase().includes('total') ||
      trimmed.toLowerCase().includes('grand') ||
      trimmed.toLowerCase().includes('net amount') ||
      trimmed.toLowerCase().includes('authorised')) {
      return true;
    }
  }

  return false;
}

/**
 * Direct vision-based product extraction using Claude Sonnet 4.5
 * Sends the receipt image directly to Claude without AWS Textract preprocessing
 * This is used when Textract fails to identify the product table correctly
 * 
 * @param imageBuffer - The receipt image buffer
 * @param categoriesContext - Optional context about existing categories/subcategories
 */
async function extractProductsWithVision(
  imageBuffer: Buffer,
  categoriesContext?: { categories: string[]; subcategories: Record<string, string[]> }
): Promise<ExtractedProductV2[]> {
  const { invokeEnhancedModelWithVision } = await import('./awsBedrockEnhanced');

  // Build categories context for AI
  let categoriesPromptSection = '';
  if (categoriesContext && categoriesContext.categories.length > 0) {
    categoriesPromptSection = `
7️⃣  EXISTING CATEGORIES FOR MAPPING:
   Use these existing categories when possible. If no match, suggest a new one.
   
   📂 AVAILABLE CATEGORIES:
   ${categoriesContext.categories.join(', ')}
   
   📁 AVAILABLE SUBCATEGORIES BY CATEGORY:
   ${Object.entries(categoriesContext.subcategories || {}).map(([cat, subs]) =>
      `   • ${cat}: ${subs.join(', ')}`
    ).join('\n')}
   
   ⚠️ IMPORTANT: 
   - Prefer existing categories/subcategories if they match
   - Set "categoryIsNew": true if suggesting a new category not in the list
   - Set "subcategoryIsNew": true if suggesting a new subcategory not in the list
`;
  }

  const prompt = `You are an expert at extracting product data from Indian FMCG/Retail receipt images. Analyze this receipt image and extract ALL products.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 YOUR MISSION: Extract EVERY SINGLE product from the receipt
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📜 CRITICAL INSTRUCTIONS:

1️⃣  FIND THE PRODUCT TABLE:
   • Look for the table with individual product rows (usually 5-50 rows)
   • Each row typically has: SI, HSN, PCode, Item Description, MRP, Pcs, various amounts
   • IGNORE footer sections (declarations, signatures, Total row)
   • IGNORE tax summary tables (CGST/SGST breakdowns)

2️⃣  ⚠️⚠️⚠️ CRITICAL: NET AMOUNT COLUMN IDENTIFICATION ⚠️⚠️⚠️
   
   The NET AMOUNT is the FINAL amount for the product AFTER all taxes.
   
   🔴 NET AMOUNT IS ALWAYS IN THE **LAST or SECOND-TO-LAST** COLUMN!
   
   ✅ CORRECT columns for Net Amount (priority order):
      1. "Net Amt" (most common - LAST column)
      2. "Net Amount" 
      3. "Total" (sometimes in last column)
      4. "Amount"
      5. "Amt"
   
   ❌ WRONG columns - DO NOT USE THESE as Net Amount:
      • "Taxable Amt" or "Taxable Amount" or "Taxable" (this is BEFORE taxes)
      • "Gross Amt" or "Gross Amount" (this is before discounts)
      • "SCH Amt" (scheme amount - discount)
      • "Disc Amt" (discount amount)
      • "CGST Amt" or "SGST Amt" (these are tax amounts)
      • "Pc Price" (per piece price, not total)
   
   📋 EXAMPLE FROM RECEIPT:
      Row: "OB KIDS RS 25 CHOTA BHEEM HC | MRP: 198.00 | Pcs: 24 | ... | Taxable: 152.82 | ... | Net Amt: 160.46"
      
      ✅ CORRECT: netAmount = 160.46 (from "Net Amt" - LAST column)
      ❌ WRONG: netAmount = 152.82 (Taxable is NOT the final amount!)

3️⃣  QUANTITY EXTRACTION:
   • Get quantity from "Pcs" or "Pieces" or "Qty" column
   • This is the number of items, NOT "Cs" (cases) or "UPC"
   • Typical values: 1, 5, 10, 12, 24, 48, etc.

4️⃣  UNIT EXTRACTION (IMPORTANT):
   Receipts may have different column names: "Unit", "Units", "Qty", "Pcs", "Pieces"
   
   📋 RECEIPT ABBREVIATIONS → OUR UNIT FORMAT:
   • "Pcs", "Pieces", "Pc", "PCS" → "pieces"
   • "Kg", "KG", "Kgs", "KGS" → "kg"
   • "Gm", "GM", "Gms", "GMS", "g" → "grams"
   • "Ltr", "LTR", "L", "Lt" → "liters"
   • "Ml", "ML" → "ml"
   • "Pkt", "PKT", "Pack" → "pack"
   • "Box", "BOX" → "box"
   • "Dz", "DZ", "Dozen" → "dozen"
   • "Btl", "BTL", "Bottle" → "bottle"
   • "Can", "CAN" → "can"
   
   🥬 SMART UNIT DETECTION BY PRODUCT TYPE:
   If unit is not clearly mentioned in receipt, infer from product name:
   
   Products that should be "kg":
   • Vegetables: Potato, Onion, Tomato, Garlic, Ginger, Carrot, Cabbage, Cauliflower
   • Fruits: Apple, Banana, Orange, Mango, Grapes
   • Dals/Pulses: Toor Dal, Chana Dal, Moong Dal, Urad Dal, Masoor Dal
   • Rice: Basmati, Sona Masoori, any rice variety
   • Flour/Atta: Wheat Flour, Maida, Besan, Suji
   • Sugar, Salt, Jaggery
   
   Products that should be "liters" or "ml":
   • Oils: Cooking Oil, Sunflower Oil, Mustard Oil, Coconut Oil
   • Milk, Curd, Buttermilk
   • Soft Drinks: Pepsi, Coca-Cola, 7UP, Sprite, Fanta (check if 2L, 1L, 500ml mentioned)
   • Juices: Frooti, Real, Tropicana
   
   Products that should be "pieces" (default):
   • Biscuits, Chocolates, Chips, Namkeen
   • Soaps, Shampoo, Toothpaste
   • Bread, Buns
   • Most packaged FMCG products
   
   Products that should be "pack":
   • Multi-pack items (4-pack soap, 3-pack noodles)
   • Bundle items
   
   ⚠️ DEFAULT: If unsure, use "pieces"

5️⃣  MRP EXTRACTION:
   • Extract MRP from the "MRP" column if present
   • MRP is the Maximum Retail Price (printed on product)
   • Include in the "mrp" field in your response

6️⃣  UNIT PRICE CALCULATION:
   unitPrice = netAmount ÷ quantity
   
   Example: Net Amt = 160.46, Pcs = 24 → unitPrice = 160.46 / 24 = 6.69

6️⃣  MINIMUM ORDER QUANTITY (minOrderQuantity):
   Suggest appropriate minimum order quantity based on:
   
   📊 GUIDELINES:
   • Low-price items (unitPrice < ₹15): minOrderQuantity = 12-24
   • Medium-price items (₹15-50): minOrderQuantity = 6-12
   • Higher-price items (₹50-100): minOrderQuantity = 3-6
   • Premium items (> ₹100): minOrderQuantity = 1-3
   
   📋 EXAMPLES:
   • Parle-G ₹10 pack: minOrderQuantity = 12
   • Dairy Milk ₹50: minOrderQuantity = 6
   • Shampoo bottle ₹200: minOrderQuantity = 3
   • Premium product ₹500+: minOrderQuantity = 1
${categoriesPromptSection}
8️⃣  PRODUCT NAME EXTRACTION RULES:
   ✓ KEEP: Brand name, variant, weight/size
   ✗ REMOVE: HSN codes, PCode, UPC, batch numbers
   
   Example: "OB KIDS RS 25 CHOTA BHEEM HC" → "OB Kids Rs.25 Chota Bheem HC"

9️⃣  DESCRIPTION WITH MRP:
   Create human-friendly description that includes MRP if available.
   
   Format: "[Expanded Product Name] | MRP ₹[mrp]"
   
   Examples:
   • "Oral-B Kids Chota Bheem Toothbrush | MRP ₹198"
   • "7UP 2LT | MRP ₹90"
   • "Whisper Ultra XXL 7s | MRP ₹110"

🔟  BRAND EXTRACTION:
   Identify and extract the brand/manufacturer name.
   
   📋 COMMON INDIAN FMCG BRANDS:
   • Chocolates: Cadbury, Nestle, Ferrero, Mars, Amul
   • Biscuits: Parle, Britannia, ITC, Sunfeast, Oreo
   • Snacks: Lays, Kurkure, Haldiram's, Bikaji, Balaji
   • Beverages: Coca-Cola, Pepsi, Thums Up, Sprite, 7UP, Fanta, Maaza, Frooti
   • Personal Care: Colgate, Oral-B, Dove, Lux, Lifebuoy, Pepsodent, Closeup
   • Dairy: Amul, Mother Dairy, Nestle, Britannia
   • Staples: Aashirvaad, Fortune, Saffola, Tata, Patanjali
   • Noodles: Maggi, Yippee, Top Ramen, Knorr, Ching's
   
   ⚠️ RULES:
   • Extract the parent brand, not sub-brand (e.g., "Cadbury" not "Dairy Milk")
   • If brand unclear, use your knowledge of Indian FMCG products
   • If truly unknown, leave brand empty

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 RESPONSE FORMAT (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ RESPOND WITH ONLY A JSON ARRAY - NO MARKDOWN, NO CODE BLOCKS, NO EXPLANATIONS

Your response must START with [ and END with ]

Format:
[
  {
    "name": "Product Name Here",
    "brand": "Brand Name",
    "description": "Human-friendly description | MRP ₹XX",
    "category": "Category Name",
    "subcategory": "Subcategory Name",
    "categoryIsNew": false,
    "subcategoryIsNew": false,
    "quantity": 24,
    "unit": "pieces",
    "mrp": 198.00,
    "netAmount": 160.46,
    "unitPrice": 6.69,
    "minOrderQuantity": 12,
    "confidence": 0.95
  },
  {
    "name": "Potato Fresh",
    "brand": "",
    "description": "Fresh Potato 1KG",
    "category": "Vegetables",
    "subcategory": "Root Vegetables",
    "categoryIsNew": false,
    "subcategoryIsNew": false,
    "quantity": 5,
    "unit": "kg",
    "mrp": null,
    "netAmount": 150.00,
    "unitPrice": 30.00,
    "minOrderQuantity": 1,
    "confidence": 0.90
  }
]

🔴 CRITICAL REMINDERS:
• Net Amount is from the LAST column (usually "Net Amt" or "Total")
• DO NOT use "Taxable Amt" as Net Amount!
• Extract MRP from the MRP column
• Extract BRAND name (parent company/manufacturer)
• Extract UNIT properly: Use "kg" for vegetables/dals/rice, "liters" for oils/milk, "pieces" for packaged goods
• Normalize units: "Pcs" → "pieces", "KG" → "kg", "LTR" → "liters"
• If unit unclear, infer from product type (e.g., Potato → "kg", Parle-G → "pieces")
• Suggest minOrderQuantity based on unit price
• Include MRP in description field
• Extract ALL products (if 30 rows, return 30 products)

START YOUR RESPONSE WITH [`;

  console.log('🖼️ Using Claude Vision (direct image analysis, bypassing Textract)');
  if (categoriesContext) {
    console.log(`📂 Provided ${categoriesContext.categories.length} categories for mapping`);
  }

  const response = await invokeEnhancedModelWithVision(imageBuffer, prompt, {
    maxTokens: 8192, // Increased for larger receipts
    temperature: 0.1,
  });

  if (!response.success || !response.content) {
    throw new Error(`Vision extraction failed: ${response.error || 'Unknown error'}`);
  }

  console.log('📝 Vision AI Response preview:', response.content.substring(0, 500));

  // Parse JSON response
  const { parseBedrockJSON } = await import('./awsBedrock');
  const parsed = parseBedrockJSON<ExtractedProductV2[]>(response.content);

  if (!parsed || !Array.isArray(parsed)) {
    throw new Error('Failed to parse vision extraction result as JSON array');
  }

  console.log(`✅ Vision extracted ${parsed.length} products`);

  // Validate and map products
  const validProducts = parsed
    .filter(p => {
      if (!p.name || typeof p.name !== 'string') return false;
      if (p.quantity <= 0 || p.netAmount <= 0) return false;
      return true;
    })
    .map((p, idx) => {
      const cleanedName = cleanProductName(p.name);
      const mrp = p.mrp || undefined;

      // Build description with MRP if available
      let description = p.description || cleanedName;
      if (mrp && !description.includes('MRP') && !description.includes('₹')) {
        description = `${description} | MRP ₹${mrp}`;
      }

      return {
        id: `prod_${Date.now()}_${idx}`,
        name: cleanedName,
        brand: p.brand || '', // AI-suggested brand
        description: description,
        category: p.category || '',
        subcategory: p.subcategory || '',
        categoryIsNew: p.categoryIsNew || false,
        subcategoryIsNew: p.subcategoryIsNew || false,
        quantity: p.quantity || 1,
        // Smart unit handling: normalize AI extraction OR infer from product name
        unit: normalizeUnit(p.unit) || suggestUnitFromProductName(cleanedName),
        mrp: mrp,
        netAmount: p.netAmount || 0,
        unitPrice: p.unitPrice || (p.netAmount && p.quantity ? p.netAmount / p.quantity : 0),
        // Min Order Qty: Use AI suggestion OR extracted quantity, whichever is SMALLER
        // This ensures Min Qty doesn't exceed what was actually on the receipt
        minOrderQuantity: Math.min(
          p.minOrderQuantity || suggestMinOrderQuantity(p.unitPrice || (p.netAmount / p.quantity)),
          p.quantity || 1
        ),
        confidence: p.confidence || 0.85,
        needsReview: (p.confidence || 0.85) < 0.7,
        rowIndex: idx,
      };
    });

  return validProducts;
}

/**
 * Suggest minimum order quantity based on unit price
 * Lower priced items typically need higher minimum quantities
 */
function suggestMinOrderQuantity(unitPrice: number): number {
  if (unitPrice <= 0) return 1;
  if (unitPrice < 10) return 24;     // Very cheap items (candies, small packs)
  if (unitPrice < 20) return 12;     // Low-price items (biscuits, small snacks)
  if (unitPrice < 50) return 6;      // Medium-price items (regular snacks, beverages)
  if (unitPrice < 100) return 3;     // Higher-price items (larger packs)
  if (unitPrice < 250) return 2;     // Premium items
  return 1;                          // Expensive items
}

/**
 * Normalize unit from various receipt abbreviations
 * @param unit - Unit string from receipt/AI
 * @returns Normalized unit string or empty if invalid
 */
function normalizeUnit(unit: string | undefined | null): string {
  if (!unit) return '';

  const normalized = unit.toLowerCase().trim();

  // Pieces
  if (/^(pcs?|pieces?|pices?|nos?|numbers?)$/i.test(normalized)) return 'pieces';

  // Weight - Kilograms
  if (/^(kg|kgs|kilogram|kilograms?)$/i.test(normalized)) return 'kg';

  // Weight - Grams
  if (/^(gm|gms|g|gram|grams?)$/i.test(normalized)) return 'grams';

  // Volume - Liters
  if (/^(l|lt|ltr|ltrs?|liter|liters?|litre|litres?)$/i.test(normalized)) return 'liters';

  // Volume - Milliliters
  if (/^(ml|mls?|milliliter|milliliters?)$/i.test(normalized)) return 'ml';

  // Pack
  if (/^(pkt|pkts?|pack|packs?|packet|packets?)$/i.test(normalized)) return 'pack';

  // Box
  if (/^(box|boxes?)$/i.test(normalized)) return 'box';

  // Dozen
  if (/^(dz|dzn|dozen)$/i.test(normalized)) return 'dozen';

  // Bottle
  if (/^(btl|btls?|bottle|bottles?)$/i.test(normalized)) return 'bottle';

  // Can
  if (/^(can|cans?)$/i.test(normalized)) return 'can';

  // Carton
  if (/^(ctn|carton|cartons?)$/i.test(normalized)) return 'carton';

  // Case
  if (/^(cs|case|cases?)$/i.test(normalized)) return 'case';

  // If already a valid unit, return as-is
  if (['pieces', 'kg', 'grams', 'liters', 'ml', 'pack', 'box', 'dozen', 'bottle', 'can', 'carton', 'case'].includes(normalized)) {
    return normalized;
  }

  return ''; // Return empty to trigger fallback
}

/**
 * Suggest unit based on product name for intelligent default
 * Used when unit is not clearly mentioned in receipt
 * @param productName - The product name to analyze
 * @returns Suggested unit string
 */
function suggestUnitFromProductName(productName: string): string {
  const name = productName.toLowerCase();

  // ==========================================
  // VEGETABLES & FRUITS → "kg"
  // ==========================================
  const kgProducts = [
    // Vegetables
    'potato', 'potatoes', 'aloo', 'batata',
    'onion', 'onions', 'pyaj', 'pyaaz',
    'tomato', 'tomatoes', 'tamatar',
    'garlic', 'lahsun', 'lehsun',
    'ginger', 'adrak',
    'carrot', 'carrots', 'gajar',
    'cabbage', 'patta gobhi', 'band gobhi',
    'cauliflower', 'phool gobhi', 'gobi',
    'brinjal', 'baingan', 'eggplant',
    'capsicum', 'shimla mirch',
    'cucumber', 'kheera', 'kakdi',
    'lady finger', 'ladyfinger', 'bhindi', 'okra',
    'beans', 'french beans',
    'peas', 'matar',
    'spinach', 'palak',
    'coriander', 'dhania',
    'methi', 'fenugreek',
    'bitter gourd', 'karela',
    'bottle gourd', 'lauki', 'doodhi',
    'radish', 'mooli',
    'beetroot', 'chukandar',
    // Fruits
    'apple', 'apples', 'seb',
    'banana', 'bananas', 'kela',
    'orange', 'oranges', 'santra', 'narangi',
    'mango', 'mangoes', 'aam',
    'grapes', 'angoor',
    'papaya', 'papita',
    'guava', 'amrood',
    'pomegranate', 'anar',
    'watermelon', 'tarbooj',
    'pineapple', 'ananas',
    // Dals/Pulses
    'dal', 'daal',
    'toor', 'arhar', 'tur',
    'chana', 'chickpea', 'gram',
    'moong', 'mung', 'green gram',
    'urad', 'black gram',
    'masoor', 'red lentil',
    'rajma', 'kidney bean',
    'pulses', 'lentils',
    // Rice
    'rice', 'chawal', 'basmati', 'sona masoori', 'sona masuri',
    // Flour/Atta
    'atta', 'flour', 'wheat flour', 'maida', 'besan', 'suji', 'rava', 'sooji',
    // Sugar/Salt
    'sugar', 'cheeni', 'shakkar',
    'salt', 'namak',
    'jaggery', 'gur', 'gud',
  ];

  for (const keyword of kgProducts) {
    if (name.includes(keyword)) return 'kg';
  }

  // ==========================================
  // LIQUID PRODUCTS → "liters" or "ml"
  // ==========================================

  // Check for specific size mentions first
  if (/\d+\s*l\b|\d+\s*ltr|\d+\s*liters?/i.test(name)) return 'liters';
  if (/\d+\s*ml\b/i.test(name)) return 'ml';

  const literProducts = [
    // Oils
    'oil', 'tel',
    'sunflower', 'refined',
    'mustard oil', 'sarson',
    'coconut oil', 'nariyal',
    'groundnut oil', 'peanut oil',
    'olive oil',
    'vegetable oil',
    // Milk & Dairy Liquids
    'milk', 'doodh',
    'curd', 'dahi', 'yogurt',
    'buttermilk', 'chaas', 'lassi',
    'ghee', // Usually comes in liters
  ];

  for (const keyword of literProducts) {
    if (name.includes(keyword)) return 'liters';
  }

  const mlProducts = [
    // Soft Drinks
    'pepsi', 'coca cola', 'coke', 'thums up', 'thumbs up',
    'sprite', '7up', '7 up', 'fanta', 'mirinda', 'limca',
    // Juices
    'frooti', 'maaza', 'real', 'tropicana', 'slice', 'appy',
    // Shampoo/Personal Care (if liquid)
    'shampoo', 'conditioner', 'body wash', 'hand wash',
    'face wash', 'liquid soap', 'dettol liquid',
    // Sauces
    'sauce', 'ketchup', 'mayonnaise', 'mayo',
  ];

  for (const keyword of mlProducts) {
    if (name.includes(keyword)) {
      // Check if liters mentioned for soft drinks (2L, 1L)
      if (/\d+\s*l\b|\d+\s*ltr/i.test(name)) return 'liters';
      return 'ml'; // Default to ml for these
    }
  }

  // ==========================================
  // PACK PRODUCTS → "pack"
  // ==========================================
  const packProducts = [
    'noodles', 'maggi', 'yippee', 'ramen',
    'combo', 'bundle', 'multipack', 'multi-pack',
    'family pack', 'value pack', 'economy pack',
  ];

  for (const keyword of packProducts) {
    if (name.includes(keyword)) return 'pack';
  }

  // ==========================================
  // DEFAULT → "pieces"
  // ==========================================
  return 'pieces';
}

/**
 * AI-powered product extraction using Claude Sonnet 4.5
 * Analyzes AWS Textract structure and extracts products
 * Uses model: anthropic.claude-sonnet-4-5-20250929-v1:0 (inference profile)
 * Note: This requires Anthropic use case approval in AWS Bedrock
 */
async function extractProductsWithAI(
  textLines: string[],
  tables: any[],
  structuredData: any
): Promise<ExtractedProductV2[]> {
  // Build structured table context for AI
  // Process tables to extract structured data with headers and rows
  let tableContext = 'No table structure detected';
  let formattedTables: any[] = [];

  if (tables.length > 0) {
    // Find the largest table (usually the main product table)
    // Use rowCount if available (from V2 enhanced extraction), otherwise fall back to cell count
    const sortedTables = [...tables].sort((a, b) => {
      const aRows = a.rowCount || ((a.cells && Array.isArray(a.cells)) ? a.cells.length : 0);
      const bRows = b.rowCount || ((b.cells && Array.isArray(b.cells)) ? b.cells.length : 0);
      return bRows - aRows;
    });

    // Process the largest tables (main product table is usually the largest)
    for (const table of sortedTables.slice(0, 2)) {
      let rows: any[][] = [];

      // Use structuredRows if available (from V2 enhanced extraction)
      if (table.structuredRows && Array.isArray(table.structuredRows)) {
        // Use the pre-structured rows from V2 extraction
        rows = table.structuredRows.map((row: any[]) =>
          row.map((cell: any) => (cell.Text || cell.text || '').toString().trim())
        );
      } else if (table.cells && Array.isArray(table.cells)) {
        // Fallback to manual grouping for backward compatibility
        const rowMap = new Map<number, any[]>();
        table.cells.forEach((cell: any) => {
          const rowIdx = cell.RowIndex || 0;
          if (!rowMap.has(rowIdx)) {
            rowMap.set(rowIdx, []);
          }
          rowMap.get(rowIdx)!.push(cell);
        });

        // Sort rows and cells
        const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);

        sortedRows.forEach((rowIdx) => {
          const cells = rowMap.get(rowIdx)!;
          cells.sort((a, b) => (a.ColumnIndex || 0) - (b.ColumnIndex || 0));
          rows.push(cells.map(c => (c.Text || c.text || '').toString().trim()));
        });
      }

      // Identify header row (usually first row)
      if (rows.length > 0) {
        const headerRow = rows[0] || [];
        const dataRows = rows.slice(1);

        // Check if this looks like a product table
        const hasProductColumns = headerRow.some((h: string) =>
          /item|description|product|particulars|goods|name/i.test(h)
        );
        const hasQuantityColumns = headerRow.some((h: string) =>
          /pcs|pieces|qty|quantity|nos/i.test(h)
        );
        const hasAmountColumns = headerRow.some((h: string) =>
          /net|amount|amt|total|price/i.test(h)
        );

        // Skip summary/tax tables - look for headers like CGST, SGST, Tax Slab, etc.
        const isSummaryTable = headerRow.some((h: string) =>
          /cgst|sgst|tax slab|particulars.*cgst|tax.*slab/i.test(h)
        );

        // Filter out rows that are clearly not products (metadata, headers, totals)
        const filteredRows = dataRows.filter((row: string[]) => {
          const rowText = row.join(' ').toLowerCase();
          // Skip if row contains only metadata
          if (/channel|traditional|small|sectorized|stn|cin|gstn|pan|dl|fssai/i.test(rowText)) {
            return false;
          }
          // Skip if row is mostly empty or contains only codes
          const nonEmptyCells = row.filter(cell => cell && cell.trim().length > 0);
          if (nonEmptyCells.length < 3) return false;
          return true;
        });

        if (!isSummaryTable && hasProductColumns && filteredRows.length > 0) {
          // Calculate a quality score for this table
          const hasHighRowCount = filteredRows.length >= 10;
          const hasAllKeyColumns = hasProductColumns && hasQuantityColumns && hasAmountColumns;
          const qualityScore = (hasHighRowCount ? 2 : 0) + (hasAllKeyColumns ? 3 : 1);

          formattedTables.push({
            tableType: 'PRODUCT_TABLE',
            headers: headerRow,
            rowCount: filteredRows.length,
            sampleRows: filteredRows.slice(0, 3), // First 3 rows as examples only
            allRows: filteredRows,
            qualityScore // Add quality score for better sorting
          });
        } else if (!isSummaryTable && filteredRows.length > 5 && hasQuantityColumns) {
          formattedTables.push({
            tableType: 'POSSIBLE_PRODUCT_TABLE',
            headers: headerRow,
            rowCount: filteredRows.length,
            sampleRows: filteredRows.slice(0, 3),
            allRows: filteredRows,
            qualityScore: 1
          });
        } else if (!isSummaryTable && filteredRows.length > 3) {
          // Lower priority for tables without clear product indicators
          formattedTables.push({
            tableType: 'POSSIBLE_PRODUCT_TABLE',
            headers: headerRow,
            rowCount: filteredRows.length,
            sampleRows: filteredRows.slice(0, 3),
            allRows: filteredRows,
            qualityScore: 0.5
          });
        }
      }
    }
  }

  // Format tables for AI with clear structure
  if (formattedTables.length > 0) {
    // Prioritize by quality score, then by type, then by row count
    formattedTables.sort((a, b) => {
      // First, sort by quality score (highest first)
      if (a.qualityScore !== b.qualityScore) {
        return b.qualityScore - a.qualityScore;
      }
      // Then by table type
      if (a.tableType === 'PRODUCT_TABLE' && b.tableType !== 'PRODUCT_TABLE') return -1;
      if (b.tableType === 'PRODUCT_TABLE' && a.tableType !== 'PRODUCT_TABLE') return 1;
      // Finally by row count (largest first)
      return b.rowCount - a.rowCount;
    });

    console.log(`📊 Table prioritization:`, formattedTables.map(t => ({
      type: t.tableType,
      rows: t.rowCount,
      quality: t.qualityScore,
      headers: t.headers.slice(0, 5)
    })));

    // Send ONLY the best table to AI (to avoid confusion with footer/summary tables)
    const bestTable = formattedTables[0];

    tableContext = (() => {
      const table = bestTable;
      const idx = 0;
      // Identify column indices for better clarity
      const headers = table.headers;
      let productNameColIdx = -1;
      let qtyColIdx = -1;
      let netAmtColIdx = -1;

      // Find key column indices
      headers.forEach((header: string, i: number) => {
        const h = header.toLowerCase();
        if (h.includes('item') || h.includes('description') || h.includes('product') || h.includes('name')) {
          productNameColIdx = i;
        }
        if (h.includes('pcs') || h.includes('pieces') || h.includes('qty') || h.includes('quantity')) {
          qtyColIdx = i;
        }
        if (h.includes('net') && (h.includes('amt') || h.includes('amount'))) {
          netAmtColIdx = i;
        }
      });

      // Format all rows with clear column mappings
      const allRowsFormatted = table.allRows.map((row: string[], i: number) => {
        const productName = productNameColIdx >= 0 ? row[productNameColIdx] : '';
        const qty = qtyColIdx >= 0 ? row[qtyColIdx] : '';
        const netAmt = netAmtColIdx >= 0 ? row[netAmtColIdx] : '';
        return `  Row ${i + 1}: Product="${productName}", Pcs="${qty}", NetAmt="${netAmt}" [Full Row: ${JSON.stringify(row)}]`;
      }).join('\n');

      return `📊 TABLE ${idx + 1} - ${table.tableType}
Table has ${table.rowCount} product rows

🔑 COLUMN HEADERS:
${JSON.stringify(table.headers)}

⚡ KEY COLUMN INDICES:
- Product Name Column: ${productNameColIdx} (${productNameColIdx >= 0 ? headers[productNameColIdx] : 'NOT FOUND'})
- Quantity Column (Pcs): ${qtyColIdx} (${qtyColIdx >= 0 ? headers[qtyColIdx] : 'NOT FOUND'})
- Net Amount Column: ${netAmtColIdx} (${netAmtColIdx >= 0 ? headers[netAmtColIdx] : 'NOT FOUND'})

📋 ALL ${table.rowCount} PRODUCT ROWS (YOU MUST EXTRACT ALL ${table.rowCount} PRODUCTS):
${allRowsFormatted}

✅ EXTRACTION REQUIREMENT: Return exactly ${table.rowCount} products from the ${table.rowCount} rows above.`;
    })(); // Execute IIFE to format single table
  } else {
    tableContext = 'No product table structure detected in receipt data';
  }

  const textContext = textLines.slice(0, 50).join('\n'); // Limit text context

  const prompt = `You are an expert at extracting product data from receipt tables. Your ONLY task is to extract ALL products from the itemized product table.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 YOUR MISSION: Extract EVERY SINGLE product from the product table below
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📜 CRITICAL RULES (READ BEFORE STARTING):

1️⃣  EXTRACT FROM THE RIGHT TABLE:
   ✓ Use the ITEMIZED PRODUCT TABLE (has individual product names in each row)
   ✗ SKIP summary tables (CGST/SGST tax breakdowns)
   ✗ SKIP header metadata (STN, CIN, GSTN, addresses, phone numbers)
   ✗ SKIP footer sections (terms, totals, signatures)
  1️⃣  EXTRACT FROM THE RIGHT TABLE:
     ✓ Use the ITEMIZED PRODUCT TABLE (has individual product names in each row)
     ✗ SKIP summary tables (CGST/SGST tax breakdowns)
     ✗ SKIP header metadata (STN, CIN, GSTN, addresses, phone numbers)
     ✗ SKIP footer sections (terms, totals, signatures)

  2️⃣  PROCESS EVERY SINGLE ROW:
     • If the table has 5 rows → extract 5 products
     • If the table has 29 rows → extract 29 products
     • DO NOT stop after extracting 1 or 2 products!
     • Process EVERY row listed in the "ALL PRODUCT ROWS" section below

  3️⃣  EXTRACT THESE FIELDS FOR EACH PRODUCT:
     • name: Clean product name (remove HSN, PCode, UPC, barcodes, serial numbers BUT KEEP weights, sizes, variants)
     • description: Generate intelligent human-friendly description
     • quantity: Number from "Pcs" or "Pieces" column (must be > 0)
     • unit: Usually "pieces" (or "pcs", "kg", "g", "l", etc. if specified)
     • netAmount: Number from "Net Amt" or "Net Amount" column (must be > 0)
     • unitPrice: Calculate as netAmount ÷ quantity
     • confidence: 0.85-0.95 (based on data quality)

  4️⃣  INTELLIGENT DESCRIPTION GENERATION:
     Transform abbreviated product names into human-friendly descriptions:
     
     Examples:
     • "CDM 40G RS 45 PRICING" → "Cadbury Dairy Milk 40G MRP ₹45"
     • "FIVE STAR 40 30 20 10" → "Five Star Chocolate Multi-pack (40g, 30g, 20g, 10g)"
     • "AASHIRVAAD 1KG RS.80" → "Aashirvaad Atta 1KG MRP ₹80"

  5️⃣  PRICE CALCULATION FORMULA:
     unitPrice = netAmount / quantity
     
     Example: If NetAmt=166.67 and Pcs=5, then unitPrice=166.67/5=33.33

  6️⃣  CLEAN PRODUCT NAMES:
     ✓ Keep: "CDM 40G RS 45", "Parle-G 100g", "Maggi 70G RS.12"
     ✗ Remove: HSN codes (like "33051090")
     ✗ Remove: PCode (like "80813857")
     ✗ Remove: UPC (like "60")
     ✗ Remove: Serial numbers, barcodes

  7️⃣  IGNORE THESE (NOT products):
     ✗ "Traditional" (this is a channel name, not a product)
     ✗ "Small A Traditional" (channel classification)
   ✗ Tax slab rows (CGST/SGST percentages)
     ✗ Rows with only codes and no product names

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RECEIPT TABLE DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${tableContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 EXTRACTION INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STEP 1: Identify the product table
     → Look for the table with columns like: "Item Description", "Pcs", "Net Amt"
     → This table has MULTIPLE rows (each row = 1 product)

  STEP 2: For EACH row in the product table, extract:
     → Product Name (clean it: remove codes)
     → Quantity from "Pcs" column
     → Net Amount from "Net Amt" column
     → Calculate: unitPrice = netAmount / quantity

  STEP 3: Return ALL products as a JSON array
     → MUST return same number of products as there are rows in the table
     → DO NOT return just 1 product if there are 20 rows!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 RESPONSE FORMAT (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Count the rows in the table above
• Your JSON array MUST have the SAME number of objects as there are product rows
• If table has N rows, return N products in the array
• Extracting only 1 product when there are 20+ rows is WRONG

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

START YOUR RESPONSE WITH [`;

  // Try Claude Sonnet 4.5 (use case details already submitted, model is accessible)
  let response = await invokeEnhancedModel(prompt, {
    maxTokens: 4096,
    temperature: 0.1, // Low temperature for consistent extraction
  });

  // Check for errors - since model is accessible, errors might indicate other issues
  if (!response.success || !response.content) {
    const errorMsg = response.error || 'AI extraction failed';

    console.error('❌ Claude Sonnet 4.5 invocation failed:', errorMsg);

    // If error mentions use case details but model is accessible, check for other issues
    if (errorMsg.includes('use case details') || errorMsg.includes('ResourceNotFoundException')) {
      throw new Error(`Claude Sonnet 4.5 model access error: ${errorMsg}

Possible issues:
1. Model ID format: Currently using 'anthropic.claude-sonnet-4-5-20250929-v1:0'
2. Model might not be available in region: ${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}
3. Model access might need to be refreshed in AWS Bedrock Console

To verify:
- Check AWS Bedrock Console: https://console.aws.amazon.com/bedrock/
- Verify model ID in Model Catalog
- Ensure model is enabled in your region`);
    }

    throw new Error(`AI extraction failed: ${errorMsg}`);
  }

  // Validate and log response content before parsing
  if (!response.content || response.content.trim().length === 0) {
    console.error('❌ Empty response content from AI model');
    throw new Error('AI model returned empty response. Please check your AWS Bedrock configuration and model access.');
  }

  // Check for suspicious response patterns (like "0...0" which might indicate an error)
  if (response.content.length < 10 || /^0+\.{3}0+$/.test(response.content.trim())) {
    console.error('❌ Invalid response format from AI model:', response.content);
    throw new Error(`AI model returned invalid response format: "${response.content.substring(0, 50)}". This may indicate a model configuration issue or the model may not be available.`);
  }

  // Log first 500 characters of response for debugging
  console.log('📝 AI Response preview:', response.content.substring(0, 500));

  // Try to parse JSON
  const parsed = parseBedrockJSON<ExtractedProductV2[]>(response.content);
  if (!parsed || !Array.isArray(parsed)) {
    console.error('❌ Failed to parse AI response as JSON array');
    console.error('📄 Full response content (first 1000 chars):', response.content.substring(0, 1000));
    throw new Error(`Failed to parse AI extraction result. Response was not valid JSON. The AI model may have returned an error message or unexpected format. Content preview: ${response.content.substring(0, 200)}`);
  }

  console.log(`✅ Successfully parsed ${parsed.length} products from AI response`);

  // Filter and validate extracted products
  const validProducts = parsed
    .filter(p => {
      // Validate product name
      if (!p.name || typeof p.name !== 'string') return false;
      const cleanedName = cleanProductName(p.name);
      if (!cleanedName || cleanedName.length < 3) return false;

      // Filter out metadata fields that were incorrectly extracted
      const nameLower = cleanedName.toLowerCase().trim();
      const invalidPatterns = [
        /^traditional$/i,
        /^small$/i,
        /^sectorized$/i,
        /^channel$/i,
        /^other$/i,
        /^(stn|cin|gstn|pan|dl|fssai)$/i,
        /^(address|phone|state|route|visit|po)$/i,
        /^(kerala|state code|route name|pay term|credit customer)$/i,
        /^(cgst|sgst|igst|gst|tax)$/i,
        /^(particulars|total|subtotal|grand total)$/i,
      ];

      // Check if the name matches any invalid pattern
      for (const pattern of invalidPatterns) {
        if (pattern.test(nameLower)) {
          console.warn(`Filtered out invalid product name (metadata field): ${cleanedName}`);
          return false;
        }
      }

      // Additional validation: product names should have at least one letter and be reasonably descriptive
      if (cleanedName.length < 5) {
        // Very short names (less than 5 chars) are likely codes or metadata
        console.warn(`Filtered out product name (too short): ${cleanedName}`);
        return false;
      }

      // Must contain at least one letter (not just numbers)
      if (!/[A-Za-z]/.test(cleanedName)) {
        console.warn(`Filtered out product name (no letters): ${cleanedName}`);
        return false;
      }

      // Validate quantity and amount
      const quantity = p.quantity || 1;
      const netAmount = p.netAmount || 0;
      if (quantity <= 0 || netAmount <= 0) return false;

      return true;
    })
    .map((p, idx) => ({
      id: `prod_${Date.now()}_${idx}`,
      name: cleanProductName(p.name),
      description: p.description || cleanProductName(p.name), // AI-generated description or fallback to cleaned name
      category: p.category || '',
      subcategory: p.subcategory || '',
      quantity: p.quantity || 1,
      unit: p.unit || 'piece',
      netAmount: p.netAmount || 0,
      unitPrice: p.unitPrice || (p.netAmount && p.quantity ? p.netAmount / p.quantity : 0),
      confidence: p.confidence || 0.8,
      needsReview: (p.confidence || 0.8) < 0.7,
      rowIndex: idx,
    }));

  // Log warning if too few products extracted
  if (validProducts.length === 1) {
    console.warn(`⚠️ Only 1 product extracted - this may be incorrect. Product: ${validProducts[0]?.name}`);
  }

  if (validProducts.length === 0 && parsed.length > 0) {
    console.warn(`⚠️ All ${parsed.length} extracted products were filtered out as invalid`);
  }

  return validProducts;
}

/**
 * Main extraction function - combines AWS Textract + AI
 * Fetches existing categories from DB and passes to AI for better mapping
 * Categories are suggested but NOT automatically saved to DB during extraction
 */
export async function extractProductsFromReceiptV2(
  imageBuffer: Buffer
): Promise<ReceiptExtractionResultV2> {
  if (!validateAWSConfig()) {
    return {
      success: false,
      products: [],
      confidence: 0,
      error: 'AWS Textract is not configured',
    };
  }

  try {
    // Step 1: Fetch existing categories from database for AI context
    let categoriesContext: { categories: string[]; subcategories: Record<string, string[]> } | undefined;

    try {
      // Dynamically import to avoid SSR issues
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/categories`);
      if (response.ok) {
        const data = await response.json();
        const categories: string[] = [];
        const subcategories: Record<string, string[]> = {};

        if (data.categories && Array.isArray(data.categories)) {
          data.categories.forEach((cat: any) => {
            categories.push(cat.name);
            if (cat.subcategories && Array.isArray(cat.subcategories)) {
              subcategories[cat.name] = cat.subcategories.map((sub: any) => sub.name);
            }
          });
        }

        categoriesContext = { categories, subcategories };
        console.log(`📂 Loaded ${categories.length} categories from DB for AI context`);
      } else {
        console.warn('⚠️ Could not fetch categories from DB, AI will suggest new categories');
      }
    } catch (catError) {
      console.warn('⚠️ Error fetching categories:', catError);
      // Continue without categories context - AI will suggest new ones
    }

    // Step 2: Use Claude Vision for direct image analysis (bypassing Textract)
    // This is more reliable when receipts have complex table structures
    console.log('📸 Starting vision-based extraction with Claude Sonnet 4.5...');

    let products: ExtractedProductV2[] = [];

    try {
      products = await extractProductsWithVision(imageBuffer, categoriesContext);
    } catch (visionError: any) {
      const errorMsg = visionError.message || String(visionError);

      // Provide helpful error message with updated AWS Bedrock information
      if (errorMsg.includes('use case details') || errorMsg.includes('Anthropic') || errorMsg.includes('approval')) {
        return {
          success: false,
          products: [],
          confidence: 0,
          error: `Anthropic use case details required for Claude Sonnet 4.5.

AWS Bedrock now automatically enables models, but Anthropic requires use case details for first-time users.

📝 HOW TO SUBMIT USE CASE DETAILS:

Method 1 - AWS Console (Easiest):
1. Go to: https://console.aws.amazon.com/bedrock/
2. Click "Model access" in left sidebar
3. Click "Modify model access" button
4. Select "Claude Sonnet 4.5" (model ID: anthropic.claude-sonnet-4-5-20250929-v1:0)
5. Click "Submit use case details"
6. Fill form with: "Receipt extraction and product data processing for inventory management system. Extracting product names, quantities, units, and prices from scanned receipts using OCR and AI to populate seller inventory databases."
7. Submit and wait 15 minutes

Method 2 - Model Catalog:
1. Go to: https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess
2. Find "Claude Sonnet 4.5" in Model catalog
3. Open model → Click "Submit use case details"
4. Complete and submit form

✅ ONE-TIME: Submit once per AWS account, access granted immediately!

📖 Full guide: See ANTHROPIC_USE_CASE_SUBMISSION.md in project root

Note: Using Claude Sonnet 4.5 exclusively for best extraction quality.`,
        };
      }

      return {
        success: false,
        products: [],
        confidence: 0,
        error: `AI extraction failed: ${errorMsg}. 

Scan Receipt 2.0 uses AWS Textract + Claude Sonnet 4.5 exclusively for best extraction quality.`,
      };
    }

    // Step 3: Post-process and validate
    products = products.filter(p => {
      // Must have a valid product name
      if (!p.name || p.name.length < 2) return false;
      // Must have quantity > 0
      if (p.quantity <= 0) return false;
      // Must have amount > 0
      if (p.netAmount <= 0 && p.unitPrice <= 0) return false;
      return true;
    });

    // Calculate overall confidence
    const overallConfidence = products.length > 0
      ? products.reduce((sum, p) => sum + p.confidence, 0) / products.length
      : 0;

    // Calculate metadata
    const totalAmount = products.reduce((sum, p) => sum + p.netAmount, 0);

    return {
      success: products.length > 0,
      products,
      confidence: overallConfidence,
      metadata: {
        totalItems: products.length,
        totalAmount,
      },
    };
  } catch (error: any) {
    console.error('Error in receipt extraction V2:', error);
    const errorMsg = error.message || String(error);

    // Provide helpful error message for Anthropic approval issue
    if (errorMsg.includes('use case details') || errorMsg.includes('Anthropic')) {
      return {
        success: false,
        products: [],
        confidence: 0,
        error: 'Claude Sonnet 4.5 requires Anthropic use case approval in AWS Bedrock Console. Please complete the approval form in AWS Bedrock Console (https://console.aws.amazon.com/bedrock/), then try again. Scan Receipt 2.0 uses AWS Textract + AI exclusively for better extraction accuracy.',
      };
    }

    return {
      success: false,
      products: [],
      confidence: 0,
      error: errorMsg || 'Failed to extract products',
    };
  }
}

export default {
  extractProductsFromReceiptV2,
};

