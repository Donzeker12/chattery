<?php

namespace App\Http\Controllers;

use App\Jobs\SendFcmNotification;
use App\Jobs\SendPushNotification;
use App\Models\Chat;
use App\Models\Message;
use App\Models\Reaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class ChatController extends Controller
{
    /**
     * Show the chat interface.
     */
    public function index(Request $request): Response
    {
        $user = Auth::user();
        $onlineThreshold = now()->subMinutes(5);
        
        // Get all chats for the authenticated user with latest message
        $chats = Chat::where('user_one_id', $user->id)
            ->orWhere('user_two_id', $user->id)
            ->with(['userOne', 'userTwo', 'latestMessage'])
            ->get()
            ->filter(function ($chat) use ($user) {
                // Filter out chats hidden by this user
                $hiddenForUsers = $chat->hidden_for_users ?? [];
                return !in_array($user->id, $hiddenForUsers);
            })
            ->map(function ($chat) use ($user, $onlineThreshold) {
                $otherUser = $chat->otherParticipant($user->id);
                $isOnline = $otherUser->last_seen_at && $otherUser->last_seen_at >= $onlineThreshold;
                
                return [
                    'id' => $chat->id,
                    'participant' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'is_online' => $isOnline,
                        'created_at' => $otherUser->created_at?->toIso8601String(),
                        'profile_photo_url' => $otherUser->profile_photo_path ? asset('storage/' . $otherUser->profile_photo_path) : null,
                    ],
                    'latest_message' => $chat->latestMessage ? [
                        'message' => $chat->latestMessage->message,
                        'created_at' => $chat->latestMessage->created_at,
                        'is_mine' => $chat->latestMessage->user_id === $user->id,
                    ] : null,
                    'unread_count' => $chat->unreadMessagesCount($user->id),
                ];
            })
            ->sortByDesc(function ($chat) {
                return $chat['latest_message']['created_at']?->timestamp ?? 0;
            })
            ->values()
            ->toArray();

        // Get all users except the authenticated user for starting new chats
        // Note: We'll load users via search instead of showing all users
        $users = [];

        return Inertia::render('Chat/Index', [
            'chats' => $chats,
            'users' => $users,
            'auth' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_admin' => $user->is_admin,
                    'profile_photo_url' => $user->profile_photo_path ? asset('storage/' . $user->profile_photo_path) : null,
                ],
            ],
        ]);
    }

    /**
     * Get messages for a specific chat.
     */
    public function show(Chat $chat)
    {
        $user = Auth::user();
        $onlineThreshold = now()->subMinutes(5);

        // Verify user is part of this chat
        if ($chat->user_one_id !== $user->id && $chat->user_two_id !== $user->id) {
            abort(403);
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
                // Filter out messages deleted for everyone
                if ($message->deleted_at) {
                    return false;
                }
                // Filter out messages deleted for this user
                $deletedForUsers = $message->deleted_for_users ?? [];
                if (in_array($user->id, $deletedForUsers)) {
                    return false;
                }
                // Filter out messages hidden for this user (when chat was deleted)
                $hiddenForUsers = $message->hidden_for_users ?? [];
                if (in_array($user->id, $hiddenForUsers)) {
                    return false;
                }
                return true;
            })
            ->map(function ($message) use ($user) {
                $isMine = $message->user_id === $user->id;
                $isViewOnce = (bool) $message->view_once;
                $viewOnceViewedBy = $message->view_once_viewed_by ?? [];
                // Sender: has the recipient seen it? (anyone in the array)
                // Receiver: have I already seen it?
                $viewOnceViewed = $isMine
                    ? !empty($viewOnceViewedBy)
                    : in_array($user->id, $viewOnceViewedBy);

                // For view_once images, only expose the URL to the sender
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
                    'created_at' => $message->created_at,
                    'edited_at' => $message->edited_at,
                    'user' => [
                        'name' => $message->user->name,
                    ],
                    'reactions' => $message->reactions->groupBy('emoji')->map(function ($reactions, $emoji) use ($user) {
                        return [
                            'emoji' => $emoji,
                            'count' => $reactions->count(),
                            'users' => $reactions->map(fn($r) => ['id' => $r->user_id, 'name' => $r->user->name])->values(),
                            'reacted_by_me' => $reactions->contains('user_id', $user->id),
                        ];
                    })->values(),
                ];
            })
            ->values();

        $otherUser = $chat->otherParticipant($user->id);
        $isOnline = $otherUser->last_seen_at && $otherUser->last_seen_at >= $onlineThreshold;

        return response()->json([
            'chat' => [
                'id' => $chat->id,
                'participant' => [
                    'id' => $otherUser->id,
                    'name' => $otherUser->name,
                    'is_online' => $isOnline,
                    'created_at' => $otherUser->created_at?->toIso8601String(),
                    'profile_photo_url' => $otherUser->profile_photo_path ? asset('storage/' . $otherUser->profile_photo_path) : null,
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

        // Verify user is part of this chat
        if ($chat->user_one_id !== $user->id && $chat->user_two_id !== $user->id) {
            abort(403);
        }

        $validated = $request->validate([
            'message' => 'nullable|string|max:5000',
            'attachment' => 'nullable|file|mimes:jpg,jpeg,png,gif,webp|max:10240', // Max 10MB
            'view_once' => 'nullable|boolean',
        ]);

        // Ensure at least message or attachment is provided
        if (empty($validated['message']) && !$request->hasFile('attachment')) {
            return response()->json(['error' => 'Message or attachment is required'], 422);
        }

        // view_once only makes sense for image attachments
        $viewOnce = $request->hasFile('attachment') && !empty($validated['view_once']);

        $attachmentPath = null;
        $attachmentType = null;

        // Handle file upload
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $filename = time() . '_' . $file->getClientOriginalName();
            $attachmentPath = $file->storeAs('chat-attachments', $filename, 'public');
            $attachmentType = 'image';
        }

        // If chat was hidden by either user, unhide it for both users
        if (!empty($chat->hidden_for_users)) {
            $chat->hidden_for_users = [];
            $chat->save();
        }

        $message = $chat->messages()->create([
            'user_id' => $user->id,
            'message' => $validated['message'] ?? '',
            'attachment_type' => $attachmentType,
            'attachment_path' => $attachmentPath,
            'view_once' => $viewOnce,
        ]);

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
                'created_at' => $message->created_at,
                'user' => [
                    'name' => $user->name,
                ],
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
            abort(403);
        }

        if (!$message->view_once) {
            return response()->json(['error' => 'Dit is geen eenmalig bericht'], 400);
        }

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

        // Check if chat already exists
        $chat = Chat::where(function ($query) use ($user, $otherUserId) {
            $query->where('user_one_id', $user->id)
                ->where('user_two_id', $otherUserId);
        })->orWhere(function ($query) use ($user, $otherUserId) {
            $query->where('user_one_id', $otherUserId)
                ->where('user_two_id', $user->id);
        })->first();

        // Create chat if it doesn't exist
        if (!$chat) {
            $chat = Chat::create([
                'user_one_id' => min($user->id, $otherUserId),
                'user_two_id' => max($user->id, $otherUserId),
            ]);
        } else {
            // If chat was hidden, unhide it for BOTH users (fresh start)
            if (!empty($chat->hidden_for_users)) {
                $chat->hidden_for_users = [];
                $chat->save();
            }
        }

        return response()->json([
            'chat_id' => $chat->id,
        ]);
    }

    /**
     * Get chat list for polling updates.
     */
    public function getChatList()
    {
        $user = Auth::user();
        $onlineThreshold = now()->subMinutes(5);
        
        // Get all chats for the authenticated user with latest message
        $chats = Chat::where('user_one_id', $user->id)
            ->orWhere('user_two_id', $user->id)
            ->with(['userOne', 'userTwo', 'latestMessage'])
            ->get()
            ->filter(function ($chat) use ($user) {
                // Filter out chats hidden by this user
                $hiddenForUsers = $chat->hidden_for_users ?? [];
                return !in_array($user->id, $hiddenForUsers);
            })
            ->map(function ($chat) use ($user, $onlineThreshold) {
                $otherUser = $chat->otherParticipant($user->id);
                $isOnline = $otherUser->last_seen_at && $otherUser->last_seen_at >= $onlineThreshold;
                
                return [
                    'id' => $chat->id,
                    'participant' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'is_online' => $isOnline,
                        'created_at' => $otherUser->created_at?->toIso8601String(),
                        'profile_photo_url' => $otherUser->profile_photo_path ? asset('storage/' . $otherUser->profile_photo_path) : null,
                    ],
                    'latest_message' => $chat->latestMessage ? [
                        'message' => $chat->latestMessage->message,
                        'created_at' => $chat->latestMessage->created_at,
                        'is_mine' => $chat->latestMessage->user_id === $user->id,
                    ] : null,
                    'unread_count' => $chat->unreadMessagesCount($user->id),
                ];
            })
            ->sortByDesc(function ($chat) {
                return $chat['latest_message']['created_at'] ?? $chat['id'];
            })
            ->values()
            ->toArray();

        return response()->json([
            'chats' => $chats,
        ]);
    }

    /**
     * Search users for starting new chats.
     */
    public function searchUsers(Request $request)
    {
        $user = Auth::user();
        $query = $request->get('query', '');
        
        if (strlen($query) < 2) {
            return response()->json(['users' => []]);
        }
        
        // Search only on name (not email), exclude hidden users and current user
        $users = User::where('id', '!=', $user->id)
            ->where('is_hidden', false)
            ->where(function ($q) use ($query) {
                $q->where('name', 'LIKE', $query . '%')
                  ->orWhere('name', 'LIKE', '% ' . $query . '%');
            })
            ->select('id', 'name', 'profile_photo_path')
            ->limit(10)
            ->get()
            ->map(function ($u) {
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'profile_photo_url' => $u->profile_photo_path ? asset('storage/' . $u->profile_photo_path) : null,
                ];
            })
            ->toArray();
        
        return response()->json(['users' => $users]);
    }

    /**
     * Delete message for me (alleen voor de ingelogde gebruiker).
     */
    public function deleteMessageForMe(Message $message)
    {
        $user = Auth::user();

        // Verify user is part of the chat
        if ($message->chat->user_one_id !== $user->id && $message->chat->user_two_id !== $user->id) {
            abort(403);
        }

        // Add user ID to deleted_for_users array
        $deletedForUsers = $message->deleted_for_users ?? [];
        if (!in_array($user->id, $deletedForUsers)) {
            $deletedForUsers[] = $user->id;
            $message->deleted_for_users = $deletedForUsers;
            $message->save();
        }

        return response()->json([
            'success' => true,
            'message' => 'Bericht verwijderd voor jou'
        ]);
    }

    /**
     * Delete message for everyone (alleen voor de afzender).
     */
    public function deleteMessageForEveryone(Message $message)
    {
        $user = Auth::user();

        // Only the sender can delete for everyone
        if ($message->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Je kunt alleen je eigen berichten voor iedereen verwijderen'
            ], 403);
        }

        // Mark as deleted for everyone
        $message->deleted_at = now();
        $message->save();

        return response()->json([
            'success' => true,
            'message' => 'Bericht verwijderd voor iedereen'
        ]);
    }

    /**
     * Edit a message (alleen voor de afzender).
     */
    public function editMessage(Request $request, Message $message)
    {
        $user = Auth::user();

        // Only the sender can edit
        if ($message->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Je kunt alleen je eigen berichten bewerken'
            ], 403);
        }

        // Cannot edit deleted messages
        if ($message->deleted_at) {
            return response()->json([
                'success' => false,
                'message' => 'Verwijderde berichten kunnen niet bewerkt worden'
            ], 400);
        }

        $validated = $request->validate([
            'message' => 'required|string|max:10000',
        ]);

        // Save original message if not already saved
        if (!$message->original_message) {
            $message->original_message = $message->message;
        }

        // Update message
        $message->message = $validated['message'];
        $message->edited_at = now();
        $message->save();

        return response()->json([
            'success' => true,
            'message' => 'Bericht bewerkt',
            'updated_message' => [
                'id' => $message->id,
                'message' => $message->message,
                'edited_at' => $message->edited_at,
            ]
        ]);
    }

    /**
     * Add a reaction to a message.
     */
    public function addReaction(Request $request, Message $message)
    {
        $user = Auth::user();

        // Verify user is part of the chat
        if ($message->chat->user_one_id !== $user->id && $message->chat->user_two_id !== $user->id) {
            abort(403);
        }

        // Validate emoji
        $validated = $request->validate([
            'emoji' => 'required|string|max:10',
        ]);

        // Check if reaction already exists (unique constraint)
        $existingReaction = Reaction::where('message_id', $message->id)
            ->where('user_id', $user->id)
            ->where('emoji', $validated['emoji'])
            ->first();

        if ($existingReaction) {
            return response()->json([
                'success' => false,
                'message' => 'Je hebt al met deze emoji gereageerd',
            ], 422);
        }

        // Create reaction
        $reaction = Reaction::create([
            'message_id' => $message->id,
            'user_id' => $user->id,
            'emoji' => $validated['emoji'],
        ]);

        // Load user relationship
        $reaction->load('user');

        return response()->json([
            'success' => true,
            'message' => 'Reactie toegevoegd',
            'reaction' => [
                'id' => $reaction->id,
                'emoji' => $reaction->emoji,
                'user' => [
                    'id' => $reaction->user->id,
                    'name' => $reaction->user->name,
                ],
            ],
        ]);
    }

    /**
     * Remove a reaction from a message.
     */
    public function removeReaction(Message $message, string $emoji)
    {
        $user = Auth::user();

        // Verify user is part of the chat
        if ($message->chat->user_one_id !== $user->id && $message->chat->user_two_id !== $user->id) {
            abort(403);
        }

        // Find and delete the reaction
        $reaction = Reaction::where('message_id', $message->id)
            ->where('user_id', $user->id)
            ->where('emoji', $emoji)
            ->first();

        if (!$reaction) {
            return response()->json([
                'success' => false,
                'message' => 'Reactie niet gevonden',
            ], 404);
        }

        $reaction->delete();

        return response()->json([
            'success' => true,
            'message' => 'Reactie verwijderd',
        ]);
    }

    /**
     * Delete a chat conversation.
     */
    public function deleteChat(Chat $chat)
    {
        $user = Auth::user();

        // Verify user is part of this chat
        if ($chat->user_one_id !== $user->id && $chat->user_two_id !== $user->id) {
            abort(403);
        }

        // Add user to hidden_for_users array for the chat
        $hiddenForUsers = $chat->hidden_for_users ?? [];
        
        if (!in_array($user->id, $hiddenForUsers)) {
            $hiddenForUsers[] = $user->id;
            $chat->hidden_for_users = $hiddenForUsers;
            $chat->save();
        }

        // Hide all messages in this chat for this user
        foreach ($chat->messages as $message) {
            $messageHiddenForUsers = $message->hidden_for_users ?? [];
            if (!in_array($user->id, $messageHiddenForUsers)) {
                $messageHiddenForUsers[] = $user->id;
                $message->hidden_for_users = $messageHiddenForUsers;
                $message->save();
            }
        }

        // If both users have hidden the chat, permanently delete it
        $bothUsersHidden = in_array($chat->user_one_id, $hiddenForUsers) && 
                          in_array($chat->user_two_id, $hiddenForUsers);
        
        if ($bothUsersHidden) {
            // Delete all messages and reactions using query builder (more efficient)
            // This cascades properly due to foreign key constraints
            $chat->messages()->delete();
            $chat->delete();
            
            return response()->json([
                'success' => true,
                'message' => 'Gesprek permanent verwijderd',
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Gesprek verborgen',
        ]);
    }

    /**
     * Send push notification to user about new message.
     */
    private function sendPushNotification(User $recipient, User $sender, Message $message): void
    {
        $webSubscriptions = $recipient->pushSubscriptions;
        $mobileTokens = $recipient->mobilePushTokens;

        // Don't send notifications if user has no supported subscriptions
        if ($webSubscriptions->isEmpty() && $mobileTokens->isEmpty()) {
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

        // Queue web push notifications for browser/PWA subscriptions
        foreach ($webSubscriptions as $subscription) {
            SendPushNotification::dispatch($subscription, $title, $body, $data);
        }

        // Queue native mobile push notifications for FCM tokens
        foreach ($mobileTokens as $mobileToken) {
            SendFcmNotification::dispatch($mobileToken, $title, $body, $data);
        }
    }

    /**
     * Get all media (images and files) from a chat.
     */
    public function getMedia(Request $request, Chat $chat)
    {
        $user = Auth::user();

        // Verify user is part of this chat
        if ($chat->user_one_id !== $user->id && $chat->user_two_id !== $user->id) {
            abort(403);
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

            // Never show view_once messages in gallery
            if ($message->view_once) {
                return false;
            }

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
