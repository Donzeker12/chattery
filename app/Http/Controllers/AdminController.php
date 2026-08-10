<?php

namespace App\Http\Controllers;

use App\Models\AdminLog;
use App\Models\ChatSecurityEvent;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AdminController extends Controller
{
    public function index()
    {
        $users = User::orderBy('created_at', 'desc')->get()->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'is_admin' => $user->is_admin,
                'is_banned' => !is_null($user->banned_at),
                'is_hidden' => $user->is_hidden,
                'is_online' => $user->isOnline(),
                'account_type' => $user->account_type ?? 'user',
                'created_at' => $user->created_at->format('d-m-Y H:i'),
                'last_seen' => $user->last_seen_at ? $user->last_seen_at->diffForHumans() : 'Nooit',
                'profile_photo_url' => $user->profile_photo_path ? asset('storage/' . $user->profile_photo_path) : null,
            ];
        })->toArray();

        $onlineCount = collect($users)->where('is_online', true)->count();

        $screenshotEvents = ChatSecurityEvent::query()
            ->where('event_type', 'screenshot_attempt')
            ->with([
                'user:id,name',
                'chat.userOne:id,name',
                'chat.userTwo:id,name',
            ])
            ->latest()
            ->limit(30)
            ->get()
            ->map(function ($event) {
                $chatUserOne = $event->chat?->userOne?->name ?? 'Onbekend';
                $chatUserTwo = $event->chat?->userTwo?->name ?? 'Onbekend';

                return [
                    'id' => $event->id,
                    'user_name' => $event->user?->name ?? 'Onbekend',
                    'chat_label' => "{$chatUserOne} & {$chatUserTwo}",
                    'trigger' => $event->trigger ?? 'unknown',
                    'happened_at' => $event->created_at?->diffForHumans() ?? 'Onbekend',
                ];
            })
            ->values()
            ->toArray();

        $screenshotEventsLast24h = ChatSecurityEvent::query()
            ->where('event_type', 'screenshot_attempt')
            ->where('created_at', '>=', now()->subDay())
            ->count();

        return Inertia::render('Admin/Index', [
            'users' => $users,
            'total_users' => count($users),
            'online_users' => $onlineCount,
            'screenshot_events' => $screenshotEvents,
            'screenshot_events_last_24h' => $screenshotEventsLast24h,
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

    public function hideUser(Request $request, User $user)
    {
        $user->is_hidden = true;
        $user->save();

        // Log admin action
        AdminLog::create([
            'admin_user_id' => Auth::id(),
            'action' => 'hide_user',
            'target_user_id' => $user->id,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'details' => [
                'user_name' => $user->name,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Gebruiker is verborgen'
        ]);
    }

    public function unhideUser(Request $request, User $user)
    {
        $user->is_hidden = false;
        $user->save();

        // Log admin action
        AdminLog::create([
            'admin_user_id' => Auth::id(),
            'action' => 'unhide_user',
            'target_user_id' => $user->id,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'details' => [
                'user_name' => $user->name,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Gebruiker is zichtbaar'
        ]);
    }

    public function setAccountType(Request $request, User $user)
    {
        if ($user->is_admin) {
            return response()->json([
                'success' => false,
                'message' => 'Je kunt het account type van een admin niet wijzigen'
            ], 403);
        }

        $request->validate([
            'account_type' => 'required|in:user,model',
        ]);

        $user->account_type = $request->input('account_type');
        $user->save();

        AdminLog::create([
            'admin_user_id' => Auth::id(),
            'action' => 'set_account_type',
            'target_user_id' => $user->id,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'details' => [
                'user_name' => $user->name,
                'account_type' => $user->account_type,
            ],
        ]);

        return response()->json([
            'success' => true,
            'account_type' => $user->account_type,
            'message' => 'Account type bijgewerkt naar ' . $user->account_type,
        ]);
    }

    public function deleteUser(Request $request, User $user)
    {
        if ($user->id === Auth::id()) {
            return response()->json([
                'success' => false,
                'message' => 'Je kunt je eigen account niet verwijderen via admin.'
            ], 403);
        }

        if ($user->is_admin) {
            return response()->json([
                'success' => false,
                'message' => 'Je kunt geen admin gebruiker verwijderen.'
            ], 403);
        }

        $deletedUserId = $user->id;
        $deletedUserName = $user->name;

        $user->delete();

        AdminLog::create([
            'admin_user_id' => Auth::id(),
            'action' => 'delete_user',
            'target_user_id' => null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'details' => [
                'deleted_user_id' => $deletedUserId,
                'user_name' => $deletedUserName,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Gebruiker is verwijderd.'
        ]);
    }
}
