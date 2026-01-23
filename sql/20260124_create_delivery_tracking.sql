-- Delivery Partner Tracking & Management System
-- Part of the Admin Console enhancement

-- 1. Real-time Location Logs
CREATE TABLE IF NOT EXISTS public.delivery_partner_location_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_partner_id UUID NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION, -- direction in degrees
    speed DOUBLE PRECISION, -- speed in km/h
    battery_level INTEGER, -- battery percentage
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Assignment Rejections
CREATE TABLE IF NOT EXISTS public.delivery_assignment_rejections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_partner_id UUID NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
    batch_id UUID, -- Links to delivery_batches(id), loose reference to avoid dependency issues if table missing
    order_id UUID, -- Links to orders(id) or master_orders(id) if needed
    reason TEXT,
    rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.delivery_partner_location_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignment_rejections ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow admins to view everything
CREATE POLICY "Admins can view all location logs" ON public.delivery_partner_location_logs
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_credentials WHERE admin_credentials.id = auth.uid()));

CREATE POLICY "Admins can view all rejections" ON public.delivery_assignment_rejections
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_credentials WHERE admin_credentials.id = auth.uid()));

-- Allow delivery partners to insert their own logs (assuming they have a user role, but for now we focus on admin view)
-- We will assume the API handles insertion with service role or proper auth.

-- 5. Helper Functions

-- Function to find nearby partners within a radius
CREATE OR REPLACE FUNCTION public.get_nearby_delivery_partners(
    target_lat DOUBLE PRECISION,
    target_lng DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 10.0
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone_number TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_km DOUBLE PRECISION,
    is_online BOOLEAN,
    is_available BOOLEAN,
    vehicle_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dp.id,
        dp.name,
        dp.phone_number,
        dp.latitude,
        dp.longitude,
        (
            6371 * acos(
                least(1.0, greatest(-1.0, 
                    cos(radians(target_lat)) * cos(radians(dp.latitude)) * cos(radians(dp.longitude) - radians(target_lng)) +
                    sin(radians(target_lat)) * sin(radians(dp.latitude))
                ))
            )
        ) AS distance_km,
        dp.is_online,
        dp.is_available,
        dp.vehicle_type
    FROM 
        public.delivery_partners dp
    WHERE 
        dp.latitude IS NOT NULL 
        AND dp.longitude IS NOT NULL
        AND dp.is_active = true
        AND (
            6371 * acos(
                least(1.0, greatest(-1.0, 
                    cos(radians(target_lat)) * cos(radians(dp.latitude)) * cos(radians(dp.longitude) - radians(target_lng)) +
                    sin(radians(target_lat)) * sin(radians(dp.latitude))
                ))
            )
        ) <= radius_km
    ORDER BY 
        distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to update partner location (and history)
CREATE OR REPLACE FUNCTION public.update_delivery_partner_location(
    p_partner_id UUID,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_heading DOUBLE PRECISION DEFAULT NULL,
    p_speed DOUBLE PRECISION DEFAULT NULL,
    p_battery INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Update current location in profile
    UPDATE public.delivery_partners
    SET 
        latitude = p_lat,
        longitude = p_lng,
        updated_at = NOW()
    WHERE id = p_partner_id;

    -- Log history
    INSERT INTO public.delivery_partner_location_logs (
        delivery_partner_id, latitude, longitude, heading, speed, battery_level
    ) VALUES (
        p_partner_id, p_lat, p_lng, p_heading, p_speed, p_battery
    );
END;
$$ LANGUAGE plpgsql;
