-- Add brand column to products table if it doesn't exist
-- This migration adds brand support to the products table for receipt extraction

-- Check if brand column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'brand'
    ) THEN
        ALTER TABLE public.products 
        ADD COLUMN brand TEXT;
        
        -- Create index for brand column for better query performance
        CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
        
        RAISE NOTICE 'Brand column added to products table';
    ELSE
        RAISE NOTICE 'Brand column already exists in products table';
    END IF;
END $$;

