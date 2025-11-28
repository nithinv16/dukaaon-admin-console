/**
 * AI Extraction Service Property Tests
 * 
 * Tests for the AI-enhanced text extraction service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateFieldConfidence,
  needsReview,
  convertToAIExtractedProducts,
  AIExtractedProduct,
  FieldConfidence,
  ImageType,
  isNameOnlyList,
  processNameOnlyProducts,
  convertNameOnlyToAIExtractedProducts,
  NameOnlyProduct,
  calculateStringSimilarity,
  findBestMasterProductMatch,
  enrichProductsWithMasterData,
  MasterProductRecord,
  MasterProductMatch,
} from './aiExtractionService';

// ============================================================================
// Arbitraries for Property-Based Testing
// ============================================================================

const imageTypeArb = fc.constantFrom(
  'receipt',
  'product_list',
  'name_only_list',
  'invoice',
  'unknown'
) as fc.Arbitrary<ImageType>;

// Image types that preserve original values (excludes name_only_list which has special handling)
const regularImageTypeArb = fc.constantFrom(
  'receipt',
  'product_list',
  'invoice',
  'unknown'
) as fc.Arbitrary<ImageType>;

const validProductArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  price: fc.float({ min: 0, max: 10000, noNaN: true }),
  quantity: fc.integer({ min: 1, max: 1000 }),
  unit: fc.option(fc.constantFrom('pieces', 'kg', 'g', 'l', 'ml', 'pack'), { nil: undefined }),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
});

// AI response for regular image types (not name_only_list)
const regularAIResponseArb = fc.record({
  imageType: regularImageTypeArb,
  products: fc.array(validProductArb, { minLength: 0, maxLength: 20 }),
});

// AI response for all image types including name_only_list
const validAIResponseArb = fc.record({
  imageType: imageTypeArb,
  products: fc.array(validProductArb, { minLength: 0, maxLength: 20 }),
});

// ============================================================================
// Property 1: OCR to AI Pipeline Integrity
// **Feature: ai-product-extraction, Property 1: OCR to AI Pipeline Integrity**
// **Validates: Requirements 1.1, 1.2**
// ============================================================================

describe('Property 1: OCR to AI Pipeline Integrity', () => {
  /**
   * For any image buffer passed to the extraction service, the system SHALL
   * first call AWS Textract to extract raw text, then pass that text to AWS
   * Bedrock for parsing, and return structured product data.
   * 
   * Since we cannot test actual AWS services in unit tests, we test the
   * pipeline logic by verifying:
   * 1. The conversion functions maintain data integrity
   * 2. Products are correctly transformed through the pipeline
   * 3. Confidence scores are properly calculated
   */

  it('Property 1: AI response products are correctly converted to AIExtractedProduct format', () => {
    // Use regularAIResponseArb to exclude name_only_list which has special handling (Property 7)
    fc.assert(
      fc.property(regularAIResponseArb, (aiResponse) => {
        const products = convertToAIExtractedProducts(aiResponse);

        // Verify product count is preserved
        expect(products.length).toBe(aiResponse.products.length);

        // Verify each product has required fields
        for (let i = 0; i < products.length; i++) {
          const original = aiResponse.products[i];
          const converted = products[i];

          // Name is preserved
          expect(converted.name).toBe(original.name);

          // Price is preserved (non-negative)
          expect(converted.price).toBe(original.price);
          expect(converted.price).toBeGreaterThanOrEqual(0);

          // Quantity is preserved (>= 1)
          expect(converted.quantity).toBe(original.quantity);
          expect(converted.quantity).toBeGreaterThanOrEqual(1);

          // Unit is preserved
          expect(converted.unit).toBe(original.unit);

          // Confidence object exists with all required fields
          expect(converted.confidence).toBeDefined();
          expect(typeof converted.confidence.name).toBe('number');
          expect(typeof converted.confidence.price).toBe('number');
          expect(typeof converted.confidence.quantity).toBe('number');
          expect(typeof converted.confidence.brand).toBe('number');
          expect(typeof converted.confidence.overall).toBe('number');

          // needsReview is a boolean
          expect(typeof converted.needsReview).toBe('boolean');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: Confidence scores are bounded between 0 and 1', () => {
    fc.assert(
      fc.property(validAIResponseArb, (aiResponse) => {
        const products = convertToAIExtractedProducts(aiResponse);

        for (const product of products) {
          expect(product.confidence.name).toBeGreaterThanOrEqual(0);
          expect(product.confidence.name).toBeLessThanOrEqual(1);

          expect(product.confidence.price).toBeGreaterThanOrEqual(0);
          expect(product.confidence.price).toBeLessThanOrEqual(1);

          expect(product.confidence.quantity).toBeGreaterThanOrEqual(0);
          expect(product.confidence.quantity).toBeLessThanOrEqual(1);

          expect(product.confidence.brand).toBeGreaterThanOrEqual(0);
          expect(product.confidence.brand).toBeLessThanOrEqual(1);

          expect(product.confidence.overall).toBeGreaterThanOrEqual(0);
          expect(product.confidence.overall).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1: Pipeline preserves product data integrity through conversion', () => {
    // Use regularAIResponseArb to exclude name_only_list which has special handling (Property 7)
    fc.assert(
      fc.property(regularAIResponseArb, (aiResponse) => {
        const products = convertToAIExtractedProducts(aiResponse);

        // All original products should be present in output
        expect(products.length).toBe(aiResponse.products.length);

        // Product names should match exactly
        const originalNames = aiResponse.products.map(p => p.name);
        const convertedNames = products.map(p => p.name);
        expect(convertedNames).toEqual(originalNames);

        // Product prices should match exactly
        const originalPrices = aiResponse.products.map(p => p.price);
        const convertedPrices = products.map(p => p.price);
        expect(convertedPrices).toEqual(originalPrices);

        // Product quantities should match exactly
        const originalQuantities = aiResponse.products.map(p => p.quantity);
        const convertedQuantities = products.map(p => p.quantity);
        expect(convertedQuantities).toEqual(originalQuantities);
      }),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 3: Low Confidence Field Highlighting
// **Feature: ai-product-extraction, Property 3: Low Confidence Field Highlighting**
// **Validates: Requirements 1.6**
// ============================================================================

describe('Property 3: Low Confidence Field Highlighting', () => {
  /**
   * For any extracted product where any field has confidence below 0.7,
   * the product SHALL have needsReview set to true and the low-confidence
   * fields SHALL be flagged.
   */

  // Arbitrary for products with varying confidence levels
  const productWithConfidenceArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    price: fc.float({ min: 0, max: 10000, noNaN: true }),
    quantity: fc.integer({ min: 1, max: 1000 }),
    unit: fc.option(fc.constantFrom('pieces', 'kg', 'g', 'l', 'ml', 'pack'), { nil: undefined }),
    confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  });

  it('Property 3: Products with low confidence fields are flagged for review', () => {
    fc.assert(
      fc.property(productWithConfidenceArb, (product) => {
        const fieldConfidence = calculateFieldConfidence(product);
        const requiresReview = needsReview(fieldConfidence);

        // If any field confidence is below 0.7, needsReview should be true
        const hasLowConfidenceField =
          fieldConfidence.name < 0.7 ||
          fieldConfidence.price < 0.7 ||
          fieldConfidence.quantity < 0.7 ||
          fieldConfidence.overall < 0.7;

        expect(requiresReview).toBe(hasLowConfidenceField);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3: High confidence products do not need review', () => {
    // Generate products with high base confidence
    const highConfidenceProductArb = fc.record({
      name: fc.string({ minLength: 3, maxLength: 100 }), // Longer names get higher confidence
      price: fc.float({ min: 1, max: 10000, noNaN: true }), // Non-zero prices get higher confidence
      quantity: fc.integer({ min: 1, max: 1000 }),
      unit: fc.option(fc.constantFrom('pieces', 'kg', 'g', 'l', 'ml', 'pack'), { nil: undefined }),
      confidence: fc.float({ min: Math.fround(0.9), max: 1, noNaN: true }), // High base confidence
    });

    fc.assert(
      fc.property(highConfidenceProductArb, (product) => {
        const fieldConfidence = calculateFieldConfidence(product);
        
        // With high base confidence, name > 2 chars, and price > 0,
        // all field confidences should be >= 0.7
        expect(fieldConfidence.name).toBeGreaterThanOrEqual(0.7);
        expect(fieldConfidence.price).toBeGreaterThanOrEqual(0.7);
        expect(fieldConfidence.quantity).toBeGreaterThanOrEqual(0.7);
        
        // Overall should also be high (though brand starts at 0, it has low weight)
        // Note: brand confidence is 0, so overall = 0.4*name + 0.3*price + 0.2*quantity + 0.1*0
        // With all fields at 0.9+, overall should be around 0.81+
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3: Zero price products have low price confidence', () => {
    const zeroPriceProductArb = fc.record({
      name: fc.string({ minLength: 3, maxLength: 100 }),
      price: fc.constant(0), // Zero price
      quantity: fc.integer({ min: 1, max: 1000 }),
      unit: fc.option(fc.constantFrom('pieces', 'kg', 'g', 'l', 'ml', 'pack'), { nil: undefined }),
      confidence: fc.float({ min: 0.5, max: 1, noNaN: true }),
    });

    fc.assert(
      fc.property(zeroPriceProductArb, (product) => {
        const fieldConfidence = calculateFieldConfidence(product);
        
        // Zero price should result in low price confidence (30% of base)
        expect(fieldConfidence.price).toBeLessThan(0.7);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3: Short name products have lower name confidence', () => {
    const shortNameProductArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 2 }), // Very short names
      price: fc.float({ min: 1, max: 10000, noNaN: true }),
      quantity: fc.integer({ min: 1, max: 1000 }),
      unit: fc.option(fc.constantFrom('pieces', 'kg', 'g', 'l', 'ml', 'pack'), { nil: undefined }),
      confidence: fc.float({ min: 0.5, max: 1, noNaN: true }),
    });

    fc.assert(
      fc.property(shortNameProductArb, (product) => {
        const fieldConfidence = calculateFieldConfidence(product);
        
        // Short names (<=2 chars) should have reduced confidence (50% of base)
        expect(fieldConfidence.name).toBeLessThanOrEqual(product.confidence * 0.5);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3: needsReview is consistent with confidence thresholds', () => {
    fc.assert(
      fc.property(productWithConfidenceArb, (product) => {
        const fieldConfidence = calculateFieldConfidence(product);
        const requiresReview = needsReview(fieldConfidence);

        // Verify the needsReview function correctly checks all thresholds
        const manualCheck =
          fieldConfidence.name < 0.7 ||
          fieldConfidence.price < 0.7 ||
          fieldConfidence.quantity < 0.7 ||
          fieldConfidence.overall < 0.7;

        expect(requiresReview).toBe(manualCheck);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Unit Tests for Edge Cases
// ============================================================================

describe('calculateFieldConfidence Edge Cases', () => {
  it('handles empty product name', () => {
    const product = { name: '', price: 10, quantity: 1, confidence: 0.9 };
    const confidence = calculateFieldConfidence(product);
    
    // Empty name should have reduced confidence
    expect(confidence.name).toBeLessThan(0.9);
  });

  it('handles zero quantity', () => {
    const product = { name: 'Test Product', price: 10, quantity: 0, confidence: 0.9 };
    const confidence = calculateFieldConfidence(product);
    
    // Zero quantity should have reduced confidence
    expect(confidence.quantity).toBeLessThan(0.9);
  });

  it('handles maximum confidence', () => {
    const product = { name: 'Test Product', price: 10, quantity: 1, confidence: 1.0 };
    const confidence = calculateFieldConfidence(product);
    
    // All confidences should be <= 1
    expect(confidence.name).toBeLessThanOrEqual(1);
    expect(confidence.price).toBeLessThanOrEqual(1);
    expect(confidence.quantity).toBeLessThanOrEqual(1);
    expect(confidence.overall).toBeLessThanOrEqual(1);
  });

  it('handles minimum confidence', () => {
    const product = { name: 'Test Product', price: 10, quantity: 1, confidence: 0 };
    const confidence = calculateFieldConfidence(product);
    
    // All confidences should be >= 0
    expect(confidence.name).toBeGreaterThanOrEqual(0);
    expect(confidence.price).toBeGreaterThanOrEqual(0);
    expect(confidence.quantity).toBeGreaterThanOrEqual(0);
    expect(confidence.overall).toBeGreaterThanOrEqual(0);
  });
});

describe('convertToAIExtractedProducts Edge Cases', () => {
  it('handles empty product array', () => {
    const aiResponse = { imageType: 'receipt' as ImageType, products: [] };
    const products = convertToAIExtractedProducts(aiResponse);
    
    expect(products).toEqual([]);
  });

  it('handles single product', () => {
    const aiResponse = {
      imageType: 'receipt' as ImageType,
      products: [{ name: 'Test', price: 10, quantity: 1, confidence: 0.9 }],
    };
    const products = convertToAIExtractedProducts(aiResponse);
    
    expect(products.length).toBe(1);
    expect(products[0].name).toBe('Test');
    expect(products[0].price).toBe(10);
  });
});

// ============================================================================
// Property 7: Name-Only List Default Values
// **Feature: ai-product-extraction, Property 7: Name-Only List Default Values**
// **Validates: Requirements 3.1, 3.2**
// ============================================================================

describe('Property 7: Name-Only List Default Values', () => {
  /**
   * For any image classified as "name_only_list", all extracted products
   * SHALL have price set to 0 and quantity set to 1.
   */

  // Arbitrary for product names
  const productNameArb = fc.string({ minLength: 1, maxLength: 100 });
  const confidenceArb = fc.float({ min: 0, max: 1, noNaN: true });

  // Arbitrary for name-only product input
  const nameOnlyProductInputArb = fc.record({
    name: productNameArb,
    confidence: confidenceArb,
  });

  // Arbitrary for array of name-only products
  const nameOnlyProductsArrayArb = fc.array(nameOnlyProductInputArb, { minLength: 1, maxLength: 20 });

  it('Property 7: isNameOnlyList correctly identifies name_only_list image type', () => {
    // Test all image types
    expect(isNameOnlyList('name_only_list')).toBe(true);
    expect(isNameOnlyList('receipt')).toBe(false);
    expect(isNameOnlyList('product_list')).toBe(false);
    expect(isNameOnlyList('invoice')).toBe(false);
    expect(isNameOnlyList('unknown')).toBe(false);
  });

  it('Property 7: All name-only products have price set to 0', () => {
    fc.assert(
      fc.property(nameOnlyProductsArrayArb, (products) => {
        const processed = processNameOnlyProducts(products);

        // Every product should have price = 0
        for (const product of processed) {
          expect(product.price).toBe(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7: All name-only products have quantity set to 1', () => {
    fc.assert(
      fc.property(nameOnlyProductsArrayArb, (products) => {
        const processed = processNameOnlyProducts(products);

        // Every product should have quantity = 1
        for (const product of processed) {
          expect(product.quantity).toBe(1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7: Name-only products preserve original names', () => {
    fc.assert(
      fc.property(nameOnlyProductsArrayArb, (products) => {
        const processed = processNameOnlyProducts(products);

        // Product count should be preserved
        expect(processed.length).toBe(products.length);

        // Names should be preserved
        for (let i = 0; i < products.length; i++) {
          expect(processed[i].name).toBe(products[i].name);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7: Name-only products mark price as needing user input', () => {
    fc.assert(
      fc.property(nameOnlyProductsArrayArb, (products) => {
        const processed = processNameOnlyProducts(products);

        // Every product should have needsUserInput.price = true
        for (const product of processed) {
          expect(product.needsUserInput.price).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7: convertToAIExtractedProducts handles name_only_list correctly', () => {
    fc.assert(
      fc.property(nameOnlyProductsArrayArb, (products) => {
        // Create an AI response with name_only_list type
        const aiResponse = {
          imageType: 'name_only_list' as ImageType,
          products: products.map((p) => ({
            name: p.name,
            price: 999, // This should be overridden to 0
            quantity: 999, // This should be overridden to 1
            confidence: p.confidence,
          })),
        };

        const converted = convertToAIExtractedProducts(aiResponse);

        // All products should have price = 0 and quantity = 1
        for (const product of converted) {
          expect(product.price).toBe(0);
          expect(product.quantity).toBe(1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7: Name-only products always need review', () => {
    fc.assert(
      fc.property(nameOnlyProductsArrayArb, (products) => {
        const nameOnlyProducts = processNameOnlyProducts(products);
        const converted = convertNameOnlyToAIExtractedProducts(nameOnlyProducts);

        // All name-only products should need review
        for (const product of converted) {
          expect(product.needsReview).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7: Name-only products have low price confidence', () => {
    fc.assert(
      fc.property(nameOnlyProductsArrayArb, (products) => {
        const nameOnlyProducts = processNameOnlyProducts(products);
        const converted = convertNameOnlyToAIExtractedProducts(nameOnlyProducts);

        // Price confidence should be very low (< 0.7) since it's a default value
        for (const product of converted) {
          expect(product.confidence.price).toBeLessThan(0.7);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Unit Tests for Name-Only List Edge Cases
// ============================================================================

describe('Name-Only List Edge Cases', () => {
  it('handles empty name-only product array', () => {
    const processed = processNameOnlyProducts([]);
    expect(processed).toEqual([]);
  });

  it('handles single name-only product', () => {
    const processed = processNameOnlyProducts([{ name: 'Test Product', confidence: 0.9 }]);
    
    expect(processed.length).toBe(1);
    expect(processed[0].name).toBe('Test Product');
    expect(processed[0].price).toBe(0);
    expect(processed[0].quantity).toBe(1);
    expect(processed[0].needsUserInput.price).toBe(true);
  });

  it('convertToAIExtractedProducts uses regular processing for non-name-only lists', () => {
    const aiResponse = {
      imageType: 'receipt' as ImageType,
      products: [{ name: 'Test', price: 10, quantity: 2, confidence: 0.9 }],
    };
    const products = convertToAIExtractedProducts(aiResponse);
    
    // Should preserve original price and quantity for receipts
    expect(products[0].price).toBe(10);
    expect(products[0].quantity).toBe(2);
  });
});

// ============================================================================
// Property 8: Master Product Matching
// **Feature: ai-product-extraction, Property 8: Master Product Matching**
// **Validates: Requirements 3.4, 3.5**
// ============================================================================

describe('Property 8: Master Product Matching', () => {
  /**
   * For any extracted product name, the system SHALL attempt to match against
   * the master_products table, and if a match is found with confidence >= 0.8,
   * the price and description SHALL be pre-populated from the master product.
   */

  // Arbitrary for master product records
  const masterProductArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 3, maxLength: 100 }),
    description: fc.string({ minLength: 1, maxLength: 500 }),
    price: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
    category: fc.string({ minLength: 1, maxLength: 50 }),
    subcategory: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    brand: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  });

  const masterProductsArrayArb = fc.array(masterProductArb, { minLength: 1, maxLength: 20 });

  // Arbitrary for extracted products
  const extractedProductArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    price: fc.float({ min: 0, max: 10000, noNaN: true }),
    quantity: fc.integer({ min: 1, max: 100 }),
    unit: fc.option(fc.constantFrom('pieces', 'kg', 'g', 'l', 'ml', 'pack'), { nil: undefined }),
    confidence: fc.record({
      name: fc.float({ min: 0, max: 1, noNaN: true }),
      price: fc.float({ min: 0, max: 1, noNaN: true }),
      quantity: fc.float({ min: 0, max: 1, noNaN: true }),
      brand: fc.float({ min: 0, max: 1, noNaN: true }),
      overall: fc.float({ min: 0, max: 1, noNaN: true }),
    }),
    needsReview: fc.boolean(),
  });

  it('Property 8: String similarity returns 1 for identical strings', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (str) => {
        const similarity = calculateStringSimilarity(str, str);
        expect(similarity).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: String similarity is symmetric', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (str1, str2) => {
          const sim1 = calculateStringSimilarity(str1, str2);
          const sim2 = calculateStringSimilarity(str2, str1);
          expect(sim1).toBeCloseTo(sim2, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: String similarity is bounded between 0 and 1', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 0, maxLength: 100 }),
        (str1, str2) => {
          const similarity = calculateStringSimilarity(str1, str2);
          expect(similarity).toBeGreaterThanOrEqual(0);
          expect(similarity).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: findBestMasterProductMatch returns null for empty master products', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (productName) => {
        const match = findBestMasterProductMatch(productName, []);
        expect(match).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: findBestMasterProductMatch returns exact match with confidence 1', () => {
    fc.assert(
      fc.property(masterProductArb, (masterProduct) => {
        const match = findBestMasterProductMatch(masterProduct.name, [masterProduct]);
        
        expect(match).not.toBeNull();
        expect(match!.matchConfidence).toBe(1);
        expect(match!.id).toBe(masterProduct.id);
        expect(match!.price).toBe(masterProduct.price);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: High confidence matches (>= 0.8) pre-populate price from master product', () => {
    // Create products that will have high confidence matches
    fc.assert(
      fc.property(masterProductArb, (masterProduct) => {
        const extractedProduct: AIExtractedProduct = {
          name: masterProduct.name, // Exact match
          price: 0, // Original price
          quantity: 1,
          confidence: {
            name: 0.8,
            price: 0.1,
            quantity: 0.5,
            brand: 0,
            overall: 0.35,
          },
          needsReview: true,
        };

        const enriched = enrichProductsWithMasterData([extractedProduct], [masterProduct]);

        // Should have master product match
        expect(enriched[0].masterProductMatch).toBeDefined();
        expect(enriched[0].masterProductMatch!.matchConfidence).toBe(1);
        
        // Price should be pre-populated from master product (Requirement 3.5)
        expect(enriched[0].price).toBe(masterProduct.price);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: Low confidence matches (< 0.8) do not pre-populate price', () => {
    // Create products with names that won't match well
    const originalPrice = 99.99;
    const extractedProduct: AIExtractedProduct = {
      name: 'Completely Different Product XYZ123',
      price: originalPrice,
      quantity: 1,
      confidence: {
        name: 0.8,
        price: 0.5,
        quantity: 0.5,
        brand: 0,
        overall: 0.5,
      },
      needsReview: true,
    };

    const masterProducts: MasterProductRecord[] = [
      {
        id: '123',
        name: 'Another Unrelated Item ABC',
        description: 'Test description',
        price: 50.00,
        category: 'Test',
      },
    ];

    const enriched = enrichProductsWithMasterData([extractedProduct], masterProducts);

    // Price should NOT be changed since match confidence is low
    expect(enriched[0].price).toBe(originalPrice);
  });

  it('Property 8: Enrichment preserves product count', () => {
    fc.assert(
      fc.property(
        fc.array(extractedProductArb, { minLength: 1, maxLength: 10 }),
        masterProductsArrayArb,
        (products, masterProducts) => {
          const enriched = enrichProductsWithMasterData(products as AIExtractedProduct[], masterProducts);
          expect(enriched.length).toBe(products.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: Enrichment preserves product names', () => {
    fc.assert(
      fc.property(
        fc.array(extractedProductArb, { minLength: 1, maxLength: 10 }),
        masterProductsArrayArb,
        (products, masterProducts) => {
          const enriched = enrichProductsWithMasterData(products as AIExtractedProduct[], masterProducts);
          
          for (let i = 0; i < products.length; i++) {
            expect(enriched[i].name).toBe(products[i].name);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: Match confidence is always between 0 and 1', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        masterProductsArrayArb,
        (productName, masterProducts) => {
          const match = findBestMasterProductMatch(productName, masterProducts);
          
          if (match) {
            expect(match.matchConfidence).toBeGreaterThanOrEqual(0);
            expect(match.matchConfidence).toBeLessThanOrEqual(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Unit Tests for Master Product Matching Edge Cases
// ============================================================================

describe('Master Product Matching Edge Cases', () => {
  it('handles empty product name', () => {
    const masterProducts: MasterProductRecord[] = [
      { id: '1', name: 'Test Product', description: 'Desc', price: 10, category: 'Test' },
    ];
    const match = findBestMasterProductMatch('', masterProducts);
    expect(match).toBeNull();
  });

  it('handles case-insensitive matching', () => {
    const masterProducts: MasterProductRecord[] = [
      { id: '1', name: 'Test Product', description: 'Desc', price: 10, category: 'Test' },
    ];
    const match = findBestMasterProductMatch('TEST PRODUCT', masterProducts);
    expect(match).not.toBeNull();
    expect(match!.matchConfidence).toBe(1);
  });

  it('handles whitespace in names', () => {
    const masterProducts: MasterProductRecord[] = [
      { id: '1', name: 'Test Product', description: 'Desc', price: 10, category: 'Test' },
    ];
    const match = findBestMasterProductMatch('  Test Product  ', masterProducts);
    expect(match).not.toBeNull();
    expect(match!.matchConfidence).toBe(1);
  });

  it('returns best match when multiple products exist', () => {
    const masterProducts: MasterProductRecord[] = [
      { id: '1', name: 'Apple iPhone 15', description: 'Phone', price: 999, category: 'Electronics' },
      { id: '2', name: 'Apple iPhone 15 Pro', description: 'Phone', price: 1199, category: 'Electronics' },
      { id: '3', name: 'Samsung Galaxy', description: 'Phone', price: 899, category: 'Electronics' },
    ];
    
    const match = findBestMasterProductMatch('Apple iPhone 15', masterProducts);
    expect(match).not.toBeNull();
    expect(match!.id).toBe('1'); // Exact match
    expect(match!.matchConfidence).toBe(1);
  });

  it('enrichProductsWithMasterData handles empty arrays', () => {
    const enriched = enrichProductsWithMasterData([], []);
    expect(enriched).toEqual([]);
  });
});
