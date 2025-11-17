import { NextRequest, NextResponse } from 'next/server';
import { adminQueries } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const options = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 25,
      search: searchParams.get('search') || undefined,
    };
    const slotId = searchParams.get('slot_id') || undefined;

    const result = await adminQueries.getContentItems(slotId, options);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching content items:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch content items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const itemData = await request.json();
    
    if (!itemData.slot_id || !itemData.type) {
      return NextResponse.json(
        { error: 'slot_id and type are required' },
        { status: 400 }
      );
    }

    const item = await adminQueries.upsertContentItem(itemData);
    return NextResponse.json({ data: item, success: true });
  } catch (error: any) {
    console.error('Error creating/updating content item:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save content item' },
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
        { error: 'Content item ID is required' },
        { status: 400 }
      );
    }

    await adminQueries.deleteContentItem(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting content item:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete content item' },
      { status: 500 }
    );
  }
}

