-- Create profile_change_requests table for pending business information changes
-- Changes to sensitive fields (phone, GST, address, business name, owner name, location) require approval
-- This applies to both sellers and retailers

-- NOTE: Run this SQL in your Supabase Dashboard -> SQL Editor

-- Drop existing table if exists
DROP TABLE IF EXISTS public.profile_change_requests;

CREATE TABLE public.profile_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Role of the user (seller or retailer)
    user_role TEXT NOT NULL CHECK (user_role IN ('seller', 'retailer')),
    
    -- Current values (for reference)
    current_values JSONB NOT NULL DEFAULT '{}',
    
    -- Requested changes (can include: business_name, owner_name, phone_number, 
    -- address, gst_number, latitude, longitude, shop_name for retailers)
    requested_changes JSONB NOT NULL DEFAULT '{}',
    
    -- Status: pending, approved, rejected
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    
    -- Admin who processed the request (references admin_credentials table)
    processed_by UUID REFERENCES public.admin_credentials(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_user_id ON public.profile_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_status ON public.profile_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_role ON public.profile_change_requests(user_role);
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_created_at ON public.profile_change_requests(created_at DESC);

-- Enable RLS
ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own change requests
CREATE POLICY "Users can view their own change requests"
ON public.profile_change_requests
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Users can create change requests for themselves
CREATE POLICY "Users can create their own change requests"
ON public.profile_change_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy: Users can cancel (delete) their pending requests
CREATE POLICY "Users can delete their own pending requests"
ON public.profile_change_requests
FOR DELETE
USING (user_id = auth.uid() AND status = 'pending');

-- Policy: Allow service role full access (for admin operations via service key)
CREATE POLICY "Service role has full access"
ON public.profile_change_requests
FOR ALL
USING (true)
WITH CHECK (true);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_profile_change_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_profile_change_request_timestamp ON public.profile_change_requests;
CREATE TRIGGER update_profile_change_request_timestamp
    BEFORE UPDATE ON public.profile_change_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_change_request_timestamp();

-- Create function to apply approved changes (without email - profiles table doesn't have email column)
CREATE OR REPLACE FUNCTION apply_profile_change_request(request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    req RECORD;
    changes JSONB;
    profile_changes JSONB;
BEGIN
    -- Get the request
    SELECT * INTO req FROM public.profile_change_requests WHERE id = request_id AND status = 'approved';
    
    IF req IS NULL THEN
        RETURN FALSE;
    END IF;
    
    changes := req.requested_changes;
    profile_changes := '{}'::jsonb;
    
    -- Handle based on user role
    IF req.user_role = 'seller' THEN
        -- Update seller_details table
        UPDATE public.seller_details
        SET 
            business_name = COALESCE(changes->>'business_name', business_name),
            owner_name = COALESCE(changes->>'owner_name', owner_name),
            address = COALESCE(changes->'address', address),
            gst_number = COALESCE(changes->>'gst_number', gst_number)
        WHERE user_id = req.user_id;
        
        -- Build profile changes for seller (phone_number and location only - no email)
        IF changes ? 'phone_number' THEN
            profile_changes := profile_changes || jsonb_build_object('phone_number', changes->>'phone_number');
        END IF;
        IF changes ? 'latitude' THEN
            profile_changes := profile_changes || jsonb_build_object('latitude', (changes->>'latitude')::float);
        END IF;
        IF changes ? 'longitude' THEN
            profile_changes := profile_changes || jsonb_build_object('longitude', (changes->>'longitude')::float);
        END IF;
        
    ELSIF req.user_role = 'retailer' THEN
        -- For retailers, business_details is a JSONB column in profiles
        -- Build profile changes for retailer (phone_number and location only - no email)
        IF changes ? 'phone_number' THEN
            profile_changes := profile_changes || jsonb_build_object('phone_number', changes->>'phone_number');
        END IF;
        IF changes ? 'latitude' THEN
            profile_changes := profile_changes || jsonb_build_object('latitude', (changes->>'latitude')::float);
        END IF;
        IF changes ? 'longitude' THEN
            profile_changes := profile_changes || jsonb_build_object('longitude', (changes->>'longitude')::float);
        END IF;
        
        -- Update business_details JSONB if any business fields changed
        IF changes ? 'shopName' OR changes ? 'ownerName' OR changes ? 'address' OR changes ? 'gstNumber' THEN
            UPDATE public.profiles
            SET business_details = business_details || 
                jsonb_strip_nulls(jsonb_build_object(
                    'shopName', changes->>'shopName',
                    'ownerName', changes->>'ownerName',
                    'address', changes->>'address',
                    'gstNumber', changes->>'gstNumber'
                ))
            WHERE id = req.user_id;
        END IF;
    END IF;
    
    -- Apply profile changes (phone_number and location only) to profiles table
    IF profile_changes != '{}'::jsonb THEN
        UPDATE public.profiles
        SET 
            phone_number = COALESCE((profile_changes->>'phone_number'), phone_number),
            latitude = COALESCE((profile_changes->>'latitude')::float, latitude),
            longitude = COALESCE((profile_changes->>'longitude')::float, longitude),
            location_updated_at = CASE 
                WHEN profile_changes ? 'latitude' OR profile_changes ? 'longitude' 
                THEN NOW() 
                ELSE location_updated_at 
            END
        WHERE id = req.user_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION apply_profile_change_request(UUID) TO authenticated;


-- ============================================================================
-- IF YOU ONLY NEED TO UPDATE THE FUNCTION (table already exists), run this:
-- ============================================================================
-- 
-- CREATE OR REPLACE FUNCTION apply_profile_change_request(request_id UUID)
-- RETURNS BOOLEAN AS $$
-- DECLARE
--     req RECORD;
--     changes JSONB;
--     profile_changes JSONB;
-- BEGIN
--     SELECT * INTO req FROM public.profile_change_requests WHERE id = request_id AND status = 'approved';
--     
--     IF req IS NULL THEN
--         RETURN FALSE;
--     END IF;
--     
--     changes := req.requested_changes;
--     profile_changes := '{}'::jsonb;
--     
--     IF req.user_role = 'seller' THEN
--         UPDATE public.seller_details
--         SET 
--             business_name = COALESCE(changes->>'business_name', business_name),
--             owner_name = COALESCE(changes->>'owner_name', owner_name),
--             address = COALESCE(changes->'address', address),
--             gst_number = COALESCE(changes->>'gst_number', gst_number)
--         WHERE user_id = req.user_id;
--         
--         IF changes ? 'phone_number' THEN
--             profile_changes := profile_changes || jsonb_build_object('phone_number', changes->>'phone_number');
--         END IF;
--         IF changes ? 'latitude' THEN
--             profile_changes := profile_changes || jsonb_build_object('latitude', (changes->>'latitude')::float);
--         END IF;
--         IF changes ? 'longitude' THEN
--             profile_changes := profile_changes || jsonb_build_object('longitude', (changes->>'longitude')::float);
--         END IF;
--         
--     ELSIF req.user_role = 'retailer' THEN
--         IF changes ? 'phone_number' THEN
--             profile_changes := profile_changes || jsonb_build_object('phone_number', changes->>'phone_number');
--         END IF;
--         IF changes ? 'latitude' THEN
--             profile_changes := profile_changes || jsonb_build_object('latitude', (changes->>'latitude')::float);
--         END IF;
--         IF changes ? 'longitude' THEN
--             profile_changes := profile_changes || jsonb_build_object('longitude', (changes->>'longitude')::float);
--         END IF;
--         
--         IF changes ? 'shopName' OR changes ? 'ownerName' OR changes ? 'address' OR changes ? 'gstNumber' THEN
--             UPDATE public.profiles
--             SET business_details = business_details || 
--                 jsonb_strip_nulls(jsonb_build_object(
--                     'shopName', changes->>'shopName',
--                     'ownerName', changes->>'ownerName',
--                     'address', changes->>'address',
--                     'gstNumber', changes->>'gstNumber'
--                 ))
--             WHERE id = req.user_id;
--         END IF;
--     END IF;
--     
--     IF profile_changes != '{}'::jsonb THEN
--         UPDATE public.profiles
--         SET 
--             phone_number = COALESCE((profile_changes->>'phone_number'), phone_number),
--             latitude = COALESCE((profile_changes->>'latitude')::float, latitude),
--             longitude = COALESCE((profile_changes->>'longitude')::float, longitude),
--             location_updated_at = CASE 
--                 WHEN profile_changes ? 'latitude' OR profile_changes ? 'longitude' 
--                 THEN NOW() 
--                 ELSE location_updated_at 
--             END
--         WHERE id = req.user_id;
--     END IF;
--     
--     RETURN TRUE;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
-- ============================================================================
