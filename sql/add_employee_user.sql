-- Quick script to add the employee user to your database
-- Run this in your Supabase SQL Editor

-- First, ensure the Employee role exists
INSERT INTO public.admin_roles (name, description, permissions, is_system)
SELECT * FROM (VALUES (
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
WHERE NOT EXISTS (SELECT 1 FROM public.admin_roles WHERE name = 'Employee');

-- Then, add the employee user
DO $$
DECLARE
    employee_role_id UUID;
BEGIN
    -- Get the Employee role ID
    SELECT id INTO employee_role_id 
    FROM public.admin_roles 
    WHERE name = 'Employee';
    
    -- Insert or update the employee credentials
    INSERT INTO public.admin_credentials (email, password_hash, name, role, role_id, status)
    VALUES (
        'yadhukk5723@gmail.com',
        '$2b$10$placeholder',  -- You'll need to update this with a real hash
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

-- Verify the employee was created
SELECT id, email, name, role, status 
FROM public.admin_credentials 
WHERE email = 'yadhukk5723@gmail.com';
