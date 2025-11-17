import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const options = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 25,
      target_role: searchParams.get('target_role') || undefined,
      severity: searchParams.get('severity') || undefined,
      type: searchParams.get('type') || undefined,
    };

    const result = await adminQueries.getAdminMessages(options);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching admin messages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const messageData = await request.json();
    
    if (!messageData.title || !messageData.message || !messageData.severity || !messageData.type) {
      return NextResponse.json(
        { error: 'title, message, severity, and type are required' },
        { status: 400 }
      );
    }

    const message = await adminQueries.createAdminMessage(messageData);
    return NextResponse.json({ data: message, success: true });
  } catch (error: any) {
    console.error('Error creating admin message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create message' },
      { status: 500 }
    );
  }
}

