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

// Authkey.io API for sending WhatsApp messages
async function sendViaAuthkey(phoneNumber: string, message: string, templateId?: string, variables?: Record<string, string>) {
    const authkeyApiKey = process.env.AUTHKEY_API_KEY;
    const authkeySenderId = process.env.AUTHKEY_SENDER_ID;

    if (!authkeyApiKey) {
        throw new Error('AUTHKEY_API_KEY not configured');
    }

    // Format phone number: Remove all non-digits
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    let mobile = cleanPhone;
    let country_code = '91'; // default

    // Basic parsing logic
    if (cleanPhone.length > 10) {
        if (cleanPhone.startsWith('91')) {
            country_code = '91';
            mobile = cleanPhone.substring(2);
        } else {
            // Fallback for other countries (first 2 digits)
            country_code = cleanPhone.substring(0, 2);
            mobile = cleanPhone.substring(2);
        }
    }

    // Log for debugging
    console.log(`Sending WhatsApp to: +${country_code} ${mobile} (${templateId ? 'Template' : 'Text'})`);

    try {
        const params = new URLSearchParams({
            authkey: authkeyApiKey,
            mobile: mobile,
            country_code: country_code,
        });

        if (authkeySenderId) {
            params.append('sid', authkeySenderId);
        }

        if (templateId) {
            params.append('wid', templateId); // Using WID as requested

            // Map variables to arg1, arg2, etc.
            if (variables) {
                const values = Object.values(variables);
                values.forEach((val, index) => {
                    params.append(`arg${index + 1}`, val);
                });
            }
        } else {
            params.append('message', message);
            // params.append('type', 'text'); // Usually inferred
        }

        const url = `https://api.authkey.io/request?${params.toString()}`;
        // Log URL safely (hide authkey)
        console.log('Authkey Request URL:', url.replace(authkeyApiKey, '***'));

        const response = await fetch(url);
        const result = await response.json();
        console.log('Authkey Response:', JSON.stringify(result));

        if (!response.ok || result.status === 'error' || result.Message === 'Connection Error') {
            // Handle specific "Connection Error" as failure
            throw new Error(result.Message || result.message || 'Failed to send message');
        }

        return {
            success: true,
            messageId: result.message_id || result.id || result.MessageId, // Varies
            response: result,
        };
    } catch (error) {
        console.error('Authkey API error:', error);
        throw error;
    }
}

// POST - Send a WhatsApp message
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone_number, message, message_type, template_key, variables } = body;

        if (!phone_number) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        if (message_type === 'text' && !message) {
            return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
        }

        if (message_type === 'template' && !template_key) {
            return NextResponse.json({ error: 'Template key is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        let templateId: string | undefined;
        let messageContent = message;

        // If sending template, get the template ID from config
        if (message_type === 'template' && template_key) {
            const { data: templateConfig, error: templateError } = await supabase
                .from('whatsapp_template_config')
                .select('authkey_template_id, template_name, variable_count')
                .eq('template_key', template_key)
                .eq('is_enabled', true)
                .single();

            if (templateError || !templateConfig) {
                return NextResponse.json({ error: 'Template not found or not enabled' }, { status: 400 });
            }

            if (!templateConfig.authkey_template_id) {
                return NextResponse.json({ error: 'Template not configured in Authkey' }, { status: 400 });
            }

            templateId = templateConfig.authkey_template_id;
            messageContent = `[Template: ${templateConfig.template_name}]`;
        }

        // Try to send via Authkey
        let sendResult;
        let status = 'pending';
        let errorMessage: string | null = null;
        let authkeyMessageId: string | null = null;

        try {
            sendResult = await sendViaAuthkey(phone_number, messageContent, templateId, variables);
            status = 'sent';
            authkeyMessageId = sendResult.messageId;
        } catch (error) {
            status = 'failed';
            errorMessage = error instanceof Error ? error.message : 'Failed to send message';
            console.error('Send error:', error);
        }

        // Store message in database
        const { data: messageData, error: insertError } = await supabase
            .from('whatsapp_messages')
            .insert({
                phone_number,
                direction: 'outbound',
                message_type: message_type || 'text',
                content: messageContent,
                template_key: template_key || null,
                template_variables: variables || null,
                status,
                error_message: errorMessage,
                authkey_message_id: authkeyMessageId,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error storing message:', insertError);
        }

        // If template, also store in template_sends
        if (message_type === 'template' && template_key) {
            await supabase
                .from('whatsapp_template_sends')
                .insert({
                    template_key,
                    phone_number,
                    variables_used: variables || null,
                    status,
                    authkey_response: sendResult?.response || null,
                    error_message: errorMessage,
                    created_at: new Date().toISOString(),
                });
        }

        // Update or create conversation
        const { data: existingConv } = await supabase
            .from('whatsapp_conversations')
            .select('id, total_messages')
            .eq('phone_number', phone_number)
            .single();

        if (existingConv) {
            await supabase
                .from('whatsapp_conversations')
                .update({
                    last_message_at: new Date().toISOString(),
                    last_message_content: messageContent.substring(0, 200),
                    last_message_direction: 'outbound',
                    total_messages: (existingConv.total_messages || 0) + 1,
                })
                .eq('id', existingConv.id);
        } else {
            await supabase
                .from('whatsapp_conversations')
                .insert({
                    phone_number,
                    last_message_at: new Date().toISOString(),
                    last_message_content: messageContent.substring(0, 200),
                    last_message_direction: 'outbound',
                    total_messages: 1,
                });
        }

        if (status === 'failed') {
            return NextResponse.json({
                error: errorMessage,
                message: messageData,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: messageData,
            authkey_response: sendResult?.response,
        });

    } catch (error) {
        console.error('WhatsApp send error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to send message'
        }, { status: 500 });
    }
}
