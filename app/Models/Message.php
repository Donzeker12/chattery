<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    use HasFactory;

    protected $fillable = [
        'chat_id',
        'user_id',
        'message',
        'is_read',
        'attachment_type',
        'attachment_path',
        'view_once',
        'view_once_viewed_by',
        'deleted_at',
        'deleted_for_users',
        'hidden_for_users',
        'edited_at',
        'original_message',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'deleted_at' => 'datetime',
        'deleted_for_users' => 'array',
        'hidden_for_users' => 'array',
        'view_once' => 'boolean',
        'view_once_viewed_by' => 'array',
        'edited_at' => 'datetime',
    ];

    /**
     * Get the chat that owns the message.
     */
    public function chat(): BelongsTo
    {
        return $this->belongsTo(Chat::class);
    }

    /**
     * Get the user that sent the message.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get all reactions for the message.
     */
    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class);
    }
}
