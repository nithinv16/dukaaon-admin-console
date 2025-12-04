/**
 * Employee Activity Tracking Utilities
 * Tracks all employee actions with detailed metrics
 */

import { getAdminSupabaseClient } from './supabase-admin';

export interface ActivityMetric {
  admin_id: string;
  session_id?: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  items_processed?: number;
  operation_status?: 'success' | 'failed' | 'partial';
  error_message?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
}

export interface SessionInfo {
  admin_id: string;
  ip_address?: string;
  user_agent?: string;
  location_city?: string;
  location_country?: string;
  location_region?: string;
}

/**
 * Start tracking an operation - returns operation ID and start time
 */
export async function startActivityTracking(
  activity: ActivityMetric
): Promise<{ operationId: string; startTime: Date }> {
  const supabase = getAdminSupabaseClient();
  const startTime = new Date();

  const { data, error } = await supabase
    .from('admin_activity_metrics')
    .insert({
      admin_id: activity.admin_id,
      session_id: activity.session_id,
      action_type: activity.action_type,
      entity_type: activity.entity_type,
      entity_id: activity.entity_id,
      operation_start_time: startTime.toISOString(),
      operation_end_time: null,
      items_processed: activity.items_processed || 1,
      operation_status: 'success',
      metadata: activity.metadata || {},
      ip_address: activity.ip_address,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error starting activity tracking:', error);
    // Return a fallback ID
    return { operationId: `temp-${Date.now()}`, startTime };
  }

  return { operationId: data.id, startTime };
}

/**
 * End tracking an operation - updates duration and status
 */
export async function endActivityTracking(
  operationId: string,
  status: 'success' | 'failed' | 'partial' = 'success',
  errorMessage?: string,
  itemsProcessed?: number
): Promise<void> {
  const supabase = getAdminSupabaseClient();
  const endTime = new Date();

  // Get the start time from the record
  const { data: activity, error: fetchError } = await supabase
    .from('admin_activity_metrics')
    .select('operation_start_time, items_processed')
    .eq('id', operationId)
    .single();

  if (fetchError || !activity) {
    console.error('Error fetching activity for tracking:', fetchError);
    return;
  }

  const startTime = new Date(activity.operation_start_time);
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationSeconds = durationMs / 1000;

  const updateData: any = {
    operation_end_time: endTime.toISOString(),
    duration_ms: durationMs,
    duration_seconds: durationSeconds,
    operation_status: status,
  };

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  if (itemsProcessed !== undefined) {
    updateData.items_processed = itemsProcessed;
  } else if (activity.items_processed) {
    updateData.items_processed = activity.items_processed;
  }

  const { error } = await supabase
    .from('admin_activity_metrics')
    .update(updateData)
    .eq('id', operationId);

  if (error) {
    console.error('Error ending activity tracking:', error);
  }
}

/**
 * Create a new admin session (on login or website open)
 * This is the primary entry point for tracking a user's session
 */
export async function createAdminSession(
  sessionInfo: SessionInfo
): Promise<{ sessionId: string; sessionToken: string }> {
  const supabase = getAdminSupabaseClient();
  const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const loginTime = new Date().toISOString();

  const { data, error } = await supabase
    .from('admin_sessions')
    .insert({
      admin_id: sessionInfo.admin_id,
      session_token: sessionToken,
      ip_address: sessionInfo.ip_address,
      user_agent: sessionInfo.user_agent,
      location_city: sessionInfo.location_city,
      location_country: sessionInfo.location_country,
      location_region: sessionInfo.location_region,
      login_time: loginTime,
      last_activity: loginTime,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating admin session:', error);
    throw new Error('Failed to create session');
  }

  // Start an initial activity period when session is created
  // This ensures active time tracking begins from session start
  await supabase
    .from('admin_activity_periods')
    .insert({
      session_id: data.id,
      admin_id: sessionInfo.admin_id,
      period_start: loginTime,
      is_active: true,
    });

  console.log(`📝 Session created: ${data.id} for admin ${sessionInfo.admin_id}`);

  return { sessionId: data.id, sessionToken };
}

/**
 * Update session activity (heartbeat)
 * Tracks activity periods to calculate actual working time vs idle time
 */
export async function updateSessionActivity(
  sessionId: string,
  isActive?: boolean,
  lastActivity?: string
): Promise<void> {
  const supabase = getAdminSupabaseClient();

  // Update session last activity
  const { error: sessionError } = await supabase
    .from('admin_sessions')
    .update({
      last_activity: lastActivity || new Date().toISOString()
    })
    .eq('id', sessionId)
    .eq('is_active', true);

  if (sessionError) {
    console.error('Error updating session activity:', sessionError);
  }

  // Track activity period if status is provided
  if (isActive !== undefined) {
    // Get session info to get admin_id
    const { data: session } = await supabase
      .from('admin_sessions')
      .select('admin_id')
      .eq('id', sessionId)
      .single();

    if (!session) return;

    const currentTime = lastActivity ? new Date(lastActivity) : new Date();
    const currentTimeISO = currentTime.toISOString();

    // Check if there's an open activity period
    const { data: openPeriod } = await supabase
      .from('admin_activity_periods')
      .select('*')
      .eq('session_id', sessionId)
      .is('period_end', null)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (isActive) {
      // Active - ensure an active period is open
      if (!openPeriod) {
        // Start new active period using lastActivity timestamp
        await supabase
          .from('admin_activity_periods')
          .insert({
            session_id: sessionId,
            admin_id: session.admin_id,
            period_start: currentTimeISO,
            is_active: true,
          });
      }
      // If period exists and user is active, keep it open (no action needed)
    } else {
      // Idle - close any open active period
      // When isActive is false, lastActivity is the timestamp of the last activity event
      // The user became idle 1 minute after lastActivity (IDLE_THRESHOLD_MS = 60 seconds)
      if (openPeriod && openPeriod.is_active) {
        const periodStart = new Date(openPeriod.period_start);
        // Calculate when user became idle: lastActivity + 1 minute
        // This ensures we only count time when user was actually active
        const lastActivityTime = lastActivity ? new Date(lastActivity) : new Date();
        const IDLE_THRESHOLD_MS = 60 * 1000; // 1 minute
        const periodEnd = new Date(lastActivityTime.getTime() + IDLE_THRESHOLD_MS);
        const durationMs = periodEnd.getTime() - periodStart.getTime();
        const durationMinutes = Math.max(0, Math.round(durationMs / 60000));

        await supabase
          .from('admin_activity_periods')
          .update({
            period_end: periodEnd.toISOString(),
            duration_minutes: durationMinutes,
          })
          .eq('id', openPeriod.id);
      }
    }
  }
}

/**
 * End admin session (on logout)
 */
export async function endAdminSession(
  sessionId: string
): Promise<void> {
  const supabase = getAdminSupabaseClient();
  const logoutTime = new Date();

  // Get session login time to calculate total duration
  const { data: session } = await supabase
    .from('admin_sessions')
    .select('login_time, last_activity')
    .eq('id', sessionId)
    .single();

  if (!session) {
    console.error('Session not found:', sessionId);
    return;
  }

  const loginTime = new Date(session.login_time);
  const sessionDurationMinutes = Math.max(0, Math.round((logoutTime.getTime() - loginTime.getTime()) / 60000));

  // Close any open activity periods before ending the session
  const { data: openPeriod } = await supabase
    .from('admin_activity_periods')
    .select('*')
    .eq('session_id', sessionId)
    .is('period_end', null)
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  if (openPeriod && openPeriod.is_active) {
    const periodStart = new Date(openPeriod.period_start);
    const durationMs = logoutTime.getTime() - periodStart.getTime();
    const durationMinutes = Math.max(0, Math.round(durationMs / 60000));

    await supabase
      .from('admin_activity_periods')
      .update({
        period_end: logoutTime.toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq('id', openPeriod.id);
  }

  const { error } = await supabase
    .from('admin_sessions')
    .update({
      logout_time: logoutTime.toISOString(),
      is_active: false,
      last_activity: logoutTime.toISOString(),
      duration_minutes: sessionDurationMinutes,
    })
    .eq('id', sessionId);

  if (error) {
    console.error('Error ending admin session:', error);
  }
}

/**
 * Cleanup stale sessions that weren't properly closed
 * This handles cases where browser crashed, internet disconnected, or beacon failed
 * A session is considered stale if:
 * - It's marked as active
 * - It hasn't had a heartbeat in more than 2 minutes (STALE_SESSION_THRESHOLD)
 */
export async function cleanupStaleSessions(
  adminId: string
): Promise<void> {
  const supabase = getAdminSupabaseClient();
  const STALE_SESSION_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes without heartbeat
  const staleThreshold = new Date(Date.now() - STALE_SESSION_THRESHOLD_MS);

  try {
    // Find stale sessions for this admin
    const { data: staleSessions, error: fetchError } = await supabase
      .from('admin_sessions')
      .select('id, last_activity, login_time')
      .eq('admin_id', adminId)
      .eq('is_active', true)
      .lt('last_activity', staleThreshold.toISOString());

    if (fetchError) {
      console.error('Error fetching stale sessions:', fetchError);
      return;
    }

    if (!staleSessions || staleSessions.length === 0) {
      return;
    }

    console.log(`🧹 Found ${staleSessions.length} stale session(s) to cleanup`);

    // End each stale session
    for (const session of staleSessions) {
      const lastActivityTime = session.last_activity 
        ? new Date(session.last_activity) 
        : new Date(session.login_time);

      // Close any open activity periods for this session
      const { data: openPeriod } = await supabase
        .from('admin_activity_periods')
        .select('*')
        .eq('session_id', session.id)
        .is('period_end', null)
        .order('period_start', { ascending: false })
        .limit(1)
        .single();

      if (openPeriod && openPeriod.is_active) {
        const periodStart = new Date(openPeriod.period_start);
        // Use last_activity + 1 minute as the end time (when user became idle)
        const IDLE_THRESHOLD_MS = 60 * 1000;
        const periodEnd = new Date(lastActivityTime.getTime() + IDLE_THRESHOLD_MS);
        const durationMs = Math.max(0, periodEnd.getTime() - periodStart.getTime());
        const durationMinutes = Math.round(durationMs / 60000);

        await supabase
          .from('admin_activity_periods')
          .update({
            period_end: periodEnd.toISOString(),
            duration_minutes: durationMinutes,
          })
          .eq('id', openPeriod.id);
      }

      // Calculate session duration (from login to last_activity + 1 min)
      const loginTime = new Date(session.login_time);
      const IDLE_THRESHOLD_MS = 60 * 1000;
      const logoutTime = new Date(lastActivityTime.getTime() + IDLE_THRESHOLD_MS);
      const durationMinutes = Math.max(0, Math.round((logoutTime.getTime() - loginTime.getTime()) / 60000));

      // End the session
      await supabase
        .from('admin_sessions')
        .update({
          logout_time: logoutTime.toISOString(),
          is_active: false,
          duration_minutes: durationMinutes,
        })
        .eq('id', session.id);

      console.log(`🧹 Cleaned up stale session ${session.id}`);
    }
  } catch (error) {
    console.error('Error cleaning up stale sessions:', error);
  }
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string | undefined {
  // Try various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');

  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  return realIP || cfConnectingIP || undefined;
}

/**
 * Get location from IP (basic implementation - you may want to use a service)
 */
export async function getLocationFromIP(
  ip: string
): Promise<{ city?: string; country?: string; region?: string }> {
  // This is a placeholder - in production, use a service like:
  // - MaxMind GeoIP2
  // - ipapi.co
  // - ip-api.com
  // For now, return empty location
  return {};
}

/**
 * Helper to track product creation with timing
 */
export async function trackProductCreation(
  adminId: string,
  sessionId: string | undefined,
  productIds: string[],
  metadata?: Record<string, any>,
  ipAddress?: string
): Promise<{ operationId: string; startTime: Date }> {
  return startActivityTracking({
    admin_id: adminId,
    session_id: sessionId,
    action_type: 'create_product',
    entity_type: 'product',
    items_processed: productIds.length,
    metadata: {
      product_ids: productIds,
      ...metadata,
    },
    ip_address: ipAddress,
  });
}

/**
 * Helper to track product update with timing
 */
export async function trackProductUpdate(
  adminId: string,
  sessionId: string | undefined,
  productId: string,
  metadata?: Record<string, any>,
  ipAddress?: string
): Promise<{ operationId: string; startTime: Date }> {
  return startActivityTracking({
    admin_id: adminId,
    session_id: sessionId,
    action_type: 'update_product',
    entity_type: 'product',
    entity_id: productId,
    metadata,
    ip_address: ipAddress,
  });
}

/**
 * Helper to track bulk upload with timing
 */
export async function trackBulkUpload(
  adminId: string,
  sessionId: string | undefined,
  uploadType: 'products' | 'seller_inventory',
  itemCount: number,
  metadata?: Record<string, any>,
  ipAddress?: string
): Promise<{ operationId: string; startTime: Date }> {
  return startActivityTracking({
    admin_id: adminId,
    session_id: sessionId,
    action_type: 'bulk_upload',
    entity_type: uploadType,
    items_processed: itemCount,
    metadata,
    ip_address: ipAddress,
  });
}

/**
 * Helper to track receipt scan with timing
 */
export async function trackReceiptScan(
  adminId: string,
  sessionId: string | undefined,
  productsExtracted: number,
  metadata?: Record<string, any>,
  ipAddress?: string
): Promise<{ operationId: string; startTime: Date }> {
  return startActivityTracking({
    admin_id: adminId,
    session_id: sessionId,
    action_type: 'scan_receipt',
    entity_type: 'product',
    items_processed: productsExtracted,
    metadata,
    ip_address: ipAddress,
  });
}

/**
 * Helper to track master product creation with timing
 */
export async function trackMasterProductCreation(
  adminId: string,
  sessionId: string | undefined,
  masterProductIds: string[],
  metadata?: Record<string, any>,
  ipAddress?: string
): Promise<{ operationId: string; startTime: Date }> {
  return startActivityTracking({
    admin_id: adminId,
    session_id: sessionId,
    action_type: 'create_product',
    entity_type: 'master_product',
    items_processed: masterProductIds.length,
    metadata: {
      master_product_ids: masterProductIds,
      ...metadata,
    },
    ip_address: ipAddress,
  });
}

/**
 * Helper to track master product update with timing
 */
export async function trackMasterProductUpdate(
  adminId: string,
  sessionId: string | undefined,
  masterProductId: string,
  metadata?: Record<string, any>,
  ipAddress?: string
): Promise<{ operationId: string; startTime: Date }> {
  return startActivityTracking({
    admin_id: adminId,
    session_id: sessionId,
    action_type: 'update_product',
    entity_type: 'master_product',
    entity_id: masterProductId,
    metadata,
    ip_address: ipAddress,
  });
}


