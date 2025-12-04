-- Page Visits Tracking Table
-- Tracks which pages employees visit and time spent on each

-- Create the page visits table
CREATE TABLE IF NOT EXISTS public.admin_page_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.admin_sessions(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES public.admin_credentials(id) ON DELETE CASCADE,
    page_path TEXT NOT NULL,
    page_name TEXT NOT NULL,
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_page_visits_admin_id ON public.admin_page_visits(admin_id);
CREATE INDEX IF NOT EXISTS idx_page_visits_session_id ON public.admin_page_visits(session_id);
CREATE INDEX IF NOT EXISTS idx_page_visits_entry_time ON public.admin_page_visits(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_page_visits_page_path ON public.admin_page_visits(page_path);

-- Enable RLS
ALTER TABLE public.admin_page_visits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Service role can access all page visits" ON public.admin_page_visits;
CREATE POLICY "Service role can access all page visits"
ON public.admin_page_visits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view page visits" ON public.admin_page_visits;
CREATE POLICY "Admins can view page visits"
ON public.admin_page_visits FOR SELECT
TO authenticated
USING (true);

-- Grant permissions
GRANT ALL ON public.admin_page_visits TO service_role;
GRANT SELECT ON public.admin_page_visits TO authenticated;

-- Function to get page visit statistics for an employee
CREATE OR REPLACE FUNCTION public.get_page_visit_stats(
    p_admin_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    page_path TEXT,
    page_name TEXT,
    visit_count BIGINT,
    total_duration_seconds BIGINT,
    avg_duration_seconds NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pv.page_path,
        pv.page_name,
        COUNT(*)::BIGINT as visit_count,
        COALESCE(SUM(pv.duration_seconds), 0)::BIGINT as total_duration_seconds,
        ROUND(AVG(pv.duration_seconds), 1) as avg_duration_seconds
    FROM public.admin_page_visits pv
    WHERE pv.admin_id = p_admin_id
        AND pv.entry_time >= p_start_date
        AND pv.entry_time <= p_end_date
    GROUP BY pv.page_path, pv.page_name
    ORDER BY total_duration_seconds DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_page_visit_stats TO anon, authenticated, service_role;

-- Verify table created
SELECT 'Page Visits table created' as status;

