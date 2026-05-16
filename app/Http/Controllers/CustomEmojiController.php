<?php

namespace App\Http\Controllers;

use App\Models\CustomEmoji;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CustomEmojiController extends Controller
{
    public function index()
    {
        $emojis = CustomEmoji::orderBy('name')->get()->map(fn($e) => [
            'id'   => $e->id,
            'name' => $e->name,
            'url'  => asset('storage/' . $e->image_path),
        ]);

        return response()->json($emojis);
    }

    public function store(Request $request)
    {
        if (!Auth::user()->is_admin) {
            return response()->json(['message' => 'Geen toegang'], 403);
        }

        $request->validate([
            'name'  => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_]+$/', 'unique:custom_emojis,name'],
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,gif,webp', 'max:2048'],
        ], [
            'name.regex'  => 'Naam mag alleen kleine letters, cijfers en underscores bevatten.',
            'name.unique' => 'Er bestaat al een emoji met deze naam.',
        ]);

        $path = $request->file('image')->store('custom-emojis', 'public');

        $emoji = CustomEmoji::create([
            'name'       => $request->input('name'),
            'image_path' => $path,
            'created_by' => Auth::id(),
        ]);

        return response()->json([
            'id'   => $emoji->id,
            'name' => $emoji->name,
            'url'  => asset('storage/' . $emoji->image_path),
        ], 201);
    }

    public function destroy(CustomEmoji $customEmoji)
    {
        if (!Auth::user()->is_admin) {
            return response()->json(['message' => 'Geen toegang'], 403);
        }

        Storage::disk('public')->delete($customEmoji->image_path);
        $customEmoji->delete();

        return response()->json(['success' => true]);
    }
}
