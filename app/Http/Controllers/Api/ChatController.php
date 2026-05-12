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
use Illuminate\Support\Facades\Cache;
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
                        'profile_photo_url' => $otherUser->profile_photo_path
                            ? asset('storage/' . $otherUser->profile_photo_path)
                            : null,
                    ],
                    'latest_message' => $chat->latestMessage ? [
                        'message' => $chat->latestMessage->message,
                        'content' => $chat->latestMessage->message, // Add content field for frontend compatibility
                        'attachment_url' => $chat->latestMessage->attachment_path ? asset('storage/' . $chat->latestMessage->attachment_path) : null,
                        'attachment_type' => $chat->latestMessage->attachment_type,
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
     * Supports cursor-based pagination via query params:
     *   before_id — load older messages (load more)
     *   after_id  — load newer messages (auto-refresh polling)
     */
    public function show(Request $request, Chat $chat)
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

        $perPage = 30;
        $beforeId = $request->query('before_id');
        $afterId  = $request->query('after_id');

        $query = $chat->messages()
            ->with(['user', 'reactions.user', 'replyTo.user']);

        if ($afterId) {
            // Poll for new messages only (no limit needed)
            $query->where('id', '>', (int) $afterId)
                  ->orderBy('created_at', 'asc');
            $rawMessages = $query->get();
            $hasMore = false;
        } elseif ($beforeId) {
            // Load older messages (paginated)
            $query->where('id', '<', (int) $beforeId)
                  ->orderBy('created_at', 'desc')
                  ->limit($perPage + 1);
            $rawMessages = $query->get();
            $hasMore = $rawMessages->count() > $perPage;
            if ($hasMore) {
                $rawMessages = $rawMessages->slice(0, $perPage);
            }
            $rawMessages = $rawMessages->sortBy('created_at')->values();
        } else {
            // Initial load: latest messages
            $query->orderBy('created_at', 'desc')
                  ->limit($perPage + 1);
            $rawMessages = $query->get();
            $hasMore = $rawMessages->count() > $perPage;
            if ($hasMore) {
                $rawMessages = $rawMessages->slice(0, $perPage);
            }
            $rawMessages = $rawMessages->sortBy('created_at')->values();
        }

        $messages = $rawMessages
            ->filter(function ($message) use ($user) {
                if ($message->deleted_at) return false;
                $deletedForUsers = $message->deleted_for_users ?? [];
                if (in_array($user->id, $deletedForUsers)) return false;
                return true;
            })
            ->map(function ($message) use ($user) {
                $isMine = $message->user_id === $user->id;
                $isViewOnce = (bool) $message->view_once;
                $viewOnceViewedBy = $message->view_once_viewed_by ?? [];
                $viewOnceViewed = $isMine
                    ? !empty($viewOnceViewedBy)
                    : in_array($user->id, $viewOnceViewedBy);

                $attachmentUrl = null;
                if ($message->attachment_path) {
                    if (!$isViewOnce || $isMine) {
                        $attachmentUrl = asset('storage/' . $message->attachment_path);
                    }
                }

                return [
                    'id' => $message->id,
                    'message' => $message->message,
                    'content' => $message->message,
                    'attachment_type' => $message->attachment_type,
                    'attachment_url' => $attachmentUrl,
                    'view_once' => $isViewOnce,
                    'view_once_viewed' => $viewOnceViewed,
                    'is_mine' => $isMine,
                    'created_at' => $message->created_at->toIso8601String(),
                    'edited_at' => $message->edited_at?->toIso8601String(),
                    'user' => [
                        'name' => $message->user->name,
                    ],
                    'reply_to' => $message->replyTo ? [
                        'id' => $message->replyTo->id,
                        'message' => $message->replyTo->message,
                        'user_name' => $message->replyTo->user->name ?? 'Onbekend',
                        'attachment_type' => $message->replyTo->attachment_type,
                    ] : null,
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
                    'profile_photo_url' => $otherUser->profile_photo_path
                        ? asset('storage/' . $otherUser->profile_photo_path)
                        : null,
                ],
            ],
            'messages' => $messages,
            'has_more' => $hasMore,
        ]);
    }

    /**
     * Get all media (images and files) from a chat.
     */
    public function getMedia(Request $request, Chat $chat)
    {
        $user = Auth::user();

        // Verify user is part of this chat
        if ($chat->user_one_id !== $user->id && $chat->user_two_id !== $user->id) {
            return response()->json(['error' => 'Niet geautoriseerd'], 403);
        }

        // Get filter type from request (all, images, files)
        $type = $request->get('type', 'all');

        // Get all messages with attachments
        $query = $chat->messages()
            ->whereNotNull('attachment_path')
            ->whereNull('deleted_at')
            ->with('user')
            ->orderBy('created_at', 'desc');

        // Apply type filter
        if ($type === 'images') {
            $query->where('attachment_type', 'image');
        } elseif ($type === 'files') {
            $query->where('attachment_type', 'file');
        }

        $mediaMessages = $query->get()->filter(function ($message) use ($user) {
            // Filter out messages deleted or hidden for this user
            $deletedForUsers = $message->deleted_for_users ?? [];
            $hiddenForUsers = $message->hidden_for_users ?? [];
            
            return !in_array($user->id, $deletedForUsers) && !in_array($user->id, $hiddenForUsers);
        })->map(function ($message) {
            return [
                'id' => $message->id,
                'type' => $message->attachment_type,
                'url' => asset('storage/' . $message->attachment_path),
                'message' => $message->message,
                'created_at' => $message->created_at->format('d-m-Y H:i'),
                'user' => [
                    'id' => $message->user->id,
                    'name' => $message->user->name,
                ],
            ];
        })->values();

        return response()->json([
            'media' => $mediaMessages,
            'total' => $mediaMessages->count(),
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
            'view_once' => 'nullable|boolean',
            'reply_to_id' => 'nullable|integer|exists:messages,id',
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

        // view_once only makes sense when sending an image
        $viewOnce = $hasAttachment && !empty($validated['view_once']);

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
            'view_once' => $viewOnce,
            'reply_to_id' => $validated['reply_to_id'] ?? null,
        ]);

        $message->load('replyTo.user');

        // Send push notifications to other participant
        $otherUser = $chat->otherParticipant($user->id);
        $this->sendPushNotification($otherUser, $user, $message);

        return response()->json([
            'message' => [
                'id' => $message->id,
                'message' => $message->message,
                'attachment_type' => $message->attachment_type,
                'attachment_url' => $message->attachment_path ? asset('storage/' . $message->attachment_path) : null,
                'view_once' => $message->view_once,
                'view_once_viewed' => false,
                'is_mine' => true,
                'created_at' => $message->created_at->toIso8601String(),
                'user' => [
                    'name' => $user->name,
                ],
                'reply_to' => $message->replyTo ? [
                    'id' => $message->replyTo->id,
                    'message' => $message->replyTo->message,
                    'user_name' => $message->replyTo->user->name ?? 'Onbekend',
                    'attachment_type' => $message->replyTo->attachment_type,
                ] : null,
                'reactions' => [],
            ],
        ]);
    }

    /**
     * Mark a view-once image as viewed and return its URL.
     */
    public function viewOnce(Message $message)
    {
        $user = Auth::user();

        // Verify user is part of the chat
        if ($message->chat->user_one_id !== $user->id && $message->chat->user_two_id !== $user->id) {
            return response()->json(['error' => 'Niet geautoriseerd'], 403);
        }

        if (!$message->view_once) {
            return response()->json(['error' => 'Dit is geen eenmalig bericht'], 400);
        }

        // The sender cannot use this endpoint (they already know the image)
        if ($message->user_id === $user->id) {
            return response()->json(['error' => 'Afzenders kunnen dit bericht niet als eenmalig bekijken'], 400);
        }

        $viewedBy = $message->view_once_viewed_by ?? [];

        if (in_array($user->id, $viewedBy)) {
            return response()->json(['error' => 'Je hebt dit bericht al bekeken'], 409);
        }

        if (!$message->attachment_path) {
            return response()->json(['error' => 'Geen bijlage gevonden'], 404);
        }

        $url = asset('storage/' . $message->attachment_path);

        // Mark as viewed
        $viewedBy[] = $user->id;
        $message->view_once_viewed_by = $viewedBy;
        $message->save();

        return response()->json(['url' => $url]);
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
            ->select('id', 'name', 'email', 'profile_photo_path')
            ->get()
            ->map(function ($u) {
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'profile_photo_url' => $u->profile_photo_path ? asset('storage/' . $u->profile_photo_path) : null,
                ];
            });

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

    /**
     * Update typing status for a user in a chat.
     */
    public function updateTypingStatus(Request $request, Chat $chat)
    {
        $user = Auth::user();

        // Verify user is part of this chat
        if ($chat->user_one_id !== $user->id && $chat->user_two_id !== $user->id) {
            abort(403);
        }

        $validated = $request->validate([
            'is_typing' => 'required|boolean',
        ]);

        $cacheKey = "chat.{$chat->id}.user.{$user->id}.typing";

        if ($validated['is_typing']) {
            // Set typing status for 5 seconds
            Cache::put($cacheKey, true, now()->addSeconds(5));
        } else {
            // Remove typing status
            Cache::forget($cacheKey);
        }

        return response()->json([
            'success' => true,
        ]);
    }

    /**
     * Get typing status for a chat (check if other user is typing).
     */
    public function getTypingStatus(Chat $chat)
    {
        $user = Auth::user();

        // Verify user is part of this chat
        if ($chat->user_one_id !== $user->id && $chat->user_two_id !== $user->id) {
            abort(403);
        }

        // Get the other user
        $otherUserId = $chat->user_one_id === $user->id ? $chat->user_two_id : $chat->user_one_id;
        $cacheKey = "chat.{$chat->id}.user.{$otherUserId}.typing";

        $isTyping = Cache::has($cacheKey);

        return response()->json([
            'is_typing' => $isTyping,
        ]);
    }
}
