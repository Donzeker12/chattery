<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendPushNotification;
use App\Models\Chat;
use App\Models\Message;
use App\Models\Reaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class ChatController extends Controller
{
    /**
     * Get all chats for authenticated user.
     */
    public function index()
    {
        $user = Auth::user();
        $onlineThreshold = now()->subMinutes(5);
        
        $chats = Chat::where('user_one_id', $user->id)
            ->orWhere('user_two_id', $user->id)
            ->with(['userOne', 'userTwo', 'latestMessage'])
            ->get()
            ->map(function ($chat) use ($user, $onlineThreshold) {
                $otherUser = $chat->otherParticipant($user->id);
                $isOnline = $otherUser->last_seen_at && $otherUser->last_seen_at >= $onlineThreshold;
                
                return [
                    'id' => $chat->id,
                    'participant' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                        'is_online' => $isOnline,
                    ],
                    'latest_message' => $chat->latestMessage ? [
                        'message' => $chat->latestMessage->message,
                        'created_at' => $chat->latestMessage->created_at->toIso8601String(),
                        'is_mine' => $chat->latestMessage->user_id === $user->id,
                    ] : null,
                    'unread_count' => $chat->unreadMessagesCount($user->id),
                ];
            })
            ->sortByDesc(function ($chat) {
                return $chat['latest_message']['created_at'] ?? 0;
            })
            ->values()
            ->toArray();

        return response()->json(['chats' => $chats]);
    }

    /**
     * Get messages for a specific chat.
     */
    public function show(Chat $chat)
    {
        $user = Auth::user();
        $onlineThreshold = now()->subMinutes(5);

        if ($chat->user_one_id !== $user->id && $chat->user_two_id !== $user->id) {
            return response()->json(['error' => 'Niet geautoriseerd'], 403);
        }

        // Mark messages as read
        $chat->messages()
            ->where('user_id', '!=', $user->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        $messages = $chat->messages()
            ->with(['user', 'reactions.user'])
            ->orderBy('created_at', 'asc')
            ->get()
            ->filter(function ($message) use ($user) {
                if ($message->deleted_at) return false;
                $deletedForUsers = $message->deleted_for_users ?? [];
                if (in_array($user->id, $deletedForUsers)) return false;
                return true;
            })
            ->map(function ($message) use ($user) {
                return [
                    'id' => $message->id,
                    'message' => $message->message,
                    'attachment_type' => $message->attachment_type,
                    'attachment_path' => $message->attachment_path ? asset('storage/' . $message->attachment_path) : null,
                    'is_mine' => $message->user_id === $user->id,
                    'created_at' => $message->created_at->toIso8601String(),
                    'edited_at' => $message->edited_at?->toIso8601String(),
                    'user' => [
                        'name' => $message->user->name,
                    ],
                    'reactions' => $message->reactions->groupBy('emoji')->map(function ($reactions, $emoji) use ($user) {
                        return [
                            'emoji' => $emoji,
                            'count' => $reactions->count(),
                            'users' => $reactions->map(fn($r) => ['id' => $r->user_id, 'name' => $r->user->name])->values()->toArray(),
                            'reacted_by_me' => $reactions->contains('user_id', $user->id),
                        ];
                    })->values()->toArray(),
                ];
            })
            ->values()
            ->toArray();

        $otherUser = $chat->otherParticipant($user->id);
        $isOnline = $otherUser->last_seen_at && $otherUser->last_seen_at >= $onlineThreshold;

        return response()->json([
            'chat' => [
                'id' => $chat->id,
                'participant' => [
                    'id' => $otherUser->id,
                    'name' => $otherUser->name,
                    'email' => $otherUser->email,
                    'is_online' => $isOnline,
                ],
            ],
            'messages' => $messages,
        ]);
    }

    /**
     * Send a message in a chat.
     */
    public function sendMessage(Request $request, Chat $chat)
    {
        $user = Auth::user();

        if ($chat->user_one_id !== $user->id && $chat->user_two_id !== $user->id) {
            return response()->json(['error' => 'Niet geautoriseerd'], 403);
        }

        // Debug logging - temporary
        \Log::info('SendMessage request data:', [
            'message' => $request->input('message'),
            'message_length' => strlen($request->input('message') ?? ''),
            'has_attachment' => $request->hasFile('attachment'),
            'all_input' => $request->all(),
        ]);

        $validated = $request->validate([
            'message' => 'nullable|string|max:5000',
            'attachment' => 'nullable|file|mimes:jpg,jpeg,png,gif,webp,avif,bmp,svg|max:10240',
        ]);

        // Check if we have either message content OR an attachment
        $hasMessage = !empty(trim($validated['message'] ?? ''));
        $hasAttachment = $request->hasFile('attachment');
        
        if (!$hasMessage && !$hasAttachment) {
            \Log::warning('Message validation failed', [
                'message' => $validated['message'] ?? 'null',
                'trimmed_message' => trim($validated['message'] ?? ''),
                'has_message' => $hasMessage,
                'has_attachment' => $hasAttachment,
            ]);
            return response()->json(['error' => 'Bericht of bijlage is verplicht'], 422);
        }

        $attachmentPath = null;
        $attachmentType = null;

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $filename = time() . '_' . $file->getClientOriginalName();
            $attachmentPath = $file->storeAs('chat-attachments', $filename, 'public');
            $attachmentType = 'image';
        }

        $message = $chat->messages()->create([
            'user_id' => $user->id,
            'message' => $validated['message'] ?? '',
            'attachment_type' => $attachmentType,
            'attachment_path' => $attachmentPath,
        ]);

        // Send push notifications to other participant
        $otherUser = $chat->otherParticipant($user->id);
        $this->sendPushNotification($otherUser, $user, $message);

        return response()->json([
            'message' => [
                'id' => $message->id,
                'message' => $message->message,
                'attachment_type' => $message->attachment_type,
                'attachment_path' => $message->attachment_path ? asset('storage/' . $message->attachment_path) : null,
                'is_mine' => true,
                'created_at' => $message->created_at->toIso8601String(),
                'user' => [
                    'name' => $user->name,
                ],
                'reactions' => [],
            ],
        ]);
    }

    /**
     * Start a new chat with a user.
     */
    public function startChat(Request $request)
    {
        $user = Auth::user();
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $otherUserId = $validated['user_id'];

        $chat = Chat::where(function ($query) use ($user, $otherUserId) {
            $query->where('user_one_id', $user->id)
                ->where('user_two_id', $otherUserId);
        })->orWhere(function ($query) use ($user, $otherUserId) {
            $query->where('user_one_id', $otherUserId)
                ->where('user_two_id', $user->id);
        })->first();

        if (!$chat) {
            $chat = Chat::create([
                'user_one_id' => min($user->id, $otherUserId),
                'user_two_id' => max($user->id, $otherUserId),
            ]);
        }

        return response()->json(['chat_id' => $chat->id]);
    }

    /**
     * Delete message for me.
     */
    public function deleteMessageForMe(Message $message)
    {
        $user = Auth::user();

        if ($message->chat->user_one_id !== $user->id && $message->chat->user_two_id !== $user->id) {
            return response()->json(['error' => 'Niet geautoriseerd'], 403);
        }

        $deletedForUsers = $message->deleted_for_users ?? [];
        if (!in_array($user->id, $deletedForUsers)) {
            $deletedForUsers[] = $user->id;
            $message->deleted_for_users = $deletedForUsers;
            $message->save();
        }

        return response()->json(['success' => true, 'message' => 'Bericht verwijderd']);
    }

    /**
     * Delete message for everyone.
     */
    public function deleteMessageForEveryone(Message $message)
    {
        $user = Auth::user();

        if ($message->user_id !== $user->id) {
            return response()->json(['error' => 'Alleen de afzender kan dit doen'], 403);
        }

        $message->deleted_at = now();
        $message->save();

        return response()->json(['success' => true, 'message' => 'Bericht verwijderd']);
    }

    /**
     * Edit a message.
     */
    public function editMessage(Request $request, Message $message)
    {
        $user = Auth::user();

        if ($message->user_id !== $user->id) {
            return response()->json(['error' => 'Alleen de afzender kan dit doen'], 403);
        }

        if ($message->deleted_at) {
            return response()->json(['error' => 'Verwijderde berichten kunnen niet bewerkt worden'], 400);
        }

        $validated = $request->validate([
            'message' => 'required|string|max:10000',
        ]);

        if (!$message->original_message) {
            $message->original_message = $message->message;
        }

        $message->message = $validated['message'];
        $message->edited_at = now();
        $message->save();

        return response()->json([
            'success' => true,
            'message' => $message->message,
            'edited_at' => $message->edited_at->toIso8601String(),
        ]);
    }

    /**
     * Add reaction to message.
     */
    public function addReaction(Request $request, Message $message)
    {
        $user = Auth::user();

        if ($message->chat->user_one_id !== $user->id && $message->chat->user_two_id !== $user->id) {
            return response()->json(['error' => 'Niet geautoriseerd'], 403);
        }

        $validated = $request->validate([
            'emoji' => 'required|string|max:10',
        ]);

        $existingReaction = Reaction::where('message_id', $message->id)
            ->where('user_id', $user->id)
            ->where('emoji', $validated['emoji'])
            ->first();

        if ($existingReaction) {
            return response()->json(['error' => 'Al gereageerd met deze emoji'], 422);
        }

        $reaction = Reaction::create([
            'message_id' => $message->id,
            'user_id' => $user->id,
            'emoji' => $validated['emoji'],
        ]);

        return response()->json([
            'success' => true,
            'reaction' => [
                'emoji' => $reaction->emoji,
                'user_id' => $user->id,
            ],
        ]);
    }

    /**
     * Remove reaction from message.
     */
    public function removeReaction(Message $message, string $emoji)
    {
        $user = Auth::user();

        if ($message->chat->user_one_id !== $user->id && $message->chat->user_two_id !== $user->id) {
            return response()->json(['error' => 'Niet geautoriseerd'], 403);
        }

        $reaction = Reaction::where('message_id', $message->id)
            ->where('user_id', $user->id)
            ->where('emoji', urldecode($emoji))
            ->first();

        if (!$reaction) {
            return response()->json(['error' => 'Reactie niet gevonden'], 404);
        }

        $reaction->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Get all users for starting new chats.
     */
    public function getUsers()
    {
        $user = Auth::user();
        
        $users = User::where('id', '!=', $user->id)
            ->select('id', 'name', 'email')
            ->get();

        return response()->json(['users' => $users]);
    }

    /**
     * Send push notification to user about new message.
     */
    private function sendPushNotification(User $recipient, User $sender, Message $message): void
    {
        // Don't send notifications if user has no subscriptions
        if ($recipient->pushSubscriptions->isEmpty()) {
            return;
        }

        // Create notification content
        $title = "💬 Nieuw bericht van {$sender->name}";
        
        if ($message->attachment_type) {
            $body = $message->message 
                ? "{$message->message} 📷"  
                : "📷 Foto";
        } else {
            $body = $message->message ?: "Nieuw bericht";
        }

        // Limit body length
        if (strlen($body) > 100) {
            $body = substr($body, 0, 97) . '...';
        }

        $data = [
            'url' => '/chat',
            'chat_id' => $message->chat_id,
            'message_id' => $message->id,
            'sender_id' => $sender->id,
            'sender_name' => $sender->name,
        ];

        // Queue push notification for each subscription
        foreach ($recipient->pushSubscriptions as $subscription) {
            SendPushNotification::dispatch($subscription, $title, $body, $data);
        }
    }
}
