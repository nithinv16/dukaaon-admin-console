-- Phase 2: Advanced Admin Console Features
-- Database tables for app configuration, feature flags, dynamic content, and messaging

-- ============================================
-- 1. APP CONFIGURATION TABLE
-- ============================================
-- Stores application-wide configuration settings
CREATE TABLE IF NOT EXISTS public.app_configs (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  scope TEXT NOT NULL DEFAULT 'global', -- 'global', 'role', 'region', 'user'
  scope_value TEXT, -- Specific value for scope (e.g., role name, region name, user_id)
  updated_by UUID REFERENCES admin_credentials(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_configs_scope ON public.app_configs(scope, scope_value);
CREATE INDEX IF NOT EXISTS idx_app_configs_updated_at ON public.app_configs(updated_at DESC);

COMMENT ON TABLE public.app_configs IS 'Application configuration key-value store';
COMMENT ON COLUMN public.app_configs.scope IS 'Configuration scope: global, role, region, or user';
COMMENT ON COLUMN public.app_configs.scope_value IS 'Specific value for scope (e.g., retailer, BLR, user_id)';

-- ============================================
-- 2. FEATURE FLAGS TABLE
-- ============================================
-- Manages feature toggles for gradual rollouts
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_type TEXT NOT NULL DEFAULT 'global', -- 'global', 'role', 'region', 'percentage', 'user_list'
  config JSONB DEFAULT '{}', -- Rollout configuration
  updated_by UUID REFERENCES admin_credentials(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON public.feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_rollout_type ON public.feature_flags(rollout_type);

COMMENT ON TABLE public.feature_flags IS 'Feature toggle management for gradual rollouts';
COMMENT ON COLUMN public.feature_flags.rollout_type IS 'Rollout strategy: global, role, region, percentage, or user_list';
COMMENT ON COLUMN public.feature_flags.config IS 'JSON configuration for rollout (e.g., {"roles": ["retailer"], "percentage": 50, "user_ids": [...]})';

-- ============================================
-- 3. DYNAMIC CONTENT SLOTS TABLE
-- ============================================
-- Defines content slots in the app (e.g., home_top_banner, home_deals_strip)
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
-- 4. DYNAMIC CONTENT ITEMS TABLE
-- ============================================
-- Stores actual content items (banners, carousels, etc.)
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
-- 5. ADMIN MESSAGES TABLE
-- ============================================
-- Stores warnings and messages sent by admins to users
CREATE TABLE IF NOT EXISTS public.admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Specific user (nullable for broadcast)
  target_role TEXT, -- 'retailer', 'wholesaler', 'manufacturer' (nullable for specific user)
  target_region TEXT, -- City/region targeting (nullable)
  severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
  type TEXT NOT NULL, -- 'policy_violation', 'system_update', 'payment_reminder', 'account_warning', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- Extra info, links, action buttons
  requires_ack BOOLEAN NOT NULL DEFAULT false, -- User must acknowledge
  send_via_whatsapp BOOLEAN DEFAULT false,
  send_via_sms BOOLEAN DEFAULT false,
  send_via_push BOOLEAN DEFAULT false,
  created_by UUID REFERENCES admin_credentials(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_target_user ON public.admin_messages(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_target_role ON public.admin_messages(target_role);
CREATE INDEX IF NOT EXISTS idx_admin_messages_severity ON public.admin_messages(severity);
CREATE INDEX IF NOT EXISTS idx_admin_messages_type ON public.admin_messages(type);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created_at ON public.admin_messages(created_at DESC);

COMMENT ON TABLE public.admin_messages IS 'Admin warnings and messages to users';
COMMENT ON COLUMN public.admin_messages.target_user_id IS 'Specific user ID (null for broadcast messages)';
COMMENT ON COLUMN public.admin_messages.requires_ack IS 'Whether user must acknowledge this message';

-- ============================================
-- 6. ADMIN MESSAGE STATUSES TABLE
-- ============================================
-- Tracks delivery and read status of messages
CREATE TABLE IF NOT EXISTS public.admin_message_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES admin_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_message_statuses_message_id ON public.admin_message_statuses(message_id);
CREATE INDEX IF NOT EXISTS idx_admin_message_statuses_user_id ON public.admin_message_statuses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_message_statuses_unique ON public.admin_message_statuses(message_id, user_id);

COMMENT ON TABLE public.admin_message_statuses IS 'Tracks delivery and read status of admin messages';

-- ============================================
-- 7. ADMIN AUDIT LOG TABLE
-- ============================================
-- Tracks all admin actions for audit purposes
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_credentials(id),
  action TEXT NOT NULL, -- 'update_user', 'change_feature_flag', 'send_warning', 'update_order', etc.
  entity_type TEXT NOT NULL, -- 'user', 'order', 'product', 'config', 'content', 'message'
  entity_id TEXT, -- ID of the affected entity (as string for flexibility)
  before_data JSONB,
  after_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON public.admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

COMMENT ON TABLE public.admin_audit_log IS 'Audit trail for all admin actions';

-- ============================================
-- 8. TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_app_configs_updated_at
  BEFORE UPDATE ON app_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dynamic_content_slots_updated_at
  BEFORE UPDATE ON dynamic_content_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dynamic_content_items_updated_at
  BEFORE UPDATE ON dynamic_content_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Function to check if a feature flag is enabled for a user
CREATE OR REPLACE FUNCTION is_feature_enabled(
  feature_name TEXT,
  user_role TEXT DEFAULT NULL,
  user_region TEXT DEFAULT NULL,
  user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  flag_record RECORD;
BEGIN
  SELECT * INTO flag_record
  FROM feature_flags
  WHERE name = feature_name;

  IF NOT FOUND OR NOT flag_record.enabled THEN
    RETURN false;
  END IF;

  -- Check rollout type
  CASE flag_record.rollout_type
    WHEN 'global' THEN
      RETURN true;
    WHEN 'role' THEN
      IF user_role IS NULL THEN RETURN false; END IF;
      RETURN (flag_record.config->>'roles')::jsonb ? user_role;
    WHEN 'region' THEN
      IF user_region IS NULL THEN RETURN false; END IF;
      RETURN (flag_record.config->>'regions')::jsonb ? user_region;
    WHEN 'percentage' THEN
      -- Simple hash-based percentage rollout
      IF user_id IS NULL THEN RETURN false; END IF;
      RETURN (abs(hashtext(user_id::text)) % 100) < (flag_record.config->>'percentage')::int;
    WHEN 'user_list' THEN
      IF user_id IS NULL THEN RETURN false; END IF;
      RETURN (flag_record.config->>'user_ids')::jsonb ? user_id::text;
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get active dynamic content for a slot
CREATE OR REPLACE FUNCTION get_active_content_for_slot(
  slot_code TEXT,
  user_role TEXT DEFAULT NULL,
  user_region TEXT DEFAULT NULL,
  user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  subtitle TEXT,
  image_url TEXT,
  deeplink TEXT,
  payload JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dci.id,
    dci.type,
    dci.title,
    dci.subtitle,
    dci.image_url,
    dci.deeplink,
    dci.payload
  FROM dynamic_content_items dci
  JOIN dynamic_content_slots dcs ON dci.slot_id = dcs.id
  WHERE
    dcs.code = slot_code
    AND dci.is_active = true
    AND (dci.start_at IS NULL OR dci.start_at <= NOW())
    AND (dci.end_at IS NULL OR dci.end_at >= NOW())
    AND (
      -- No targeting (global)
      dci.targeting = '{}'::jsonb
      OR
      -- Role targeting
      (user_role IS NOT NULL AND (dci.targeting->>'roles')::jsonb ? user_role)
      OR
      -- Region targeting
      (user_region IS NOT NULL AND (dci.targeting->>'regions')::jsonb ? user_region)
      OR
      -- User ID targeting
      (user_id IS NOT NULL AND (dci.targeting->>'user_ids')::jsonb ? user_id::text)
    )
  ORDER BY dci.priority DESC, dci.created_at DESC
  LIMIT (SELECT max_items FROM dynamic_content_slots WHERE code = slot_code);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 10. INITIAL DATA (OPTIONAL)
-- ============================================

-- Insert default content slots
INSERT INTO dynamic_content_slots (code, name, description, allowed_types, max_items)
VALUES
  ('home_top_banner', 'Home Top Banner', 'Main banner at the top of home screen', ARRAY['banner'], 1),
  ('home_deals_strip', 'Home Deals Strip', 'Deals carousel on home screen', ARRAY['carousel', 'banner'], 5),
  ('home_featured_categories', 'Home Featured Categories', 'Featured categories grid', ARRAY['product_grid'], 8),
  ('category_header', 'Category Header', 'Banner at top of category pages', ARRAY['banner'], 1)
ON CONFLICT (code) DO NOTHING;

-- Insert default app configs
INSERT INTO app_configs (key, value, description, scope)
VALUES
  ('maintenance_mode', '{"enabled": false, "message": ""}', 'Enable/disable maintenance mode', 'global'),
  ('allow_registration', '{"enabled": true}', 'Allow new user registrations', 'global'),
  ('min_order_amount', '{"retailer": 300, "wholesaler": 1000}', 'Minimum order amount by role', 'role'),
  ('max_cart_size', '{"value": 50}', 'Maximum items in cart', 'global'),
  ('free_delivery_threshold', '{"value": 500}', 'Order amount for free delivery', 'global')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- END OF PHASE 2 TABLES
-- ============================================

