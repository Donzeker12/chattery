<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureProfileIsComplete
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->requiresProfileCompletion() || $this->isAllowed($request)) {
            return $next($request);
        }

        if ($request->expectsJson() || $request->is('api/*')) {
            return new JsonResponse([
                'message' => 'Vul eerst je profieltype en gender in.',
                'code' => 'PROFILE_INCOMPLETE',
            ], 428);
        }

        return new RedirectResponse(route('profile.complete'));
    }

    private function isAllowed(Request $request): bool
    {
        if ($request->routeIs('profile.complete', 'profile.update', 'logout')) {
            return true;
        }

        return $request->is(
            'api/user',
            'api/profile',
            'api/logout',
            'api/push/mobile-token',
        );
    }
}