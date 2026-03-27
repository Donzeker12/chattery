#!/bin/bash

echo "=== CHATTERY VPS DIAGNOSE ==="
echo "Datum: $(date)"
echo ""

# 1. Controleer project directory
echo "1. Project Directory Check:"
cd /var/www/chattery 2>/dev/null || cd /home/chattery 2>/dev/null || cd /root/chattery 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Project gevonden in: $(pwd)"
    ls -la | head -10
else
    echo "❌ Project directory niet gevonden"
    echo "Zoek naar chattery:"
    find / -name "chattery" -type d 2>/dev/null | head -5
fi
echo ""

# 2. Storage symlink check
echo "2. Storage Symlink Check:"
if [ -L "public/storage" ]; then
    echo "✅ Storage symlink bestaat"
    ls -la public/storage
else
    echo "❌ Storage symlink ontbreekt"
    echo "Uitvoeren: php artisan storage:link"
fi
echo ""

# 3. Permissies check
echo "3. Permissies Check:"
echo "Storage directory:"
ls -la storage/ | head -5
echo "Public directory:"
ls -la public/ | head -5
echo ""

# 4. Laravel cache check
echo "4. Laravel Cache Status:"
php artisan --version
echo "Cache directories:"
ls -la storage/framework/cache/ 2>/dev/null || echo "Cache directory niet gevonden"
echo ""

# 5. Profile photos check
echo "5. Profile Photos Check:"
if [ -d "storage/app/public/profiles" ]; then
    echo "✅ Profiles directory bestaat"
    ls -la storage/app/public/profiles/ | wc -l
    echo "Aantal bestanden: $(ls -1 storage/app/public/profiles/ 2>/dev/null | wc -l)"
else
    echo "❌ Profiles directory ontbreekt"
fi
echo ""

# 6. Logs check
echo "6. Recent Laravel Logs:"
if [ -f "storage/logs/laravel.log" ]; then
    echo "Laatste errors:"
    tail -20 storage/logs/laravel.log | grep -E "ERROR|Exception|Fatal" | tail -5
else
    echo "❌ Laravel log niet gevonden"
fi
echo ""

# 7. Web server check
echo "7. Web Server Status:"
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx draait"
    nginx -t 2>&1 | head -3
elif systemctl is-active --quiet apache2; then
    echo "✅ Apache draait"
else
    echo "❌ Geen webserver gevonden"
fi
echo ""

# 8. PHP check  
echo "8. PHP Status:"
php --version | head -1
php -m | grep -E "pdo|mysql|mbstring|tokenizer|xml|ctype|json" | wc -l
echo "PHP modules gevonden: $(php -m | grep -E 'pdo|mysql|mbstring|tokenizer|xml|ctype|json' | wc -l)/7"
echo ""

echo "=== EINDE DIAGNOSE ==="
echo ""
echo "Oplossingen uitvoeren:"
echo "1. php artisan cache:clear"
echo "2. php artisan storage:link"  
echo "3. mkdir -p storage/app/public/profiles"
echo "4. chown -R www-data:www-data storage/"
echo "5. chmod -R 755 storage/"
echo "6. systemctl reload nginx"