<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Remove admin rights from jan@example.com if exists
        $oldAdmin = User::where('email', 'jan@example.com')->first();
        if ($oldAdmin && $oldAdmin->is_admin) {
            $oldAdmin->is_admin = false;
            $oldAdmin->save();
            $this->command->info("✓ Admin rechten verwijderd van {$oldAdmin->email}");
        }

        // Check if donzeker1@hotmail.com exists, if not create it
        $user = User::where('email', 'donzeker1@hotmail.com')->first();
        
        if (!$user) {
            $user = User::create([
                'name' => 'Admin',
                'email' => 'donzeker1@hotmail.com',
                'password' => Hash::make('password'),
            ]);
            $this->command->info("✓ Nieuwe gebruiker aangemaakt: {$user->email}");
        }

        // Make admin
        $user->is_admin = true;
        $user->save();
        $this->command->info("✓ {$user->name} ({$user->email}) is nu een admin.");
    }
}
