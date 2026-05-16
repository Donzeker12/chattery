<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Story;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use App\Models\StoryImage;

class StoryController extends Controller
{
    public function store(Request $request)
    {
        if (!in_array(Auth::user()->account_type, ['model', 'admin'])) {
            return response()->json(['message' => 'Alleen modellen of admins kunnen verhalen plaatsen.'], 403);
        }
        $request->validate([
            'content' => 'required|string|max:500',
            'images' => 'nullable|array|max:10',
            'images.*' => 'image|max:20480',
        ]);

        $story = Story::create([
            'user_id' => Auth::id(),
            'content' => $request->input('content'),
        ]);

        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $file) {
                $imagePath = $file->store('stories', 'public');
                StoryImage::create([
                    'story_id' => $story->id,
                    'image_path' => $imagePath,
                ]);
            }
        }

        $story->load(['user:id,name,profile_photo_path', 'images']);

        return response()->json(['message' => 'Story created successfully', 'story' => $this->formatStory($story)], 201);
    }

    public function index()
    {
        $userId = Auth::id();

        $chatUserIds = Chat::query()
            ->where('user_one_id', $userId)
            ->orWhere('user_two_id', $userId)
            ->get(['user_one_id', 'user_two_id'])
            ->flatMap(function (Chat $chat) use ($userId) {
                return [$chat->user_one_id, $chat->user_two_id];
            })
            ->filter(fn ($id) => $id !== $userId)
            ->unique()
            ->values();

        $viewedStoryIds = DB::table('story_views')
            ->where('viewer_user_id', $userId)
            ->pluck('story_id')
            ->flip();

        $stories = Story::with('user:id,name,profile_photo_path')
            ->whereIn('user_id', $chatUserIds)
            ->latest()
            ->get()
            ->map(fn (Story $story) => $this->formatStory($story, $viewedStoryIds->has($story->id)));

        return response()->json($stories->values());
    }

    public function mine()
    {
        $stories = Story::with('user:id,name,profile_photo_path')
            ->where('user_id', Auth::id())
            ->latest()
            ->get()
            ->map(fn (Story $story) => $this->formatStory($story));

        return response()->json($stories->values());
    }

    public function update(Request $request, int $storyId)
    {
        if (!in_array(Auth::user()->account_type, ['model', 'admin'])) {
            return response()->json(['message' => 'Alleen modellen of admins kunnen verhalen bewerken.'], 403);
        }
        $story = Story::where('id', $storyId)
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $validated = $request->validate([
            'content' => 'required|string|max:500',
            'images' => 'nullable|array|max:10',
            'images.*' => 'image|max:20480',
            'remove_image_ids' => 'nullable|array',
            'remove_image_ids.*' => 'integer|exists:story_images,id,story_id,'.$story->id,
        ]);

        $story->update([
            'content' => $validated['content'],
        ]);

        // Remove selected images
        if (!empty($validated['remove_image_ids'])) {
            $imagesToRemove = StoryImage::whereIn('id', $validated['remove_image_ids'])->where('story_id', $story->id)->get();
            foreach ($imagesToRemove as $img) {
                Storage::disk('public')->delete($img->image_path);
                $img->delete();
            }
        }

        // Add new images
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $file) {
                $imagePath = $file->store('stories', 'public');
                StoryImage::create([
                    'story_id' => $story->id,
                    'image_path' => $imagePath,
                ]);
            }
        }

        $story->load(['user:id,name,profile_photo_path', 'images']);

        return response()->json([
            'message' => 'Verhaal bijgewerkt',
            'story' => $this->formatStory($story),
        ]);
    }

    public function destroy(int $storyId)
    {
        $story = Story::where('id', $storyId)
            ->where('user_id', Auth::id())
            ->firstOrFail();

        // Delete all images
        foreach ($story->images as $img) {
            Storage::disk('public')->delete($img->image_path);
            $img->delete();
        }

        $story->delete();

        return response()->json([
            'message' => 'Verhaal verwijderd',
        ]);
    }

    private function formatStory(Story $story, bool $isViewed = false): array
    {
        return [
            'id' => $story->id,
            'content' => $story->content,
            'images' => $story->images->map(fn($img) => [
                'id' => $img->id,
                'url' => asset('storage/' . $img->image_path),
            ])->toArray(),
            'created_at' => $story->created_at,
            'user_id' => $story->user_id,
            'is_viewed' => $isViewed,
            'user' => [
                'id' => $story->user?->id,
                'name' => $story->user?->name,
                'profile_photo_url' => $story->user?->profile_photo_path
                    ? asset('storage/' . $story->user->profile_photo_path)
                    : null,
            ],
        ];
    }

    public function markViewed(Story $story)
    {
        DB::table('story_views')->insertOrIgnore([
            'story_id' => $story->id,
            'viewer_user_id' => Auth::id(),
            'viewed_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }
}