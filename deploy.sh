#!/bin/bash

# Chattery Deployment Script
# Run this script on your VPS as root

echo "🚀 Starting Chattery deployment..."

# Install required PHP extensions
echo "📦 Installing PHP extensions..."
apt update
apt install -y php8.2-sqlite3 php8.2-pdo-sqlite php8.2-mysql nginx

# Start services
systemctl enable nginx php8.2-fpm
systemctl start nginx php8.2-fpm

# Navigate to the project directory
cd /var/www/chattery || exit 1

# Configure .env file
echo "📝 Configuring .env file..."
cat > /tmp/db_config.txt << 'EOF'
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=chattery
DB_USERNAME=chattery
DB_PASSWORD=Ch@tt3ry!Secur3P@ss2026
EOF

# Remove old DB config and add new one
sed -i '/^DB_/d' .env
cat /tmp/db_config.txt >> .env

# Run migrations
echo "🗄️  Running database migrations..."
php artisan migrate --force

# Run seeders if needed
echo "🌱 Running database seeders..."
php artisan db:seed --class=AdminSeeder --force || echo "Seeder may have already run"

# Clear and optimize caches
echo "🧹 Clearing and optimizing caches..."
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set proper permissions
echo "🔐 Setting permissions..."
chown -R www-data:www-data /var/www/chattery
chmod -R 755 /var/www/chattery
chmod -R 775 /var/www/chattery/storage
chmod -R 775 /var/www/chattery/bootstrap/cache

# Create Nginx configuration
echo "🌐 Creating Nginx configuration..."
cat > /etc/nginx/sites-available/chattery << 'NGINX_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name chattery.tech www.chattery.tech;
    
    root /var/www/chattery/public;
    index index.php index.html;

    # Increase upload size for attachments
    client_max_body_size 210M;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    # Service Worker
    location = /sw.js {
        add_header Service-Worker-Allowed "/" always;
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 300;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
NGINX_EOF

# Enable site
ln -sf /etc/nginx/sites-available/chattery /etc/nginx/sites-enabled/

# Test Nginx configuration
echo "✅ Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    # Reload Nginx
    echo "🔄 Reloading Nginx..."
    systemctl reload nginx
    
    # Install SSL certificate
    echo "🔒 Installing SSL certificate..."
    certbot --nginx -d chattery.tech -d www.chattery.tech --non-interactive --agree-tos --email admin@chattery.tech --redirect
    
    echo "✅ Deployment completed successfully!"
    echo ""
    echo "🌐 Your site is now available at:"
    echo "   https://chattery.tech"
    echo ""
    echo "📝 Default admin credentials (if seeded):"
    echo "   Email: admin@chattery.tech"
    echo "   Password: Check your AdminSeeder.php file"
else
    echo "❌ Nginx configuration test failed. Please check the configuration."
    exit 1
fi
