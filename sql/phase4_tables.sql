-- Phase 4 Database Tables
-- Message Templates Table

CREATE TABLE IF NOT EXISTS public.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'whatsapp', 'push')),
    subject TEXT,
    content TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_templates_type ON public.message_templates(type);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON public.message_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_message_templates_name ON public.message_templates(name);

-- Enable RLS on message_templates table
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (admin only access)
DROP POLICY IF EXISTS "Admins can view all templates" ON public.message_templates;
CREATE POLICY "Admins can view all templates" ON public.message_templates
    FOR SELECT USING (true); -- In production, check admin credentials

DROP POLICY IF EXISTS "Admins can insert templates" ON public.message_templates;
CREATE POLICY "Admins can insert templates" ON public.message_templates
    FOR INSERT WITH CHECK (true); -- In production, check admin credentials

DROP POLICY IF EXISTS "Admins can update templates" ON public.message_templates;
CREATE POLICY "Admins can update templates" ON public.message_templates
    FOR UPDATE USING (true); -- In production, check admin credentials

DROP POLICY IF EXISTS "Admins can delete templates" ON public.message_templates;
CREATE POLICY "Admins can delete templates" ON public.message_templates
    FOR DELETE USING (true); -- In production, check admin credentials

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_message_templates_updated_at ON public.message_templates;
CREATE TRIGGER trigger_update_message_templates_updated_at
    BEFORE UPDATE ON public.message_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_message_templates_updated_at();

