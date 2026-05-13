<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MobilePushTokenController extends Controller
{
    /**
     * Store or update the current device FCM token.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string|max:4096',
            'platform' => 'nullable|string|max:50',
            'device_name' => 'nullable|string|max:255',
        ]);

        $request->user()->mobilePushTokens()->updateOrCreate(
            ['token' => $validated['token']],
            [
                'platform' => $validated['platform'] ?? 'unknown',
                'device_name' => $validated['device_name'] ?? null,
                'last_used_at' => now(),
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Mobiele push token opgeslagen',
        ]);
    }

    /**
     * Delete a device FCM token.
     */
    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string|max:4096',
        ]);

        $request->user()->mobilePushTokens()
            ->where('token', $validated['token'])
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Mobiele push token verwijderd',
        ]);
    }
}
