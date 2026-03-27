# Chattery - Update Instructies

## 🔄 Updates Deployen naar VPS

Wanneer je lokaal wijzigingen hebt gemaakt en deze naar de VPS wilt pushen, volg dan deze stappen:

### 1. Lokaal (Windows)
```bash
# Wijzigingen committen
git add .
git commit -m "Beschrijving van je wijzigingen"

# Pushen naar GitHub
git push origin main
```

### 2. Op de VPS Server
```bash
# SSH verbinding maken
ssh root@187.124.27.250

# Navigeer naar de project directory
cd /var/www/chattery

# Pull laatste wijzigingen
git pull origin main

# Update Composer dependencies (productie)
composer install --no-dev --optimize-autoloader

# Update NPM dependencies en build frontend
npm install && npm run build

# Voer database migraties uit (indien nodig)
php artisan migrate --force

# Cache optimalisatie
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Zet juiste permissions
chown -R www-data:www-data /var/www/chattery

# Klaar!
```

## 🚀 Snelle Update (één commando)

Je kunt alle commando's in één keer uitvoeren:

```bash
ssh root@187.124.27.250 "cd /var/www/chattery && git pull origin main && composer install --no-dev --optimize-autoloader && npm install && npm run build && php artisan migrate --force && php artisan config:cache && php artisan route:cache && php artisan view:cache && chown -R www-data:www-data /var/www/chattery && echo '✅ Update completed!'"
```

## 🗄️ Database Migraties

Als je nieuwe database wijzigingen hebt:

```bash
# Nieuwe migratie aanmaken (lokaal)
php artisan make:migration create_iets_table

# Na pushen, op VPS:
cd /var/www/chattery
php artisan migrate --force
```

## 🧹 Cache Wissen

Als je problemen hebt, probeer alle cache te wissen:

```bash
cd /var/www/chattery
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan optimize
```

## 🔐 Permissions Probleem?

Als je permission errors krijgt:

```bash
cd /var/www/chattery
chown -R www-data:www-data .
chmod -R 755 .
chmod -R 775 storage
chmod -R 775 bootstrap/cache
```

## 📊 Logs Bekijken

Als er iets misgaat, bekijk de logs:

```bash
# Laravel log
tail -n 100 /var/www/chattery/storage/logs/laravel.log

# Nginx error log
tail -n 100 /var/log/nginx/error.log

# PHP-FPM log
tail -n 100 /var/log/php8.2-fpm.log
```

## 🌐 Server Informatie

- **Domain:** https://chattery.tech
- **Server IP:** 187.124.27.250
- **Project Path:** /var/www/chattery
- **Database:** chattery
- **Webserver:** Nginx
- **PHP Version:** 8.4.18
- **Node Version:** 20.20.0

## 📝 Belangrijke Bestanden

- **Nginx Config:** `/etc/nginx/sites-available/chattery`
- **Environment:** `/var/www/chattery/.env`
- **Logs:** `/var/www/chattery/storage/logs/`

## 🆘 Hulp Nodig?

Bij problemen, controleer:
1. Nginx status: `systemctl status nginx`
2. PHP-FPM status: `systemctl status php8.2-fpm`
3. Database status: `systemctl status mysql`
4. Nginx syntax: `nginx -t`
5. Laravel logs: `tail -f /var/www/chattery/storage/logs/laravel.log`
