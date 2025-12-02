-- Check what admin users exist in your database
-- Run this in Supabase SQL Editor to see all admin users

SELECT 
    id,
    email,
    name,
    role,
    status,
    created_at
FROM public.admin_credentials
ORDER BY created_at DESC;

-- Also check if the Employee role exists
SELECT 
    id,
    name,
    description
FROM public.admin_roles
WHERE name = 'Employee';
