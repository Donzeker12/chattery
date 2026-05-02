<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Public routes
Route::get('/', function () {
    if (auth()->check()) {
        return redirect('/chat');
    }
    return redirect('/login');
})->name('home');

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1'); // Max 10 attempts per minute
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1'); // Max 5 registrations per minute
});

// Protected routes
Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    
    // Profile routes
    Route::get('/profile', [ProfileController::class, 'index'])->name('profile');
    Route::post('/profile/photo', [ProfileController::class, 'uploadPhoto'])->name('profile.photo.upload');
    Route::delete('/profile/photo', [ProfileController::class, 'deletePhoto'])->name('profile.photo.delete');
    Route::get('/profile/photo', [ProfileController::class, 'getPhotoUrl'])->name('profile.photo.get');
    Route::post('/profile/password', [ProfileController::class, 'changePassword'])->name('profile.password.change');
    
    Route::get('/chat', [ChatController::class, 'index'])->name('chat');
    Route::get('/chat/list', [ChatController::class, 'getChatList'])->name('chat.list');
    Route::get('/chat/search-users', [ChatController::class, 'searchUsers'])->name('chat.search-users');
    Route::get('/chat/{chat}', [ChatController::class, 'show'])->name('chat.show');
    Route::post('/chat/{chat}/message', [ChatController::class, 'sendMessage'])->name('chat.message');
    Route::post('/chat/start', [ChatController::class, 'startChat'])->name('chat.start');
    Route::delete('/chat/{chat}', [ChatController::class, 'deleteChat'])->name('chat.delete');
    
    // Push notifications
    Route::get('/push/vapid-key', [App\Http\Controllers\PushNotificationController::class, 'getVapidPublicKey'])->name('push.vapid-key');
    Route::post('/push/subscribe', [App\Http\Controllers\PushNotificationController::class, 'subscribe'])->name('push.subscribe');
    Route::post('/push/unsubscribe', [App\Http\Controllers\PushNotificationController::class, 'unsubscribe'])->name('push.unsubscribe');
    
    // Message actions
    Route::delete('/message/{message}/delete-for-me', [ChatController::class, 'deleteMessageForMe'])->name('message.delete-for-me');
    Route::delete('/message/{message}/delete-for-everyone', [ChatController::class, 'deleteMessageForEveryone'])->name('message.delete-for-everyone');
    Route::put('/message/{message}/edit', [ChatController::class, 'editMessage'])->name('message.edit');
    
    // Message reactions
    Route::post('/message/{message}/reaction', [ChatController::class, 'addReaction'])->name('message.reaction.add');
    Route::delete('/message/{message}/reaction/{emoji}', [ChatController::class, 'removeReaction'])->name('message.reaction.remove');
});

// Admin routes - Rate limited and secured
Route::middleware(['auth', 'admin', 'throttle:60,1'])->group(function () {
    Route::get('/admin', [AdminController::class, 'index'])->name('admin');
    Route::post('/admin/ban/{user}', [AdminController::class, 'banUser'])->name('admin.ban');
    Route::post('/admin/unban/{user}', [AdminController::class, 'unbanUser'])->name('admin.unban');
});
