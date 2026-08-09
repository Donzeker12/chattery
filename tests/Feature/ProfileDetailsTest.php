<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('an individual registers with a gender on the website', function () {
    $this->post('/register', [
        'name' => 'Nieuwe Gebruiker',
        'email' => 'persoon@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'profile_type' => 'individual',
        'gender' => 'female',
    ])->assertRedirect('/chat');

    $this->assertDatabaseHas('users', [
        'email' => 'persoon@example.com',
        'profile_type' => 'individual',
        'gender' => 'female',
    ]);
});

test('a couple registers without a gender through the api', function () {
    $response = $this->postJson('/api/register', [
        'name' => 'Samen Profiel',
        'email' => 'koppel@example.com',
        'password' => 'password123',
        'profile_type' => 'couple',
        'gender' => null,
    ]);

    $response
        ->assertCreated()
        ->assertJsonPath('user.profile_type', 'couple')
        ->assertJsonPath('user.gender', null);

    $this->assertDatabaseHas('users', [
        'email' => 'koppel@example.com',
        'profile_type' => 'couple',
        'gender' => null,
    ]);
});

test('gender is required for an individual registration', function () {
    $this->postJson('/api/register', [
        'name' => 'Zonder Gender',
        'email' => 'ongeldig@example.com',
        'password' => 'password123',
        'profile_type' => 'individual',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('gender');
});

test('an older mobile client can register without profile details', function () {
    $this->postJson('/api/register', [
        'name' => 'Oudere App',
        'email' => 'legacy@example.com',
        'password' => 'password123',
    ])->assertCreated();

    $this->assertDatabaseHas('users', [
        'email' => 'legacy@example.com',
        'profile_type' => null,
        'gender' => null,
    ]);
});

test('an authenticated user can update profile details', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->patchJson('/api/profile', [
        'profile_type' => 'individual',
        'gender' => 'male',
    ])
        ->assertOk()
        ->assertJsonPath('user.profile_type', 'individual')
        ->assertJsonPath('user.gender', 'male');

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'profile_type' => 'individual',
        'gender' => 'male',
    ]);
});
