-- Add variant_product_id to product_variants table
-- This links variant entries to the actual variant product (separate product card)
-- Allows each variant to be a separate product while still being linked in product_variants

-- Add variant_product_id column (nullable, references the actual variant product)
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS variant_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_product_variants_variant_product_id ON public.product_variants(variant_product_id) WHERE variant_product_id IS NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.product_variants.variant_product_id IS 'References the actual product entry for this variant. Each variant is a separate product card, but linked via product_variants table.';

