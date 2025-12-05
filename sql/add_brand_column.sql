-- Add brand column to products table for AI-suggested brand extraction
-- This column stores the brand/manufacturer name extracted from receipts

-- Add brand column if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'brand'
    ) THEN
        ALTER TABLE products ADD COLUMN brand TEXT;
        COMMENT ON COLUMN products.brand IS 'Brand/manufacturer name (e.g., Cadbury, Parle, Britannia)';
    END IF;
END $$;

-- Create index on brand for faster queries
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

-- Example brands that may be extracted:
-- Chocolates: Cadbury, Nestle, Ferrero, Mars, Amul
-- Biscuits: Parle, Britannia, ITC, Sunfeast, Oreo
-- Snacks: Lays, Kurkure, Haldiram's, Bikaji, Balaji
-- Beverages: Coca-Cola, Pepsi, Thums Up, Sprite, 7UP, Fanta, Maaza, Frooti
-- Personal Care: Colgate, Oral-B, Dove, Lux, Lifebuoy, Pepsodent, Closeup
-- Dairy: Amul, Mother Dairy, Nestle, Britannia
-- Staples: Aashirvaad, Fortune, Saffola, Tata, Patanjali
-- Noodles: Maggi, Yippee, Top Ramen, Knorr, Ching's
