import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

// GET - Fetch WhatsApp data
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'templates';

    try {
        const supabase = getSupabaseAdmin();

        switch (type) {
            case 'templates': {
                const category = searchParams.get('category');
                let query = supabase
                    .from('whatsapp_template_config')
                    .select('*')
                    .order('category', { ascending: true });

                if (category) {
                    query = query.eq('category', category);
                }

                const { data, error } = await query;
                if (error) throw error;
                return NextResponse.json({ data });
            }

            case 'messages': {
                const phone = searchParams.get('phone');
                const status = searchParams.get('status');
                const direction = searchParams.get('direction');
                const limit = parseInt(searchParams.get('limit') || '100');
                const offset = parseInt(searchParams.get('offset') || '0');

                let query = supabase
                    .from('whatsapp_messages')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(offset, offset + limit - 1);

                if (phone) query = query.ilike('phone_number', `%${phone}%`);
                if (status) query = query.eq('status', status);
                if (direction) query = query.eq('direction', direction);

                const { data, error, count } = await query;
                if (error) throw error;
                return NextResponse.json({ data, count });
            }

            case 'conversations': {
                const activeOnly = searchParams.get('active') === 'true';
                const limit = parseInt(searchParams.get('limit') || '50');

                let query = supabase
                    .from('whatsapp_conversations')
                    .select('*')
                    .order('last_message_at', { ascending: false })
                    .limit(limit);

                if (activeOnly) {
                    query = query.gte('last_message_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
                }

                const { data, error } = await query;
                if (error) throw error;
                return NextResponse.json({ data });
            }

            case 'order_responses': {
                const processed = searchParams.get('processed');
                const limit = parseInt(searchParams.get('limit') || '50');

                let query = supabase
                    .from('whatsapp_order_responses')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(limit);

                if (processed === 'false') {
                    query = query.eq('processed', false);
                } else if (processed === 'true') {
                    query = query.eq('processed', true);
                }

                const { data: responses, error } = await query;
                if (error) throw error;

                // Manual join with profiles (sellers) to avoid FK relationship error
                if (responses && responses.length > 0) {
                    const sellerIds = Array.from(new Set(responses.map((r: any) => r.seller_id).filter(Boolean)));

                    if (sellerIds.length > 0) {
                        const { data: profiles, error: profilesError } = await supabase
                            .from('profiles')
                            .select('id, business_details')
                            .in('id', sellerIds);

                        if (!profilesError && profiles) {
                            const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

                            // Attach profile data to responses
                            const data = responses.map((r: any) => ({
                                ...r,
                                profiles: profileMap.get(r.seller_id) || null
                            }));

                            return NextResponse.json({ data });
                        }
                    }
                }

                return NextResponse.json({ data: responses });
            }

            case 'template_sends': {
                const templateKey = searchParams.get('template_key');
                const days = parseInt(searchParams.get('days') || '7');
                const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

                let query = supabase
                    .from('whatsapp_template_sends')
                    .select('*')
                    .gte('created_at', startDate)
                    .order('created_at', { ascending: false });

                if (templateKey) {
                    query = query.eq('template_key', templateKey);
                }

                const { data, error } = await query;
                if (error) throw error;
                return NextResponse.json({ data });
            }

            case 'analytics': {
                const days = parseInt(searchParams.get('days') || '7');
                const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

                // Get message stats
                const { data: messages, error: messagesError } = await supabase
                    .from('whatsapp_messages')
                    .select('*')
                    .gte('created_at', startDate);

                if (messagesError) throw messagesError;

                // Get template sends stats
                const { data: sends, error: sendsError } = await supabase
                    .from('whatsapp_template_sends')
                    .select('*')
                    .gte('created_at', startDate);

                if (sendsError) throw sendsError;

                // Get active conversations count
                const { count: activeConversations, error: convError } = await supabase
                    .from('whatsapp_conversations')
                    .select('*', { count: 'exact', head: true })
                    .gte('last_message_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

                if (convError) throw convError;

                // Get unprocessed order responses
                const { count: pendingResponses, error: respError } = await supabase
                    .from('whatsapp_order_responses')
                    .select('*', { count: 'exact', head: true })
                    .eq('processed', false);

                if (respError) throw respError;

                // Calculate stats
                const totalMessages = messages?.length || 0;
                const outboundMessages = messages?.filter(m => m.direction === 'outbound').length || 0;
                const inboundMessages = messages?.filter(m => m.direction === 'inbound').length || 0;
                const sentCount = sends?.filter(s => s.status === 'sent').length || 0;
                const deliveredCount = sends?.filter(s => s.status === 'delivered').length || 0;
                const readCount = sends?.filter(s => s.status === 'read').length || 0;
                const failedCount = sends?.filter(s => s.status === 'failed').length || 0;

                // Template usage breakdown
                const templateUsage: Record<string, { total: number; delivered: number; failed: number }> = {};
                sends?.forEach(send => {
                    if (!templateUsage[send.template_key]) {
                        templateUsage[send.template_key] = { total: 0, delivered: 0, failed: 0 };
                    }
                    templateUsage[send.template_key].total++;
                    if (send.status === 'delivered' || send.status === 'read') {
                        templateUsage[send.template_key].delivered++;
                    }
                    if (send.status === 'failed') {
                        templateUsage[send.template_key].failed++;
                    }
                });

                // Daily breakdown
                const dailyStats: Record<string, { date: string; messages: number; delivered: number; failed: number }> = {};
                for (let i = 0; i < days; i++) {
                    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                    const dateKey = date.toISOString().split('T')[0];
                    dailyStats[dateKey] = { date: dateKey, messages: 0, delivered: 0, failed: 0 };
                }

                sends?.forEach(send => {
                    const dateKey = send.created_at.split('T')[0];
                    if (dailyStats[dateKey]) {
                        dailyStats[dateKey].messages++;
                        if (send.status === 'delivered' || send.status === 'read') {
                            dailyStats[dateKey].delivered++;
                        }
                        if (send.status === 'failed') {
                            dailyStats[dateKey].failed++;
                        }
                    }
                });

                return NextResponse.json({
                    summary: {
                        totalMessages,
                        outboundMessages,
                        inboundMessages,
                        sentCount,
                        deliveredCount,
                        readCount,
                        failedCount,
                        activeConversations: activeConversations || 0,
                        pendingResponses: pendingResponses || 0,
                        deliveryRate: sentCount > 0 ? ((deliveredCount + readCount) / sentCount * 100).toFixed(2) : 0
                    },
                    templateUsage: Object.entries(templateUsage).map(([key, stats]) => ({
                        templateKey: key,
                        ...stats,
                        deliveryRate: stats.total > 0 ? ((stats.delivered / stats.total) * 100).toFixed(2) : 0
                    })),
                    dailyStats: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date))
                });
            }

            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }
    } catch (error) {
        console.error('WhatsApp API error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to fetch WhatsApp data'
        }, { status: 500 });
    }
}

