import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Hook to track page visits and time spent on each page
 * Integrates with employee tracking system
 */
export function usePageTracking() {
    const pathname = usePathname();
    const pageEntryTimeRef = useRef<number>(Date.now());
    const currentPageRef = useRef<string>(pathname);
    const sessionIdRef = useRef<string | null>(null);

    // Get page name from path
    const getPageName = useCallback((path: string): string => {
        const pageNames: Record<string, string> = {
            '/': 'Dashboard',
            '/users': 'Users Management',
            '/orders': 'Orders Management',
            '/products': 'Products Management',
            '/products/master': 'Master Products',
            '/products/extracted': 'Extracted Products',
            '/products/scan-receipt': 'Scan Receipt',
            '/products/add-from-master': 'Add From Master',
            '/products/clone-inventory': 'Clone Inventory',
            '/categories': 'Categories Management',
            '/dynamic-content': 'Dynamic Content',
            '/warnings': 'Warnings',
            '/payments': 'Payments',
            '/whatsapp': 'WhatsApp',
            '/notifications': 'Notifications',
            '/analytics': 'Analytics',
            '/database-tools': 'Database Tools',
            '/audit-log': 'Audit Log',
            '/employee-tracking': 'Employee Tracking',
            '/seller-inventory': 'Seller Inventory',
            '/bulk-operations': 'Bulk Operations',
            '/templates': 'Templates',
            '/send-message': 'Send Messages',
            '/roles-permissions': 'Roles & Permissions',
            '/admin-users': 'Admin Users',
            '/settings': 'Settings',
        };

        // Check for exact match first
        if (pageNames[path]) return pageNames[path];

        // Check for dynamic routes
        if (path.startsWith('/orders/')) return 'Order Details';
        if (path.startsWith('/users/')) return 'User Details';
        if (path.startsWith('/products/')) return 'Product Details';

        return path.split('/').pop()?.replace(/-/g, ' ') || 'Unknown Page';
    }, []);

    // Track page exit (send data to server)
    const trackPageExit = useCallback(async (pagePath: string, entryTime: number) => {
        const sessionId = sessionIdRef.current || localStorage.getItem('tracking_session_id');
        const adminSession = localStorage.getItem('admin_session');
        
        if (!sessionId || !adminSession) return;

        const adminData = JSON.parse(adminSession);
        const exitTime = Date.now();
        const durationSeconds = Math.round((exitTime - entryTime) / 1000);

        // Only track if spent at least 1 second on page
        if (durationSeconds < 1) return;

        try {
            const data = {
                session_id: sessionId,
                admin_id: adminData.id,
                page_path: pagePath,
                page_name: getPageName(pagePath),
                entry_time: new Date(entryTime).toISOString(),
                exit_time: new Date(exitTime).toISOString(),
                duration_seconds: durationSeconds,
            };

            // Use sendBeacon for reliable delivery on page change
            if (navigator.sendBeacon) {
                navigator.sendBeacon('/api/admin/page-tracking', JSON.stringify(data));
            } else {
                await fetch('/api/admin/page-tracking', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
            }
        } catch (error) {
            console.error('Failed to track page exit:', error);
        }
    }, [getPageName]);

    // Handle page change
    useEffect(() => {
        sessionIdRef.current = localStorage.getItem('tracking_session_id');

        // Track exit from previous page
        if (currentPageRef.current !== pathname) {
            trackPageExit(currentPageRef.current, pageEntryTimeRef.current);
        }

        // Update refs for new page
        currentPageRef.current = pathname;
        pageEntryTimeRef.current = Date.now();

        // Track exit on page unload
        const handleBeforeUnload = () => {
            trackPageExit(pathname, pageEntryTimeRef.current);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [pathname, trackPageExit]);

    // Track visibility change (tab switch)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab hidden - track partial page visit
                trackPageExit(pathname, pageEntryTimeRef.current);
            } else {
                // Tab visible again - reset entry time
                pageEntryTimeRef.current = Date.now();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [pathname, trackPageExit]);

    return {
        currentPage: pathname,
        pageName: getPageName(pathname),
    };
}

