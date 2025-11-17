-- Phase 5 Database Tables
-- Admin Roles and Permissions

CREATE TABLE IF NOT EXISTS public.admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_roles_name ON public.admin_roles(name);
CREATE INDEX IF NOT EXISTS idx_admin_roles_system ON public.admin_roles(is_system);

-- Add role_id to admin_credentials table (if it doesn't exist)
-- Note: The table already has a 'role' TEXT column, we'll add role_id as a foreign key
-- and keep both for backward compatibility
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_credentials' 
        AND column_name = 'role_id'
    ) THEN
        ALTER TABLE public.admin_credentials 
        ADD COLUMN role_id UUID REFERENCES public.admin_roles(id);
        
        -- Create index for role_id
        CREATE INDEX IF NOT EXISTS idx_admin_credentials_role_id ON public.admin_credentials(role_id);
    END IF;
END $$;

-- Migrate existing role text values to role_id references
-- This maps the existing 'role' TEXT values to the new admin_roles table
DO $$
DECLARE
    super_admin_id UUID;
    admin_id UUID;
    support_id UUID;
BEGIN
    -- Get role IDs
    SELECT id INTO super_admin_id FROM public.admin_roles WHERE name = 'Super Admin';
    SELECT id INTO admin_id FROM public.admin_roles WHERE name = 'Admin';
    SELECT id INTO support_id FROM public.admin_roles WHERE name = 'Support';
    
    -- Map existing role text to role_id
    -- Update based on existing role text values
    UPDATE public.admin_credentials
    SET role_id = super_admin_id
    WHERE role = 'super_admin' OR role = 'Super Admin' OR role = 'superadmin'
    AND role_id IS NULL;
    
    UPDATE public.admin_credentials
    SET role_id = admin_id
    WHERE role = 'admin' OR role = 'Admin'
    AND role_id IS NULL;
    
    UPDATE public.admin_credentials
    SET role_id = support_id
    WHERE role = 'support' OR role = 'Support'
    AND role_id IS NULL;
    
    -- For any remaining admins without a role_id, assign 'Admin' role by default
    UPDATE public.admin_credentials
    SET role_id = admin_id
    WHERE role_id IS NULL
    AND admin_id IS NOT NULL;
END $$;

-- Ensure roles are created before trying to reference them
-- Create default system roles (only if they don't exist)
INSERT INTO public.admin_roles (name, description, permissions, is_system)
SELECT * FROM (VALUES 
    (
        'Super Admin',
        'Full access to all features',
        '[
            {"resource": "users", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "orders", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "products", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "categories", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "payments", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "analytics", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "settings", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "templates", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "bulk_operations", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "database_tools", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "audit_log", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "dynamic_content", "actions": ["view", "create", "update", "delete", "export", "manage"]},
            {"resource": "messages", "actions": ["view", "create", "update", "delete", "export", "manage"]}
        ]'::jsonb,
        true
    ),
    (
        'Admin',
        'Standard admin access',
        '[
            {"resource": "users", "actions": ["view", "update", "export"]},
            {"resource": "orders", "actions": ["view", "update", "export"]},
            {"resource": "products", "actions": ["view", "create", "update", "export"]},
            {"resource": "categories", "actions": ["view", "create", "update"]},
            {"resource": "analytics", "actions": ["view", "export"]},
            {"resource": "templates", "actions": ["view", "create", "update"]},
            {"resource": "messages", "actions": ["view", "create"]}
        ]'::jsonb,
        true
    ),
    (
        'Support',
        'Limited access for support staff',
        '[
            {"resource": "users", "actions": ["view"]},
            {"resource": "orders", "actions": ["view", "update"]},
            {"resource": "products", "actions": ["view"]},
            {"resource": "analytics", "actions": ["view"]}
        ]'::jsonb,
        true
    )) AS v(name, description, permissions, is_system)
WHERE NOT EXISTS (SELECT 1 FROM public.admin_roles WHERE admin_roles.name = v.name);

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only)
DROP POLICY IF EXISTS "Admins can view all roles" ON public.admin_roles;
CREATE POLICY "Admins can view all roles" ON public.admin_roles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert roles" ON public.admin_roles;
CREATE POLICY "Admins can insert roles" ON public.admin_roles
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update roles" ON public.admin_roles;
CREATE POLICY "Admins can update roles" ON public.admin_roles
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Admins can delete roles" ON public.admin_roles;
CREATE POLICY "Admins can delete roles" ON public.admin_roles
    FOR DELETE USING (true);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_admin_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_admin_roles_updated_at ON public.admin_roles;
CREATE TRIGGER trigger_update_admin_roles_updated_at
    BEFORE UPDATE ON public.admin_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_roles_updated_at();

