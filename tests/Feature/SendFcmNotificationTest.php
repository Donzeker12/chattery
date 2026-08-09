<?php

use App\Jobs\SendFcmNotification;
use App\Models\MobilePushToken;
use App\Models\User;
use App\Services\FcmClient;
use App\Services\FcmSendResult;
use Illuminate\Support\Facades\Http;

test('the fcm client sends an http v1 message with string data values', function () {
    $credentialsPath = tempnam(sys_get_temp_dir(), 'chattery-fcm-');
    file_put_contents($credentialsPath, json_encode([
        'type' => 'service_account',
        'project_id' => 'chattery-test',
        'client_email' => 'firebase@example.test',
    ], JSON_THROW_ON_ERROR));
    config(['services.fcm.credentials' => $credentialsPath]);

    Http::fake([
        'https://fcm.googleapis.com/*' => Http::response(['name' => 'messages/123'], 200),
    ]);

    $client = new class extends FcmClient
    {
        protected function accessToken(array $credentials): string
        {
            return 'test-access-token';
        }
    };

    try {
        $result = $client->send('device-token', 'Nieuw bericht', 'Hallo', [
            'chat_id' => 42,
            'muted' => false,
        ]);
    } finally {
        unlink($credentialsPath);
    }

    expect($result->successful)->toBeTrue();

    Http::assertSent(function ($request) {
        return $request->url() === 'https://fcm.googleapis.com/v1/projects/chattery-test/messages:send'
            && $request->hasHeader('Authorization', 'Bearer test-access-token')
            && $request['message']['data'] === ['chat_id' => '42', 'muted' => 'false']
            && $request['message']['android']['notification']['channel_id'] === 'chattery_messages';
    });
});

test('the notification job removes a token rejected by firebase', function () {
    $token = MobilePushToken::create([
        'user_id' => User::factory()->create()->id,
        'token' => 'expired-device-token',
        'platform' => 'android',
    ]);
    $client = Mockery::mock(FcmClient::class);
    $client->shouldReceive('isConfigured')->once()->andReturnTrue();
    $client->shouldReceive('send')->once()->andReturn(
        new FcmSendResult(false, 404, 'UNREGISTERED', '{"error":"not registered"}'),
    );

    (new SendFcmNotification($token, 'Titel', 'Bericht'))->handle($client);

    $this->assertDatabaseMissing('mobile_push_tokens', ['id' => $token->id]);
});

test('the notification job skips sending without firebase credentials', function () {
    $token = MobilePushToken::create([
        'user_id' => User::factory()->create()->id,
        'token' => 'active-device-token',
        'platform' => 'android',
    ]);
    $client = Mockery::mock(FcmClient::class);
    $client->shouldReceive('isConfigured')->once()->andReturnFalse();
    $client->shouldNotReceive('send');

    (new SendFcmNotification($token, 'Titel', 'Bericht'))->handle($client);

    $this->assertDatabaseHas('mobile_push_tokens', ['id' => $token->id]);
});
