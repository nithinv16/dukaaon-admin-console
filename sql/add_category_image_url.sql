-- Ensure image_url columns exist in categories and subcategories tables
-- These columns store the URLs to the category/subcategory icons

-- Add image_url column to categories if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE categories ADD COLUMN image_url TEXT;
        COMMENT ON COLUMN categories.image_url IS 'URL to category icon image stored in category-images/categories-icon';
    END IF;
END $$;

-- Add image_url column to subcategories if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subcategories' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE subcategories ADD COLUMN image_url TEXT;
        COMMENT ON COLUMN subcategories.image_url IS 'URL to subcategory icon image stored in category-images/subcategories';
    END IF;
END $$;

-- Note: The category-images bucket should be created in Supabase Storage
-- with the following folder structure:
-- category-images/
--   categories-icon/     <-- for category icons
--   subcategories/       <-- for subcategory icons
--
-- Make sure the bucket has public access enabled for the images to be viewable
