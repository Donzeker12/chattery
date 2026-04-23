#!/bin/bash

# Chattery VPS Update Script
# Run this on your VPS to deploy the latest changes

echo "🚀 Starting Chattery VPS update..."

# Check if we're in the right directory
if [ ! -f "artisan" ]; then
    echo "❌ Error: Not in a Laravel project directory"
    echo "Please run this script from /var/www/chattery"
    exit 1
fi

# Pull latest changes from GitHub
echo "📥 Pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main

# Install/update Composer dependencies
echo "📦 Installing PHP dependencies..."
composer install --optimize-autoloader --no-dev --no-interaction

# Install/update NPM dependencies and build assets
echo "🏗️  Building frontend assets..."
npm ci --only=production
npm run build

# Clear all caches
echo "🧹 Clearing application caches..."
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Optimize for production
echo "⚡ Optimizing for production..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run any pending migrations (if any)
echo "🗄️  Checking for database migrations..."
php artisan migrate --force

# Fix permissions
echo "🔐 Setting correct permissions..."
chown -R www-data:www-data .
chmod -R 755 .
chmod -R 775 storage bootstrap/cache

# Reload web server
echo "🔄 Reloading web server..."
if systemctl is-active --quiet nginx; then
    systemctl reload nginx
    echo "✅ Nginx reloaded"
elif systemctl is-active --quiet apache2; then
    systemctl reload apache2
    echo "✅ Apache reloaded"
else
    echo "⚠️  Could not detect web server to reload"
fi

# Clear OPCache if enabled
echo "🔄 Clearing OPCache..."
php -r "if(function_exists('opcache_reset')) { opcache_reset(); echo 'OPCache cleared'; } else { echo 'OPCache not enabled'; }"

echo "✅ Chattery VPS update complete!"
echo "🎉 Password change functionality is now deployed!"
echo ""
echo "Recent changes deployed:"
echo "• 🔐 Password change functionality in user profiles"
echo "• 🇳🇱 Dutch validation messages"
echo "• 🛡️  Secure current password verification"
echo "• 🔗 New API endpoints for mobile compatibility"