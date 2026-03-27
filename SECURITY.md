# Beveiligingsmaatregelen Chattery Admin Panel

## Overzicht
Dit document beschrijft alle beveiligingsmaatregelen die zijn geïmplementeerd om het admin panel en de applicatie te beschermen tegen aanvallen.

## Geïmplementeerde Beveiligingsmaatregelen

### 1. IP-Based Rate Limiting ✓
**Doel:** Bescherming tegen brute force aanvallen op inlogpagina

**Implementatie:**
- **Locatie:** `app/Http/Controllers/AuthController.php`
- **Mechanisme:** FailedLoginAttempt model
- **Limiet:** 5 mislukte pogingen binnen 15 minuten
- **Blokkade:** 30 minuten automatische IP blokkade
- **Database tabel:** `failed_login_attempts` (ip_address, email, user_agent, attempted_at, blocked_until)

**Hoe werkt het:**
1. Bij elke mislukte login wordt IP-adres + email + tijd vastgelegd
2. Systeem telt recent pogingen (laatste 15 minuten)
3. Na 5 pogingen wordt IP geblokkeerd voor 30 minuten
4. Gebruiker krijgt duidelijke foutmelding met resterende blokkade tijd
5. Bij succesvolle login worden oude pogingen verwijderd

**Code voorbeeld:**
```php
// Check for existing IP block
$existingBlock = FailedLoginAttempt::where('ip_address', $request->ip())
    ->where('blocked_until', '>', now())
    ->first();

if ($existingBlock) {
    $minutesLeft = now()->diffInMinutes($existingBlock->blocked_until);
    return back()->withErrors([
        'email' => "Te veel mislukte pogingen. Probeer het over {$minutesLeft} minuten opnieuw."
    ]);
}
```

### 2. Comprehensive Admin Action Logging ✓
**Doel:** Audit trail van alle admin activiteiten voor accountability

**Implementatie:**
- **Locatie:** `app/Models/AdminLog.php`
- **Database tabel:** `admin_logs` (admin_user_id, action, target_user_id, ip_address, user_agent, details)
- **Gelogde acties:**
  - Admin login pogingen
  - Admin panel toegang (elke pageview)
  - Gebruiker ban/unban acties
  - Ongeautoriseerde toegang pogingen

**Vastgelegde informatie:**
- Admin user ID (wie)
- Actie type (wat)
- Target user ID (voor wie, indien van toepassing)
- IP adres (vanuit waar)
- User agent (welke browser/device)
- Timestamp (wanneer)
- Extra details als JSON (context)

**Code voorbeeld:**
```php
AdminLog::create([
    'admin_user_id' => Auth::id(),
    'action' => 'ban_user',
    'target_user_id' => $user->id,
    'ip_address' => $request->ip(),
    'user_agent' => $request->userAgent(),
    'details' => [
        'user_name' => $user->name,
        'user_email' => $user->email
    ]
]);
```

### 3. Enhanced IsAdmin Middleware ✓
**Doel:** Multi-layer beveiliging voor admin routes

**Implementatie:**
- **Locatie:** `app/Http/Middleware/IsAdmin.php`
- **Controles:**
  1. Authenticatie check (is gebruiker ingelogd?)
  2. Admin role verificatie (heeft is_admin = 1?)
  3. Ban status check (is gebruiker niet gebanned?)
  4. Logging van alle toegang pogingen

**Wat wordt gelogd:**
- **Succesvolle toegang:** Admin ID, URL, HTTP method, IP, user agent
- **Mislukte toegang:** Request details, reden van weigering, IP, user agent

**Code voorbeeld:**
```php
// Log unauthorized access attempt
if (!Auth::check() || !Auth::user()->is_admin || Auth::user()->banned_at) {
    AdminLog::create([
        'admin_user_id' => Auth::id(),
        'action' => 'unauthorized_admin_access',
        'ip_address' => $request->ip(),
        'user_agent' => $request->userAgent(),
        'details' => [
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'reason' => !Auth::check() ? 'not_authenticated' : 
                       (!Auth::user()->is_admin ? 'not_admin' : 'banned')
        ]
    ]);
}
```

### 4. Route-Level Rate Limiting ✓
**Doel:** Bescherming tegen DDoS en abuse op specifieke endpoints

**Implementatie:**
- **Locatie:** `routes/web.php`
- **Limieten:**
  - Login POST: 10 pogingen per minuut
  - Register POST: 5 registraties per minuut
  - Admin routes: 60 requests per minuut
  
**Code voorbeeld:**
```php
// Login route with rate limiting
Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');

// Admin routes with rate limiting
Route::middleware(['auth', 'admin', 'throttle:60,1'])->group(function () {
    Route::get('/admin', [AdminController::class, 'index']);
    // ... other admin routes
});
```

### 5. Session Security Hardening ✓
**Doel:** Beschermen van gebruikerssessies tegen hijacking

**Implementatie:**
- **Locatie:** `config/session.php`
- **Instellingen:**
  - Session lifetime: 60 minuten (ipv 120)
  - Session encryption: ingeschakeld
  - Expire on close: ingeschakeld
  - Driver: database (voor betere tracking)

**Configuratie:**
```php
'lifetime' => 60,                    // Session verloopt na 1 uur inactiviteit
'expire_on_close' => true,           // Session verloopt bij sluiten browser
'encrypt' => true,                   // Alle session data encrypted
'driver' => 'database',              // Sessions in database voor audit
```

