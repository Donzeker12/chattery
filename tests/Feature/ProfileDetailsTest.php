<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('profile completion is required only for incomplete non-admin users', function (array $attributes, bool $required) {
    $user = User::factory()->make($attributes);

    expect($user->requiresProfileCompletion())->toBe($required);
})->with([
    'admin without details' => [['is_admin' => true, 'profile_type' => null, 'gender' => null], false],
    'couple without gender' => [['is_admin' => false, 'profile_type' => 'couple', 'gender' => null], false],
    'man' => [['is_admin' => false, 'profile_type' => 'individual', 'gender' => 'male'], false],
    'woman' => [['is_admin' => false, 'profile_type' => 'individual', 'gender' => 'female'], false],
    'other' => [['is_admin' => false, 'profile_type' => 'individual', 'gender' => 'other'], false],
    'missing type' => [['is_admin' => false, 'profile_type' => null, 'gender' => null], true],
    'missing gender' => [['is_admin' => false, 'profile_type' => 'individual', 'gender' => null], true],
    'old privacy choice' => [['is_admin' => false, 'profile_type' => 'individual', 'gender' => 'prefer_not_to_say'], true],
]);

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

test('an incomplete user is redirected to mandatory profile completion after web login', function () {
    $user = User::factory()->create([
        'email' => 'incomplete@example.com',
        'password' => 'password123',
        'profile_type' => null,
        'gender' => null,
    ]);

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password123',
    ])->assertRedirect(route('profile.complete'));

    $this->get('/chat')->assertRedirect(route('profile.complete'));
    $this->get('/profile/complete')->assertOk();
});

test('an incomplete api user is blocked until profile completion', function () {
    $user = User::factory()->create([
        'profile_type' => null,
        'gender' => null,
    ]);
    Sanctum::actingAs($user);

    $this->getJson('/api/users')
        ->assertStatus(428)
        ->assertJsonPath('code', 'PROFILE_INCOMPLETE');

    $this->getJson('/api/user')->assertOk();

    $this->patchJson('/api/profile', [
        'profile_type' => 'individual',
        'gender' => 'other',
    ])->assertOk();

    $this->getJson('/api/users')->assertOk();
});

test('admins bypass mandatory profile completion', function () {
    $admin = User::factory()->create([
        'is_admin' => true,
        'profile_type' => null,
        'gender' => null,
    ]);
    Sanctum::actingAs($admin);

    $this->getJson('/api/users')->assertOk();
});
