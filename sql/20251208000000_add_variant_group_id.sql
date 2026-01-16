-- Add variant_group_id to products table to link variant products together
-- This allows each variant to be a separate product card, but linked for variant switching

-- Add variant_group_id column (nullable, so existing products are not affected)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS variant_group_id UUID;

-- Create index for efficient queries of variant groups
CREATE INDEX IF NOT EXISTS idx_products_variant_group_id ON public.products(variant_group_id) WHERE variant_group_id IS NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.products.variant_group_id IS 'Links variant products together. Products with the same variant_group_id are variants of each other and can be switched between when viewing any variant.';

