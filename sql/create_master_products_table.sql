-- Create master_products table for detailed product catalog
-- This table will store comprehensive product information with detailed specifications

-- Create the master_products table
CREATE TABLE IF NOT EXISTS public.master_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    category TEXT NOT NULL,
    subcategory TEXT,
    brand TEXT,
    sku TEXT UNIQUE,
    barcode TEXT UNIQUE,
    weight DECIMAL(8,2), -- in grams
    dimensions TEXT, -- format: "L x W x H"
    material TEXT,
    color TEXT,
    size TEXT,
    images TEXT[] DEFAULT '{}', -- array of image URLs
    specifications JSONB DEFAULT '{}', -- flexible specifications storage
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'inactive', 'draft')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_master_products_name ON public.master_products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_master_products_description ON public.master_products USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_master_products_category ON public.master_products(category);
CREATE INDEX IF NOT EXISTS idx_master_products_brand ON public.master_products(brand);
CREATE INDEX IF NOT EXISTS idx_master_products_sku ON public.master_products(sku);
CREATE INDEX IF NOT EXISTS idx_master_products_status ON public.master_products(status);
CREATE INDEX IF NOT EXISTS idx_master_products_created_at ON public.master_products(created_at DESC);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_master_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_master_products_updated_at ON public.master_products;
CREATE TRIGGER trigger_update_master_products_updated_at
    BEFORE UPDATE ON public.master_products
    FOR EACH ROW
    EXECUTE FUNCTION update_master_products_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Allow authenticated users to read all master products
CREATE POLICY "Allow authenticated users to read master products" ON public.master_products
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert master products
CREATE POLICY "Allow authenticated users to insert master products" ON public.master_products
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update master products
CREATE POLICY "Allow authenticated users to update master products" ON public.master_products
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to delete master products
CREATE POLICY "Allow authenticated users to delete master products" ON public.master_products
    FOR DELETE
    TO authenticated
    USING (true);

-- Insert some sample data
INSERT INTO public.master_products (
    name,
    description,
    price,
    category,
    subcategory,
    brand,
    sku,
    barcode,
    weight,
    dimensions,
    material,
    color,
    size,
    specifications,
    status
) VALUES 
(
    'Premium Wireless Headphones',
    'High-quality wireless headphones with noise cancellation and premium sound quality. Perfect for music lovers and professionals.',
    2999.00,
    'Electronics',
    'Audio',
    'AudioTech',
    'AT-WH-001',
    '1234567890123',
    350.00,
    '20 x 18 x 8 cm',
    'Plastic, Metal',
    'Black',
    'One Size',
    '{"battery_life": "30 hours", "connectivity": "Bluetooth 5.0", "noise_cancellation": true, "warranty": "2 years"}',
    'active'
),
(
    'Organic Cotton T-Shirt',
    'Comfortable and sustainable organic cotton t-shirt. Available in multiple colors and sizes.',
    899.00,
    'Clothing',
    'T-Shirts',
    'EcoWear',
    'EW-TS-002',
    '2345678901234',
    180.00,
    '70 x 50 x 2 cm',
    '100% Organic Cotton',
    'White',
    'Medium',
    '{"fabric": "Organic Cotton", "care_instructions": "Machine wash cold", "fit": "Regular", "origin": "India"}',
    'active'
),
(
    'Smart Home Security Camera',
    'Advanced security camera with AI detection, night vision, and cloud storage. Monitor your home from anywhere.',
    4999.00,
    'Electronics',
    'Security',
    'SecureHome',
    'SH-CAM-003',
    '3456789012345',
    420.00,
    '12 x 8 x 8 cm',
    'Plastic, Metal',
    'White',
    'Compact',
    '{"resolution": "4K", "night_vision": true, "ai_detection": true, "storage": "Cloud + Local", "connectivity": "WiFi"}',
    'active'
)
ON CONFLICT (sku) DO NOTHING;

-- Grant necessary permissions
GRANT ALL ON public.master_products TO authenticated;
GRANT ALL ON public.master_products TO service_role;

-- Create a view for master product statistics
CREATE OR REPLACE VIEW public.master_product_stats AS
SELECT 
    COUNT(*) as total_products,
    COUNT(*) FILTER (WHERE status = 'active') as active_products,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_products,
    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_products,
    COUNT(DISTINCT category) as total_categories,
    COUNT(DISTINCT brand) as total_brands
FROM public.master_products;

-- Grant permissions on the view
GRANT SELECT ON public.master_product_stats TO authenticated;
GRANT SELECT ON public.master_product_stats TO service_role;

COMMIT;