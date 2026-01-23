-- =====================================================
-- REFERRAL & REWARD SYSTEM
-- Complete referral tracking, rewards, and sales team attribution
-- =====================================================

-- 1. REFERRAL SETTINGS TABLE (Admin-configurable from Supabase)
-- Store all referral program settings that can be changed from dashboard
CREATE TABLE IF NOT EXISTS public.referral_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default referral settings
INSERT INTO public.referral_settings (key, value, description) VALUES
    -- Reward Settings
    ('referrer_reward', '{"amount": 100, "currency": "INR", "type": "wallet_credit", "description": "₹100 wallet credit when your friend places first order"}', 'Reward for the person who referred'),
    ('referee_reward', '{"amount": 50, "currency": "INR", "type": "discount", "description": "₹50 off on your first order"}', 'Reward for the new user who was referred'),
    ('min_order_for_reward', '{"amount": 500, "currency": "INR"}', 'Minimum order amount to trigger referral reward'),
    ('max_referrals_per_user', '{"limit": 50, "period": "month", "unlimited": false}', 'Maximum referrals a user can make'),
    ('reward_expiry_days', '{"days": 30, "can_expire": true}', 'How long before rewards expire'),
    ('program_status', '{"enabled": true, "message": "Refer friends and earn rewards!"}', 'Overall referral program status'),
    ('sales_team_bonus', '{"amount": 25, "currency": "INR", "per_signup": true, "description": "Bonus per customer onboarded"}', 'Bonus for sales team members per signup'),
    
    -- UI Content Settings (Dynamic text - can be edited in Supabase)
    ('ui_banner_title', '{"en": "Refer & Earn", "hi": "रेफर करें और कमाएं", "te": "రిఫర్ చేసి సంపాదించండి", "ta": "பரிந்துரை செய்து சம்பாதிக்கவும்"}', 'Referral banner title in multiple languages'),
    ('ui_banner_subtitle', '{"en": "Share with friends & earn rewards", "hi": "दोस्तों के साथ साझा करें और इनाम पाएं", "te": "మిత్రులతో పంచుకోండి & రివార్డులు అందుకోండి", "ta": "நண்பர்களுடன் பகிர்ந்து வெகுமதிகளைப் பெறுங்கள்"}', 'Referral banner subtitle'),
    ('ui_share_button_text', '{"en": "Share Now", "hi": "अभी साझा करें", "te": "ఇప్పుడే షేర్ చేయండి", "ta": "இப்போது பகிரவும்"}', 'Share button text'),
    ('ui_copy_code_text', '{"en": "Tap to copy code", "hi": "कोड कॉपी करने के लिए टैप करें", "te": "కోడ్ కాపీ చేయడానికి నొక్కండి", "ta": "குறியீட்டை நகலெடுக்க தட்டவும்"}', 'Copy code instruction text'),
    
    -- Share Message Template (Dynamic - can be edited in Supabase)
    ('share_message_template', '{
        "en": "Join dukaaOn with my referral code: {{CODE}}\n\n🎁 You''ll get ₹{{REFEREE_REWARD}} off on your first order!\n🛒 Shop from nearby wholesalers at best prices\n\nDownload now: {{LINK}}",
        "hi": "मेरे रेफरल कोड से dukaaOn जॉइन करें: {{CODE}}\n\n🎁 आपको अपने पहले ऑर्डर पर ₹{{REFEREE_REWARD}} की छूट मिलेगी!\n🛒 नजदीकी थोक विक्रेताओं से बेहतरीन कीमतों पर खरीदारी करें\n\nअभी डाउनलोड करें: {{LINK}}"
    }', 'Share message template with placeholders'),
    
    -- Banner Colors (Dynamic - can be edited in Supabase)
    ('ui_banner_colors', '{"gradient_start": "#FF9800", "gradient_end": "#F57C00", "text_color": "#FFFFFF", "code_bg_color": "#FFFFFF", "code_text_color": "#2575FC"}', 'Referral banner color scheme'),
    
    -- Current Offers (Dynamic - can be edited in Supabase)
    ('current_offer', '{
        "enabled": true,
        "title": "Special Referral Bonus!",
        "description": "Refer 5 friends this month and get extra ₹200 bonus!",
        "start_date": "2026-01-01",
        "end_date": "2026-01-31",
        "bonus_amount": 200,
        "min_referrals": 5
    }', 'Current special referral offer'),
    
    -- App Store Links
    ('app_store_links', '{
        "play_store": "https://play.google.com/store/apps/details?id=com.sixn8.dukaaon",
        "app_store": "",
        "package_name": "com.sixn8.dukaaon"
    }', 'App store links for referral sharing'),
    
    -- Milestone Rewards (Dynamic - can be edited in Supabase)
    ('milestone_rewards', '[
        {"referrals": 5, "bonus": 200, "title": "Starter Bonus"},
        {"referrals": 10, "bonus": 500, "title": "Bronze Bonus"},
        {"referrals": 25, "bonus": 1500, "title": "Silver Bonus"},
        {"referrals": 50, "bonus": 5000, "title": "Gold Bonus"}
    ]', 'Milestone-based bonus rewards for referrers'),
    
    -- Terms and Conditions (Dynamic - can be edited in Supabase)
    ('terms_and_conditions', '{
        "en": [
            "Referral rewards are credited only after the referee places their first order of ₹500 or more",
            "Maximum 50 referrals per month per user",
            "Wallet credits expire after 30 days if unused",
            "dukaaOn reserves the right to modify or cancel the referral program at any time"
        ],
        "hi": [
            "रेफ़रल रिवॉर्ड तभी क्रेडिट किया जाता है जब रेफ़री ₹500 या उससे अधिक का पहला ऑर्डर करता है",
            "प्रति उपयोगकर्ता प्रति माह अधिकतम 50 रेफ़रल",
            "वॉलेट क्रेडिट अगर उपयोग नहीं किया गया तो 30 दिनों बाद समाप्त हो जाते हैं",
            "dukaaOn किसी भी समय रेफ़रल प्रोग्राम को संशोधित या रद्द करने का अधिकार सुरक्षित रखता है"
        ]
    }', 'Terms and conditions for referral program')
