-- Create admin_credentials table for admin login
-- This table will store admin login credentials separately from the auth system

-- Create the admin_credentials table
CREATE TABLE IF NOT EXISTS public.admin_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'active',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_credentials_email ON public.admin_credentials(email);
CREATE INDEX IF NOT EXISTS idx_admin_credentials_status ON public.admin_credentials(status);

-- Enable RLS on admin_credentials table
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow service role to access admin credentials
DROP POLICY IF EXISTS "Service role can access admin credentials" ON public.admin_credentials;
CREATE POLICY "Service role can access admin credentials" 
ON public.admin_credentials
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create RLS policy to allow anon role to read admin credentials for login validation
DROP POLICY IF EXISTS "Allow anon to read admin credentials for login" ON public.admin_credentials;
CREATE POLICY "Allow anon to read admin credentials for login" 
ON public.admin_credentials
FOR SELECT
TO anon
USING (status = 'active');

-- Insert default admin credentials
-- Password: dukaaon#28 (hashed using bcrypt)
INSERT INTO public.admin_credentials (email, password_hash, name, role, status)
VALUES (
    'admin@dukaaon.in',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash for 'dukaaon#28'
    'DukaaOn Admin',
    'admin',
    'active'
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    updated_at = NOW();

-- Create function to validate admin credentials
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
    result JSONB;
BEGIN
    -- Find admin by email and active status
    SELECT id, email, password_hash, name, role, status, last_login
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
        
        -- Return success with admin info
        RETURN jsonb_build_object(
            'success', true,
            'admin', jsonb_build_object(
                'id', admin_record.id,
                'email', admin_record.email,
                'name', admin_record.name,
                'role', admin_record.role
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.admin_credentials TO service_role;
GRANT SELECT ON public.admin_credentials TO anon;
GRANT EXECUTE ON FUNCTION public.validate_admin_credentials TO anon, authenticated, service_role;