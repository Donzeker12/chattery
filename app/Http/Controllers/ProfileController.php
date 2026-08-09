<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\File;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function complete(): Response|\Illuminate\Http\RedirectResponse
    {
        if (! Auth::user()->requiresProfileCompletion()) {
            return redirect('/chat');
        }

        return Inertia::render('Profile/Complete');
    }

    /**
     * Display the profile page.
     */
    public function index()
    {
        return Inertia::render('Profile/Index');
    }

    /**
     * Upload or update profile photo.
     */
    public function uploadPhoto(Request $request)
    {
        $request->validate([
            'photo' => ['required', File::image()->max(5 * 1024)], // Max 5MB
        ]);

        $user = Auth::user();

        // Delete old profile photo if exists
        if ($user->profile_photo_path) {
            Storage::disk('public')->delete($user->profile_photo_path);
        }

        // Store new photo
        $file = $request->file('photo');
        $filename = 'profile_' . $user->id . '_' . time() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('profile-photos', $filename, 'public');

        // Update user record
        $user->profile_photo_path = $path;
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Profielfoto succesvol geüpload',
            'photo_url' => asset('storage/' . $path),
        ]);
    }

    /**
     * Delete profile photo.
     */
    public function deletePhoto()
    {
        $user = Auth::user();

        if ($user->profile_photo_path) {
            Storage::disk('public')->delete($user->profile_photo_path);
            $user->profile_photo_path = null;
            $user->save();
        }

        return response()->json([
            'success' => true,
            'message' => 'Profielfoto verwijderd',
        ]);
    }

    /**
     * Get profile photo URL.
     */
    public function getPhotoUrl()
    {
        $user = Auth::user();

        return response()->json([
            'photo_url' => $user->profile_photo_path 
                ? asset('storage/' . $user->profile_photo_path) 
                : null,
        ]);
    }

    /**
     * Update profile classification details.
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'profile_type' => ['required', Rule::in(['individual', 'couple'])],
            'gender' => [
                'nullable',
                Rule::requiredIf($request->input('profile_type') === 'individual'),
                Rule::in(['male', 'female', 'other']),
            ],
        ]);

        if ($validated['profile_type'] === 'couple') {
            $validated['gender'] = null;
        }

        $user = Auth::user();
        $user->fill($validated);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Profielgegevens opgeslagen',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_admin' => $user->is_admin,
                'profile_type' => $user->profile_type,
                'gender' => $user->gender,
                'profile_photo_url' => $user->profile_photo_path
                    ? asset('storage/' . $user->profile_photo_path)
                    : null,
            ],
        ]);
    }

    /**
     * Change user password.
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required',
            'password' => 'required|min:8|confirmed',
        ], [
            'current_password.required' => 'Huidig wachtwoord is verplicht',
            'password.required' => 'Nieuw wachtwoord is verplicht',
            'password.min' => 'Nieuw wachtwoord moet minimaal 8 karakters bevatten',
            'password.confirmed' => 'Wachtwoord bevestiging komt niet overeen',
        ]);

        $user = Auth::user();

        // Verify current password
        if (!Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Het huidige wachtwoord is incorrect']
            ]);
        }

        // Update password
        $user->update([
            'password' => Hash::make($request->password)
        ]);

        return back()->with('success', 'Wachtwoord succesvol gewijzigd!');
    }

    /**
     * Update user UI preferences.
     */
    public function updatePreferences(Request $request)
    {
        $validated = $request->validate([
            'chat_theme' => 'sometimes|string|in:default,dark,nature,sunset,ocean,lavender',
            'dark_mode' => 'sometimes|boolean',
            'chat_animations' => 'sometimes|boolean',
            'sound_notifications' => 'sometimes|boolean',
            'show_typing_indicator' => 'sometimes|boolean',
        ]);

        $user = Auth::user();
        $user->fill($validated);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Instellingen opgeslagen',
            'preferences' => [
                'chat_theme' => $user->chat_theme ?? 'default',
                'dark_mode' => (bool) $user->dark_mode,
                'chat_animations' => (bool) $user->chat_animations,
                'sound_notifications' => (bool) $user->sound_notifications,
                'show_typing_indicator' => (bool) $user->show_typing_indicator,
            ],
        ]);
    }
}
