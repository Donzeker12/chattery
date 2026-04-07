<?php

return [
    'vapid' => [
        'subject' => env('VAPID_SUBJECT', 'mailto:admin@chattery.com'),
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
    ],

    'gcm' => [
        'key' => env('GCM_KEY'),
    ],

    'ttl' => env('PUSH_TTL', 7 * 24 * 60 * 60), // 7 days in seconds

    'topic' => env('PUSH_TOPIC', 'chattery-notifications'),

    'urgency' => env('PUSH_URGENCY', 'normal'), // very-low, low, normal, high

    'batch_size' => env('PUSH_BATCH_SIZE', 100),
];