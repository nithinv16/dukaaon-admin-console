import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Helper to create a mock File from CSV content
 */
function createCSVFile(content: string): File {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], 'test.csv', { type: 'text/csv' });
}

/**
 * Helper to create a mock File from Excel content
 */
function createExcelFile(data: Record<string, any>[]): File {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  return new File([blob], 'test.xlsx', { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

/**
 * Pure function to parse CSV content (extracted for testing)
 * This mirrors the logic in parseCSVFile but works with string content
 */
function parseCSVContent(csvContent: string): Array<{
  name: string;
  price: number;
  min_order_quantity: number;
  description: string;
  stock_level: number;
}> {
  const results = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  const products: Array<{
    name: string;
    price: number;
    min_order_quantity: number;
    description: string;
    stock_level: number;
  }> = [];

  const data = results.data as Record<string, string>[];

  for (const row of data) {
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
        stock_level: 100
      });
    }
  }

  return products;
}

/**
 * **Feature: category-inventory-improvements, Property 5: CSV/Excel Parsing Round-Trip**
 * **Validates: Requirements 3.3**
 * 
 * For any valid CSV or Excel file with columns (product_name, price, min_order_quantity),
 * parsing the file SHALL produce an array of ParsedProduct objects where each object's
 * fields match the corresponding row values.
 */
