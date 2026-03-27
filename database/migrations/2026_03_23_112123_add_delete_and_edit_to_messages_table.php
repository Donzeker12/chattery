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
        Schema::table('messages', function (Blueprint $table) {
            $table->timestamp('deleted_at')->nullable(); // Verwijderd voor iedereen
            $table->json('deleted_for_users')->nullable(); // Array van user IDs die het voor zichzelf verwijderd hebben
            $table->timestamp('edited_at')->nullable(); // Wanneer laatste keer bewerkt
            $table->text('original_message')->nullable(); // Origineel bericht (voor edit geschiedenis)
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['deleted_at', 'deleted_for_users', 'edited_at', 'original_message']);
        });
    }
};
