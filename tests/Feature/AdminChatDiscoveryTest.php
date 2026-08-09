<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('admins are excluded from chat user discovery', function () {
    $currentUser = User::factory()->create();
    $regularUser = User::factory()->create(['is_admin' => false]);
    $admin = User::factory()->create(['is_admin' => true]);

    Sanctum::actingAs($currentUser);

    $response = $this->getJson('/api/users');

    $response
        ->assertOk()
        ->assertJsonFragment(['id' => $regularUser->id])
        ->assertJsonMissing(['id' => $admin->id]);
});

test('a chat cannot be started with an admin', function () {
    $currentUser = User::factory()->create();
    $admin = User::factory()->create(['is_admin' => true]);

    Sanctum::actingAs($currentUser);

    $this->postJson('/api/chats/start', ['user_id' => $admin->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('user_id');

    $this->assertDatabaseCount('chats', 0);
});

test('admins are also excluded from web chat search', function () {
    $currentUser = User::factory()->create();
    $regularUser = User::factory()->create([
        'name' => 'Zoekbare Gebruiker',
        'is_admin' => false,
    ]);
    $admin = User::factory()->create([
        'name' => 'Zoekbare Admin',
        'is_admin' => true,
    ]);

    $response = $this
        ->actingAs($currentUser)
        ->getJson('/chat/search-users?query=Zoekbare');

    $response
        ->assertOk()
        ->assertJsonFragment(['id' => $regularUser->id])
        ->assertJsonMissing(['id' => $admin->id]);
});

test('the web endpoint cannot start a chat with an admin', function () {
    $currentUser = User::factory()->create();
    $admin = User::factory()->create(['is_admin' => true]);

    $this
        ->actingAs($currentUser)
        ->postJson('/chat/start', ['user_id' => $admin->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('user_id');

    $this->assertDatabaseCount('chats', 0);
});
