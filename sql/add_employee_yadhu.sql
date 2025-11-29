-- Add Employee: Yadhu K
-- This script creates a new employee account with appropriate role and permissions

-- =====================================================
-- 1. CREATE EMPLOYEE ROLE (if not exists)
-- =====================================================

-- Insert the "Employee" role with limited permissions (no delete access to products)
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
-- 2. CREATE EMPLOYEE CREDENTIALS
-- =====================================================

-- Get the Employee role ID
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
        '$2b$10$placeholder', -- This will be handled by the validation function
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
-- 3. UPDATE VALIDATE_ADMIN_CREDENTIALS FUNCTION
-- =====================================================

-- Update the validation function to support multiple employee passwords
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
    -- Find admin by email and active status, including role_id
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
    
    -- Validate password based on email
    -- In production, you should use proper password hashing with bcrypt
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
        
        -- Return success with admin info, including role_id and role details if available
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.validate_admin_credentials TO anon, authenticated, service_role;

COMMIT;
