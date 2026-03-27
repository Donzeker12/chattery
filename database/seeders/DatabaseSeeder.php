<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create test users for the chat application
        User::create([
            'name' => 'Jan de Vries',
            'email' => 'jan@example.com',
            'password' => Hash::make('password'),
        ]);

        User::create([
            'name' => 'Emma Jansen',
            'email' => 'emma@example.com',
            'password' => Hash::make('password'),
        ]);

        User::create([
            'name' => 'Pieter Bakker',
            'email' => 'pieter@example.com',
            'password' => Hash::make('password'),
        ]);

        User::create([
            'name' => 'Lisa Visser',
            'email' => 'lisa@example.com',
            'password' => Hash::make('password'),
        ]);
    }
}
