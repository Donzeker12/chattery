<?php

namespace App\Jobs;

use App\Models\PushSubscription;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class SendPushNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 30;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public PushSubscription $subscription,
        public string $title,
        public string $body,
        public array $data = []
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $webPush = new WebPush([
                'VAPID' => [
                    'subject' => config('app.url'),
                    'publicKey' => config('webpush.vapid.public_key'),
                    'privateKey' => config('webpush.vapid.private_key'),
                ]
            ]);

            $subscription = Subscription::create([
                'endpoint' => $this->subscription->endpoint,
                'keys' => [
                    'p256dh' => $this->subscription->p256dh_key,
                    'auth' => $this->subscription->auth_key,
                ]
            ]);

            $payload = json_encode([
                'title' => $this->title,
                'body' => $this->body,
                'icon' => '/icon-192x192.png',
                'badge' => '/icon-72x72.png',
                'image' => null,
                'data' => array_merge([
                    'url' => '/chat',
                    'timestamp' => now()->toIsoString(),
                ], $this->data),
                'actions' => [
                    [
                        'action' => 'open',
                        'title' => 'Open chat',
                        'icon' => '/icon-192x192.png'
                    ],
                    [
                        'action' => 'close',
                        'title' => 'Sluiten'
                    ]
                ],
                'tag' => 'chattery-message',
                'renotify' => true,
                'vibrate' => [200, 100, 200],
                'silent' => false,
                'requireInteraction' => false
            ]);

            $report = $webPush->sendOneNotification($subscription, $payload);

            // Handle the response
            if ($report->isSuccess()) {
                Log::info('Push notification sent successfully', [
                    'user_id' => $this->subscription->user_id,
                    'endpoint' => substr($this->subscription->endpoint, 0, 50) . '...'
                ]);
            } else {
                Log::warning('Push notification failed', [
                    'user_id' => $this->subscription->user_id,
                    'endpoint' => substr($this->subscription->endpoint, 0, 50) . '...',
                    'reason' => $report->getReason(),
                    'response' => $report->getResponse()?->getBody()?->getContents()
                ]);

                // If subscription is invalid, remove it
                if ($report->isSubscriptionExpired()) {
                    $this->subscription->delete();
                    Log::info('Removed expired push subscription', [
                        'user_id' => $this->subscription->user_id
                    ]);
                }
            }

        } catch (\Exception $e) {
            Log::error('Push notification job failed', [
                'user_id' => $this->subscription->user_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            throw $e; // Re-throw to trigger retry mechanism
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('Push notification job failed permanently', [
            'user_id' => $this->subscription->user_id,
            'error' => $exception->getMessage()
        ]);
    }
}