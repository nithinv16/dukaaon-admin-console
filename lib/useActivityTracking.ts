import { useEffect, useRef, useCallback } from 'react';

const IDLE_THRESHOLD_MS = 60 * 1000; // 1 minute of inactivity = idle
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // Send heartbeat every 30 seconds
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

/**
 * Hook to track employee activity and detect idle time
 * Tracks: website opening, mouse/keyboard activity, tab visibility, browser/tab close
 * Sends heartbeat to server with activity status
 * Automatically ends session on browser/tab close
 */
export function useActivityTracking() {
    const lastActivityRef = useRef<number>(Date.now());
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const isActiveRef = useRef<boolean>(true);
    const isUnloadingRef = useRef<boolean>(false);

    // Update last activity timestamp
    const updateActivity = useCallback(() => {
        lastActivityRef.current = Date.now();
        if (!isActiveRef.current) {
            isActiveRef.current = true;
            console.log('🟢 Employee became active');
        }
    }, []);

    // Check if user is currently idle (no mouse/keyboard activity for > 1 minute)
    const checkIdleStatus = useCallback(() => {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        const wasActive = isActiveRef.current;
        isActiveRef.current = timeSinceLastActivity < IDLE_THRESHOLD_MS;

        if (wasActive && !isActiveRef.current) {
            console.log('🟡 Employee went idle (no mouse/keyboard for 1+ min)');
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
            // Tab hidden - mark as idle and close activity period
            isActiveRef.current = false;
            sendHeartbeat();
        } else {
            // Tab visible again - mark as active and start new activity period
            updateActivity();
            sendHeartbeat();
        }
    }, [updateActivity, sendHeartbeat]);

    // Handle before unload (browser close, tab close, refresh, navigation away)
    // This is the primary handler for ending sessions when user closes browser/tab
    const handleBeforeUnload = useCallback(() => {
        if (isUnloadingRef.current) return; // Prevent duplicate calls
        isUnloadingRef.current = true;

        const sessionId = sessionIdRef.current || localStorage.getItem('tracking_session_id');
        if (!sessionId) return;

        console.log('🚪 Browser/tab closing - ending session');

        // Use sendBeacon for guaranteed delivery even when browser is closing
        // Send "end" action to properly close the session
        const data = JSON.stringify({
            session_id: sessionId,
            action: 'end', // End the session, not just heartbeat
            is_active: false,
            last_activity: new Date(lastActivityRef.current).toISOString(),
            browser_closed: true,
        });

        navigator.sendBeacon('/api/admin/sessions', data);
    }, []);

    // Handle pagehide (more reliable than beforeunload on mobile)
    const handlePageHide = useCallback((event: PageTransitionEvent) => {
        if (isUnloadingRef.current) return;

        // persisted = true means page might be restored from bfcache
        // persisted = false means page is being destroyed (closed)
        if (!event.persisted) {
            isUnloadingRef.current = true;

            const sessionId = sessionIdRef.current || localStorage.getItem('tracking_session_id');
            if (!sessionId) return;

            console.log('🚪 Page hidden (destroying) - ending session');

            const data = JSON.stringify({
                session_id: sessionId,
                action: 'end',
                is_active: false,
                last_activity: new Date(lastActivityRef.current).toISOString(),
                browser_closed: true,
            });

            navigator.sendBeacon('/api/admin/sessions', data);
        } else {
            // Page might be restored, just mark as idle
            const sessionId = sessionIdRef.current || localStorage.getItem('tracking_session_id');
            if (!sessionId) return;

            const data = JSON.stringify({
                session_id: sessionId,
                action: 'heartbeat',
                is_active: false,
                last_activity: new Date(lastActivityRef.current).toISOString(),
            });

            navigator.sendBeacon('/api/admin/sessions', data);
        }
    }, []);

    // Create tracking session if user is logged in but has no session
    const createSessionIfNeeded = useCallback(async () => {
        // Check if we already have a tracking session
        const existingSessionId = localStorage.getItem('tracking_session_id');
        if (existingSessionId) {
            sessionIdRef.current = existingSessionId;
            return existingSessionId;
        }

        // Check if user is logged in
        const adminSession = localStorage.getItem('admin_session');
        if (!adminSession) {
            console.log('🔒 No admin session found, skipping tracking');
            return null;
        }

        try {
            const admin = JSON.parse(adminSession);
            if (!admin?.id) {
                console.warn('⚠️ Invalid admin session data');
                return null;
            }

            console.log('📝 Creating tracking session for', admin.name || admin.email);

            const response = await fetch('/api/admin/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: admin.id }),
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('tracking_session_id', data.session_id);
                sessionIdRef.current = data.session_id;
                console.log('✅ Tracking session created:', data.session_id);
                return data.session_id;
            } else {
                console.error('❌ Failed to create tracking session:', await response.text());
                return null;
            }
        } catch (error) {
            console.error('❌ Error creating tracking session:', error);
            return null;
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const initTracking = async () => {
            // Try to get existing session ID or create a new one
            const sessionId = await createSessionIfNeeded();

            if (!mounted) return;

            if (!sessionId) {
                console.warn('⚠️ Could not establish tracking session');
                return;
            }

            console.log('🎯 Activity tracking started - monitoring mouse/keyboard');

            // Attach activity listeners for mouse and keyboard
            ACTIVITY_EVENTS.forEach(event => {
                window.addEventListener(event, updateActivity, { passive: true });
            });

            // Attach visibility change listener (tab switch, minimize)
            document.addEventListener('visibilitychange', handleVisibilityChange);

            // Attach unload listeners for browser/tab close
            window.addEventListener('beforeunload', handleBeforeUnload);
            window.addEventListener('pagehide', handlePageHide);

            // Start heartbeat interval
            heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

            // Send initial heartbeat to mark session start on website open
            sendHeartbeat();
        };

        initTracking();

        // Cleanup
        return () => {
            mounted = false;
            console.log('🛑 Activity tracking stopped');

            // Remove event listeners
            ACTIVITY_EVENTS.forEach(event => {
                window.removeEventListener(event, updateActivity);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide);

            // Clear interval
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }

            // Send final heartbeat (not session end - component unmount doesn't mean browser close)
            if (!isUnloadingRef.current) {
                sendHeartbeat();
            }
        };
    }, [createSessionIfNeeded, updateActivity, sendHeartbeat, handleVisibilityChange, handleBeforeUnload, handlePageHide]);

    return {
        isActive: isActiveRef.current,
        lastActivity: lastActivityRef.current,
    };
}
