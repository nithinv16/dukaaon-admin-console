-- Fix foreign key constraint for admin_messages.created_by
-- This ensures Supabase PostgREST can properly recognize the relationship
-- 
-- IMPORTANT: Run phase2_tables.sql FIRST to create the admin_messages table
-- This script only fixes the foreign key constraint if the table already exists

-- Check if table exists before trying to fix the constraint
DO $$ 
BEGIN
  -- Only proceed if the table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_messages') THEN
    -- Drop existing foreign key if it exists (with different name)
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'admin_messages'::regclass 
      AND confrelid = 'admin_credentials'::regclass
      AND contype = 'f'
    ) THEN
      ALTER TABLE admin_messages 
      DROP CONSTRAINT IF EXISTS admin_messages_created_by_fkey;
    END IF;

    -- Re-add the foreign key with explicit naming
    ALTER TABLE admin_messages
    ADD CONSTRAINT admin_messages_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES admin_credentials(id) 
    ON DELETE SET NULL;

    -- Add comment for clarity
    COMMENT ON CONSTRAINT admin_messages_created_by_fkey ON admin_messages 
    IS 'Foreign key to admin_credentials table for tracking message creator';
  ELSE
    RAISE NOTICE 'Table admin_messages does not exist. Please run phase2_tables.sql first to create the table.';
  END IF;
END $$;

