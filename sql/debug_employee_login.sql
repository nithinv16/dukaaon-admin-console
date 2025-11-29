-- =====================================================
-- DEBUGGING SCRIPT FOR EMPLOYEE LOGIN ISSUE
-- Run these queries in Supabase SQL Editor to diagnose the problem
-- =====================================================

-- 1. Check if employee exists in admin_credentials
SELECT 
    id, 
    email, 
    name, 
    role, 
    role_id, 
    status,
    created_at
FROM public.admin_credentials 
WHERE email = 'yadhukk5723@gmail.com';

-- Expected: Should return 1 row with email 'yadhukk5723@gmail.com'
-- If NO rows: The complete_employee_tracking_setup.sql script hasn't been run

-- =====================================================

-- 2. Check if Employee role exists
SELECT 
    id, 
    name, 
    description, 
    permissions
FROM public.admin_roles 
WHERE name = 'Employee';

-- Expected: Should return 1 row with role 'Employee'
-- If NO rows: The admin_roles table setup is incomplete

-- =====================================================

-- 3. Test the validation function directly
SELECT public.validate_admin_credentials(
    'yadhukk5723@gmail.com'::text,
    'yadhukal123'::text
);

-- Expected: Should return JSON with success=true
-- If success=false: The validation function needs to be updated

-- =====================================================

-- 4. Check current version of validate_admin_credentials function
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'validate_admin_credentials';

-- This will show you the current function definition
-- Check if it includes the CASE statement for yadhukk5723@gmail.com

-- =====================================================

-- 5. If employee doesn't exist, create it manually
-- (Only run this if step 1 returned NO rows)

DO $$
DECLARE
    employee_role_id UUID;
BEGIN
    -- Get the Employee role ID (create if doesn't exist)
    SELECT id INTO employee_role_id FROM public.admin_roles WHERE name = 'Employee';
    
    IF employee_role_id IS NULL THEN
        INSERT INTO public.admin_roles (name, description, permissions, is_system)
        VALUES (
            'Employee',
            'Employee with limited product management access',
            '[{"resource": "products", "actions": ["view", "create", "update", "export"]}, {"resource": "categories", "actions": ["view"]}, {"resource": "analytics", "actions": ["view"]}, {"resource": "bulk_operations", "actions": ["view", "create"]}, {"resource": "messages", "actions": ["view"]}]'::jsonb,
            false
        )
        RETURNING id INTO employee_role_id;
    END IF;
    
    -- Insert employee (or update if exists)
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
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        role_id = EXCLUDED.role_id,
        status = EXCLUDED.status,
        updated_at = NOW();
    
    RAISE NOTICE 'Employee created/updated successfully';
END $$;

-- =====================================================

-- 6. Force update the validation function
-- (Run this if the function doesn't include the employee password)

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
    is_valid_password BOOLEAN := false;
BEGIN
    -- Find admin by email
    SELECT id, email, password_hash, name, role, role_id, status, last_login
    INTO admin_record
    FROM public.admin_credentials
    WHERE email = input_email AND status = 'active';
    
    IF admin_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid credentials');
    END IF;
    
    -- Check password (plain text for demo - use bcrypt in production!)
    CASE admin_record.email
        WHEN 'admin@dukaaon.in' THEN
            is_valid_password := (input_password = 'dukaaon#28');
        WHEN 'yadhukk5723@gmail.com' THEN
            is_valid_password := (input_password = 'yadhukal123');
        ELSE
            -- For any other users, fail
            is_valid_password := false;
    END CASE;
    
    IF is_valid_password THEN
        -- Update last login
        UPDATE public.admin_credentials
        SET last_login = NOW(), updated_at = NOW()
        WHERE id = admin_record.id;
        
        -- Get role details
        IF admin_record.role_id IS NOT NULL THEN
            SELECT id, name, description, permissions, is_system
            INTO role_record
            FROM public.admin_roles
            WHERE id = admin_record.role_id;
        END IF;
        
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
        RETURN jsonb_build_object('success', false, 'message', 'Invalid credentials');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentication error: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_admin_credentials TO anon, authenticated, service_role;

-- =====================================================

-- 7. Test login again after fixes
SELECT public.validate_admin_credentials(
    'yadhukk5723@gmail.com'::text,
    'yadhukal123'::text
);

-- This should now return: {"success": true, "admin": {...}}
