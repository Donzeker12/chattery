<?php

namespace App\Http\Middleware;

use App\Models\AdminLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class IsAdmin
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Check if user is authenticated
        if (!Auth::check()) {
            abort(403, 'Niet ingelogd.');
        }

        $user = Auth::user();

        // Check if user is admin
        if (!$user->is_admin) {
            // Log unauthorized access attempt
            AdminLog::create([
                'admin_user_id' => $user->id,
                'action' => 'unauthorized_access_attempt',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'details' => [
                    'url' => $request->fullUrl(),
                    'method' => $request->method(),
                ],
            ]);

            abort(403, 'Geen toegang. Alleen admins hebben toegang tot deze pagina.');
        }

        // Check if user is banned
        if ($user->banned_at) {
            Auth::logout();
            abort(403, 'Je account is gebanned.');
        }

        // Log admin access
        AdminLog::create([
            'admin_user_id' => $user->id,
            'action' => 'access_panel',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'details' => [
                'url' => $request->fullUrl(),
                'method' => $request->method(),
            ],
        ]);

        return $next($request);
    }
}
