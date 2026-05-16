<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\MobilePushTokenController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PushNotificationController;
use App\Http\Controllers\CustomEmojiController;
use App\Http\Controllers\StoryController;
use Illuminate\Support\Facades\Route;

// Public API routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Push notifications VAPID key (public)
Route::get('/push/vapid-key', [PushNotificationController::class, 'getVapidPublicKey']);

// Protected API routes
Route::middleware(['auth:sanctum'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    
    // Profile
    Route::post('/profile/password', [ProfileController::class, 'changePassword']);
    Route::post('/profile/photo', [ProfileController::class, 'uploadPhoto']);
    Route::delete('/profile/photo', [ProfileController::class, 'deletePhoto']);
    Route::get('/profile/photo', [ProfileController::class, 'getPhotoUrl']);
    Route::post('/settings/preferences', [ProfileController::class, 'updatePreferences']);
    
    // Push notifications
    Route::post('/push/subscribe', [PushNotificationController::class, 'subscribe']);
    Route::post('/push/unsubscribe', [PushNotificationController::class, 'unsubscribe']);
    Route::post('/push/test', [PushNotificationController::class, 'test']);
    Route::post('/push/mobile-token', [MobilePushTokenController::class, 'store']);
    Route::delete('/push/mobile-token', [MobilePushTokenController::class, 'destroy']);
    
    // Chats
    Route::get('/chats', [ChatController::class, 'index']);
    Route::get('/chats/hidden', [ChatController::class, 'getHiddenChats']);
    Route::post('/chats/start', [ChatController::class, 'startChat']);
    Route::delete('/chats/{chat}', [ChatController::class, 'deleteChat']);
    Route::post('/chats/{chat}/hide', [ChatController::class, 'hideChat']);
    Route::post('/chats/{chat}/unhide', [ChatController::class, 'unhideChat']);
    
    // Messages
    Route::get('/chats/{chat}', [ChatController::class, 'show']);
    Route::get('/chats/{chat}/media', [ChatController::class, 'getMedia']);
    Route::post('/chats/{chat}/messages', [ChatController::class, 'sendMessage']);
    Route::put('/messages/{message}/edit', [ChatController::class, 'editMessage']);
    Route::delete('/messages/{message}/delete-for-me', [ChatController::class, 'deleteMessageForMe']);
    Route::delete('/messages/{message}/delete-for-everyone', [ChatController::class, 'deleteMessageForEveryone']);
    
    // Typing indicator
    Route::post('/chats/{chat}/typing', [ChatController::class, 'updateTypingStatus']);
    Route::get('/chats/{chat}/typing', [ChatController::class, 'getTypingStatus']);

    // Security events
    Route::post('/chats/{chat}/screenshot-attempt', [ChatController::class, 'reportScreenshotAttempt']);
    
    // Reactions
    Route::post('/messages/{message}/reactions', [ChatController::class, 'addReaction']);
    Route::delete('/messages/{message}/reactions/{emoji}', [ChatController::class, 'removeReaction']);

    // View once
    Route::post('/messages/{message}/view-once', [ChatController::class, 'viewOnce']);
    
    // Users
    Route::get('/users', [ChatController::class, 'getUsers']);

    // Stories
    Route::post('/stories', [StoryController::class, 'store']);
    Route::get('/stories/mine', [StoryController::class, 'mine']);
    Route::get('/stories', [StoryController::class, 'index']);
    Route::post('/stories/{story}/view', [StoryController::class, 'markViewed']);
    Route::post('/stories/{story}/reactions', [StoryController::class, 'addReaction']);
    Route::delete('/stories/{story}/reactions/{emoji}', [StoryController::class, 'removeReaction']);
    Route::put('/stories/{story}', [StoryController::class, 'update']);
    Route::delete('/stories/{story}', [StoryController::class, 'destroy']);

    // Custom emojis
    Route::get('/custom-emojis', [CustomEmojiController::class, 'index']);
    Route::post('/custom-emojis', [CustomEmojiController::class, 'store']);
    Route::delete('/custom-emojis/{customEmoji}', [CustomEmojiController::class, 'destroy']);
});
