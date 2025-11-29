import { useState, useEffect, useRef } from 'react';

/**
 * Hook to track time spent editing a product card
 * Automatically sends tracking data when stopTracking is called or component unmounts
 */
export function useProductCardTracking(
    productId: string,
    productName?: string
) {
    const startTimeRef = useRef<number | null>(null);
    const [isTracking, setIsTracking] = useState(false);

    const startTracking = () => {
        if (!startTimeRef.current) {
            startTimeRef.current = Date.now();
            setIsTracking(true);
            console.log(`⏱️ Started tracking product card: ${productName || productId}`);
        }
    };

    const stopTracking = async () => {
        if (!startTimeRef.current || !isTracking) return;

        const duration = Date.now() - startTimeRef.current;
        const durationSeconds = duration / 1000;

        console.log(`⏱️ Stopped tracking ${productName || productId}: ${durationSeconds}s`);

        // Get admin and session info
        const adminSession = localStorage.getItem('admin_session');
        const sessionId = localStorage.getItem('tracking_session_id');
        const admin = adminSession ? JSON.parse(adminSession) : null;

        if (!admin?.id) {
            console.warn('No admin session for tracking');
            setIsTracking(false);
            startTimeRef.current = null;
            return;
        }

        // Send tracking data
        try {
            await fetch('/api/admin/track-product-edit-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admin_id: admin.id,
                    session_id: sessionId,
                    product_id: productId,
                    product_name: productName,
                    duration_seconds: durationSeconds,
                    duration_ms: duration,
                }),
            });
            console.log('✅ Product card edit time tracked successfully');
        } catch (error) {
            console.error('Failed to track product edit time:', error);
        }

        setIsTracking(false);
        startTimeRef.current = null;
    };

    // Auto-stop tracking on unmount
    useEffect(() => {
        return () => {
            if (isTracking && startTimeRef.current) {
                // Send tracking immediately on unmount
                const duration = Date.now() - startTimeRef.current;
                const durationSeconds = duration / 1000;

                const adminSession = localStorage.getItem('admin_session');
                const sessionId = localStorage.getItem('tracking_session_id');
                const admin = adminSession ? JSON.parse(adminSession) : null;

                if (admin?.id) {
                    // Use sendBeacon for guaranteed delivery on unmount
                    const data = JSON.stringify({
                        admin_id: admin.id,
                        session_id: sessionId,
                        product_id: productId,
                        product_name: productName,
                        duration_seconds: durationSeconds,
                        duration_ms: duration,
                    });

                    navigator.sendBeacon('/api/admin/track-product-edit-time', data);
                }
            }
        };
    }, [isTracking, productId, productName]);

    return { startTracking, stopTracking, isTracking };
}
