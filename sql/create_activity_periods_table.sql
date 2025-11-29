-- Activity Periods Tracking Table
-- Records discrete periods of activity within a session
-- Used to calculate actual working time vs idle time

CREATE TABLE IF NOT EXISTS public.admin_activity_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.admin_sessions(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES public.admin_credentials(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_periods_session ON public.admin_activity_periods(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_periods_admin ON public.admin_activity_periods(admin_id);
CREATE INDEX IF NOT EXISTS idx_activity_periods_start ON public.admin_activity_periods(period_start DESC);

-- Enable RLS
ALTER TABLE public.admin_activity_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Service role can access all activity periods" ON public.admin_activity_periods;
CREATE POLICY "Service role can access all activity periods"
ON public.admin_activity_periods FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view activity periods" ON public.admin_activity_periods;
CREATE POLICY "Admins can view activity periods"
ON public.admin_activity_periods FOR SELECT
TO authenticated
USING (true);

GRANT ALL ON public.admin_activity_periods TO service_role;
GRANT SELECT ON public.admin_activity_periods TO authenticated;

-- Function to calculate actual working time from activity periods
CREATE OR REPLACE FUNCTION public.get_session_working_time(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_time_minutes', COALESCE(
            (SELECT EXTRACT(EPOCH FROM (logout_time - login_time)) / 60 
             FROM admin_sessions WHERE id = p_session_id), 
            0
        ),
        'active_time_minutes', COALESCE(
            (SELECT SUM(duration_minutes) 
             FROM admin_activity_periods 
             WHERE session_id = p_session_id AND is_active = true),
            0
        ),
        'idle_time_minutes', COALESCE(
            (SELECT EXTRACT(EPOCH FROM (logout_time - login_time)) / 60 
             FROM admin_sessions WHERE id = p_session_id), 
            0
        ) - COALESCE(
            (SELECT SUM(duration_minutes) 
             FROM admin_activity_periods 
             WHERE session_id = p_session_id AND is_active = true),
            0
        ),
        'activity_periods_count', (
            SELECT COUNT(*) 
            FROM admin_activity_periods 
            WHERE session_id = p_session_id
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_working_time TO anon, authenticated, service_role;

-- Update get_employee_activity_summary to include active vs idle time
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
        'active_time_minutes', COALESCE(
            (SELECT SUM(duration_minutes) 
             FROM admin_activity_periods ap 
             WHERE ap.admin_id = p_admin_id 
             AND ap.period_start >= p_start_date 
             AND ap.period_start <= p_end_date
             AND ap.is_active = true),
            0
        ),
        'idle_time_minutes', COALESCE(SUM(s.duration_minutes), 0) - COALESCE(
            (SELECT SUM(duration_minutes) 
             FROM admin_activity_periods ap 
             WHERE ap.admin_id = p_admin_id 
             AND ap.period_start >= p_start_date 
             AND ap.period_start <= p_end_date
             AND ap.is_active = true),
            0
        ),
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

-- Verify table created
SELECT 'Activity Periods table created' as status;
SELECT COUNT(*) as count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'admin_activity_periods';
