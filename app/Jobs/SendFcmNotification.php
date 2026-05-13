<?php

namespace App\Jobs;

use App\Models\MobilePushToken;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SendFcmNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 30;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public MobilePushToken $mobilePushToken,
        public string $title,
        public string $body,
        public array $data = []
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $serverKey = config('services.fcm.server_key');

        if (empty($serverKey)) {
            Log::warning('FCM server key is missing, skipping mobile push');
            return;
        }

        $payload = [
            'to' => $this->mobilePushToken->token,
            'priority' => 'high',
            'notification' => [
                'title' => $this->title,
                'body' => $this->body,
                'sound' => 'default',
            ],
            'data' => $this->data,
        ];

        $response = Http::withHeaders([
            'Authorization' => 'key=' . $serverKey,
            'Content-Type' => 'application/json',
        ])->post('https://fcm.googleapis.com/fcm/send', $payload);

        if ($response->failed()) {
            Log::warning('FCM push failed', [
                'user_id' => $this->mobilePushToken->user_id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return;
        }

        $json = $response->json();
        $error = $json['results'][0]['error'] ?? null;

        if (in_array($error, ['NotRegistered', 'InvalidRegistration'], true)) {
            $this->mobilePushToken->delete();
            Log::info('Removed invalid FCM token', [
                'user_id' => $this->mobilePushToken->user_id,
                'platform' => $this->mobilePushToken->platform,
            ]);
        }
    }
}
