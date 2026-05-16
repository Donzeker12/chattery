<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Story extends Model
{
    use HasFactory;


    protected $fillable = [
        'user_id',
        'content',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function images()
    {
        return $this->hasMany(StoryImage::class);
    }

    public function viewers()
    {
        return $this->belongsToMany(User::class, 'story_views', 'story_id', 'viewer_user_id')
            ->withPivot('viewed_at');
    }
}