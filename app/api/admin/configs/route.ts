import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || undefined;

    const configs = await adminQueries.getConfigs(scope);
    return NextResponse.json({ data: configs });
  } catch (error: any) {
    console.error('Error fetching configs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch configs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { key, value, description, scope, scopeValue } = await request.json();
    
    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Key and value are required' },
        { status: 400 }
      );
    }

    const config = await adminQueries.saveConfig(key, value, description, scope, scopeValue);
    return NextResponse.json({ data: config, success: true });
  } catch (error: any) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save config' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    if (!key) {
      return NextResponse.json(
        { error: 'Config key is required' },
        { status: 400 }
      );
    }

    await adminQueries.deleteConfig(key);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete config' },
      { status: 500 }
    );
  }
}

