import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSession,
  endAdminSession,
  updateSessionActivity,
  getClientIP,
  getLocationFromIP,
  cleanupStaleSessions,
} from '@/lib/employeeTracking';

/**
 * POST /api/admin/sessions
 * Create a new session (called on login or website open)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { admin_id } = body;

    if (!admin_id) {
      return NextResponse.json(
        { error: 'admin_id is required' },
        { status: 400 }
      );
    }

    // Cleanup any stale sessions for this admin (sessions without heartbeat for > 2 minutes)
    // This handles cases where browser crashed or closed without proper session end
    await cleanupStaleSessions(admin_id);

    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Get location from IP (you may want to use a service for this)
    const location = ipAddress ? await getLocationFromIP(ipAddress) : {};

    const { sessionId, sessionToken } = await createAdminSession({
      admin_id,
      ip_address: ipAddress,
      user_agent: userAgent,
      location_city: location.city,
      location_country: location.country,
      location_region: location.region,
    });

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      session_token: sessionToken,
    });
  } catch (error: any) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create session' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/sessions
 * Update session activity (heartbeat) or end session
 * Handles: heartbeat, logout, browser close, tab close
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, action, browser_closed } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    // Handle session end (logout, browser close, tab close)
    if (action === 'end' || action === 'logout' || browser_closed) {
      console.log(`📤 Ending session ${session_id} (action: ${action}, browser_closed: ${browser_closed})`);
      await endAdminSession(session_id);
      return NextResponse.json({
        success: true,
        message: 'Session ended',
      });
    } else {
      // Heartbeat - update last activity and track activity periods
      const { is_active, last_activity } = body;
      await updateSessionActivity(session_id, is_active, last_activity);
      return NextResponse.json({
        success: true,
        message: 'Session activity updated',
      });
    }
  } catch (error: any) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update session' },
      { status: 500 }
    );
  }
}

