<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('custom_emojis', function (Blueprint $table) {
            $table->id();
            $table->string('name', 64)->unique(); // slug-style: party_blob, cool_cat
            $table->string('image_path');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_emojis');
    }
};
