# Migration Scripts

This directory contains data migration scripts for the admin console.

## Product Category Migration

**File:** `migrate-product-categories.ts`

**Purpose:** Backfills `category_id` and `subcategory_id` for existing products that only have category/subcategory text fields.

### Prerequisites

1. Ensure you have the required environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Install `tsx` if not already installed:
   ```bash
   npm install -D tsx
   ```

### Usage

Run the migration script:

```bash
npx tsx scripts/migrate-product-categories.ts
```

### What It Does

1. Finds all products where `category_id` or `subcategory_id` is NULL but category/subcategory text exists
2. For each product:
   - Looks up the category by name (case-insensitive)
   - Creates the category if it doesn't exist (with SEO-friendly slug)
   - Looks up the subcategory by name and category
   - Creates the subcategory if it doesn't exist
   - Updates the product with the correct IDs
3. Provides a summary of updated products and any errors

### Output Example

```
🔄 Starting product category migration...

📦 Found 150 product(s) that need migration

[1/150] Processing: "Coca Cola 500ml"
  Category: "Beverages", Subcategory: "Soft Drinks"
  ✓ Found existing category "Beverages" (ID: abc-123)
  ✓ Found existing subcategory "Soft Drinks" (ID: def-456)
  ✓ Updated product with category_id: abc-123, subcategory_id: def-456

[2/150] Processing: "Apple iPhone 15"
  Category: "Electronics"
  → Creating new category "Electronics"...
  ✓ Created new category "Electronics" (ID: ghi-789)
  ✓ Updated product with category_id: ghi-789, subcategory_id: null

...

============================================================
📊 Migration Summary:
   Total products processed: 150
   ✅ Successfully updated: 148
   ✗ Errors: 2
============================================================

✅ Migration completed successfully!
```

### Safety

- The script is **idempotent** - safe to run multiple times
- It only updates products that are missing IDs
- It will NOT overwrite existing category_id or subcategory_id values
- Creates categories/subcategories as needed with proper slugs

### Rollback

If you need to rollback the changes:

```sql
-- Reset category_id and subcategory_id for all products
UPDATE products 
SET category_id = NULL, subcategory_id = NULL;

-- Delete auto-created categories (optional)
DELETE FROM categories 
WHERE description LIKE 'Auto-created category for%';

-- Delete auto-created subcategories (optional)
DELETE FROM subcategories 
WHERE description LIKE 'Auto-created subcategory for%';
```
