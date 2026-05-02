#!/bin/bash

# Manual Chattery Deployment Script
# Run each command step by step on your VPS as root

echo "🚀 Manual Chattery deployment steps..."

echo "1. Install dependencies:"
echo "composer install --optimize-autoloader --no-dev"
echo "npm ci"
echo "npm run build"

echo ""
echo "2. Setup environment:"
echo "cp .env.example .env"
echo "php artisan key:generate"
echo "# Edit .env file with your database settings"

echo ""
echo "3. Database setup:"
echo "php artisan migrate --force"
echo "php artisan db:seed --class=AdminSeeder --force"

echo ""
echo "4. Cache optimization:"
echo "php artisan config:clear"
echo "php artisan cache:clear"
echo "php artisan route:clear" 
echo "php artisan view:clear"
echo "php artisan config:cache"
echo "php artisan route:cache"
echo "php artisan view:cache"

echo ""
echo "5. Set permissions:"
echo "chown -R www-data:www-data /var/www/chattery"
echo "chmod -R 755 /var/www/chattery"
echo "chmod -R 775 /var/www/chattery/storage"
echo "chmod -R 775 /var/www/chattery/bootstrap/cache"

echo ""
echo "6. Setup web server (if needed):"
echo "# Copy nginx config from deploy.sh or setup Apache virtual host"
echo "# Install SSL certificate with certbot"

echo ""
echo "✅ Deployment should be complete!"