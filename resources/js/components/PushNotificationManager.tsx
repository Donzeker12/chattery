import { useEffect, useState } from 'react';
import axios from '@/lib/axios';

interface NotificationState {
    permission: NotificationPermission;
    supported: boolean;
    subscribed: boolean;
    loading: boolean;
}

export default function PushNotificationManager() {
    const [state, setState] = useState<NotificationState>({
        permission: 'default',
        supported: false,
        subscribed: false,
        loading: false,
    });

    useEffect(() => {
        checkNotificationSupport();
    }, []);

    const checkNotificationSupport = async () => {
        const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
        const permission = supported ? Notification.permission : 'denied';
        
        setState(prev => ({
            ...prev,
            supported,
            permission,
        }));

        if (supported && permission === 'granted') {
            await checkSubscriptionStatus();
        }
    };

    const checkSubscriptionStatus = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            setState(prev => ({
                ...prev,
                subscribed: !!subscription,
            }));
        } catch (error) {
            console.error('Error checking push subscription:', error);
        }
    };

    const requestNotificationPermission = async () => {
        if (!state.supported) {
            alert('Push notificaties worden niet ondersteund in deze browser');
            return;
        }

        setState(prev => ({ ...prev, loading: true }));

        try {
            const permission = await Notification.requestPermission();
            
            setState(prev => ({ ...prev, permission, loading: false }));

            if (permission === 'granted') {
                await subscribeToPushNotifications();
            } else {
                alert('Notificaties zijn uitgeschakeld. Je kunt ze inschakelen in de browserinstellingen.');
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            setState(prev => ({ ...prev, loading: false }));
            alert('Fout bij het aanvragen van notificatie toestemming');
        }
    };

    const subscribeToPushNotifications = async () => {
        setState(prev => ({ ...prev, loading: true }));

        try {
            // Get VAPID public key from backend
            const vapidResponse = await axios.get('/api/push/vapid-key');
            const publicKey = vapidResponse.data.publicKey;

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;
            
            // Subscribe to push notifications
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: publicKey,
            });

            // Send subscription to backend
            await axios.post('/api/push/subscribe', subscription.toJSON());

            setState(prev => ({ 
                ...prev, 
                subscribed: true, 
                loading: false 
            }));

            // Show success message
            new Notification('🔔 Notificaties ingeschakeld!', {
                body: 'Je ontvangt nu meldingen voor nieuwe berichten',
                icon: '/icon-192x192.png',
            });

        } catch (error) {
            console.error('Error subscribing to push notifications:', error);
            setState(prev => ({ ...prev, loading: false }));
            alert('Fout bij het inschakelen van notificaties');
        }
    };

    const unsubscribeFromPushNotifications = async () => {
        setState(prev => ({ ...prev, loading: true }));

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Unsubscribe from browser
                await subscription.unsubscribe();
                
                // Remove from backend
                await axios.post('/api/push/unsubscribe', {
                    endpoint: subscription.endpoint
                });
            }

            setState(prev => ({ 
                ...prev, 
                subscribed: false, 
                loading: false 
            }));

        } catch (error) {
            console.error('Error unsubscribing from push notifications:', error);
            setState(prev => ({ ...prev, loading: false }));
            alert('Fout bij het uitschakelen van notificaties');
        }
    };

    const testNotification = async () => {
        if (!state.subscribed) {
            alert('Eerst notificaties inschakelen');
            return;
        }

        setState(prev => ({ ...prev, loading: true }));

        try {
            const response = await axios.post('/api/push/test');
            alert(response.data.message);
        } catch (error) {
            console.error('Error sending test notification:', error);
            alert('Fout bij het versturen van test notificatie');
        }

        setState(prev => ({ ...prev, loading: false }));
    };

    if (!state.supported) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-yellow-800 text-sm">
                        Push notificaties worden niet ondersteund in deze browser
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed top-4 right-4 z-40">
            {state.permission === 'default' && !state.subscribed && (
                <button
                    onClick={requestNotificationPermission}
                    disabled={state.loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.414V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                    {state.loading ? 'Bezig...' : 'Meldingen inschakelen'}
                </button>
            )}
            
            {state.permission === 'granted' && !state.subscribed && (
                <button
                    onClick={subscribeToPushNotifications}
                    disabled={state.loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.414V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                    {state.loading ? 'Bezig...' : '🔔 Activeren'}  
                </button>
            )}
            
            {state.subscribed && (
                <div className="bg-green-100 text-green-800 px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">🔔 Meldingen aan</span>
                </div>
            )}
        </div>
    );
}