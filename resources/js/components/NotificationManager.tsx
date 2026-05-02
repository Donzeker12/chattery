import { useEffect, useState } from 'react';
import axios from '@/lib/axios';

interface NotificationState {
    permission: NotificationPermission;
    isSupported: boolean;
    isSubscribed: boolean;
    isLoading: boolean;
    vapidPublicKey: string | null;
}

export default function NotificationManager() {
    const [state, setState] = useState<NotificationState>({
        permission: 'default',
        isSupported: false,
        isSubscribed: false,
        isLoading: false,
        vapidPublicKey: null
    });

    useEffect(() => {
        // Check if browser supports notifications and service workers
        const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
        
        setState(prev => ({
            ...prev,
            isSupported,
            permission: isSupported ? Notification.permission : 'denied'
        }));

        if (isSupported) {
            // Get VAPID public key
            fetchVapidKey();
            // Check current subscription status
            checkSubscriptionStatus();
        }
    }, []);

    const fetchVapidKey = async () => {
        try {
            const response = await axios.get('/api/push/vapid-key');
            setState(prev => ({ ...prev, vapidPublicKey: response.data.publicKey }));
        } catch (error) {
            console.error('Failed to fetch VAPID key:', error);
        }
    };

    const checkSubscriptionStatus = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            const isSubscribed = !!subscription;
            setState(prev => ({ ...prev, isSubscribed }));
            console.log('Subscription status checked:', isSubscribed);
        } catch (error) {
            console.error('Error checking subscription:', error);
            setState(prev => ({ ...prev, isSubscribed: false }));
        }
    };

    const requestPermission = async () => {
        if (!state.isSupported) return false;

        setState(prev => ({ ...prev, isLoading: true }));

        try {
            const permission = await Notification.requestPermission();
            setState(prev => ({ ...prev, permission }));
            
            if (permission === 'granted') {
                const success = await subscribeToPushNotifications();
                return success;
            }
            return false;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        } finally {
            setState(prev => ({ ...prev, isLoading: false }));
        }
    };

    const subscribeToPushNotifications = async (): Promise<boolean> => {
        if (!state.vapidPublicKey || !state.isSupported) return false;

        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Convert VAPID key to Uint8Array
            const vapidKey = urlBase64ToUint8Array(state.vapidPublicKey);
            
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidKey
            });

            // Send subscription to backend
            await axios.post('/api/push/subscribe', {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
                    auth: arrayBufferToBase64(subscription.getKey('auth'))
                }
            });

            setState(prev => ({ ...prev, isSubscribed: true }));
            console.log('Successfully subscribed to push notifications');
            return true;
        } catch (error) {
            console.error('Error subscribing to push notifications:', error);
            setState(prev => ({ ...prev, isSubscribed: false }));
            return false;
        }
    };

    const unsubscribeFromPushNotifications = async () => {
        if (!state.isSupported) return;

        setState(prev => ({ ...prev, isLoading: true }));

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                await subscription.unsubscribe();
                
                // Remove subscription from backend
                await axios.post('/api/push/unsubscribe', {
                    endpoint: subscription.endpoint
                });
            }

            setState(prev => ({ ...prev, isSubscribed: false }));
            console.log('Successfully unsubscribed from push notifications');
        } catch (error) {
            console.error('Error unsubscribing from push notifications:', error);
        } finally {
            setState(prev => ({ ...prev, isLoading: false }));
        }
    };

    const sendTestNotification = async () => {
        if (!state.isSubscribed) return;

        try {
            await axios.post('/api/push/test');
            console.log('Test notification sent');
        } catch (error) {
            console.error('Error sending test notification:', error);
        }
    };

    // Helper functions
    const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const arrayBufferToBase64 = (buffer: ArrayBuffer | null): string => {
        if (!buffer) return '';
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    };

    // Don't render if not supported
    if (!state.isSupported) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Push Notificaties</h3>
                        <p className="text-xs text-gray-500">
                            {state.permission === 'granted' && state.isSubscribed 
                                ? '✅ Ingeschakeld' 
                                : state.permission === 'denied' 
                                ? '❌ Geblokkeerd'
                                : '⚪ Uitgeschakeld'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {state.permission === 'granted' && state.isSubscribed ? (
                        <>
                            {process.env.NODE_ENV === 'development' && (
                                <button
                                    onClick={sendTestNotification}
                                    className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 transition"
                                    title="Test notificatie"
                                >
                                    Test
                                </button>
                            )}
                            <button
                                onClick={unsubscribeFromPushNotifications}
                                disabled={state.isLoading}
                                className="text-sm bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition disabled:opacity-50"
                            >
                                {state.isLoading ? 'Bezig...' : 'Uitschakelen'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={requestPermission}
                            disabled={state.isLoading || state.permission === 'denied'}
                            className="text-sm bg-purple-500 text-white px-3 py-1 rounded-lg hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {state.isLoading ? 'Bezig...' : 
                             state.permission === 'denied' ? 'Geblokkeerd' : 'Inschakelen'}
                        </button>
                    )}
                </div>
            </div>

            <div className="text-xs text-gray-600">
                {state.permission === 'denied' ? (
                    <p className="text-red-600">
                        ❌ Notificaties zijn geblokkeerd. Schakel deze in via je browser instellingen.
                    </p>
                ) : state.permission === 'granted' && state.isSubscribed ? (
                    <p className="text-green-600">
                        ✅ Je ontvangt notificaties voor nieuwe berichten
                    </p>
                ) : state.isLoading ? (
                    <p className="text-blue-600">
                        ⏳ Bezig met instellen...
                    </p>
                ) : (
                    <p>
                        🔔 Ontvang een melding op je telefoon bij nieuwe berichten
                    </p>
                )}
            </div>
        </div>
    );
}