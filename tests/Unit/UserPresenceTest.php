<?php

use App\Models\User;
use Illuminate\Support\Carbon;
use Tests\TestCase;

uses(TestCase::class);

it('only considers recently active users online', function () {
    Carbon::setTestNow('2026-08-10 12:00:00');

    expect((new User(['last_seen_at' => now()->subSeconds(10)]))->isOnline())->toBeTrue()
        ->and((new User(['last_seen_at' => now()->subSeconds(31)]))->isOnline())->toBeFalse()
        ->and((new User())->isOnline())->toBeFalse();

    Carbon::setTestNow();
});