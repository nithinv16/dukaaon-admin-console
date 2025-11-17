import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const flags = await adminQueries.getFeatureFlags();
    return NextResponse.json({ data: flags });
  } catch (error: any) {
    console.error('Error fetching feature flags:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch feature flags' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const flagData = await request.json();
    
    if (!flagData.name) {
      return NextResponse.json(
        { error: 'Feature flag name is required' },
        { status: 400 }
      );
    }

    const flag = await adminQueries.createFeatureFlag(flagData);
    return NextResponse.json({ data: flag, success: true });
  } catch (error: any) {
    console.error('Error creating feature flag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create feature flag' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, updates } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { error: 'Feature flag ID is required' },
        { status: 400 }
      );
    }

    const flag = await adminQueries.updateFeatureFlag(id, updates);
    return NextResponse.json({ data: flag, success: true });
  } catch (error: any) {
    console.error('Error updating feature flag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update feature flag' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Feature flag ID is required' },
        { status: 400 }
      );
    }

    await adminQueries.deleteFeatureFlag(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting feature flag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete feature flag' },
      { status: 500 }
    );
  }
}

