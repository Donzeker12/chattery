<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;

class GenerateVapidKeys extends Command
{
    protected $signature = 'webpush:vapid';
    protected $description = 'Generate VAPID keys for Web Push notifications';

    public function handle()
    {
        $this->info('Generating VAPID keys...');
        
        $vapidKeys = VAPID::createVapidKeys();
        
        $this->line('');
        $this->info('VAPID keys generated successfully!');
        $this->line('');
        $this->warn('Add these to your .env file:');
        $this->line('');
        $this->line('VAPID_SUBJECT=mailto:admin@chattery.com');
        $this->line('VAPID_PUBLIC_KEY=' . $vapidKeys['publicKey']);
        $this->line('VAPID_PRIVATE_KEY=' . $vapidKeys['privateKey']);
        $this->line('');
        $this->warn('🔐 Keep the private key secret! Do not commit it to version control.');
        $this->line('');
        
        return 0;
    }
}