### 6. Password Security ✓
**Doel:** Sterke password hashing om credentials te beschermen

**Implementatie:**
- **Locatie:** `.env` en `config/hashing.php`
- **Algoritme:** bcrypt met 12 rounds
- **Sterkte:** 2^12 = 4096 iteraties per hash

**Configuratie:**
```env
BCRYPT_ROUNDS=12
```

### 7. CSRF Protection ✓
**Doel:** Bescherming tegen Cross-Site Request Forgery aanvallen

**Implementatie:**
- **Framework:** Laravel's ingebouwde CSRF middleware
- **Scope:** Alle POST, PUT, DELETE requests
- **Verificatie:** Automatisch via `@csrf` Blade directive / Inertia

### 8. Ban Status Validation ✓
**Doel:** Voorkomen dat gebannede gebruikers toegang krijgen

**Implementatie:**
- **Locatie:** Multiple layers
  1. AuthController login - controle voor authentication
  2. IsAdmin middleware - controle voor admin toegang
- **Mechanisme:** `banned_at` timestamp check

## Database Schema

### admin_logs table
```sql
- id (primary key)
- admin_user_id (foreign key → users)
- action (varchar)
- target_user_id (nullable foreign key → users)
- ip_address (varchar 45 - IPv6 compatible)
- user_agent (text)
- details (JSON)
- created_at, updated_at

Indexes:
- admin_user_id
- action
- ip_address
- created_at
```

### failed_login_attempts table
```sql
- id (primary key)
- ip_address (varchar 45)
- email (varchar)
- user_agent (text)
- attempted_at (timestamp)
- blocked_until (nullable timestamp)
- created_at (timestamp)
- updated_at (timestamp)

Indexes:
- ip_address
- email
- attempted_at
```

## Security Checklist voor Productie

### Vóór Deployment:
- [ ] `APP_DEBUG=false` in .env
- [ ] `APP_ENV=production` in .env
- [ ] Sterke `APP_KEY` gegenereerd
- [ ] Database credentials beveiligd
- [ ] HTTPS geforceerd
- [ ] `SESSION_SECURE_COOKIE=true`
- [ ] Firewall configuratie actief
- [ ] Regular backups ingesteld

### Monitoring:
- [ ] Admin logs regelmatig controleren
- [ ] Blocked IPs monitoren
- [ ] Verdachte patronen detecteren
- [ ] Error logs bijhouden

### Maintenance:
- [ ] Laravel en dependencies up-to-date
- [ ] Security patches direct toepassen
- [ ] Oude logs periodiek opschonen
- [ ] Failed attempts archiveren

## Toekomstige Verbeteringen (Optioneel)

1. **Two-Factor Authentication (2FA)**
   - TOTP implementatie voor admin accounts
   - Backup codes systeem

2. **Email Notifications**
   - Alert bij verdachte activiteit
   - Notificatie bij admin login van nieuw IP
   - Dagelijkse security digest

3. **Admin Log Viewer UI**
   - Dashboard met recente logs
   - Zoek/filter functionaliteit
   - Export naar CSV

4. **Advanced IP Management**
   - Whitelist voor trusted IPs
   - Manual IP block/unblock
   - Geografische IP blocking

5. **Password Policies**
   - Minimum lengte requirements
   - Complexity requirements
   - Password expiration (optioneel)

6. **Session Management**
   - Active sessions overzicht
   - Remote session termination
   - Concurrent login limits

## Incident Response

### Bij verdachte activiteit:
1. Check admin_logs voor ongebruikelijke patronen
2. Review failed_login_attempts voor brute force pogingen
3. Identificeer IP adressen van aanvallers
4. Overweeg manual IP blocking
5. Check of admin accounts gecompromitteerd zijn
6. Reset passwords indien nodig
7. Review recent admin acties

### Contact bij security incident:
- Check logs eerst: `admin_logs` en `failed_login_attempts` tables
- Review Laravel logs: `storage/logs/laravel.log`
- Document timeline van events
- Neem preventieve maatregelen

## Technische Details

### Admin Email:
- Admin account: `donzeker1@hotmail.com`
- Herkenbaar aan: `is_admin = 1` in users table

### IP Blocking Mechanisme:
```
Failed attempt → Record in DB
↓
Count recent attempts (15 min window)
↓
If >= 5 attempts → Set blocked_until = now() + 30 minutes
↓
Future login attempts check blocked_until
↓
If blocked → Reject with time remaining
↓
On success → Clear old failed attempts
```

### Action Types in admin_logs:
- `admin_login` - Succesvolle admin login
- `admin_access` - Admin panel pageview
- `ban_user` - Gebruiker gebanned
- `unban_user` - Gebruiker unbanned
- `unauthorized_admin_access` - Mislukte toegangspoging

## Conclusie

Het admin panel is nu beveiligd met meerdere lagen van bescherming:
1. ✅ Rate limiting (IP-based + route-based)
2. ✅ Comprehensive logging
3. ✅ Enhanced middleware
4. ✅ Session hardening
5. ✅ Password security
6. ✅ CSRF protection
7. ✅ Ban validation

Deze maatregelen maken het significant moeilijker voor hackers om:
- Brute force attacks uit te voeren
- Ongeautoriseerde toegang te krijgen
- Sessions te hijacken
- Admin accounts te compromitteren

**Alle acties zijn traceerbaar en verdachte activiteit wordt automatisch geblokkeerd.**
