#!/bin/bash

echo "=== CHATTERY VPS FIX SCRIPT ==="
echo "Datum: $(date)"
echo ""

# Ga naar project directory
cd /var/www/chattery 2>/dev/null || cd /home/chattery 2>/dev/null || cd /root/chattery 2>/dev/null

if [ $? -ne 0 ]; then
    echo "❌ Chattery project niet gevonden!"
    exit 1
fi

echo "🔧 Project gevonden in: $(pwd)"
echo ""

# 1. Laravel caches legen
echo "1. Laravel caches legen..."
php artisan cache:clear
php artisan config:clear
php artisan route:clear 
php artisan view:clear
php artisan optimize:clear
echo "✅ Caches geleegd"
echo ""

# 2. Storage symlink maken
echo "2. Storage symlink controleren..."
if [ ! -L "public/storage" ]; then
    php artisan storage:link
    echo "✅ Storage symlink aangemaakt"
else
    echo "✅ Storage symlink bestaat al"
fi
echo ""

# 3. Directories aanmaken
echo "3. Benodigde directories aanmaken..."
mkdir -p storage/app/public/profiles
mkdir -p storage/logs
mkdir -p storage/framework/cache
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
echo "✅ Directories aangemaakt"
echo ""

# 4. Permissies instellen
echo "4. Permissies corrigeren..."
chown -R www-data:www-data storage/
chown -R www-data:www-data bootstrap/cache/
chown -R www-data:www-data public/storage/

chmod -R 755 storage/
chmod -R 755 bootstrap/cache/
chmod -R 755 public/storage/
echo "✅ Permissies ingesteld"
echo ""

# 5. Web server herladen
echo "5. Web server herladen..."
if systemctl is-active --quiet nginx; then
    systemctl reload nginx
    echo "✅ Nginx herlaadden"
elif systemctl is-active --quiet apache2; then
    systemctl restart apache2
    echo "✅ Apache herstart"
fi

# PHP-FPM restart als beschikbaar
if systemctl is-active --quiet php8.2-fpm; then
    systemctl restart php8.2-fpm
    echo "✅ PHP-FPM herstart"
elif systemctl is-active --quiet php8.1-fpm; then
    systemctl restart php8.1-fpm
    echo "✅ PHP-FPM herstart"
fi
echo ""

# 6. Test de applicatie
echo "6. Applicatie test..."
if php artisan --version >/dev/null 2>&1; then
    echo "✅ Laravel draait correct"
else
    echo "❌ Laravel heeft problemen"
fi

echo ""
echo "🎉 FIX SCRIPT VOLTOOID!"
echo ""
echo "Volgende stappen:"
echo "1. Ga naar je website en hard-refresh (Ctrl+F5)"
echo "2. Open browser console en check op errors"  
echo "3. Test chat en profiel foto upload"
echo ""
echo "Als er nog problemen zijn:"
echo "- Controleer error logs: tail -f storage/logs/laravel.log"
echo "- Controleer web server logs: journalctl -fu nginx"