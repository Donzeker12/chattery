<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FailedLoginAttempt extends Model
{
    protected $fillable = [
        'ip_address',
        'email',
        'user_agent',
        'attempted_at',
        'blocked_until',
    ];

    protected $casts = [
        'attempted_at' => 'datetime',
        'blocked_until' => 'datetime',
    ];
}
