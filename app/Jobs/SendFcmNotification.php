<?php

namespace App\Jobs;

use App\Models\MobilePushToken;
use App\Services\FcmClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
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
    public function handle(FcmClient $fcmClient): void
    {
        if (! $fcmClient->isConfigured()) {
            Log::warning('Firebase credentials are missing, skipping mobile push');

            return;
        }

        $result = $fcmClient->send(
            $this->mobilePushToken->token,
            $this->title,
            $this->body,
            $this->data,
        );

        if (! $result->successful) {
            Log::warning('FCM push failed', [
                'user_id' => $this->mobilePushToken->user_id,
                'status' => $result->status,
                'error_code' => $result->errorCode,
                'body' => $result->body,
            ]);
        }

        if ($result->tokenIsInvalid()) {
            $this->mobilePushToken->delete();
            Log::info('Removed invalid FCM token', [
                'user_id' => $this->mobilePushToken->user_id,
                'platform' => $this->mobilePushToken->platform,
            ]);
        }
    }
}
