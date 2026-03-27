<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use Illuminate\Support\Facades\Route;

// Public API routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected API routes
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    
    // Chats
    Route::get('/chats', [ChatController::class, 'index']);
    Route::post('/chats/start', [ChatController::class, 'startChat']);
    
    // Messages
    Route::get('/chats/{chat}', [ChatController::class, 'show']);
    Route::post('/chats/{chat}/messages', [ChatController::class, 'sendMessage']);
    Route::put('/messages/{message}/edit', [ChatController::class, 'editMessage']);
    Route::delete('/messages/{message}/delete-for-me', [ChatController::class, 'deleteMessageForMe']);
    Route::delete('/messages/{message}/delete-for-everyone', [ChatController::class, 'deleteMessageForEveryone']);
    
    // Reactions
    Route::post('/messages/{message}/reactions', [ChatController::class, 'addReaction']);
    Route::delete('/messages/{message}/reactions/{emoji}', [ChatController::class, 'removeReaction']);
    
    // Users
    Route::get('/users', [ChatController::class, 'getUsers']);
});
