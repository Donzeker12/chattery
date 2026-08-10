<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PresenceController extends Controller
{
    public function heartbeat(Request $request): JsonResponse
    {
        $request->user()->updateQuietly(['last_seen_at' => now()]);

        return response()->json(['online' => true]);
    }
}