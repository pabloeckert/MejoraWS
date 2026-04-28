#!/bin/bash
# ============================================
# MejoraWS — SSL Setup (Let's Encrypt)
# ============================================
# Uso: ./scripts/setup-ssl.sh tu-dominio.com
# Requisitos: dominio apuntando al servidor, puerto 80 libre
# ============================================

set -euo pipefail

DOMAIN=${1:-""}
SSL_DIR="./nginx/ssl"

if [ -z "$DOMAIN" ]; then
    echo "Uso: $0 <dominio.com>"
    echo "Ejemplo: $0 mejoraws.ejemplo.com"
    exit 1
fi

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[MejoraWS SSL]${NC} Configurando SSL para $DOMAIN..."

# Create SSL directory
mkdir -p "$SSL_DIR"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Instalando certbot..."
    apt-get update && apt-get install -y certbot python3-certbot-nginx
fi

# Stop nginx temporarily
docker compose stop nginx 2>/dev/null || true

# Get certificate
certbot certonly --standalone \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "admin@$DOMAIN" \
    --preferred-challenges http

# Copy certificates
cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/fullchain.pem"
cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/privkey.pem"

# Set permissions
chmod 644 "$SSL_DIR/fullchain.pem"
chmod 600 "$SSL_DIR/privkey.pem"

# Setup auto-renewal cron
CRON_CMD="0 3 * * 1 certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/ && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/ && docker compose restart nginx"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_CMD") | crontab -

echo -e "${GREEN}[OK]${NC} SSL configurado para $DOMAIN"
echo -e "${GREEN}[OK]${NC} Auto-renovación configurada (cada lunes 3am)"
echo ""
echo "Reiniciar nginx: docker compose --profile production up -d nginx"
