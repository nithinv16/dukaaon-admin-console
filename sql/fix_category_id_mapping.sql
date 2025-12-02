-- ============================================================================
-- Fix Category/Subcategory ID Mapping in Products Table
-- ============================================================================
-- Purpose: 
--   1. Update FK constraints to allow category deletion (ON DELETE SET NULL)
--   2. Backfill category_id and subcategory_id from correct product names
--   3. Identify redundant categories/subcategories for cleanup
--
-- Run this script in your Supabase SQL editor
-- ============================================================================

-- ============================================================================
-- STEP 1: Update Foreign Key Constraints
-- ============================================================================
-- Add ON DELETE SET NULL so deleting categories doesn't fail
-- Products will have their IDs set to NULL when category is deleted

-- Drop existing FK constraints
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_subcategory_id_fkey;

-- Recreate with ON DELETE SET NULL behavior
ALTER TABLE products
  ADD CONSTRAINT products_category_id_fkey 
  FOREIGN KEY (category_id) 
  REFERENCES categories(id) 
  ON DELETE SET NULL;

ALTER TABLE products
  ADD CONSTRAINT products_subcategory_id_fkey 
  FOREIGN KEY (subcategory_id) 
  REFERENCES subcategories(id) 
  ON DELETE SET NULL;

-- Verify constraints were created
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'products'::regclass
  AND conname IN ('products_category_id_fkey', 'products_subcategory_id_fkey');


-- ============================================================================
-- STEP 2: Backfill category_id from Product Names (Auto-Create if Missing)
-- ============================================================================
-- For each unique category name in products:
-- 1. Check if it exists in categories table
-- 2. If not, create it
-- 3. Then update products with the category_id

-- Show before state
SELECT 
  COUNT(*) as total_products,
  COUNT(category) as with_category_name,
  COUNT(category_id) as with_category_id,
  COUNT(category) - COUNT(category_id) as missing_category_id
FROM products;

-- Create missing categories
DO $$
DECLARE
  cat_record RECORD;
  new_category_id UUID;
  category_slug TEXT;
  existing_category_id UUID;
BEGIN
  -- Loop through all unique category names in products that don't have a match
  FOR cat_record IN 
    SELECT DISTINCT TRIM(p.category) as category_name
    FROM products p
    WHERE p.category IS NOT NULL 
      AND p.category_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM categories c 
        WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(p.category))
      )
  LOOP
    -- Generate slug from category name
    category_slug := LOWER(REGEXP_REPLACE(cat_record.category_name, '[^a-zA-Z0-9]+', '-', 'g'));
    category_slug := TRIM(BOTH '-' FROM category_slug);
    
    -- Check if category with this slug already exists
    SELECT id INTO existing_category_id FROM categories WHERE slug = category_slug LIMIT 1;
    
    IF existing_category_id IS NULL THEN
      -- Insert new category
      INSERT INTO categories (name, slug)
      VALUES (cat_record.category_name, category_slug)
      RETURNING id INTO new_category_id;
      
      RAISE NOTICE 'Created category: % (ID: %)', cat_record.category_name, new_category_id;
    ELSE
      RAISE NOTICE 'Category slug already exists: % (using existing ID: %)', category_slug, existing_category_id;
    END IF;
  END LOOP;
END $$;

-- Now update all products with their category_id
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE LOWER(TRIM(p.category)) = LOWER(TRIM(c.name))
  AND p.category IS NOT NULL
  AND p.category_id IS NULL;

-- Show after state
SELECT 
  COUNT(*) as total_products,
  COUNT(category) as with_category_name,
  COUNT(category_id) as with_category_id,
  COUNT(category) - COUNT(category_id) as still_missing_category_id
FROM products;

-- Report any remaining unmatched products (should be zero now)
SELECT 
  category,
  COUNT(*) as product_count
FROM products
WHERE category IS NOT NULL 
  AND category_id IS NULL
GROUP BY category
ORDER BY COUNT(*) DESC;