ON CONFLICT (key) DO NOTHING;

-- 2. REFERRAL CODES TABLE
-- Store custom and generated referral codes (including sales team codes)
CREATE TABLE IF NOT EXISTS public.referral_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    code_type TEXT NOT NULL DEFAULT 'user' CHECK (code_type IN ('user', 'sales_team', 'influencer', 'marketing')),
    is_active BOOLEAN DEFAULT true,
    max_uses INTEGER, -- NULL means unlimited
    current_uses INTEGER DEFAULT 0,
    custom_reward JSONB, -- Override default reward if needed
    metadata JSONB, -- Store additional info like campaign name, sales team member name, etc.
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON public.referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_type ON public.referral_codes(code_type);

-- 3. REFERRALS TABLE
-- Track all referrals and their status
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Person who referred
    referee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- New user who signed up
    referral_code_id UUID REFERENCES public.referral_codes(id) ON DELETE SET NULL,
    referral_code TEXT NOT NULL, -- Store the actual code used
    
    -- Tracking method
    tracking_method TEXT DEFAULT 'code' CHECK (tracking_method IN ('code', 'link', 'qr', 'sms', 'whatsapp', 'device_fingerprint')),
    
    -- Attribution data
    attribution_source TEXT, -- 'app_share', 'sales_team', 'marketing_campaign', etc.
    device_fingerprint TEXT, -- For tracking without explicit code entry
    click_id TEXT, -- Dynamic link click tracking
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rewarded', 'expired', 'invalid')),
    verified_at TIMESTAMP WITH TIME ZONE,
    rewarded_at TIMESTAMP WITH TIME ZONE,
    
    -- Reward info
    referrer_reward_amount NUMERIC,
    referee_reward_amount NUMERIC,
    reward_note TEXT,
    
    -- Additional metadata
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON public.referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_device_fingerprint ON public.referrals(device_fingerprint);

-- 4. REFERRAL REWARDS TABLE
-- Track individual reward transactions
CREATE TABLE IF NOT EXISTS public.referral_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_id UUID REFERENCES public.referrals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('wallet_credit', 'discount', 'cashback', 'points', 'free_delivery')),
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'used', 'expired', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE,
    credited_at TIMESTAMP WITH TIME ZONE,
    used_at TIMESTAMP WITH TIME ZONE,
    used_in_order_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON public.referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON public.referral_rewards(status);