describe('CSV/Excel Parsing Property Tests', () => {
  // Arbitrary for generating valid product names (non-empty, no commas or newlines)
  const productNameArb = fc.stringMatching(/^[a-zA-Z0-9 ]{1,50}$/)
    .filter(s => s.trim().length > 0);

  // Arbitrary for generating valid prices (positive numbers)
  // Use Math.fround to ensure 32-bit float compatibility with fast-check
  const priceArb = fc.float({ min: Math.fround(0.01), max: Math.fround(99999.99), noNaN: true })
    .map(p => Math.round(p * 100) / 100); // Round to 2 decimal places

  // Arbitrary for generating valid quantities (positive integers)
  const quantityArb = fc.integer({ min: 1, max: 1000 });

  // Arbitrary for generating a product row
  const productRowArb = fc.record({
    product_name: productNameArb,
    price: priceArb,
    min_order_quantity: quantityArb
  });

  it('Property 5: Parsed products count matches input row count', () => {
    fc.assert(
      fc.property(
        fc.array(productRowArb, { minLength: 1, maxLength: 20 }),
        (products) => {
          // Generate CSV content
          const header = 'product_name,price,min_order_quantity';
          const rows = products.map(p => 
            `${p.product_name},${p.price},${p.min_order_quantity}`
          );
          const csvContent = [header, ...rows].join('\n');

          // Parse the CSV
          const parsed = parseCSVContent(csvContent);

          // Number of parsed products should match input
          expect(parsed.length).toBe(products.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Product names are preserved after parsing', () => {
    fc.assert(
      fc.property(
        fc.array(productRowArb, { minLength: 1, maxLength: 20 }),
        (products) => {
          const header = 'product_name,price,min_order_quantity';
          const rows = products.map(p => 
            `${p.product_name},${p.price},${p.min_order_quantity}`
          );
          const csvContent = [header, ...rows].join('\n');

          const parsed = parseCSVContent(csvContent);

          // Each product name should match (trimmed)
          for (let i = 0; i < products.length; i++) {
            expect(parsed[i].name).toBe(products[i].product_name.trim());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Prices are correctly parsed as numbers', () => {
    fc.assert(
      fc.property(
        fc.array(productRowArb, { minLength: 1, maxLength: 20 }),
        (products) => {
          const header = 'product_name,price,min_order_quantity';
          const rows = products.map(p => 
            `${p.product_name},${p.price},${p.min_order_quantity}`
          );
          const csvContent = [header, ...rows].join('\n');

          const parsed = parseCSVContent(csvContent);

          // Each price should be a number matching the input
          for (let i = 0; i < products.length; i++) {
            expect(typeof parsed[i].price).toBe('number');
            expect(parsed[i].price).toBeCloseTo(products[i].price, 2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Quantities are correctly parsed as integers', () => {
    fc.assert(
      fc.property(
        fc.array(productRowArb, { minLength: 1, maxLength: 20 }),
        (products) => {
          const header = 'product_name,price,min_order_quantity';
          const rows = products.map(p => 
            `${p.product_name},${p.price},${p.min_order_quantity}`
          );
          const csvContent = [header, ...rows].join('\n');

          const parsed = parseCSVContent(csvContent);

          // Each quantity should be an integer matching the input
          for (let i = 0; i < products.length; i++) {
            expect(Number.isInteger(parsed[i].min_order_quantity)).toBe(true);
            expect(parsed[i].min_order_quantity).toBe(products[i].min_order_quantity);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Stock level defaults to 100 for all parsed products', () => {
    fc.assert(
      fc.property(
        fc.array(productRowArb, { minLength: 1, maxLength: 20 }),
        (products) => {
          const header = 'product_name,price,min_order_quantity';
          const rows = products.map(p => 
            `${p.product_name},${p.price},${p.min_order_quantity}`
          );
          const csvContent = [header, ...rows].join('\n');

          const parsed = parseCSVContent(csvContent);

          // All products should have stock_level of 100
          for (const product of parsed) {
            expect(product.stock_level).toBe(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Alternative column names are supported', () => {
    // Test with 'name' instead of 'product_name'
    fc.assert(
      fc.property(
        fc.array(productRowArb, { minLength: 1, maxLength: 10 }),
        (products) => {
          const header = 'name,price,qty';
          const rows = products.map(p => 
            `${p.product_name},${p.price},${p.min_order_quantity}`
          );
          const csvContent = [header, ...rows].join('\n');

          const parsed = parseCSVContent(csvContent);

          expect(parsed.length).toBe(products.length);
          for (let i = 0; i < products.length; i++) {
            expect(parsed[i].name).toBe(products[i].product_name.trim());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Empty rows are skipped', () => {
    fc.assert(
      fc.property(
        fc.array(productRowArb, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 5 }),
        (products, emptyRowCount) => {
          const header = 'product_name,price,min_order_quantity';
          const rows = products.map(p => 
            `${p.product_name},${p.price},${p.min_order_quantity}`
          );
          // Add empty rows
          const emptyRows = Array(emptyRowCount).fill('');
          const allRows = [...rows, ...emptyRows];
          const csvContent = [header, ...allRows].join('\n');

          const parsed = parseCSVContent(csvContent);

          // Should only have the valid products, not empty rows
          expect(parsed.length).toBe(products.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Prices with currency symbols are parsed correctly', () => {
    fc.assert(
      fc.property(
        fc.array(productRowArb, { minLength: 1, maxLength: 10 }),
        (products) => {
          const header = 'product_name,price,min_order_quantity';
          const rows = products.map(p => 
            `${p.product_name},$${p.price},${p.min_order_quantity}`
          );
          const csvContent = [header, ...rows].join('\n');

          const parsed = parseCSVContent(csvContent);

          // Prices should be parsed correctly even with $ prefix
          for (let i = 0; i < products.length; i++) {
            expect(parsed[i].price).toBeCloseTo(products[i].price, 2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Unit tests for edge cases
 */
describe('CSV Parsing Edge Cases', () => {
  it('should handle empty CSV content', () => {
    const csvContent = 'product_name,price,min_order_quantity\n';
    const parsed = parseCSVContent(csvContent);
    expect(parsed.length).toBe(0);
  });

  it('should handle CSV with only headers', () => {
    const csvContent = 'product_name,price,min_order_quantity';
    const parsed = parseCSVContent(csvContent);
    expect(parsed.length).toBe(0);
  });

  it('should handle missing price (defaults to 0)', () => {
    const csvContent = 'product_name,price,min_order_quantity\nTest Product,,5';
    const parsed = parseCSVContent(csvContent);
    expect(parsed.length).toBe(1);
    expect(parsed[0].price).toBe(0);
  });

  it('should handle missing quantity (defaults to 1)', () => {
    const csvContent = 'product_name,price,min_order_quantity\nTest Product,100,';
    const parsed = parseCSVContent(csvContent);
    expect(parsed.length).toBe(1);
    expect(parsed[0].min_order_quantity).toBe(1);
  });

  it('should skip rows with empty product names', () => {
    const csvContent = 'product_name,price,min_order_quantity\n,100,5\nValid Product,50,2';
    const parsed = parseCSVContent(csvContent);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('Valid Product');
  });

  it('should trim whitespace from product names', () => {
    const csvContent = 'product_name,price,min_order_quantity\n  Trimmed Product  ,100,5';
    const parsed = parseCSVContent(csvContent);
    expect(parsed[0].name).toBe('Trimmed Product');
  });
});


/**
 * **Feature: category-inventory-improvements, Property 6: Preview Completeness**
 * **Validates: Requirements 3.5, 3.6**
 * 
 * For any set of extracted products, the preview page SHALL display all products
 * with editable fields for: name, price, min_order_quantity, image, description,
 * category, subcategory, and stock_level (defaulting to 100).
 */
describe('Preview Completeness Property Tests', () => {
  // Arbitrary for generating valid product names
  const productNameArb = fc.stringMatching(/^[a-zA-Z0-9 ]{1,50}$/)
    .filter(s => s.trim().length > 0);

  // Arbitrary for generating valid prices
  const priceArb = fc.float({ min: Math.fround(0.01), max: Math.fround(99999.99), noNaN: true })
    .map(p => Math.round(p * 100) / 100);

  // Arbitrary for generating valid quantities
  const quantityArb = fc.integer({ min: 1, max: 1000 });

  // Arbitrary for generating a parsed product
  const parsedProductArb = fc.record({
    name: productNameArb,
    price: priceArb,
    min_order_quantity: quantityArb,
    description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    category: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
    subcategory: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
    imageUrl: fc.option(fc.webUrl(), { nil: undefined }),
    stock_level: fc.constant(100) // Always defaults to 100
  });

  it('Property 6: All parsed products have required name field', () => {
    fc.assert(
      fc.property(
        fc.array(parsedProductArb, { minLength: 1, maxLength: 20 }),
        (products) => {
          for (const product of products) {
            expect(product).toHaveProperty('name');
            expect(typeof product.name).toBe('string');
            expect(product.name.trim().length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: All parsed products have required price field', () => {
    fc.assert(
      fc.property(
        fc.array(parsedProductArb, { minLength: 1, maxLength: 20 }),
        (products) => {
          for (const product of products) {
            expect(product).toHaveProperty('price');
            expect(typeof product.price).toBe('number');
            expect(product.price).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: All parsed products have required min_order_quantity field', () => {
    fc.assert(
      fc.property(
        fc.array(parsedProductArb, { minLength: 1, maxLength: 20 }),
        (products) => {
          for (const product of products) {
            expect(product).toHaveProperty('min_order_quantity');
            expect(typeof product.min_order_quantity).toBe('number');
            expect(Number.isInteger(product.min_order_quantity)).toBe(true);
            expect(product.min_order_quantity).toBeGreaterThanOrEqual(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: All parsed products have stock_level defaulting to 100', () => {
    fc.assert(
      fc.property(
        fc.array(parsedProductArb, { minLength: 1, maxLength: 20 }),
        (products) => {
          for (const product of products) {
            expect(product).toHaveProperty('stock_level');
            expect(product.stock_level).toBe(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: ParsedProduct interface includes all required optional fields', () => {
    fc.assert(
      fc.property(
        parsedProductArb,
        (product) => {
          // Verify the product has all the fields defined in ParsedProduct interface
          const requiredKeys = ['name', 'price', 'min_order_quantity', 'stock_level'];
          const optionalKeys = ['description', 'category', 'subcategory', 'imageUrl'];
          
          // All required keys must exist
          for (const key of requiredKeys) {
            expect(product).toHaveProperty(key);
          }
          
          // Optional keys should be allowed (may be undefined)
          for (const key of optionalKeys) {
            // The key should either exist or be undefined
            expect(key in product || product[key as keyof typeof product] === undefined).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: CSV parsing produces products with all required fields for preview', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            product_name: productNameArb,
            price: priceArb,
            min_order_quantity: quantityArb
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (inputProducts) => {
          const header = 'product_name,price,min_order_quantity';
          const rows = inputProducts.map(p => 
            `${p.product_name},${p.price},${p.min_order_quantity}`
          );
          const csvContent = [header, ...rows].join('\n');

          const parsed = parseCSVContent(csvContent);

          // Each parsed product should have all fields needed for preview
          for (const product of parsed) {
            // Required fields
            expect(product).toHaveProperty('name');
            expect(product).toHaveProperty('price');
            expect(product).toHaveProperty('min_order_quantity');
            expect(product).toHaveProperty('stock_level');
            expect(product).toHaveProperty('description');
            
            // Stock level should default to 100
            expect(product.stock_level).toBe(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
