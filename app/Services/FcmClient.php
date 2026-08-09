<?php

namespace App\Services;

use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use JsonException;
use RuntimeException;

class FcmClient
{
    private const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

    public function isConfigured(): bool
    {
        $path = config('services.fcm.credentials');

        return is_string($path) && is_readable($path);
    }

    public function send(string $token, string $title, string $body, array $data = []): FcmSendResult
    {
        $credentials = $this->credentials();
        $projectId = $credentials['project_id'] ?? null;

        if (! is_string($projectId) || $projectId === '') {
            throw new RuntimeException('Firebase project_id is missing from the credentials file.');
        }

        $response = Http::acceptJson()
            ->withToken($this->accessToken($credentials))
            ->timeout(15)
            ->post("https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send", [
                'message' => [
                    'token' => $token,
                    'notification' => [
                        'title' => $title,
                        'body' => $body,
                    ],
                    'data' => $this->normalizeData($data),
                    'android' => [
                        'priority' => 'high',
                        'notification' => [
                            'channel_id' => 'chattery_messages',
                            'sound' => 'default',
                        ],
                    ],
                ],
            ]);

        return new FcmSendResult(
            successful: $response->successful(),
            status: $response->status(),
            errorCode: $this->errorCode($response->json()),
            body: $response->failed() ? $response->body() : null,
        );
    }

    protected function accessToken(array $credentials): string
    {
        $cacheKey = 'fcm-access-token:'.sha1((string) ($credentials['client_email'] ?? 'unknown'));

        return Cache::remember($cacheKey, now()->addMinutes(50), function () use ($credentials): string {
            $auth = new ServiceAccountCredentials(self::SCOPE, $credentials);
            $token = $auth->fetchAuthToken()['access_token'] ?? null;

            if (! is_string($token) || $token === '') {
                throw new RuntimeException('Firebase did not return an OAuth access token.');
            }

            return $token;
        });
    }

    private function credentials(): array
    {
        $path = config('services.fcm.credentials');

        if (! is_string($path) || ! is_readable($path)) {
            throw new RuntimeException('Firebase credentials file is not readable.');
        }

        try {
            $credentials = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('Firebase credentials file contains invalid JSON.', previous: $exception);
        }

        if (! is_array($credentials) || ($credentials['type'] ?? null) !== 'service_account') {
            throw new RuntimeException('Firebase credentials must contain a service account.');
        }

        return $credentials;
    }

    private function normalizeData(array $data): array
    {
        return array_map(static function (mixed $value): string {
            if (is_string($value)) {
                return $value;
            }

            if (is_scalar($value) || $value === null) {
                return json_encode($value, JSON_THROW_ON_ERROR);
            }

            return json_encode($value, JSON_THROW_ON_ERROR);
        }, $data);
    }

    private function errorCode(mixed $response): ?string
    {
        if (! is_array($response)) {
            return null;
        }

        foreach ($response['error']['details'] ?? [] as $detail) {
            if (($detail['@type'] ?? null) === 'type.googleapis.com/google.firebase.fcm.v1.FcmError') {
                return $detail['errorCode'] ?? null;
            }
        }

        return $response['error']['status'] ?? null;
    }
}
