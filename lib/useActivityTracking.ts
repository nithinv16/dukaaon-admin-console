import { useEffect, useRef, useCallback } from 'react';

const IDLE_THRESHOLD_MS = 60 * 1000; // 1 minute of inactivity = idle
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // Send heartbeat every 30 seconds
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

/**
 * Hook to track employee activity and detect idle time
 * Sends heartbeat to server with activity status
 * Automatically handles browser close/refresh
 */
export function useActivityTracking() {
    const lastActivityRef = useRef<number>(Date.now());
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const isActiveRef = useRef<boolean>(true);

    // Update last activity timestamp
    const updateActivity = useCallback(() => {
        lastActivityRef.current = Date.now();
        if (!isActiveRef.current) {
            isActiveRef.current = true;
            console.log('🟢 Employee became active');
        }
    }, []);

    // Check if user is currently idle
    const checkIdleStatus = useCallback(() => {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        const wasActive = isActiveRef.current;
        isActiveRef.current = timeSinceLastActivity < IDLE_THRESHOLD_MS;

        if (wasActive && !isActiveRef.current) {
            console.log('🟡 Employee went idle');
        }

        return isActiveRef.current;
    }, []);

    // Send heartbeat to server
    const sendHeartbeat = useCallback(async () => {
        const sessionId = sessionIdRef.current || localStorage.getItem('tracking_session_id');
        if (!sessionId) return;

        const isActive = checkIdleStatus();

        try {
            await fetch('/api/admin/sessions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    action: 'heartbeat',
                    is_active: isActive,
                    last_activity: new Date(lastActivityRef.current).toISOString(),
                }),
            });

            // console.log(`💓 Heartbeat sent (${isActive ? 'active' : 'idle'})`);
        } catch (error) {
            console.error('Failed to send heartbeat:', error);
        }
    }, [checkIdleStatus]);

    // Handle page visibility change (tab switching, minimize)
    const handleVisibilityChange = useCallback(() => {
        if (document.hidden) {
            // Tab hidden - mark as potentially idle
            isActiveRef.current = false;
            sendHeartbeat();
        } else {
            // Tab visible again - mark as active
            updateActivity();
            sendHeartbeat();
        }
    }, [updateActivity, sendHeartbeat]);

    // Handle before unload (browser close, refresh)
    const handleBeforeUnload = useCallback(() => {
        const sessionId = sessionIdRef.current || localStorage.getItem('tracking_session_id');
        if (!sessionId) return;

        // Use sendBeacon for guaranteed delivery
        const data = JSON.stringify({
            session_id: sessionId,
            action: 'heartbeat',
            is_active: false,
            last_activity: new Date(lastActivityRef.current).toISOString(),
            browser_closed: true,
        });

        navigator.sendBeacon('/api/admin/sessions', data);
    }, []);

    useEffect(() => {
        // Get session ID
        sessionIdRef.current = localStorage.getItem('tracking_session_id');
        if (!sessionIdRef.current) {
            console.warn('No tracking session ID found');
            return;
        }

        console.log('🎯 Activity tracking started');

        // Attach activity listeners
        ACTIVITY_EVENTS.forEach(event => {
            window.addEventListener(event, updateActivity, { passive: true });
        });

        // Attach visibility change listener
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Attach before unload listener
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Start heartbeat interval
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

        // Send initial heartbeat
        sendHeartbeat();

        // Cleanup
        return () => {
            console.log('🛑 Activity tracking stopped');

            // Remove event listeners
            ACTIVITY_EVENTS.forEach(event => {
                window.removeEventListener(event, updateActivity);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);

            // Clear interval
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }

            // Send final heartbeat
            sendHeartbeat();
        };
    }, [updateActivity, sendHeartbeat, handleVisibilityChange, handleBeforeUnload]);

    return {
        isActive: isActiveRef.current,
        lastActivity: lastActivityRef.current,
    };
}
