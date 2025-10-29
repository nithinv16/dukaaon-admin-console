-- =====================================================
-- Row Level Security (RLS) Policies for Admin Console
-- =====================================================
-- This file contains all necessary RLS policies to ensure
-- the admin console can properly access users, orders, and products

-- =====================================================
-- 1. PROFILES TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on profiles table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.profiles';
    END LOOP;
END $$;

-- Allow service role full access to profiles (for admin console backend)
CREATE POLICY "Service role can access all profiles" 
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to read all profiles (for admin dashboard)
CREATE POLICY "Authenticated users can read all profiles" 
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update profiles (for admin management)
CREATE POLICY "Authenticated users can update profiles" 
ON public.profiles
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert new profiles
CREATE POLICY "Authenticated users can insert profiles" 
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anon role to read profiles (for login and registration)
CREATE POLICY "Anon can read profiles for auth" 
ON public.profiles
FOR SELECT
TO anon
USING (true);

-- =====================================================
-- 2. SELLER_DETAILS TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on seller_details table
ALTER TABLE public.seller_details ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on seller_details table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'seller_details'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.seller_details';
    END LOOP;
END $$;

-- Allow service role full access to seller_details
CREATE POLICY "Service role can access all seller details" 
ON public.seller_details
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to read all seller details
CREATE POLICY "Authenticated users can read all seller details" 
ON public.seller_details
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update seller details
CREATE POLICY "Authenticated users can update seller details" 
ON public.seller_details
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert seller details
CREATE POLICY "Authenticated users can insert seller details" 
ON public.seller_details
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anon role to read seller details (for public seller info)
CREATE POLICY "Anon can read seller details" 
ON public.seller_details
FOR SELECT
TO anon
USING (true);

-- =====================================================
-- 3. ORDERS TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on orders table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'orders'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.orders';
    END LOOP;
END $$;

-- Allow service role full access to orders
CREATE POLICY "Service role can access all orders" 
ON public.orders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to read all orders (for admin dashboard)
CREATE POLICY "Authenticated users can read all orders" 
ON public.orders
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update orders (for order management)
CREATE POLICY "Authenticated users can update orders" 
ON public.orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert orders
CREATE POLICY "Authenticated users can insert orders" 
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- 4. PRODUCTS TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on products table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on products table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'products'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.products';
    END LOOP;
END $$;

-- Allow service role full access to products
CREATE POLICY "Service role can access all products" 
ON public.products
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to read all products
CREATE POLICY "Authenticated users can read all products" 
ON public.products
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update products
CREATE POLICY "Authenticated users can update products" 
ON public.products
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert products
CREATE POLICY "Authenticated users can insert products" 
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anon role to read active products (for public catalog)
CREATE POLICY "Anon can read active products" 
ON public.products
FOR SELECT
TO anon
USING (status = 'active');

-- =====================================================
-- 5. MASTER_ORDERS TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on master_orders table
ALTER TABLE public.master_orders ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on master_orders table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'master_orders'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.master_orders';
    END LOOP;
END $$;

-- Allow service role full access to master_orders
CREATE POLICY "Service role can access all master orders" 
ON public.master_orders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to read all master orders (for admin dashboard)
CREATE POLICY "Authenticated users can read all master orders" 
ON public.master_orders
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update master orders (for order management)
CREATE POLICY "Authenticated users can update master orders" 
ON public.master_orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert master orders
CREATE POLICY "Authenticated users can insert master orders" 
ON public.master_orders
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- 6. DELIVERY_BATCHES TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on delivery_batches table
ALTER TABLE public.delivery_batches ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on delivery_batches table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'delivery_batches'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.delivery_batches';
    END LOOP;
END $$;

-- Allow service role full access to delivery_batches
CREATE POLICY "Service role can access all delivery batches" 
ON public.delivery_batches
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to read all delivery batches (for admin dashboard)
CREATE POLICY "Authenticated users can read all delivery batches" 
ON public.delivery_batches
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update delivery batches (for delivery management)
CREATE POLICY "Authenticated users can update delivery batches" 
ON public.delivery_batches
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert delivery batches
CREATE POLICY "Authenticated users can insert delivery batches" 
ON public.delivery_batches
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- 7. ADDITIONAL TABLES (if they exist)
-- =====================================================

-- Categories table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories') THEN
        ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Service role can access all categories" ON public.categories;
        DROP POLICY IF EXISTS "Public can read categories" ON public.categories;
        
        CREATE POLICY "Service role can access all categories" 
        ON public.categories
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
        
        CREATE POLICY "Public can read categories" 
        ON public.categories
        FOR SELECT
        TO public
        USING (true);
    END IF;
END $$;

-- Notifications table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Service role can access all notifications" ON public.notifications;
        DROP POLICY IF EXISTS "Authenticated users can read all notifications" ON public.notifications;
        
        CREATE POLICY "Service role can access all notifications" 
        ON public.notifications
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
        
        CREATE POLICY "Authenticated users can read all notifications" 
        ON public.notifications
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;

-- Payment config table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_config') THEN
        ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Service role can access payment config" ON public.payment_config;
        DROP POLICY IF EXISTS "Authenticated users can read payment config" ON public.payment_config;
        
        CREATE POLICY "Service role can access payment config" 
        ON public.payment_config
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
        
        CREATE POLICY "Authenticated users can read payment config" 
        ON public.payment_config
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions to roles
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.seller_details TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.master_products TO service_role;
GRANT ALL ON public.master_orders TO service_role;
GRANT ALL ON public.delivery_batches TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.seller_details TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT SELECT ON public.master_products TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.master_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.delivery_batches TO authenticated;

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.seller_details TO anon;
GRANT SELECT ON public.products TO anon;

-- =====================================================
-- 9. VERIFICATION QUERIES
-- =====================================================

-- Use these queries to verify the policies are working:

-- Check if RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'seller_details', 'orders', 'products', 'master_products', 'master_orders', 'delivery_batches');

-- List all policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'seller_details', 'orders', 'products', 'master_products', 'master_orders', 'delivery_batches')
ORDER BY tablename, policyname;

-- Test queries (run these as different roles to verify access)
-- SELECT COUNT(*) FROM public.profiles;
-- SELECT COUNT(*) FROM public.seller_details;
-- SELECT COUNT(*) FROM public.orders;
-- SELECT COUNT(*) FROM public.products;
-- SELECT COUNT(*) FROM public.master_orders;
-- SELECT COUNT(*) FROM public.delivery_batches;

COMMIT;