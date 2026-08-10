<?php

use App\Models\Chat;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

it('refreshes presence for an authenticated user', function () {
    Carbon::setTestNow('2026-08-10 12:00:00');
    $user = User::factory()->create([
        'profile_type' => 'couple',
        'last_seen_at' => now()->subHour(),
    ]);
    Sanctum::actingAs($user);

    $this->postJson('/api/presence/heartbeat')
        ->assertOk()
        ->assertExactJson(['online' => true]);

    expect($user->fresh()->last_seen_at->equalTo(now()))->toBeTrue();

    Carbon::setTestNow();
});

it('returns chat participants online only after recent activity', function () {
    Carbon::setTestNow('2026-08-10 12:00:00');
    $currentUser = User::factory()->create(['profile_type' => 'couple']);
    $otherUser = User::factory()->create([
        'profile_type' => 'couple',
        'last_seen_at' => now()->subSeconds(31),
    ]);
    Chat::create([
        'user_one_id' => min($currentUser->id, $otherUser->id),
        'user_two_id' => max($currentUser->id, $otherUser->id),
    ]);
    Sanctum::actingAs($currentUser);

    $this->getJson('/api/chats')
        ->assertOk()
        ->assertJsonPath('chats.0.participant.is_online', false);

    $otherUser->updateQuietly(['last_seen_at' => now()->subSeconds(10)]);

    $this->getJson('/api/chats')
        ->assertOk()
        ->assertJsonPath('chats.0.participant.is_online', true);

    Carbon::setTestNow();
});