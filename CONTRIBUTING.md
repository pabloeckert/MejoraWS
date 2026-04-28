# 🧪 Guía para Beta Testers — MejoraWS

## Setup rápido

```bash
git clone https://github.com/pabloeckert/MejoraWS.git
cd MejoraWS
make setup
```

Editá `.env` con tus keys:
- `GROQ_API_KEY` — gratis en https://console.groq.com
- `JWT_SECRET` — generá uno con `openssl rand -hex 32`

```bash
make dev
```

## Probar el Dashboard

1. Abrí http://localhost:3001
2. Login con password: `admin123` (cambiar en producción)
3. Te aparece el wizard de onboarding (5 pasos)

## Probar el Bot

1. Conectá WhatsApp (escaneá QR en logs)
2. Desde otro celular, enviá un mensaje a tu número
3. El bot debería responder automáticamente

## Probar la API

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}'

# Usar el token
export TOKEN="eyJ..."

# Listar contactos
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/contacts

# Ver health
curl http://localhost:3000/health
```

## Probar Webhooks

```bash
# Crear webhook (usá https://webhook.site para testing)
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/tu-url","events":["message.received","deal.closed"]}'

# Ver deliveries
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/webhooks
```

## Reportar bugs

Abrí un issue en GitHub con:
- **Título:** `[BETA] Descripción corta`
- **Pasos para reproducir**
- **Qué esperabas** vs **qué pasó**
- **Logs** (si los hay): `docker compose logs app --tail=50`

## Prioridades de testing

1. **WhatsApp connection** — ¿Conecta bien? ¿Mantiene sesión?
2. **Auto-reply** — ¿Responde bien? ¿Detecta intención?
3. **Anti-ban** — ¿Respeta límites? ¿No bannea?
4. **Dashboard** — ¿Carga bien? ¿Las vistas son correctas?
5. **Campañas** — ¿Envía correctamente? ¿Respeta warm-up?
6. **API** — ¿Los endpoints responden bien?

## Feedback

Todo feedback es bienvenido. Prioridades:
- 🐛 Bugs que rompan funcionalidad
- 💡 Features que faltan para tu caso de uso
- 🎨 UX que no es clara
- 📝 Documentación que falta
