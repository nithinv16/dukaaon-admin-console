import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { template_id, template_type, variables, recipients, recipient_type } = await request.json();

    if (!template_id || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Template ID and recipients are required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Replace variables in content
    let content = template.content;
    let subject = template.subject || '';
    Object.entries(variables || {}).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(regex, value as string);
      if (subject) {
        subject = subject.replace(regex, value as string);
      }
    });

    // Send messages based on type
    let sent = 0;
    const errors: string[] = [];

    // In a real implementation, you would integrate with:
    // - Email service (SendGrid, AWS SES, etc.)
    // - SMS service (Twilio, AWS SNS, etc.)
    // - WhatsApp Business API
    // - Push notification service (FCM, etc.)

    // For now, we'll create message records in the database
    for (const recipient of recipients) {
      try {
        // Create message record
        const { error: messageError } = await supabase.from('admin_messages').insert({
          type: template_type,
          subject: subject || null,
          content: content,
          target_user_id: recipient_type === 'users' ? recipient : null,
          target_phone: recipient_type === 'custom' ? recipient : null,
          target_role: recipient_type === 'roles' ? recipient : null,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

        if (messageError) {
          errors.push(`Failed to send to ${recipient}: ${messageError.message}`);
        } else {
          sent++;
        }

        // TODO: Actually send the message via the appropriate service
        // This would be done by a background job or queue system
      } catch (error: any) {
        errors.push(`Failed to send to ${recipient}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      total: recipients.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully queued ${sent} messages for sending`,
    });
  } catch (error: any) {
    console.error('Error sending messages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send messages' },
      { status: 500 }
    );
  }
}

