-- Create Admin Audit Log Table
-- Run this if you haven't run phase2_tables.sql yet
-- This creates the admin_audit_log table for tracking admin actions

-- ============================================
-- ADMIN AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_credentials(id) ON DELETE SET NULL,
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

-- Ensure the foreign key constraint has a proper name for Supabase PostgREST
ALTER TABLE public.admin_audit_log
DROP CONSTRAINT IF EXISTS admin_audit_log_admin_id_fkey;

ALTER TABLE public.admin_audit_log
ADD CONSTRAINT admin_audit_log_admin_id_fkey 
FOREIGN KEY (admin_id) 
REFERENCES public.admin_credentials(id) 
ON DELETE SET NULL;

-- Enable RLS (Row Level Security)
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow service role full access
DROP POLICY IF EXISTS "Service role can access admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "Service role can access admin_audit_log" 
ON public.admin_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

