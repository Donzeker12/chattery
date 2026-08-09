<?php

namespace App\Http\Controllers;

use App\Models\AdminLog;
use App\Models\FailedLoginAttempt;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller
{
    /**
     * Show the login form.
     */
    public function showLogin(): Response
    {        
        return Inertia::render('Auth/Login', [
            'auth' => [
                'user' => Auth::user()
            ]
        ]);
    }

    /**
     * Show the registration form.
     */
    public function showRegister(): Response
    {
        return Inertia::render('Auth/Register', [
            'auth' => [
                'user' => Auth::user()
            ]
        ]);
    }

    /**
     * Handle user login.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $ipAddress = $request->ip();
        $email = $request->email;

        // Check if IP is currently blocked
        $blockedAttempt = FailedLoginAttempt::where('ip_address', $ipAddress)
            ->where('blocked_until', '>', now())
            ->first();

        if ($blockedAttempt) {
            $minutesRemaining = now()->diffInMinutes($blockedAttempt->blocked_until);
            throw ValidationException::withMessages([
                'email' => "Te veel login pogingen. Probeer het over {$minutesRemaining} minuten opnieuw.",
            ]);
        }

        // Check failed attempts in last 15 minutes
        $recentAttempts = FailedLoginAttempt::where('ip_address', $ipAddress)
            ->where('attempted_at', '>', now()->subMinutes(15))
            ->count();

        if ($recentAttempts >= 5) {
            // Block IP for 30 minutes after 5 failed attempts
            FailedLoginAttempt::create([
                'ip_address' => $ipAddress,
                'email' => $email,
                'user_agent' => $request->userAgent(),
                'attempted_at' => now(),
                'blocked_until' => now()->addMinutes(30),
            ]);

            throw ValidationException::withMessages([
                'email' => 'Te veel login pogingen. Je IP is geblokkeerd voor 30 minuten.',
            ]);
        }

        // Check if user exists and is banned
        $user = User::where('email', $email)->first();
        if ($user && !is_null($user->banned_at)) {
            throw ValidationException::withMessages([
                'email' => 'Je account is gebanned en je kunt niet meer inloggen.',
            ]);
        }

        // Attempt login
        if (Auth::attempt($request->only('email', 'password'), $request->boolean('remember'))) {
            $request->session()->regenerate();

            // Clear old failed attempts for this IP
            FailedLoginAttempt::where('ip_address', $ipAddress)
                ->where('email', $email)
                ->delete();

            // Log admin login if user is admin
            if (Auth::user()->is_admin) {
                AdminLog::create([
                    'admin_user_id' => Auth::id(),
                    'action' => 'login',
                    'ip_address' => $ipAddress,
                    'user_agent' => $request->userAgent(),
                ]);
            }

            if (Auth::user()->requiresProfileCompletion()) {
                return redirect()->route('profile.complete');
            }

            return redirect()->intended('/chat');
        }

        // Log failed attempt
        FailedLoginAttempt::create([
            'ip_address' => $ipAddress,
            'email' => $email,
            'user_agent' => $request->userAgent(),
            'attempted_at' => now(),
        ]);

        throw ValidationException::withMessages([
            'email' => 'De ingevoerde gegevens zijn onjuist.',
        ]);
    }

    /**
     * Handle user registration.
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'profile_type' => ['required', Rule::in(['individual', 'couple'])],
            'gender' => [
                'nullable',
                Rule::requiredIf($request->input('profile_type') === 'individual'),
                Rule::in(['male', 'female', 'other']),
            ],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'profile_type' => $validated['profile_type'],
            'gender' => $validated['profile_type'] === 'couple' ? null : $validated['gender'],
        ]);

        Auth::login($user);

        return redirect('/chat');
    }

    /**
     * Handle user logout.
     */
    public function logout(Request $request)
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }
}
