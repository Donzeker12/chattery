<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name',
    'email',
    'password',
    'account_type',
    'profile_type',
    'gender',
    'last_seen_at',
    'profile_photo_path',
    'is_hidden',
    'hidden_chat_ids',
    'chat_theme',
    'dark_mode',
    'chat_animations',
    'sound_notifications',
    'show_typing_indicator',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'banned_at' => 'datetime',
            'is_admin' => 'boolean',
            'is_hidden' => 'boolean',
            'last_seen_at' => 'datetime',
            'hidden_chat_ids' => 'array',
            'dark_mode' => 'boolean',
            'chat_animations' => 'boolean',
            'sound_notifications' => 'boolean',
            'show_typing_indicator' => 'boolean',
        ];
    }

    public function requiresProfileCompletion(): bool
    {
        if ($this->is_admin) {
            return false;
        }

        if ($this->profile_type === 'couple') {
            return false;
        }

        return $this->profile_type !== 'individual'
            || ! in_array($this->gender, ['male', 'female', 'other'], true);
    }

    public function isOnline(): bool
    {
        return $this->last_seen_at !== null
            && $this->last_seen_at->isAfter(now()->subSeconds(30));
    }

    /**
     * Get all chats where user is participant one.
     */
    public function chatsAsUserOne(): HasMany
    {
        return $this->hasMany(Chat::class, 'user_one_id');
    }

    /**
     * Get all chats where user is participant two.
     */
    public function chatsAsUserTwo(): HasMany
    {
        return $this->hasMany(Chat::class, 'user_two_id');
    }

    /**
     * Get all messages sent by the user.
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /**
     * Get all push subscriptions for the user.
     */
    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(PushSubscription::class);
    }

    /**
     * Get all mobile push tokens for the user.
     */
    public function mobilePushTokens(): HasMany
    {
        return $this->hasMany(MobilePushToken::class);
    }
}
