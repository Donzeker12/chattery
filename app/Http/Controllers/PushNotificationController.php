<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PushNotificationController extends Controller
{
    /**
     * Subscribe user to push notifications.
     */
    public function subscribe(Request $request)
    {
        $user = Auth::user();

        $validated = $request->validate([
            'endpoint' => 'required|string',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
        ]);

        // Create or update subscription
        PushSubscription::updateOrCreate(
            [
                'user_id' => $user->id,
                'endpoint' => $validated['endpoint'],
            ],
            [
                'p256dh_key' => $validated['keys']['p256dh'],
                'auth_key' => $validated['keys']['auth'],
                'user_agent' => $request->header('User-Agent'),
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Push notificatie abonnement aangemaakt',
        ]);
    }

    /**
     * Unsubscribe user from push notifications.
     */
    public function unsubscribe(Request $request)
    {
        $user = Auth::user();

        $validated = $request->validate([
            'endpoint' => 'required|string',
        ]);

        PushSubscription::where('user_id', $user->id)
            ->where('endpoint', $validated['endpoint'])
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Push notificatie abonnement verwijderd',
        ]);
    }

    /**
     * Get VAPID public key for client-side subscription.
     */
    public function getVapidPublicKey()
    {
        return response()->json([
            'publicKey' => config('webpush.vapid.public_key'),
        ]);
    }

    /**
     * Test push notification (for development).
     */
    public function test(Request $request)
    {
        $user = Auth::user();

        if (!config('app.debug')) {
            abort(404);
        }

        $subscriptions = $user->pushSubscriptions;

        if ($subscriptions->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Geen push abonnementen gevonden',
            ]);
        }

        // Send test notification to all subscriptions
        foreach ($subscriptions as $subscription) {
            dispatch(new \App\Jobs\SendPushNotification(
                $subscription,
                'Test Notificatie',
                'Dit is een test bericht van Chattery! 🚀',
                ['url' => '/chat']
            ));
        }

        return response()->json([
            'success' => true,
            'message' => 'Test notificatie verzonden naar ' . $subscriptions->count() . ' apparaten',
        ]);
    }
}