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
 * Create a new admin session (on login)
 */
export async function createAdminSession(
  sessionInfo: SessionInfo
): Promise<{ sessionId: string; sessionToken: string }> {
  const supabase = getAdminSupabaseClient();
  const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;

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
      login_time: new Date().toISOString(),
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating admin session:', error);
    throw new Error('Failed to create session');
  }

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
        // Start new active period
        await supabase
          .from('admin_activity_periods')
          .insert({
            session_id: sessionId,
            admin_id: session.admin_id,
            period_start: lastActivity || new Date().toISOString(),
            is_active: true,
          });
      }
    } else {
      // Idle - close any open active period
      if (openPeriod && openPeriod.is_active) {
        const periodEnd = new Date();
        const periodStart = new Date(openPeriod.period_start);
        const durationMinutes = Math.round((periodEnd.getTime() - periodStart.getTime()) / 60000);

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

  const { error } = await supabase
    .from('admin_sessions')
    .update({
      logout_time: logoutTime.toISOString(),
      is_active: false,
      last_activity: logoutTime.toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error('Error ending admin session:', error);
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


