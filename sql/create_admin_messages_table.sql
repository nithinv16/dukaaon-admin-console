-- Create admin_messages table and related tables
-- This is a standalone script to create the admin_messages table
-- Run this if you haven't run phase2_tables.sql yet

-- ============================================
-- ADMIN MESSAGES TABLE
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
  created_by UUID REFERENCES admin_credentials(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_target_user ON public.admin_messages(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_target_role ON public.admin_messages(target_role);
CREATE INDEX IF NOT EXISTS idx_admin_messages_severity ON public.admin_messages(severity);
CREATE INDEX IF NOT EXISTS idx_admin_messages_type ON public.admin_messages(type);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created_at ON public.admin_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created_by ON public.admin_messages(created_by);

COMMENT ON TABLE public.admin_messages IS 'Admin warnings and messages to users';
COMMENT ON COLUMN public.admin_messages.target_user_id IS 'Specific user ID (null for broadcast messages)';
COMMENT ON COLUMN public.admin_messages.requires_ack IS 'Whether user must acknowledge this message';

-- ============================================
-- ADMIN MESSAGE STATUSES TABLE
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

