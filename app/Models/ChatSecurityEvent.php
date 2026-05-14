<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatSecurityEvent extends Model
{
    protected $fillable = [
        'chat_id',
        'user_id',
        'event_type',
        'trigger',
        'ip_address',
        'user_agent',
    ];

    public function chat(): BelongsTo
    {
        return $this->belongsTo(Chat::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
