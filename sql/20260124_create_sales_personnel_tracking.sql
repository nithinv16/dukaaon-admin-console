-- =====================================================
-- SALES PERSONNEL TRACKING SYSTEM
-- Complete system for tracking sales team field activities
-- =====================================================

BEGIN;

-- =====================================================
-- 1. SALES PERSONNEL TABLE
-- Extended profile for sales team members
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sales_personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL UNIQUE REFERENCES public.admin_credentials(id) ON DELETE CASCADE,
    employee_code TEXT UNIQUE, -- e.g., 'EMP001'
    phone TEXT,
    territory TEXT, -- Assigned area/region
    manager_id UUID REFERENCES public.sales_personnel(id),
    hire_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated')),
    referral_code_id UUID REFERENCES public.referral_codes(id), -- Link to referral system
    referral_code TEXT, -- Copy of the code for quick access
    metadata JSONB DEFAULT '{}', -- Additional info (transport, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_personnel_admin_id ON public.sales_personnel(admin_id);
CREATE INDEX IF NOT EXISTS idx_sales_personnel_status ON public.sales_personnel(status);
CREATE INDEX IF NOT EXISTS idx_sales_personnel_territory ON public.sales_personnel(territory);
CREATE INDEX IF NOT EXISTS idx_sales_personnel_referral_code ON public.sales_personnel(referral_code);

-- =====================================================
-- 2. SALES ROUTES TABLE
-- Planned routes for sales personnel
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sales_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_person_id UUID NOT NULL REFERENCES public.sales_personnel(id) ON DELETE CASCADE,
    route_name TEXT NOT NULL,
    route_date DATE NOT NULL,
    planned_visits INTEGER DEFAULT 0,
    completed_visits INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    start_location JSONB, -- {lat, lng, address}
    end_location JSONB,   -- {lat, lng, address}
    total_distance_km DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_routes_sales_person ON public.sales_routes(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_sales_routes_date ON public.sales_routes(route_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_routes_status ON public.sales_routes(status);

-- =====================================================
-- 3. SALES VISITS TABLE
-- Individual customer/shop visits
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sales_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_person_id UUID NOT NULL REFERENCES public.sales_personnel(id) ON DELETE CASCADE,
    route_id UUID REFERENCES public.sales_routes(id) ON DELETE SET NULL,
    
    -- Customer Info
    customer_type TEXT CHECK (customer_type IN ('retailer', 'seller', 'prospect')),
    customer_id UUID, -- References profiles(id) if existing customer
    customer_name TEXT,
    customer_phone TEXT,
    shop_name TEXT,
    
    -- Visit Details
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    
    -- Location
    check_in_location JSONB, -- {lat, lng, address, accuracy}
    check_out_location JSONB,
    
    -- Outcome
    visit_type TEXT CHECK (visit_type IN ('new_lead', 'follow_up', 'order_collection', 'complaint', 'onboarding', 'demo')),
    outcome TEXT CHECK (outcome IN ('successful', 'not_interested', 'callback_needed', 'order_placed', 'issue_resolved', 'no_show')),
    order_placed BOOLEAN DEFAULT false,
    order_amount DECIMAL(12, 2),
    order_id UUID,
    customer_onboarded BOOLEAN DEFAULT false,
    referral_code_used TEXT,
    
    -- Notes & Evidence
    notes TEXT,
    photos JSONB DEFAULT '[]', -- Array of photo URLs
    signature_url TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_visits_sales_person ON public.sales_visits(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_sales_visits_route ON public.sales_visits(route_id);
CREATE INDEX IF NOT EXISTS idx_sales_visits_date ON public.sales_visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_visits_customer ON public.sales_visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_visits_outcome ON public.sales_visits(outcome);

-- =====================================================
-- 4. SALES TARGETS TABLE
-- Monthly/weekly targets for sales personnel
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sales_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_person_id UUID NOT NULL REFERENCES public.sales_personnel(id) ON DELETE CASCADE,
    target_period TEXT NOT NULL, -- 'monthly', 'weekly', 'daily'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Targets
    target_visits INTEGER DEFAULT 0,
    target_orders INTEGER DEFAULT 0,
    target_revenue DECIMAL(12, 2) DEFAULT 0,
    target_new_customers INTEGER DEFAULT 0,
    target_referrals INTEGER DEFAULT 0,
    
    -- Achieved
    achieved_visits INTEGER DEFAULT 0,
    achieved_orders INTEGER DEFAULT 0,
    achieved_revenue DECIMAL(12, 2) DEFAULT 0,
    achieved_new_customers INTEGER DEFAULT 0,
    achieved_referrals INTEGER DEFAULT 0,
    
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(sales_person_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_sales_targets_sales_person ON public.sales_targets(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_sales_targets_period ON public.sales_targets(period_start, period_end);

-- =====================================================
-- 5. SALES LOCATION LOGS TABLE
-- Real-time location tracking during work hours
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sales_location_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_person_id UUID NOT NULL REFERENCES public.sales_personnel(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.admin_sessions(id) ON DELETE SET NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2),
    altitude DECIMAL(10, 2),
    speed DECIMAL(10, 2),
    heading DECIMAL(10, 2),
    address TEXT,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_location_logs_sales_person ON public.sales_location_logs(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_sales_location_logs_session ON public.sales_location_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_sales_location_logs_time ON public.sales_location_logs(logged_at DESC);

-- =====================================================
-- 6. FUNCTIONS
-- =====================================================

-- Update visit duration on check-out
CREATE OR REPLACE FUNCTION public.update_visit_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_out_time IS NOT NULL AND NEW.check_in_time IS NOT NULL THEN
        NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 60;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_visit_duration ON public.sales_visits;
CREATE TRIGGER trigger_update_visit_duration
    BEFORE UPDATE ON public.sales_visits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_visit_duration();

-- Get sales person performance summary
CREATE OR REPLACE FUNCTION public.get_sales_person_performance(
    p_sales_person_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_visits', COUNT(v.id),
        'successful_visits', COUNT(CASE WHEN v.outcome = 'successful' THEN 1 END),
        'orders_placed', COUNT(CASE WHEN v.order_placed THEN 1 END),
        'total_order_value', COALESCE(SUM(v.order_amount), 0),
        'customers_onboarded', COUNT(CASE WHEN v.customer_onboarded THEN 1 END),
        'avg_visit_duration_mins', ROUND(AVG(v.duration_minutes)::numeric, 1),
        'routes_completed', (
            SELECT COUNT(*) FROM public.sales_routes 
            WHERE sales_person_id = p_sales_person_id 
            AND status = 'completed'
            AND route_date BETWEEN p_start_date AND p_end_date
        ),
        'total_work_hours', (
            SELECT COALESCE(SUM(duration_minutes), 0) / 60 
            FROM public.admin_sessions s
            JOIN public.sales_personnel sp ON sp.admin_id = s.admin_id
            WHERE sp.id = p_sales_person_id
            AND s.login_time::date BETWEEN p_start_date AND p_end_date
        ),
        'visits_by_outcome', (
            SELECT jsonb_object_agg(outcome, cnt)
            FROM (
                SELECT outcome, COUNT(*) as cnt 
                FROM public.sales_visits 
                WHERE sales_person_id = p_sales_person_id
                AND visit_date BETWEEN p_start_date AND p_end_date
                GROUP BY outcome
            ) sub
        ),
        'visits_by_type', (
            SELECT jsonb_object_agg(visit_type, cnt)
            FROM (
                SELECT visit_type, COUNT(*) as cnt 
                FROM public.sales_visits 
                WHERE sales_person_id = p_sales_person_id
                AND visit_date BETWEEN p_start_date AND p_end_date
                GROUP BY visit_type
            ) sub
        )
    ) INTO result
    FROM public.sales_visits v
    WHERE v.sales_person_id = p_sales_person_id
    AND v.visit_date BETWEEN p_start_date AND p_end_date;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Get daily attendance summary for all sales personnel
CREATE OR REPLACE FUNCTION public.get_sales_team_attendance(
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    sales_person_id UUID,
    employee_code TEXT,
    name TEXT,
    login_time TIMESTAMP WITH TIME ZONE,
    logout_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    is_active BOOLEAN,
    visits_today INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id,
        sp.employee_code,
        ac.name,
        s.login_time,
        s.logout_time,
        s.duration_minutes,
        s.is_active,
        (SELECT COUNT(*)::INTEGER FROM public.sales_visits sv 
         WHERE sv.sales_person_id = sp.id AND sv.visit_date = p_date) as visits_today
    FROM public.sales_personnel sp
    JOIN public.admin_credentials ac ON ac.id = sp.admin_id
    LEFT JOIN public.admin_sessions s ON s.admin_id = sp.admin_id 
        AND s.login_time::date = p_date
    WHERE sp.status = 'active'
    ORDER BY s.login_time DESC NULLS LAST;
END;
$$;

-- Create referral code for sales personnel
CREATE OR REPLACE FUNCTION public.create_sales_personnel_referral_code(
    p_sales_person_id UUID,
    p_custom_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_employee_code TEXT;
    v_admin_name TEXT;
    v_new_code TEXT;
    v_code_id UUID;
BEGIN
    -- Get employee info
    SELECT sp.employee_code, ac.name
    INTO v_employee_code, v_admin_name
    FROM public.sales_personnel sp
    JOIN public.admin_credentials ac ON ac.id = sp.admin_id
    WHERE sp.id = p_sales_person_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Sales person not found');
    END IF;
    
    -- Generate code if not provided
    v_new_code := COALESCE(p_custom_code, 'SALES' || UPPER(COALESCE(v_employee_code, SUBSTRING(p_sales_person_id::TEXT FROM 1 FOR 6))));
    
    -- Create referral code
    INSERT INTO public.referral_codes (
        code,
        user_id,
        code_type,
        is_active,
        metadata
    ) VALUES (
        v_new_code,
        NULL, -- No user_id as this is for sales team
        'sales_team',
        true,
        jsonb_build_object(
            'sales_person_id', p_sales_person_id,
            'sales_person_name', v_admin_name,
            'employee_code', v_employee_code
        )
    )
    ON CONFLICT (code) DO UPDATE SET
        metadata = jsonb_build_object(
            'sales_person_id', p_sales_person_id,
            'sales_person_name', v_admin_name,
            'employee_code', v_employee_code
        ),
        updated_at = NOW()
    RETURNING id INTO v_code_id;
    
    -- Update sales_personnel with the code
    UPDATE public.sales_personnel
    SET referral_code_id = v_code_id,
        referral_code = v_new_code,
        updated_at = NOW()
    WHERE id = p_sales_person_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'code', v_new_code,
        'code_id', v_code_id
    );
END;
$$;

-- Get referral stats for a sales person
CREATE OR REPLACE FUNCTION public.get_sales_person_referral_stats(
    p_sales_person_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referral_code TEXT;
    result JSONB;
BEGIN
    -- Get the referral code
    SELECT referral_code INTO v_referral_code
    FROM public.sales_personnel
    WHERE id = p_sales_person_id;
    
    IF v_referral_code IS NULL THEN
        RETURN jsonb_build_object(
            'has_code', false,
            'message', 'No referral code assigned'
        );
    END IF;
    
    SELECT jsonb_build_object(
        'has_code', true,
        'referral_code', v_referral_code,
        'total_signups', (
            SELECT COALESCE(current_uses, 0) FROM public.referral_codes WHERE code = v_referral_code
        ),
        'total_referrals', (
            SELECT COUNT(*) FROM public.referrals WHERE referral_code = v_referral_code
        ),
        'pending_referrals', (
            SELECT COUNT(*) FROM public.referrals WHERE referral_code = v_referral_code AND status = 'pending'
        ),
        'rewarded_referrals', (
            SELECT COUNT(*) FROM public.referrals WHERE referral_code = v_referral_code AND status = 'rewarded'
        ),
        'total_rewards_generated', (
            SELECT COALESCE(SUM(referrer_reward_amount), 0) FROM public.referrals WHERE referral_code = v_referral_code AND status = 'rewarded'
        ),
        'recent_signups', (
            SELECT jsonb_agg(row_to_json(r))
            FROM (
                SELECT 
                    ref.id,
                    ref.status,
                    ref.created_at,
                    p.phone_number as referee_phone,
                    p.business_name as referee_business
                FROM public.referrals ref
                LEFT JOIN public.profiles p ON p.id = ref.referee_id
                WHERE ref.referral_code = v_referral_code
                ORDER BY ref.created_at DESC
                LIMIT 10
            ) r
        )
    ) INTO result;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sales_personnel_referral_code TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_sales_person_referral_stats TO authenticated, service_role;

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

ALTER TABLE public.sales_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_location_logs ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access to sales_personnel" ON public.sales_personnel FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to sales_routes" ON public.sales_routes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to sales_visits" ON public.sales_visits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to sales_targets" ON public.sales_targets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to sales_location_logs" ON public.sales_location_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read
CREATE POLICY "Authenticated read sales_personnel" ON public.sales_personnel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read sales_routes" ON public.sales_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read sales_visits" ON public.sales_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read sales_targets" ON public.sales_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read sales_location_logs" ON public.sales_location_logs FOR SELECT TO authenticated USING (true);

-- =====================================================
-- 8. GRANTS
-- =====================================================

GRANT ALL ON public.sales_personnel TO service_role;
GRANT ALL ON public.sales_routes TO service_role;
GRANT ALL ON public.sales_visits TO service_role;
GRANT ALL ON public.sales_targets TO service_role;
GRANT ALL ON public.sales_location_logs TO service_role;

GRANT SELECT ON public.sales_personnel TO authenticated;
GRANT SELECT ON public.sales_routes TO authenticated;
GRANT SELECT ON public.sales_visits TO authenticated;
GRANT SELECT ON public.sales_targets TO authenticated;
GRANT SELECT ON public.sales_location_logs TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_sales_person_performance TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_sales_team_attendance TO authenticated, service_role;

COMMIT;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.sales_personnel IS 'Extended profile for sales team members linked to admin_credentials';
COMMENT ON TABLE public.sales_routes IS 'Planned daily routes for sales personnel';
COMMENT ON TABLE public.sales_visits IS 'Individual customer/shop visits with outcomes';
COMMENT ON TABLE public.sales_targets IS 'Monthly/weekly targets and achievements';
COMMENT ON TABLE public.sales_location_logs IS 'Real-time GPS location tracking during work hours';
