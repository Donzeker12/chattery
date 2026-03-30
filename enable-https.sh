#!/bin/bash

# Enable HTTPS for Chattery PWA
echo "🔒 Setting up HTTPS for Chattery PWA..."

# Install certbot for Let's Encrypt SSL
echo "📦 Installing Certbot..."
apt update
apt install -y certbot python3-certbot-nginx

# Stop nginx temporarily
systemctl stop nginx

# Get SSL certificate
echo "🔑 Getting SSL certificate for chattery.tech..."
certbot --nginx -d chattery.tech --non-interactive --agree-tos --email admin@chattery.tech

# Update nginx conf to force HTTPS
echo "⚙️ Configuring nginx for HTTPS..."
cat > /etc/nginx/sites-available/chattery << 'EOF'
server {
    listen 80;
    server_name chattery.tech www.chattery.tech;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chattery.tech www.chattery.tech;
    root /var/www/chattery/public;

    ssl_certificate /etc/letsencrypt/live/chattery.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chattery.tech/privkey.pem;
    
    # Security headers for PWA
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # PWA files
    location /manifest.json {
        add_header Cache-Control "public, max-age=3600";
        add_header Content-Type "application/manifest+json";
    }
    
    location /sw.js {
        add_header Cache-Control "public, max-age=0";
        add_header Content-Type "application/javascript";
    }

    index index.html index.htm index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site and restart nginx
ln -sf /etc/nginx/sites-available/chattery /etc/nginx/sites-enabled/
nginx -t && systemctl start nginx

# Set up automatic SSL renewal
crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | crontab -

echo "✅ HTTPS enabled! Your Chattery PWA is now installable at https://chattery.tech"
echo "🔄 Test PWA installation in Chrome: F12 → Application tab → Manifest"