// POST - Create new template
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type } = body;

        const supabase = getSupabaseAdmin();

        if (type === 'create_template') {
            const { template_key, template_name, authkey_template_id, category, variable_count } = body.data;

            if (!template_key || !authkey_template_id) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }

            const { data, error } = await supabase
                .from('whatsapp_template_config')
                .insert({
                    template_key,
                    template_name,
                    authkey_template_id,
                    category: category || 'general',
                    variable_count: variable_count || 0,
                    is_enabled: true
                })
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ data });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    } catch (error) {
        console.error('WhatsApp API POST error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to create template'
        }, { status: 500 });
    }
}

// PUT - Update template config
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { template_key, updates } = body;

        if (!template_key || !updates) {
            return NextResponse.json({ error: 'Missing template_key or updates' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from('whatsapp_template_config')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('template_key', template_key)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (error) {
        console.error('WhatsApp API PUT error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to update template'
        }, { status: 500 });
    }
}

// PATCH - Mark order response as processed or retry failed message
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, id } = body;

        const supabase = getSupabaseAdmin();

        if (action === 'process_response') {
            const { data, error } = await supabase
                .from('whatsapp_order_responses')
                .update({
                    processed: true,
                    processed_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ data });
        }

        if (action === 'retry_send') {
            // Get the failed send details
            const { data: sendData, error: getError } = await supabase
                .from('whatsapp_template_sends')
                .select('*')
                .eq('id', id)
                .single();

            if (getError) throw getError;

            // Mark as pending retry
            const { data, error } = await supabase
                .from('whatsapp_template_sends')
                .update({
                    status: 'pending',
                    error_message: null
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ data, message: 'Send marked for retry' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('WhatsApp API PATCH error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to perform action'
        }, { status: 500 });
    }
}
