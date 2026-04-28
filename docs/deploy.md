# 🚀 Deploy Guide — MejoraWS

> Guía paso a paso para poner MejoraWS en producción.

---

## Opción 1: Docker (Recomendado)

### Requisitos
- Servidor con Linux (Ubuntu 22.04+ recomendado)
- Docker + Docker Compose instalados
- Dominio apuntando al servidor (opcional, para SSL)

### Pasos

```bash
# 1. Clonar el repo
git clone https://github.com/pabloeckert/MejoraWS.git
cd MejoraWS

# 2. Configurar variables de entorno
cp .env.example .env
nano .env  # Editar: GROQ_API_KEY, JWT_SECRET, etc.

# 3. Levantar el servicio
docker compose up -d

# 4. Verificar que funciona
curl http://localhost:3000/health

# 5. Ver logs
docker compose logs -f app
```

### Con SSL (producción)

```bash
# 1. Instalar certbot
apt-get install -y certbot

# 2. Obtener certificado SSL
./scripts/setup-ssl.sh tu-dominio.com

# 3. Levantar con nginx
docker compose --profile production up -d

# 4. Verificar
curl https://tu-dominio.com/health
```

### Comandos útiles

```bash
# Ver estado
docker compose ps

# Reiniciar app
docker compose restart app

# Ver logs en tiempo real
docker compose logs -f app

# Backup manual
./scripts/backup.sh

# Actualizar a nueva versión
git pull
docker compose build
docker compose up -d

# Detener todo
docker compose down
```

---

## Opción 2: VPS Manual (sin Docker)

### Requisitos
- Node.js 22+
- npm
- SQLite3 (para backups)

### Pasos

```bash
# 1. Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# 2. Clonar e instalar
git clone https://github.com/pabloeckert/MejoraWS.git
cd MejoraWS
npm ci

# 3. Configurar
cp .env.example .env
nano .env

# 4. Build
npm run build

# 5. Ejecutar con PM2
npm install -g pm2
pm2 start dist/server.js --name mejoraws
pm2 save
pm2 startup

# 6. Nginx (reverse proxy)
apt-get install -y nginx
# Copiar nginx/nginx.conf a /etc/nginx/nginx.conf
# Ajustar upstream a: server 127.0.0.1:3000
systemctl restart nginx
```

---

## Opción 3: VPS Simple (desarrollo/testing)

```bash
# Sin Docker, sin nginx, sin SSL
git clone https://github.com/pabloeckert/MejoraWS.git
cd MejoraWS
npm ci
cp .env.example .env
nano .env
npm run build
npm start
# Acceso: http://tu-ip:3000
```

---

## Variables de Entorno

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `NODE_ENV` | No | `development` | Entorno (`production` / `development`) |
| `PORT` | No | `3000` | Puerto del servidor API |
| `GROQ_API_KEY` | **Sí** | — | API key de Groq (gratis) |
| `OLLAMA_URL` | No | `http://localhost:11434` | URL de Ollama |
| `DB_PATH` | No | `./data/mejoraws.db` | Ruta de la base de datos |
| `SESSION_PATH` | No | `./data/session` | Ruta de sesión WhatsApp |
| `JWT_SECRET` | **Sí** | — | Secret para JWT tokens |
| `LOG_LEVEL` | No | `info` | Nivel de logging |

---

## Backup y Restore

### Backup automático
El `docker-compose.yml` incluye un servicio de backup que ejecuta cada 6 horas.

### Backup manual
```bash
./scripts/backup.sh
```

### Restore
```bash
# Detener app
docker compose stop app

# Restaurar backup
cp backups/mejoraws-YYYYMMDD-HHMMSS.db data/mejoraws.db

# Reiniciar
docker compose start app
```

---

## Monitoreo

### Health Check
```bash
curl http://localhost:3000/health
```

Respuesta:
```json
{
  "status": "ok",
  "uptime": 3600,
  "version": "0.1.0",
  "checks": {
    "database": "ok",
    "llm": "groq",
    "groq": "ok",
    "ollama": "ok"
  }
}
```

### Logs
```bash
# Logs de la app
docker compose logs -f app

# Logs de nginx (producción)
docker compose logs -f nginx

# Logs de backup
docker compose logs -f backup
```

---

## Troubleshooting

### "WhatsApp session expired"
```bash
# Resetear sesión
docker compose stop app
rm -rf data/session/*
docker compose start app
# Escanear QR code nuevamente
docker compose logs -f app
```

### "Groq API rate limited"
El sistema cae automáticamente a Ollama. Si Ollama no está disponible, el bot pausa las respuestas hasta que Groq se desbloquee.

### "Database locked"
SQLite con WAL mode maneja concurrencia. Si persiste:
```bash
docker compose restart app
```

### "Port already in use"
```bash
# Cambiar puerto en .env
PORT=3001
# O detener el proceso que usa el puerto
lsof -i :3000
```

---

## Seguridad Checklist

- [ ] `.env` configurado con secrets reales
- [ ] JWT_SECRET es aleatorio (32+ caracteres)
- [ ] SSL configurado (producción)
- [ ] Firewall: solo puertos 80, 443, 22 abiertos
- [ ] Backup automático funcionando
- [ ] Logs rotando (docker log rotation configurado)
- [ ] SSH con key auth (no password)
- [ ] Usuario no-root para la app (Docker lo hace automáticamente)

---

*Última actualización: 29 abril 2026*
