-- Create product_variants table for managing product variations
-- This is an additive migration that does not modify existing products table structure
-- Requirements: 3.9 - Use additive migrations that do not modify or delete existing columns

-- Create product_variants table
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    variant_type TEXT NOT NULL CHECK (variant_type IN ('size', 'flavor', 'color', 'weight', 'pack')),
    variant_value TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    mrp DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url TEXT,
    is_default BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique SKU per product
    UNIQUE(product_id, sku),
    -- Ensure unique variant type/value combination per product
    UNIQUE(product_id, variant_type, variant_value)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_type ON product_variants(variant_type);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_variants_default ON product_variants(product_id, is_default) WHERE is_default = true;

-- Enable RLS on product_variants table
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_variants

-- Sellers can view variants of their own products
CREATE POLICY "Sellers can view their product variants" ON public.product_variants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM products p 
            WHERE p.id = product_variants.product_id 
            AND p.seller_id = auth.uid()
        )
    );

-- Sellers can insert variants for their own products
CREATE POLICY "Sellers can insert their product variants" ON public.product_variants
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM products p 
            WHERE p.id = product_variants.product_id 
            AND p.seller_id = auth.uid()
        )
    );

-- Sellers can update variants of their own products
CREATE POLICY "Sellers can update their product variants" ON public.product_variants
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM products p 
            WHERE p.id = product_variants.product_id 
            AND p.seller_id = auth.uid()
        )
    );

-- Sellers can delete variants of their own products
CREATE POLICY "Sellers can delete their product variants" ON public.product_variants
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM products p 
            WHERE p.id = product_variants.product_id 
            AND p.seller_id = auth.uid()
        )
    );

-- Allow authenticated users to view active variants of available products
CREATE POLICY "Allow authenticated users to view active variants" ON public.product_variants
    FOR SELECT TO authenticated USING (
        is_active = true 
        AND EXISTS (
            SELECT 1 FROM products p 
            WHERE p.id = product_variants.product_id 
            AND p.stock_available > 0
        )
    );

-- Function to update variant stock
CREATE OR REPLACE FUNCTION update_variant_stock(
    p_variant_id UUID,
    p_quantity_change INTEGER,
    p_operation TEXT DEFAULT 'subtract' -- 'add' or 'subtract'
)
RETURNS BOOLEAN AS $$
DECLARE
    current_stock INTEGER;
    new_stock INTEGER;
BEGIN
    -- Get current stock
    SELECT stock_quantity INTO current_stock
    FROM product_variants
    WHERE id = p_variant_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant not found';
    END IF;
    
    -- Calculate new stock
    IF p_operation = 'add' THEN
        new_stock := current_stock + p_quantity_change;
    ELSE
        new_stock := current_stock - p_quantity_change;
    END IF;
    
    -- Ensure stock doesn't go negative
    IF new_stock < 0 THEN
        RAISE EXCEPTION 'Insufficient stock. Current: %, Requested: %', current_stock, p_quantity_change;
    END IF;
    
    -- Update stock
    UPDATE product_variants 
    SET 
        stock_quantity = new_stock,
        updated_at = NOW()
    WHERE id = p_variant_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get all variants for a product
CREATE OR REPLACE FUNCTION get_product_variants(p_product_id UUID)
RETURNS TABLE (
    id UUID,
    sku VARCHAR,
    variant_type TEXT,
    variant_value TEXT,
    price DECIMAL,
    mrp DECIMAL,
    stock_quantity INTEGER,
    image_url TEXT,
    is_default BOOLEAN,
    display_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pv.id,
        pv.sku,
        pv.variant_type,
        pv.variant_value,
        pv.price,
        pv.mrp,
        pv.stock_quantity,
        pv.image_url,
        pv.is_default,
        pv.display_order
    FROM product_variants pv
    WHERE 
        pv.product_id = p_product_id
        AND pv.is_active = true
    ORDER BY pv.variant_type, pv.display_order, pv.variant_value;
END;
$$ LANGUAGE plpgsql;

-- Function to get default variant for a product
CREATE OR REPLACE FUNCTION get_default_variant(p_product_id UUID)
RETURNS TABLE (
    id UUID,
    sku VARCHAR,
    variant_type TEXT,
    variant_value TEXT,
    price DECIMAL,
    mrp DECIMAL,
    stock_quantity INTEGER,
    image_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pv.id,
        pv.sku,
        pv.variant_type,
        pv.variant_value,
        pv.price,
        pv.mrp,
        pv.stock_quantity,
        pv.image_url
    FROM product_variants pv
    WHERE 
        pv.product_id = p_product_id
        AND pv.is_active = true
        AND pv.is_default = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_variant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_variant_timestamp
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_variant_updated_at();

-- Log the table creation
DO $$
BEGIN
    RAISE NOTICE 'product_variants table created successfully with RLS policies and helper functions';
END $$;
