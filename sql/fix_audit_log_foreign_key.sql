-- Fix admin_audit_log foreign key relationship
-- This ensures the foreign key is properly named for Supabase PostgREST

-- Drop existing foreign key if it exists (without a name)
DO $$
BEGIN
    -- Check if there's an unnamed foreign key constraint
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'admin_audit_log' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE 'admin_audit_log_%_fkey'
    ) THEN
        -- Drop the existing constraint (we'll recreate it with a proper name)
        ALTER TABLE public.admin_audit_log 
        DROP CONSTRAINT IF EXISTS admin_audit_log_admin_id_fkey;
    END IF;
END $$;

-- Add foreign key with explicit name
ALTER TABLE public.admin_audit_log
DROP CONSTRAINT IF EXISTS admin_audit_log_admin_id_fkey;

ALTER TABLE public.admin_audit_log
ADD CONSTRAINT admin_audit_log_admin_id_fkey 
FOREIGN KEY (admin_id) 
REFERENCES public.admin_credentials(id) 
ON DELETE SET NULL;

-- Verify the constraint exists
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'admin_audit_log'
    AND tc.constraint_type = 'FOREIGN KEY';