-- ============================================================================
-- STEP 3: Backfill subcategory_id from Product Names (Auto-Create if Missing)
-- ============================================================================
-- For each unique subcategory name in products:
-- 1. Check if it exists in subcategories table under the correct category
-- 2 If not, create it
-- 3. Then update products with the subcategory_id

-- Show before state
SELECT 
  COUNT(*) as total_products,
  COUNT(subcategory) as with_subcategory_name,
  COUNT(subcategory_id) as with_subcategory_id,
  COUNT(subcategory) - COUNT(subcategory_id) as missing_subcategory_id
FROM products
WHERE subcategory IS NOT NULL;

-- Create missing subcategories
DO $$
DECLARE
  sub_record RECORD;
  new_subcategory_id UUID;
  subcategory_slug TEXT;
  existing_subcategory_id UUID;
  existing_category_id UUID;
  category_slug TEXT;
  final_slug TEXT;
  final_name TEXT;
  slug_counter INTEGER;
BEGIN
  -- Loop through all unique subcategory names in products that don't have a match
  FOR sub_record IN 
    SELECT DISTINCT 
      p.category_id,
      TRIM(p.subcategory) as subcategory_name,
      TRIM(p.category) as category_name
    FROM products p
    WHERE p.subcategory IS NOT NULL 
      AND p.category_id IS NOT NULL
      AND p.subcategory_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM subcategories s 
        WHERE LOWER(TRIM(s.name)) = LOWER(TRIM(p.subcategory))
          AND s.category_id = p.category_id
      )
  LOOP
    -- Generate base slug from subcategory name
    subcategory_slug := LOWER(REGEXP_REPLACE(sub_record.subcategory_name, '[^a-zA-Z0-9]+', '-', 'g'));
    subcategory_slug := TRIM(BOTH '-' FROM subcategory_slug);
    
    -- Check if a subcategory with this exact name already exists (globally)
    SELECT id, category_id INTO existing_subcategory_id, existing_category_id
    FROM subcategories 
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(sub_record.subcategory_name))
    LIMIT 1;
    
    IF existing_subcategory_id IS NOT NULL THEN
      -- Subcategory name exists globally
      IF existing_category_id = sub_record.category_id THEN
        -- It's already under the correct category, we'll use it
        RAISE NOTICE 'Subcategory already exists: % under % (ID: %)', 
          sub_record.subcategory_name, sub_record.category_name, existing_subcategory_id;
      ELSE
        -- Name exists but under different category - we need to create with modified name
        -- Get category slug for making unique name
        SELECT slug INTO category_slug FROM categories WHERE id = sub_record.category_id;
        
        final_name := sub_record.subcategory_name || ' (' || initcap(sub_record.category_name) || ')';
        final_slug := subcategory_slug || '-' || category_slug;
        
        -- Ensure both name and slug are unique
        slug_counter := 1;
        WHILE EXISTS (SELECT 1 FROM subcategories WHERE name = final_name OR slug = final_slug) LOOP
          final_name := sub_record.subcategory_name || ' (' || initcap(sub_record.category_name) || ' ' || slug_counter || ')';
          final_slug := subcategory_slug || '-' || category_slug || '-' || slug_counter;
          slug_counter := slug_counter + 1;
        END LOOP;
        
        -- Insert with modified name
        INSERT INTO subcategories (name, slug, category_id)
        VALUES (final_name, final_slug, sub_record.category_id)
        RETURNING id INTO new_subcategory_id;
        
        RAISE NOTICE 'Created subcategory with modified name: % (original: %) under % with slug: % (ID: %)', 
          final_name, sub_record.subcategory_name, sub_record.category_name, final_slug, new_subcategory_id;
      END IF;
    ELSE
      -- Name doesn't exist, safe to create
      -- But still check if slug exists
      SELECT id INTO existing_subcategory_id FROM subcategories WHERE slug = subcategory_slug LIMIT 1;
      
      IF existing_subcategory_id IS NOT NULL THEN
        -- Slug exists, make it unique
        SELECT slug INTO category_slug FROM categories WHERE id = sub_record.category_id;
        final_slug := subcategory_slug || '-' || category_slug;
        
        slug_counter := 1;
        WHILE EXISTS (SELECT 1 FROM subcategories WHERE slug = final_slug) LOOP
          final_slug := subcategory_slug || '-' || category_slug || '-' || slug_counter;
          slug_counter := slug_counter + 1;
        END LOOP;
      ELSE
        final_slug := subcategory_slug;
      END IF;
      
      -- Insert new subcategory with original name and unique slug
      INSERT INTO subcategories (name, slug, category_id)
      VALUES (sub_record.subcategory_name, final_slug, sub_record.category_id)
      RETURNING id INTO new_subcategory_id;
      
      RAISE NOTICE 'Created subcategory: % under category: % with slug: % (ID: %)', 
        sub_record.subcategory_name, sub_record.category_name, final_slug, new_subcategory_id;
    END IF;
  END LOOP;
