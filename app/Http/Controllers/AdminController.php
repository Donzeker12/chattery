<?php

namespace App\Http\Controllers;

use App\Models\AdminLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AdminController extends Controller
{
    public function index()
    {
        // Consider users online if they were active in the last 5 minutes
        $onlineThreshold = now()->subMinutes(5);
        
        $users = User::orderBy('created_at', 'desc')->get()->map(function ($user) use ($onlineThreshold) {
            $isOnline = $user->last_seen_at && $user->last_seen_at >= $onlineThreshold;
            
            return [
                'id' => $user->id,
                'name' => $user->name,
                'is_admin' => $user->is_admin,
                'is_banned' => !is_null($user->banned_at),
                'is_online' => $isOnline,
                'created_at' => $user->created_at->format('d-m-Y H:i'),
                'last_seen' => $user->last_seen_at ? $user->last_seen_at->diffForHumans() : 'Nooit',
                'profile_photo_url' => $user->profile_photo_path ? asset('storage/' . $user->profile_photo_path) : null,
            ];
        })->toArray();

        $onlineCount = collect($users)->where('is_online', true)->count();

        return Inertia::render('Admin/Index', [
            'users' => $users,
            'total_users' => count($users),
            'online_users' => $onlineCount,
        ]);
    }

    public function banUser(Request $request, User $user)
    {
        if ($user->is_admin) {
            return response()->json([
                'success' => false,
                'message' => 'Je kunt geen admin gebruiker bannen'
            ], 403);
        }

        $user->banned_at = now();
        $user->save();

        // Log admin action
        AdminLog::create([
            'admin_user_id' => Auth::id(),
            'action' => 'ban_user',
            'target_user_id' => $user->id,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'details' => [
                'user_name' => $user->name,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Gebruiker is gebanned'
        ]);
    }

    public function unbanUser(Request $request, User $user)
    {
        $user->banned_at = null;
        $user->save();

        // Log admin action
        AdminLog::create([
            'admin_user_id' => Auth::id(),
            'action' => 'unban_user',
            'target_user_id' => $user->id,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'details' => [
                'user_name' => $user->name,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Ban is opgeheven'
        ]);
    }
}
