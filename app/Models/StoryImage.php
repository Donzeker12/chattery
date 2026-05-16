<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StoryImage extends Model
{
    use HasFactory;

    protected $fillable = [
        'story_id',
        'image_path',
    ];

    public function story()
    {
        return $this->belongsTo(Story::class);
    }
}
