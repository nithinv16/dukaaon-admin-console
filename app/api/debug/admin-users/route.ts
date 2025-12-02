import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';
        });
    } catch (error: any) {
    return NextResponse.json({
        success: false,
        error: error.message,
    });
}
}