-- 5. REFERRAL LINK CLICKS TABLE
-- Track referral link clicks for attribution (before signup)
CREATE TABLE IF NOT EXISTS public.referral_link_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_code TEXT NOT NULL,
    device_fingerprint TEXT,
    ip_address TEXT,
    user_agent TEXT,
    platform TEXT, -- 'android', 'ios', 'web'
    click_source TEXT, -- 'sms', 'whatsapp', 'email', 'social', 'qr'
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    converted BOOLEAN DEFAULT false,
    converted_user_id UUID REFERENCES public.profiles(id),
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_code ON public.referral_link_clicks(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_fingerprint ON public.referral_link_clicks(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_date ON public.referral_link_clicks(clicked_at);

-- 6. ADD REFERRAL COLUMNS TO PROFILES
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS referral_source TEXT,
    ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_referral_earnings NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0;

-- Create index for referral tracking
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- 7. FUNCTION: Generate unique referral code for user
CREATE OR REPLACE FUNCTION public.generate_referral_code(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    -- Generate code: DUK + first 6 chars of UUID (uppercase)
    new_code := 'DUK' || UPPER(SUBSTRING(user_id::TEXT FROM 1 FOR 6));
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM public.referral_codes WHERE code = new_code) INTO code_exists;
    
    -- If exists, append random chars
    WHILE code_exists LOOP
        new_code := 'DUK' || UPPER(SUBSTRING(md5(random()::TEXT) FROM 1 FOR 6));
        SELECT EXISTS(SELECT 1 FROM public.referral_codes WHERE code = new_code) INTO code_exists;
    END LOOP;
    
    -- Insert the code
    INSERT INTO public.referral_codes (code, user_id, code_type)
    VALUES (new_code, user_id, 'user')
    ON CONFLICT (code) DO NOTHING;
    
    -- Update profile with referral code
    UPDATE public.profiles 
    SET referral_code = new_code 
    WHERE id = user_id AND referral_code IS NULL;
    
    RETURN new_code;
END;
$$;

-- 8. FUNCTION: Record referral link click 
CREATE OR REPLACE FUNCTION public.record_referral_click(
    p_referral_code TEXT,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_platform TEXT DEFAULT NULL,
    p_click_source TEXT DEFAULT NULL,
    p_utm_source TEXT DEFAULT NULL,
    p_utm_medium TEXT DEFAULT NULL,
    p_utm_campaign TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    click_id UUID;
BEGIN
    INSERT INTO public.referral_link_clicks (
        referral_code,
        device_fingerprint,
        ip_address,
        user_agent,
        platform,
        click_source,
        utm_source,
        utm_medium,
        utm_campaign
    ) VALUES (
        p_referral_code,
        p_device_fingerprint,
        p_ip_address,
        p_user_agent,
        p_platform,
        p_click_source,
        p_utm_source,
        p_utm_medium,
        p_utm_campaign
    )
    RETURNING id INTO click_id;
    
    RETURN click_id;
END;
$$;

-- 9. FUNCTION: Process referral on signup (with device fingerprint matching)
CREATE OR REPLACE FUNCTION public.process_referral_on_signup(
    p_new_user_id UUID,
    p_referral_code TEXT DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    referrer_id UUID;
    referral_code_record RECORD;
    found_click RECORD;
    new_referral_id UUID;
    referrer_reward JSONB;
    referee_reward JSONB;
    program_status JSONB;
BEGIN
    -- Check if referral program is enabled
    SELECT value INTO program_status 
    FROM public.referral_settings 
    WHERE key = 'program_status' AND is_active = true;
    
    IF NOT (program_status->>'enabled')::BOOLEAN THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referral program is not active');
    END IF;
    
    -- First, try to find referral code if provided
    IF p_referral_code IS NOT NULL THEN
        SELECT rc.*, p.id as owner_id 
        INTO referral_code_record
        FROM public.referral_codes rc
        LEFT JOIN public.profiles p ON rc.user_id = p.id
        WHERE rc.code = p_referral_code 
        AND rc.is_active = true
        AND (rc.expires_at IS NULL OR rc.expires_at > NOW())
        AND (rc.max_uses IS NULL OR rc.current_uses < rc.max_uses);
        
        IF FOUND THEN
            referrer_id := referral_code_record.owner_id;
        END IF;
    END IF;
    
    -- If no code provided, try device fingerprint matching
    IF referrer_id IS NULL AND p_device_fingerprint IS NOT NULL THEN
        SELECT * INTO found_click
        FROM public.referral_link_clicks
        WHERE device_fingerprint = p_device_fingerprint
        AND converted = false
        AND clicked_at > NOW() - INTERVAL '7 days' -- Click must be within last 7 days
        ORDER BY clicked_at DESC
        LIMIT 1;
        
        IF FOUND THEN
            -- Find the referrer from the code used in the click
            SELECT rc.user_id INTO referrer_id
            FROM public.referral_codes rc
            WHERE rc.code = found_click.referral_code;
            
            -- Mark the click as converted
            UPDATE public.referral_link_clicks
            SET converted = true, converted_user_id = p_new_user_id
            WHERE id = found_click.id;
            
            p_referral_code := found_click.referral_code;
        END IF;
    END IF;
    
    -- If we found a referrer, create the referral
    IF referrer_id IS NOT NULL AND referrer_id != p_new_user_id THEN
        -- Get reward amounts from settings
        SELECT value INTO referrer_reward 
        FROM public.referral_settings 
        WHERE key = 'referrer_reward' AND is_active = true;
        
        SELECT value INTO referee_reward 
        FROM public.referral_settings 
        WHERE key = 'referee_reward' AND is_active = true;
        
        -- Create the referral record
        INSERT INTO public.referrals (
            referrer_id,
            referee_id,
            referral_code,
            referral_code_id,
            tracking_method,
            status,
            referrer_reward_amount,
            referee_reward_amount,
            metadata
        ) VALUES (
            referrer_id,
            p_new_user_id,
            COALESCE(p_referral_code, 'DEVICE_MATCH'),
            referral_code_record.id,
            CASE WHEN p_referral_code IS NOT NULL THEN 'code' ELSE 'device_fingerprint' END,
            'pending',
            (referrer_reward->>'amount')::NUMERIC,
            (referee_reward->>'amount')::NUMERIC,
            jsonb_build_object(
                'device_fingerprint', p_device_fingerprint,
                'code_type', referral_code_record.code_type
            )
        )
        RETURNING id INTO new_referral_id;
        
        -- Update profiles
        UPDATE public.profiles
        SET referred_by = referrer_id, 
            referral_source = COALESCE(referral_code_record.code_type, 'unknown')
        WHERE id = p_new_user_id;
        
        -- Update referral code usage count
        IF referral_code_record.id IS NOT NULL THEN
            UPDATE public.referral_codes
            SET current_uses = current_uses + 1,
                updated_at = NOW()
            WHERE id = referral_code_record.id;
        END IF;
        
        -- Update referrer's total referrals count
        UPDATE public.profiles
        SET total_referrals = total_referrals + 1
        WHERE id = referrer_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'referral_id', new_referral_id,
            'referrer_id', referrer_id,
            'referee_reward', referee_reward,
            'message', 'Referral created successfully'
        );
    END IF;
    
    RETURN jsonb_build_object('success', false, 'message', 'No valid referral found');
END;
$$;

-- 10. FUNCTION: Complete referral after first order
CREATE OR REPLACE FUNCTION public.complete_referral_on_first_order(
    p_user_id UUID,
    p_order_id UUID,
    p_order_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    referral_record RECORD;
    min_order JSONB;
    reward_expiry JSONB;
    expiry_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Find pending referral for this user
    SELECT * INTO referral_record
    FROM public.referrals
    WHERE referee_id = p_user_id
    AND status = 'pending'
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No pending referral found');
    END IF;
    
    -- Check minimum order amount
    SELECT value INTO min_order 
    FROM public.referral_settings 
    WHERE key = 'min_order_for_reward' AND is_active = true;
    
    IF p_order_amount < (min_order->>'amount')::NUMERIC THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Order amount does not meet minimum requirement',
            'min_required', min_order->>'amount'
        );
    END IF;
    
    -- Get reward expiry settings
    SELECT value INTO reward_expiry 
    FROM public.referral_settings 
    WHERE key = 'reward_expiry_days' AND is_active = true;
    
    IF (reward_expiry->>'can_expire')::BOOLEAN THEN
        expiry_date := NOW() + ((reward_expiry->>'days')::INTEGER || ' days')::INTERVAL;
    ELSE
        expiry_date := NULL;
    END IF;
    
    -- Update referral status
    UPDATE public.referrals
    SET status = 'rewarded',
        verified_at = NOW(),
        rewarded_at = NOW(),
        updated_at = NOW()
    WHERE id = referral_record.id;
    
    -- Create reward for referrer (wallet credit)
    INSERT INTO public.referral_rewards (
        referral_id,
        user_id,
        reward_type,
        amount,
        status,
        expires_at,
        credited_at
    ) VALUES (
        referral_record.id,
        referral_record.referrer_id,
        'wallet_credit',
        referral_record.referrer_reward_amount,
        'credited',
        expiry_date,
        NOW()
    );
    
    -- Add to referrer's wallet
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + referral_record.referrer_reward_amount,
        total_referral_earnings = total_referral_earnings + referral_record.referrer_reward_amount
    WHERE id = referral_record.referrer_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Referral rewards processed successfully',
        'referrer_reward', referral_record.referrer_reward_amount,
        'referee_reward', referral_record.referee_reward_amount
    );
END;
$$;

-- 11. FUNCTION: Get user's referral stats
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stats JSONB;
    user_code TEXT;
    referrer_reward JSONB;
BEGIN
    -- Get user's referral code (generate if doesn't exist)
    SELECT referral_code INTO user_code FROM public.profiles WHERE id = p_user_id;
    
    IF user_code IS NULL THEN
        user_code := public.generate_referral_code(p_user_id);
    END IF;
    
    -- Get current reward amount
    SELECT value INTO referrer_reward 
    FROM public.referral_settings 
    WHERE key = 'referrer_reward' AND is_active = true;
    
    -- Build stats
    SELECT jsonb_build_object(
        'referral_code', user_code,
        'reward_per_referral', referrer_reward,
        'total_referrals', COALESCE(p.total_referrals, 0),
        'total_earnings', COALESCE(p.total_referral_earnings, 0),
        'wallet_balance', COALESCE(p.wallet_balance, 0),
        'pending_referrals', (
            SELECT COUNT(*) FROM public.referrals 
            WHERE referrer_id = p_user_id AND status = 'pending'
        ),
        'successful_referrals', (
            SELECT COUNT(*) FROM public.referrals 
            WHERE referrer_id = p_user_id AND status = 'rewarded'
        )
    ) INTO stats
    FROM public.profiles p
    WHERE p.id = p_user_id;
    
    RETURN stats;
END;
$$;

-- 12. FUNCTION: Get referral settings for app display
CREATE OR REPLACE FUNCTION public.get_referral_program_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB := '{}';
    setting RECORD;
BEGIN
    FOR setting IN 
        SELECT key, value FROM public.referral_settings WHERE is_active = true
    LOOP
        result := result || jsonb_build_object(setting.key, setting.value);
    END LOOP;
    
    RETURN result;
END;
$$;

-- 13. CREATE SALES TEAM CODES
-- Function to create sales team referral codes
CREATE OR REPLACE FUNCTION public.create_sales_team_code(
    p_admin_user_id UUID,
    p_code TEXT,
    p_sales_person_name TEXT,
    p_custom_reward JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_code_id UUID;
BEGIN
    -- Insert sales team code
    INSERT INTO public.referral_codes (
        code,
        user_id,
        code_type,
        custom_reward,
        metadata
    ) VALUES (
        UPPER(p_code),
        p_admin_user_id, -- Assign to admin/company account
        'sales_team',
        p_custom_reward,
        jsonb_build_object(
            'sales_person_name', p_sales_person_name,
            'created_by', p_admin_user_id
        )
    )
    RETURNING id INTO new_code_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'code_id', new_code_id,
        'code', UPPER(p_code),
        'message', 'Sales team code created successfully'
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'message', 'Code already exists');
END;
$$;

-- 14. RLS POLICIES
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_link_clicks ENABLE ROW LEVEL SECURITY;

-- Read policies (public read for settings, users can read their own data)
CREATE POLICY "Public read for referral_settings" ON public.referral_settings FOR SELECT USING (is_active = true);
CREATE POLICY "Users can read own codes" ON public.referral_codes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can read own referrals" ON public.referrals FOR SELECT USING (referrer_id = auth.uid() OR referee_id = auth.uid());
CREATE POLICY "Users can read own rewards" ON public.referral_rewards FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Public insert for link_clicks" ON public.referral_link_clicks FOR INSERT WITH CHECK (true);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_referral_code TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_referral_click TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_referral_on_signup TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.complete_referral_on_first_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_program_info TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_sales_team_code TO authenticated;

-- 15. COMMENTS
COMMENT ON TABLE public.referral_settings IS 'Admin-configurable referral program settings';
COMMENT ON TABLE public.referral_codes IS 'User and sales team referral codes';
COMMENT ON TABLE public.referrals IS 'Tracks all referral relationships and status';
COMMENT ON TABLE public.referral_rewards IS 'Individual reward transactions for referrals';
COMMENT ON TABLE public.referral_link_clicks IS 'Tracks referral link clicks for attribution without explicit code entry';

-- 16. ADMIN HELPER FUNCTIONS

-- Function to add amount to user's wallet
CREATE OR REPLACE FUNCTION public.add_to_wallet(
    p_user_id UUID,
    p_amount NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount,
        total_referral_earnings = COALESCE(total_referral_earnings, 0) + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$;

-- Function to get referral analytics for admin dashboard
CREATE OR REPLACE FUNCTION public.get_referral_analytics(
    p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    start_date TIMESTAMP WITH TIME ZONE;
BEGIN
    start_date := NOW() - (p_days || ' days')::INTERVAL;
    
    SELECT jsonb_build_object(
        'total_referrals', (SELECT COUNT(*) FROM public.referrals),
        'pending_referrals', (SELECT COUNT(*) FROM public.referrals WHERE status = 'pending'),
        'successful_referrals', (SELECT COUNT(*) FROM public.referrals WHERE status = 'rewarded'),
        'total_rewards_paid', (SELECT COALESCE(SUM(amount), 0) FROM public.referral_rewards WHERE status = 'credited'),
        'total_clicks', (SELECT COUNT(*) FROM public.referral_link_clicks),
        'converted_clicks', (SELECT COUNT(*) FROM public.referral_link_clicks WHERE converted = true),
        'referrals_last_period', (SELECT COUNT(*) FROM public.referrals WHERE created_at >= start_date),
        'clicks_last_period', (SELECT COUNT(*) FROM public.referral_link_clicks WHERE clicked_at >= start_date),
        'top_referrers', (
            SELECT jsonb_agg(row_to_json(r))
            FROM (
                SELECT id, phone_number, total_referrals, total_referral_earnings
                FROM public.profiles
                WHERE total_referrals > 0
                ORDER BY total_referrals DESC
                LIMIT 10
            ) r
        ),
        'sales_team_performance', (
            SELECT jsonb_agg(row_to_json(s))
            FROM (
                SELECT 
                    code,
                    metadata->>'sales_person_name' as sales_person,
                    current_uses as signups,
                    is_active
                FROM public.referral_codes
                WHERE code_type = 'sales_team'
                ORDER BY current_uses DESC
            ) s
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Function to update any referral setting (admin only)
CREATE OR REPLACE FUNCTION public.update_referral_setting(
    p_key TEXT,
    p_value JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.referral_settings
    SET value = p_value,
        updated_at = NOW()
    WHERE key = p_key;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Setting not found');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'message', 'Setting updated successfully');
END;
$$;

-- Grant permissions for admin functions
GRANT EXECUTE ON FUNCTION public.add_to_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_referral_setting TO authenticated;

-- 17. ADMIN WRITE POLICIES (for admin users)
-- Note: In production, add role checks for admin users
CREATE POLICY "Admin can update referral_settings" ON public.referral_settings 
    FOR UPDATE USING (true);
    
CREATE POLICY "Admin can insert referral_codes" ON public.referral_codes 
    FOR INSERT WITH CHECK (true);
    
CREATE POLICY "Admin can update referral_codes" ON public.referral_codes 
    FOR UPDATE USING (true);

CREATE POLICY "Admin can update referrals" ON public.referrals 
    FOR UPDATE USING (true);

CREATE POLICY "Admin can insert referral_rewards" ON public.referral_rewards 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin can update referral_rewards" ON public.referral_rewards 
    FOR UPDATE USING (true);

-- Allow all authenticated users to read all referral codes (for validation)
CREATE POLICY "All users can read all codes for validation" ON public.referral_codes 
    FOR SELECT USING (is_active = true);