END $$;

-- Now update all products with their subcategory_id
-- This matches by exact name under the correct category
UPDATE products p
SET subcategory_id = s.id
FROM subcategories s
WHERE LOWER(TRIM(p.subcategory)) = LOWER(TRIM(s.name))
  AND s.category_id = p.category_id
  AND p.subcategory IS NOT NULL
  AND p.category_id IS NOT NULL
  AND p.subcategory_id IS NULL;

-- Show after state
SELECT 
  COUNT(*) as total_products,
  COUNT(subcategory) as with_subcategory_name,
  COUNT(subcategory_id) as with_subcategory_id,
  COUNT(subcategory) - COUNT(subcategory_id) as still_missing_subcategory_id
FROM products
WHERE subcategory IS NOT NULL;

-- Report any remaining unmatched products (should be zero now)
SELECT 
  category,
  subcategory,
  COUNT(*) as product_count
FROM products
WHERE subcategory IS NOT NULL 
  AND subcategory_id IS NULL
GROUP BY category, subcategory
ORDER BY COUNT(*) DESC;


-- ============================================================================
-- STEP 4: Find Redundant Categories/Subcategories for Cleanup
-- ============================================================================

-- Categories not referenced by any products (safe to delete)
SELECT 
  c.id,
  c.name,
  c.created_at,
  COALESCE(COUNT(p.id), 0) as product_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.id, c.name, c.created_at
HAVING COUNT(p.id) = 0
ORDER BY c.name;

-- Subcategories not referenced by any products (safe to delete)
SELECT 
  s.id,
  s.name,
  c.name as parent_category,
  s.created_at,
  COALESCE(COUNT(p.id), 0) as product_count
FROM subcategories s
JOIN categories c ON c.id = s.category_id
LEFT JOIN products p ON p.subcategory_id = s.id
GROUP BY s.id, s.name, c.name, s.created_at
HAVING COUNT(p.id) = 0
ORDER BY c.name, s.name;


-- ============================================================================
-- STEP 5: Summary Report
-- ============================================================================

-- Overall mapping status
SELECT 
  'Categories' as mapping_type,
  COUNT(*) FILTER (WHERE category IS NOT NULL) as has_name,
  COUNT(*) FILTER (WHERE category_id IS NOT NULL) as has_id,
  COUNT(*) FILTER (WHERE category IS NOT NULL AND category_id IS NULL) as name_without_id,
  COUNT(*) FILTER (WHERE category IS NULL AND category_id IS NOT NULL) as id_without_name
FROM products

UNION ALL

SELECT 
  'Subcategories' as mapping_type,
  COUNT(*) FILTER (WHERE subcategory IS NOT NULL) as has_name,
  COUNT(*) FILTER (WHERE subcategory_id IS NOT NULL) as has_id,
  COUNT(*) FILTER (WHERE subcategory IS NOT NULL AND subcategory_id IS NULL) as name_without_id,
  COUNT(*) FILTER (WHERE subcategory IS NULL AND subcategory_id IS NOT NULL) as id_without_name
FROM products;

-- Top 10 categories by product count
SELECT 
  c.name as category_name,
  COUNT(p.id) as product_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.id, c.name
ORDER BY COUNT(p.id) DESC
LIMIT 10;
