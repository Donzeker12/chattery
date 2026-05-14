<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('chat_theme')->default('default')->after('hidden_chat_ids');
            $table->boolean('dark_mode')->default(false)->after('chat_theme');
            $table->boolean('chat_animations')->default(true)->after('dark_mode');
            $table->boolean('sound_notifications')->default(true)->after('chat_animations');
            $table->boolean('show_typing_indicator')->default(true)->after('sound_notifications');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'chat_theme',
                'dark_mode',
                'chat_animations',
                'sound_notifications',
                'show_typing_indicator',
            ]);
        });
    }
};
