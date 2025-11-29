-- Employee Activity Tracking System
-- This system tracks all employee actions with detailed metrics

-- =====================================================
-- 1. ADMIN SESSIONS TABLE
-- Tracks login/logout sessions with location and duration
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.admin_credentials(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    location_city TEXT,
    location_country TEXT,
    location_region TEXT,
    login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    logout_time TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    duration_minutes INTEGER, -- Calculated when session ends
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON public.admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_login_time ON public.admin_sessions(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_is_active ON public.admin_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_session_token ON public.admin_sessions(session_token);

-- =====================================================
-- 2. ADMIN ACTIVITY METRICS TABLE
-- Tracks detailed metrics for each action performed
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_activity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.admin_credentials(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.admin_sessions(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'create_product', 'update_product', 'delete_product', 'bulk_upload', 'scan_receipt', etc.
    entity_type TEXT NOT NULL, -- 'product', 'master_product', 'category', etc.
    entity_id UUID,
    operation_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    operation_end_time TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER, -- Duration in milliseconds
    duration_seconds DECIMAL(10, 3), -- Duration in seconds (for precise calculations)
    items_processed INTEGER DEFAULT 1, -- Number of items (e.g., products uploaded in bulk)
    operation_status TEXT DEFAULT 'success' CHECK (operation_status IN ('success', 'failed', 'partial')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}', -- Additional context (file size, image count, etc.)
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_activity_metrics_admin_id ON public.admin_activity_metrics(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_metrics_session_id ON public.admin_activity_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_metrics_action_type ON public.admin_activity_metrics(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_metrics_entity_type ON public.admin_activity_metrics(entity_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_metrics_operation_start_time ON public.admin_activity_metrics(operation_start_time DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_metrics_duration_ms ON public.admin_activity_metrics(duration_ms);

-- =====================================================
-- 3. ENHANCED AUDIT LOG TABLE (if not exists, extend existing)
-- Extended audit log with better tracking
-- =====================================================

-- Check if audit_log table exists and add columns if needed
DO $$
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_log' 
        AND column_name = 'duration_ms'
    ) THEN
        ALTER TABLE public.audit_log 
        ADD COLUMN duration_ms INTEGER,
        ADD COLUMN ip_address INET,
        ADD COLUMN user_agent TEXT,
        ADD COLUMN session_id UUID REFERENCES public.admin_sessions(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_audit_log_session_id ON public.audit_log(session_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_duration_ms ON public.audit_log(duration_ms);
    END IF;
END $$;

-- =====================================================
-- 4. FUNCTIONS
-- =====================================================

-- Function to update session duration on logout
CREATE OR REPLACE FUNCTION public.update_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.logout_time IS NOT NULL AND OLD.logout_time IS NULL THEN
        NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.logout_time - NEW.login_time)) / 60;
        NEW.is_active := false;
        NEW.last_activity := NEW.logout_time;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update duration on logout
DROP TRIGGER IF EXISTS trigger_update_session_duration ON public.admin_sessions;
CREATE TRIGGER trigger_update_session_duration
    BEFORE UPDATE ON public.admin_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_session_duration();

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_admin_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_admin_sessions_updated_at ON public.admin_sessions;
CREATE TRIGGER trigger_update_admin_sessions_updated_at
    BEFORE UPDATE ON public.admin_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_admin_sessions_updated_at();

-- Function to get employee activity summary
CREATE OR REPLACE FUNCTION public.get_employee_activity_summary(
    p_admin_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_sessions', COUNT(DISTINCT s.id),
        'total_time_worked_minutes', COALESCE(SUM(s.duration_minutes), 0),
        'total_login_time', MIN(s.login_time),
        'last_logout_time', MAX(s.logout_time),
        'products_created', COUNT(CASE WHEN m.action_type = 'create_product' AND m.entity_type = 'product' THEN 1 END),
        'products_updated', COUNT(CASE WHEN m.action_type = 'update_product' AND m.entity_type = 'product' THEN 1 END),
        'master_products_created', COUNT(CASE WHEN m.action_type = 'create_product' AND m.entity_type = 'master_product' THEN 1 END),
        'master_products_updated', COUNT(CASE WHEN m.action_type = 'update_product' AND m.entity_type = 'master_product' THEN 1 END),
        'bulk_uploads', COUNT(CASE WHEN m.action_type = 'bulk_upload' THEN 1 END),
        'scan_receipts', COUNT(CASE WHEN m.action_type = 'scan_receipt' THEN 1 END),
        'total_items_processed', COALESCE(SUM(m.items_processed), 0),
        'avg_time_per_item_seconds', 
            CASE 
                WHEN COUNT(CASE WHEN m.items_processed > 0 THEN 1 END) > 0 
                THEN AVG(m.duration_seconds / NULLIF(m.items_processed, 0))
                ELSE NULL
            END,
        'avg_time_per_product_seconds',
            CASE 
                WHEN COUNT(CASE WHEN m.action_type = 'create_product' AND m.entity_type = 'product' THEN 1 END) > 0
                THEN AVG(CASE WHEN m.action_type = 'create_product' AND m.entity_type = 'product' THEN m.duration_seconds END)
                ELSE NULL
            END
    ) INTO result
    FROM public.admin_sessions s
    LEFT JOIN public.admin_activity_metrics m ON m.admin_id = s.admin_id 
        AND m.operation_start_time BETWEEN s.login_time AND COALESCE(s.logout_time, NOW())
    WHERE s.admin_id = p_admin_id
        AND s.login_time >= p_start_date
        AND s.login_time <= p_end_date;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_metrics ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role can access all admin sessions"
ON public.admin_sessions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can access all activity metrics"
ON public.admin_activity_metrics FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admins can view their own data (optional - you may want to restrict this)
CREATE POLICY "Admins can view their own sessions"
ON public.admin_sessions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can view their own activity"
ON public.admin_activity_metrics FOR SELECT
TO authenticated
USING (true);

-- =====================================================
-- 6. GRANTS
-- =====================================================

GRANT ALL ON public.admin_sessions TO service_role;
GRANT ALL ON public.admin_activity_metrics TO service_role;
GRANT SELECT ON public.admin_sessions TO authenticated;
GRANT SELECT ON public.admin_activity_metrics TO authenticated;

COMMIT;

