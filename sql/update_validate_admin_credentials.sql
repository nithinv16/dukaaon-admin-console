-- Update validate_admin_credentials function to include role_id
-- This is optional - the function will work with or without role_id

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
    
    -- For now, we'll do a simple text comparison
    -- In production, you should use proper password hashing
    IF input_password = 'dukaaon#28' THEN
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

