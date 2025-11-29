-- Function to get daily work time breakdown
-- Returns active time, idle time, and productivity for each day

CREATE OR REPLACE FUNCTION public.get_daily_work_breakdown(
    p_admin_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    work_date DATE,
    active_time_minutes INTEGER,
    idle_time_minutes INTEGER,
    total_time_minutes INTEGER,
    sessions_count INTEGER,
    products_created INTEGER,
    products_updated INTEGER,
    items_processed INTEGER,
    first_login TIME,
    last_logout TIME
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH daily_sessions AS (
        SELECT 
            DATE(s.login_time AT TIME ZONE 'UTC') as session_date,
            s.id as session_id,
            s.login_time,
            s.logout_time,
            s.duration_minutes,
            MIN(s.login_time::TIME) as first_login_time,
            MAX(COALESCE(s.logout_time, NOW())::TIME) as last_logout_time
        FROM admin_sessions s
        WHERE s.admin_id = p_admin_id
            AND s.login_time >= p_start_date
            AND s.login_time <= p_end_date
        GROUP BY session_date, s.id, s.login_time, s.logout_time, s.duration_minutes
    ),
    daily_activity AS (
        SELECT 
            DATE(ap.period_start AT TIME ZONE 'UTC') as activity_date,
            SUM(CASE WHEN ap.is_active THEN ap.duration_minutes ELSE 0 END) as active_mins,
            SUM(CASE WHEN NOT ap.is_active THEN ap.duration_minutes ELSE 0 END) as idle_mins
        FROM admin_activity_periods ap
        WHERE ap.admin_id = p_admin_id
            AND ap.period_start >= p_start_date
            AND ap.period_start <= p_end_date
        GROUP BY activity_date
    ),
    daily_metrics AS (
        SELECT 
            DATE(m.operation_start_time AT TIME ZONE 'UTC') as metrics_date,
            COUNT(CASE WHEN m.action_type = 'create_product' AND m.entity_type = 'product' THEN 1 END) as created,
            COUNT(CASE WHEN m.action_type = 'update_product' AND m.entity_type = 'product' THEN 1 END) as updated,
            SUM(m.items_processed) as items
        FROM admin_activity_metrics m
        WHERE m.admin_id = p_admin_id
            AND m.operation_start_time >= p_start_date
            AND m.operation_start_time <= p_end_date
        GROUP BY metrics_date
    )
    SELECT 
        ds.session_date::DATE as work_date,
        COALESCE(da.active_mins, 0)::INTEGER as active_time_minutes,
        COALESCE(da.idle_mins, 0)::INTEGER as idle_time_minutes,
        COALESCE(SUM(ds.duration_minutes), 0)::INTEGER as total_time_minutes,
        COUNT(DISTINCT ds.session_id)::INTEGER as sessions_count,
        COALESCE(dm.created, 0)::INTEGER as products_created,
        COALESCE(dm.updated, 0)::INTEGER as products_updated,
        COALESCE(dm.items, 0)::INTEGER as items_processed,
        MIN(ds.first_login_time)::TIME as first_login,
        MAX(ds.last_logout_time)::TIME as last_logout
    FROM daily_sessions ds
    LEFT JOIN daily_activity da ON da.activity_date = ds.session_date
    LEFT JOIN daily_metrics dm ON dm.metrics_date = ds.session_date
    GROUP BY ds.session_date, da.active_mins, da.idle_mins, dm.created, dm.updated, dm.items
    ORDER BY ds.session_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_work_breakdown TO anon, authenticated, service_role;

-- Test the function
SELECT * FROM public.get_daily_work_breakdown(
    (SELECT id FROM admin_credentials WHERE email = 'yadhukk5723@gmail.com'),
    NOW() - INTERVAL '7 days',
    NOW()
);
