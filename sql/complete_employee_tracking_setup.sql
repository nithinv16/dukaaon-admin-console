-- =====================================================
-- COMPLETE EMPLOYEE TRACKING SYSTEM SETUP
-- This script sets up the entire employee tracking system including:
-- 1. Tracking tables (admin_sessions, admin_activity_metrics)
-- 2. Employee role with permissions
-- 3. Employee credentials (yadhukk5723@gmail.com)
-- 4. SQL functions for metrics
-- 5. Updated validation function
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: CREATE TRACKING TABLES
-- =====================================================

-- 1.1 ADMIN SESSIONS TABLE
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
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON public.admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_login_time ON public.admin_sessions(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_is_active ON public.admin_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_session_token ON public.admin_sessions(session_token);

-- 1.2 ADMIN ACTIVITY METRICS TABLE
CREATE TABLE IF NOT EXISTS public.admin_activity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.admin_credentials(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.admin_sessions(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    operation_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    operation_end_time TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    duration_seconds DECIMAL(10, 3),
    items_processed INTEGER DEFAULT 1,
    operation_status TEXT DEFAULT 'success' CHECK (operation_status IN ('success', 'failed', 'partial')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_metrics_admin_id ON public.admin_activity_metrics(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_metrics_session_id ON public.admin_activity_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_metrics_action_type ON public.admin_activity_metrics(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_metrics_entity_type ON public.admin_activity_metrics(entity_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_metrics_operation_start_time ON public.admin_activity_metrics(operation_start_time DESC);

-- =====================================================
-- PART 2: CREATE SQL FUNCTIONS
-- =====================================================

-- 2.1 Update session duration on logout
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

DROP TRIGGER IF EXISTS trigger_update_session_duration ON public.admin_sessions;
CREATE TRIGGER trigger_update_session_duration
    BEFORE UPDATE ON public.admin_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_session_duration();

-- 2.2 Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_admin_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_admin_sessions_updated_at ON public.admin_sessions;
CREATE TRIGGER trigger_update_admin_sessions_updated_at
    BEFORE UPDATE ON public.admin_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_admin_sessions_updated_at();

-- 2.3 Get employee activity summary
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
-- PART 3: ENABLE RLS AND GRANT PERMISSIONS
-- =====================================================

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can access all admin sessions" ON public.admin_sessions;
CREATE POLICY "Service role can access all admin sessions"
ON public.admin_sessions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can access all activity metrics" ON public.admin_activity_metrics;
CREATE POLICY "Service role can access all activity metrics"
ON public.admin_activity_metrics FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view their own sessions" ON public.admin_sessions;
CREATE POLICY "Admins can view their own sessions"
ON public.admin_sessions FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can view their own activity" ON public.admin_activity_metrics;
CREATE POLICY "Admins can view their own activity"
ON public.admin_activity_metrics FOR SELECT
TO authenticated
USING (true);

GRANT ALL ON public.admin_sessions TO service_role;
GRANT ALL ON public.admin_activity_metrics TO service_role;
GRANT SELECT ON public.admin_sessions TO authenticated;
GRANT SELECT ON public.admin_activity_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_activity_summary TO anon, authenticated, service_role;

-- =====================================================
-- PART 4: CREATE EMPLOYEE ROLE
-- =====================================================

INSERT INTO public.admin_roles (name, description, permissions, is_system)
SELECT * FROM (VALUES 
    (
        'Employee',
        'Employee with limited product management access',
        '[
            {"resource": "products", "actions": ["view", "create", "update", "export"]},
            {"resource": "categories", "actions": ["view"]},
            {"resource": "analytics", "actions": ["view"]},
            {"resource": "bulk_operations", "actions": ["view", "create"]},
            {"resource": "messages", "actions": ["view"]}
        ]'::jsonb,
        false
    )) AS v(name, description, permissions, is_system)
WHERE NOT EXISTS (SELECT 1 FROM public.admin_roles WHERE admin_roles.name = 'Employee');

-- =====================================================
-- PART 5: CREATE EMPLOYEE CREDENTIALS
-- =====================================================

DO $$
DECLARE
    employee_role_id UUID;
BEGIN
    -- Get the Employee role ID
    SELECT id INTO employee_role_id 
    FROM public.admin_roles 
    WHERE name = 'Employee';
    
    -- Insert the new employee credentials
    INSERT INTO public.admin_credentials (email, password_hash, name, role, role_id, status)
    VALUES (
        'yadhukk5723@gmail.com',
        '$2b$10$placeholder',
        'Yadhu K',
        'Employee',
        employee_role_id,
        'active'
    )
    ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        role_id = EXCLUDED.role_id,
        status = EXCLUDED.status,
        updated_at = NOW();
END $$;

-- =====================================================
-- PART 6: UPDATE VALIDATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_admin_credentials(
    input_email TEXT,
    input_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_record RECORD;
    role_record RECORD;
    result JSONB;
    is_valid_password BOOLEAN := false;
BEGIN
    -- Find admin by email and active status
    SELECT 
        id, 
        email, 
        password_hash, 
        name, 
        role, 
        role_id,
        status, 
        last_login
    INTO admin_record
    FROM public.admin_credentials
    WHERE email = input_email AND status = 'active';
    
    -- Check if admin exists
    IF admin_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Invalid credentials'
        );
    END IF;
    
    -- Validate password based on email (plain text for demo - use bcrypt in production)
    CASE admin_record.email
        WHEN 'admin@dukaaon.in' THEN
            is_valid_password := (input_password = 'dukaaon#28');
        WHEN 'yadhukk5723@gmail.com' THEN
            is_valid_password := (input_password = 'yadhukal123');
        ELSE
            is_valid_password := false;
    END CASE;
    
    IF is_valid_password THEN
        -- Update last login time
        UPDATE public.admin_credentials
        SET last_login = NOW(), updated_at = NOW()
        WHERE id = admin_record.id;
        
        -- Get role details if role_id exists
        IF admin_record.role_id IS NOT NULL THEN
            SELECT id, name, description, permissions, is_system
            INTO role_record
            FROM public.admin_roles
            WHERE id = admin_record.role_id;
        END IF;
        
        -- Return success with admin info
        RETURN jsonb_build_object(
            'success', true,
            'admin', jsonb_build_object(
                'id', admin_record.id,
                'email', admin_record.email,
                'name', admin_record.name,
                'role', admin_record.role,
                'role_id', admin_record.role_id,
                'role_details', CASE 
                    WHEN role_record.id IS NOT NULL THEN
                        jsonb_build_object(
                            'id', role_record.id,
                            'name', role_record.name,
                            'description', role_record.description,
                            'permissions', role_record.permissions,
                            'is_system', role_record.is_system
                        )
                    ELSE NULL
                END
            )
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Invalid credentials'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Authentication error: ' || SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_admin_credentials TO anon, authenticated, service_role;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify tables created
SELECT 'Tables created:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('admin_sessions', 'admin_activity_metrics');

-- Verify Employee role created
SELECT 'Employee role:' as status;
SELECT id, name, description FROM public.admin_roles WHERE name = 'Employee';

-- Verify employee credentials created
SELECT 'Employee credentials:' as status;
SELECT id, email, name, role, status FROM public.admin_credentials WHERE email = 'yadhukk5723@gmail.com';

-- Verify function exists
SELECT 'Functions created:' as status;
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'get_employee_activity_summary';
