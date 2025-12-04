-- Employee Targets & Goals Table
-- Allows setting daily/weekly/monthly targets for employees

-- Create the employee targets table
CREATE TABLE IF NOT EXISTS public.employee_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.admin_credentials(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Target metrics
    target_products_created INTEGER DEFAULT 0,
    target_products_updated INTEGER DEFAULT 0,
    target_master_products_created INTEGER DEFAULT 0,
    target_receipts_scanned INTEGER DEFAULT 0,
    target_active_hours DECIMAL(4,2) DEFAULT 0,
    target_items_processed INTEGER DEFAULT 0,
    
    -- Progress tracking (updated by triggers or cron)
    actual_products_created INTEGER DEFAULT 0,
    actual_products_updated INTEGER DEFAULT 0,
    actual_master_products_created INTEGER DEFAULT 0,
    actual_receipts_scanned INTEGER DEFAULT 0,
    actual_active_hours DECIMAL(4,2) DEFAULT 0,
    actual_items_processed INTEGER DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'missed', 'exceeded')),
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    created_by UUID REFERENCES public.admin_credentials(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_targets_admin_id ON public.employee_targets(admin_id);
CREATE INDEX IF NOT EXISTS idx_employee_targets_period ON public.employee_targets(period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_employee_targets_status ON public.employee_targets(status);

-- Enable RLS
ALTER TABLE public.employee_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Service role can access all targets" ON public.employee_targets;
CREATE POLICY "Service role can access all targets"
ON public.employee_targets FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view targets" ON public.employee_targets;
CREATE POLICY "Admins can view targets"
ON public.employee_targets FOR SELECT
TO authenticated
USING (true);

-- Grant permissions
GRANT ALL ON public.employee_targets TO service_role;
GRANT SELECT ON public.employee_targets TO authenticated;

-- Function to calculate target completion percentage
CREATE OR REPLACE FUNCTION public.calculate_target_completion(target_row public.employee_targets)
RETURNS DECIMAL(5,2)
LANGUAGE plpgsql
AS $$
DECLARE
    total_weight DECIMAL;
    weighted_completion DECIMAL;
BEGIN
    total_weight := 0;
    weighted_completion := 0;
    
    -- Products created (weight: 30%)
    IF target_row.target_products_created > 0 THEN
        total_weight := total_weight + 30;
        weighted_completion := weighted_completion + 
            LEAST(30, (target_row.actual_products_created::DECIMAL / target_row.target_products_created) * 30);
    END IF;
    
    -- Master products created (weight: 25%)
    IF target_row.target_master_products_created > 0 THEN
        total_weight := total_weight + 25;
        weighted_completion := weighted_completion + 
            LEAST(25, (target_row.actual_master_products_created::DECIMAL / target_row.target_master_products_created) * 25);
    END IF;
    
    -- Active hours (weight: 20%)
    IF target_row.target_active_hours > 0 THEN
        total_weight := total_weight + 20;
        weighted_completion := weighted_completion + 
            LEAST(20, (target_row.actual_active_hours / target_row.target_active_hours) * 20);
    END IF;
    
    -- Items processed (weight: 15%)
    IF target_row.target_items_processed > 0 THEN
        total_weight := total_weight + 15;
        weighted_completion := weighted_completion + 
            LEAST(15, (target_row.actual_items_processed::DECIMAL / target_row.target_items_processed) * 15);
    END IF;
    
    -- Receipts scanned (weight: 10%)
    IF target_row.target_receipts_scanned > 0 THEN
        total_weight := total_weight + 10;
        weighted_completion := weighted_completion + 
            LEAST(10, (target_row.actual_receipts_scanned::DECIMAL / target_row.target_receipts_scanned) * 10);
    END IF;
    
    -- Calculate percentage
    IF total_weight > 0 THEN
        RETURN ROUND((weighted_completion / total_weight) * 100, 2);
    ELSE
        RETURN 0;
    END IF;
END;
$$;

-- Function to update target progress from activity metrics
CREATE OR REPLACE FUNCTION public.update_target_progress(
    p_admin_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    target_record RECORD;
    metrics RECORD;
    active_mins DECIMAL;
BEGIN
    -- Find active targets for this admin
    FOR target_record IN
        SELECT * FROM public.employee_targets
        WHERE admin_id = p_admin_id
        AND status = 'active'
        AND p_date BETWEEN period_start AND period_end
    LOOP
        -- Calculate metrics for the target period
        SELECT 
            COUNT(*) FILTER (WHERE action_type = 'create_product' AND entity_type = 'product') as products_created,
            COUNT(*) FILTER (WHERE action_type = 'update_product' AND entity_type = 'product') as products_updated,
            COUNT(*) FILTER (WHERE action_type = 'create_product' AND entity_type = 'master_product') as master_products_created,
            COUNT(*) FILTER (WHERE action_type = 'scan_receipt') as receipts_scanned,
            COALESCE(SUM(items_processed), 0) as items_processed
        INTO metrics
        FROM public.admin_activity_metrics
        WHERE admin_id = p_admin_id
        AND operation_start_time::DATE BETWEEN target_record.period_start AND target_record.period_end;
        
        -- Calculate active hours from activity periods
        SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 INTO active_mins
        FROM public.admin_activity_periods
        WHERE admin_id = p_admin_id
        AND period_start::DATE BETWEEN target_record.period_start AND target_record.period_end
        AND is_active = true;
        
        -- Update target progress
        UPDATE public.employee_targets
        SET 
            actual_products_created = metrics.products_created,
            actual_products_updated = metrics.products_updated,
            actual_master_products_created = metrics.master_products_created,
            actual_receipts_scanned = metrics.receipts_scanned,
            actual_items_processed = metrics.items_processed,
            actual_active_hours = active_mins,
            updated_at = NOW()
        WHERE id = target_record.id;
        
        -- Update completion percentage
        UPDATE public.employee_targets
        SET completion_percentage = public.calculate_target_completion(
            (SELECT * FROM public.employee_targets WHERE id = target_record.id)
        )
        WHERE id = target_record.id;
        
        -- Update status based on completion and period
        UPDATE public.employee_targets
        SET status = CASE
            WHEN p_date > period_end AND completion_percentage >= 100 THEN 'exceeded'
            WHEN p_date > period_end AND completion_percentage >= 80 THEN 'completed'
            WHEN p_date > period_end THEN 'missed'
            ELSE 'active'
        END
        WHERE id = target_record.id;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_target_completion TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_target_progress TO anon, authenticated, service_role;

-- Verify table created
SELECT 'Employee Targets table created' as status;

