-- Create Dynamic Content Tables
-- Run this if you haven't run phase2_tables.sql yet
-- This creates the dynamic_content_slots and dynamic_content_items tables

-- ============================================
-- DYNAMIC CONTENT SLOTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.dynamic_content_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- e.g., 'home_top_banner', 'home_deals_strip'
  name TEXT NOT NULL,
  description TEXT,
  allowed_types TEXT[] NOT NULL DEFAULT ARRAY['banner'], -- ['banner', 'carousel', 'html_block', 'product_grid']
  max_items INTEGER DEFAULT 1, -- Maximum items allowed in this slot
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dynamic_content_slots_code ON public.dynamic_content_slots(code);

COMMENT ON TABLE public.dynamic_content_slots IS 'Content slot definitions for dynamic content placement';
COMMENT ON COLUMN public.dynamic_content_slots.code IS 'Unique identifier for the content slot (e.g., home_top_banner)';
COMMENT ON COLUMN public.dynamic_content_slots.allowed_types IS 'Array of allowed content types for this slot';

-- ============================================
-- DYNAMIC CONTENT ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.dynamic_content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES dynamic_content_slots(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'banner', 'carousel_item', 'html_block', 'product_grid'
  title TEXT,
  subtitle TEXT,
  image_url TEXT,
  deeplink TEXT, -- e.g., 'dukaaon://category/xyz' or 'https://...'
  payload JSONB DEFAULT '{}', -- Extra config (badge text, colors, product_ids, etc.)
  targeting JSONB DEFAULT '{}', -- {roles: ['retailer'], cities: ['BLR'], user_ids: [...]}
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 0, -- Higher priority items shown first
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES admin_credentials(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dynamic_content_items_slot_id ON public.dynamic_content_items(slot_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_content_items_active ON public.dynamic_content_items(is_active);
CREATE INDEX IF NOT EXISTS idx_dynamic_content_items_dates ON public.dynamic_content_items(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_dynamic_content_items_priority ON public.dynamic_content_items(priority DESC);
CREATE INDEX IF NOT EXISTS idx_dynamic_content_items_targeting ON public.dynamic_content_items USING GIN(targeting);

COMMENT ON TABLE public.dynamic_content_items IS 'Dynamic content items (banners, carousels, etc.)';
COMMENT ON COLUMN public.dynamic_content_items.targeting IS 'JSON targeting rules: {roles: [], cities: [], user_ids: []}';
COMMENT ON COLUMN public.dynamic_content_items.payload IS 'Additional configuration: {badge_text, colors, product_ids, etc.}';

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dynamic_content_slots_updated_at
  BEFORE UPDATE ON dynamic_content_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dynamic_content_items_updated_at
  BEFORE UPDATE ON dynamic_content_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA - Default Content Slots
-- ============================================
INSERT INTO dynamic_content_slots (code, name, description, allowed_types, max_items)
VALUES
  ('home_top_banner', 'Home Top Banner', 'Main banner at the top of home screen', ARRAY['banner'], 1),
  ('home_deals_strip', 'Home Deals Strip', 'Deals carousel on home screen', ARRAY['carousel', 'banner'], 5),
  ('home_featured_categories', 'Home Featured Categories', 'Featured categories grid', ARRAY['product_grid'], 8),
  ('category_header', 'Category Header', 'Banner at top of category pages', ARRAY['banner'], 1)
ON CONFLICT (code) DO NOTHING;

-- Enable RLS (Row Level Security)
ALTER TABLE public.dynamic_content_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_content_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow service role full access
DROP POLICY IF EXISTS "Service role can access dynamic_content_slots" ON public.dynamic_content_slots;
CREATE POLICY "Service role can access dynamic_content_slots" 
ON public.dynamic_content_slots
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can access dynamic_content_items" ON public.dynamic_content_items;
CREATE POLICY "Service role can access dynamic_content_items" 
ON public.dynamic_content_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

