import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing Supabase environment variables');
    return createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
};

// GET - Fetch all referral settings
export async function GET() {
    try {
        const supabase = getAdminSupabase();
        const { data: settings, error } = await supabase
            .from('referral_settings')
            .select('*')
            .order('key');

        if (error) {
            console.error('Error fetching referral settings:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Convert to key-value map
        const settingsMap: Record<string, any> = {};
        settings?.forEach((s) => {
            settingsMap[s.key] = {
                id: s.id,
                value: s.value,
                description: s.description,
                is_active: s.is_active,
                updated_at: s.updated_at,
            };
        });

        return NextResponse.json({ data: settingsMap, raw: settings });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Update referral setting
export async function POST(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const { key, value, is_active } = await request.json();

        if (!key) return NextResponse.json({ error: 'Setting key is required' }, { status: 400 });

        const updateData: any = { updated_at: new Date().toISOString() };
        if (value !== undefined) updateData.value = value;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { error } = await supabase.from('referral_settings').update(updateData).eq('key', key);

        if (error) {
            console.error('Error updating referral setting:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: `Setting '${key}' updated` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE - Delete a referral setting (if needed)
export async function DELETE(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (!key) return NextResponse.json({ error: 'Setting key is required' }, { status: 400 });

        const { error } = await supabase.from('referral_settings').delete().eq('key', key);

        if (error) {
            console.error('Error deleting referral setting:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: `Setting '${key}' deleted` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
