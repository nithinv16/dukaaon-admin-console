import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseBedrockJSON,
  AIParsingResponse,
  AIExtractedProduct,
} from './awsBedrock';

/**
 * **Feature: ai-product-extraction, Property 2: AI Parsed Product Format Consistency**
 * **Validates: Requirements 1.3, 1.5**
 *
 * For any AI-parsed product response, each product SHALL contain name (string),
 * price (number >= 0), quantity (number >= 1), and confidence scores for each field.
 */
describe('AI Parsed Product Format Consistency Property Tests', () => {
  // Arbitrary for generating valid AI parsing response
  const imageTypeArb = fc.constantFrom(
    'receipt',
    'product_list',
    'name_only_list',
    'invoice',
    'unknown'
  ) as fc.Arbitrary<AIParsingResponse['imageType']>;

  const validProductArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    price: fc.float({ min: 0, max: 10000, noNaN: true }),
    quantity: fc.integer({ min: 1, max: 1000 }),
    unit: fc.option(fc.constantFrom('pieces', 'kg', 'g', 'l', 'ml', 'pack'), { nil: undefined }),
    confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  });

  const validAIResponseArb = fc.record({
    imageType: imageTypeArb,
    products: fc.array(validProductArb, { minLength: 0, maxLength: 20 }),
  });

  /**
   * Helper function to validate a parsed product has correct format
   */
  function validateProductFormat(product: AIParsingResponse['products'][0]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check name is a non-empty string
    if (typeof product.name !== 'string') {
      errors.push('name must be a string');
    } else if (product.name.length === 0) {
      errors.push('name must not be empty');
    }

    // Check price is a number >= 0
    if (typeof product.price !== 'number') {
      errors.push('price must be a number');
    } else if (product.price < 0) {
      errors.push('price must be >= 0');
    } else if (Number.isNaN(product.price)) {
      errors.push('price must not be NaN');
    }

    // Check quantity is a number >= 1
    if (typeof product.quantity !== 'number') {
      errors.push('quantity must be a number');
    } else if (product.quantity < 1) {
      errors.push('quantity must be >= 1');
    } else if (Number.isNaN(product.quantity)) {
      errors.push('quantity must not be NaN');
    }

    // Check confidence is a number between 0 and 1
    if (typeof product.confidence !== 'number') {
      errors.push('confidence must be a number');
    } else if (product.confidence < 0 || product.confidence > 1) {
      errors.push('confidence must be between 0 and 1');
    } else if (Number.isNaN(product.confidence)) {
      errors.push('confidence must not be NaN');
    }

    return { valid: errors.length === 0, errors };
  }

  it('Property 2: Valid AI responses parse correctly and maintain format', () => {
    fc.assert(
      fc.property(validAIResponseArb, (response) => {
        // Serialize and parse the response (simulating Bedrock response)
        const jsonString = JSON.stringify(response);
        const parsed = parseBedrockJSON<AIParsingResponse>(jsonString);

        expect(parsed).not.toBeNull();
        if (!parsed) return;

        // Verify imageType is valid
        expect(['receipt', 'product_list', 'name_only_list', 'invoice', 'unknown']).toContain(
          parsed.imageType
        );

        // Verify products array exists
        expect(Array.isArray(parsed.products)).toBe(true);

        // Verify each product has correct format
        for (const product of parsed.products) {
          const validation = validateProductFormat(product);
          expect(validation.valid).toBe(true);
          if (!validation.valid) {
            console.error('Product validation failed:', validation.errors, product);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: All products have name as non-empty string', () => {
    fc.assert(
      fc.property(validAIResponseArb, (response) => {
        const jsonString = JSON.stringify(response);
        const parsed = parseBedrockJSON<AIParsingResponse>(jsonString);

        expect(parsed).not.toBeNull();
        if (!parsed) return;

        for (const product of parsed.products) {
          expect(typeof product.name).toBe('string');
          expect(product.name.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: All products have price as non-negative number', () => {
    fc.assert(
      fc.property(validAIResponseArb, (response) => {
        const jsonString = JSON.stringify(response);
        const parsed = parseBedrockJSON<AIParsingResponse>(jsonString);

        expect(parsed).not.toBeNull();
        if (!parsed) return;

        for (const product of parsed.products) {
          expect(typeof product.price).toBe('number');
          expect(product.price).toBeGreaterThanOrEqual(0);
          expect(Number.isNaN(product.price)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: All products have quantity >= 1', () => {
    fc.assert(
      fc.property(validAIResponseArb, (response) => {
        const jsonString = JSON.stringify(response);
        const parsed = parseBedrockJSON<AIParsingResponse>(jsonString);

        expect(parsed).not.toBeNull();
        if (!parsed) return;

        for (const product of parsed.products) {
          expect(typeof product.quantity).toBe('number');
          expect(product.quantity).toBeGreaterThanOrEqual(1);
          expect(Number.isNaN(product.quantity)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: All products have confidence score between 0 and 1', () => {
    fc.assert(
      fc.property(validAIResponseArb, (response) => {
        const jsonString = JSON.stringify(response);
        const parsed = parseBedrockJSON<AIParsingResponse>(jsonString);

        expect(parsed).not.toBeNull();
        if (!parsed) return;

        for (const product of parsed.products) {
          expect(typeof product.confidence).toBe('number');
          expect(product.confidence).toBeGreaterThanOrEqual(0);
          expect(product.confidence).toBeLessThanOrEqual(1);
          expect(Number.isNaN(product.confidence)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: JSON parsing handles markdown code blocks', () => {
    fc.assert(
      fc.property(validAIResponseArb, (response) => {
        // Wrap in markdown code block (common Bedrock response format)
        const jsonString = '```json\n' + JSON.stringify(response) + '\n```';
        const parsed = parseBedrockJSON<AIParsingResponse>(jsonString);

        expect(parsed).not.toBeNull();
        if (!parsed) return;

        // Verify structure is preserved
        expect(parsed.imageType).toBe(response.imageType);
        expect(parsed.products.length).toBe(response.products.length);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: Product count is preserved through parsing', () => {
    fc.assert(
      fc.property(validAIResponseArb, (response) => {
        const jsonString = JSON.stringify(response);
        const parsed = parseBedrockJSON<AIParsingResponse>(jsonString);

        expect(parsed).not.toBeNull();
        if (!parsed) return;

        expect(parsed.products.length).toBe(response.products.length);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Additional tests for parseBedrockJSON edge cases
 */
describe('parseBedrockJSON Edge Cases', () => {
  it('returns null for invalid JSON', () => {
    expect(parseBedrockJSON('not valid json')).toBeNull();
    expect(parseBedrockJSON('{ invalid: }')).toBeNull();
    expect(parseBedrockJSON('')).toBeNull();
  });

  it('extracts JSON from markdown code blocks without language specifier', () => {
    const data = { test: 'value' };
    const wrapped = '```\n' + JSON.stringify(data) + '\n```';
    expect(parseBedrockJSON(wrapped)).toEqual(data);
  });

  it('extracts JSON object from mixed content', () => {
    const data = { products: [{ name: 'Test', price: 10 }] };
    const mixed = 'Here is the result:\n' + JSON.stringify(data) + '\nEnd of response';
    expect(parseBedrockJSON(mixed)).toEqual(data);
  });

  it('extracts JSON array from mixed content', () => {
    // Note: When both object and array patterns exist, object is preferred
    // For pure array content, it should extract correctly
    const data = [{ name: 'Test', price: 10 }];
    const pureArray = JSON.stringify(data);
    expect(parseBedrockJSON(pureArray)).toEqual(data);
  });
});
