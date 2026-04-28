# 📡 MejoraWS API Reference

> REST API v1 — Base URL: `http://localhost:3000/api/v1`

## Autenticación

Todas las rutas (excepto login y health) requieren JWT Bearer token:

```
Authorization: Bearer <token>
```

Obtener token:
```bash
POST /api/v1/auth/login
{ "password": "tu-password" }

→ { "token": "eyJhbG..." }
```

---

## Rate Limiting

- **General:** 200 req/min por IP
- **Por usuario:** 30 req/min (JWT-based)

---

## Endpoints

### Auth

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/auth/login` | Login → JWT token | ❌ |
| `GET` | `/auth/verify` | Verificar token válido | ✅ |

### Contacts

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/contacts` | Listar contactos (filtros: `search`, `tags`, `minScore`, `whatsapp`, `limit`, `offset`, `cursor`) |
| `POST` | `/contacts` | Crear contacto |
| `GET` | `/contacts/:id` | Obtener por ID |
| `PUT` | `/contacts/:id` | Actualizar |
| `DELETE` | `/contacts/:id` | Eliminar |
| `GET` | `/contacts/phone/:phone` | Buscar por teléfono |
| `POST` | `/contacts/import` | Importar archivo (multipart/form-data) |
| `GET` | `/contacts/stats/summary` | Estadísticas |

**Paginación por cursor** (más eficiente para grandes datasets):
```bash
GET /contacts?limit=20&cursor=2026-04-29T06:00:00.000Z&cursorDirection=after
```

### Deals

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/deals` | Listar deals |
| `POST` | `/deals` | Crear deal |
| `GET` | `/deals/pipeline` | Vista pipeline (por etapa) |
| `GET` | `/deals/followups` | Follow-ups pendientes |
| `GET` | `/deals/stats` | Estadísticas |
| `PATCH` | `/deals/:id` | Actualizar |
| `PATCH` | `/deals/:id/stage` | Mover etapa |
| `POST` | `/deals/:id/close` | Cerrar deal |
| `POST` | `/deals/:id/followup` | Programar follow-up |

### Messages

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/messages/:phone` | Historial contacto |
| `GET` | `/messages/recent/all` | Mensajes recientes |
| `POST` | `/messages/send` | Enviar mensaje |
| `GET` | `/messages/stats/sending` | Stats envío |

### Campaigns

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/campaigns` | Listar |
| `POST` | `/campaigns` | Crear |
| `GET` | `/campaigns/:id` | Obtener |
| `PATCH` | `/campaigns/:id` | Actualizar |
| `DELETE` | `/campaigns/:id` | Eliminar |
| `GET` | `/campaigns/:id/stats` | Stats |
| `POST` | `/campaigns/:id/execute` | Ejecutar |
| `POST` | `/campaigns/:id/pause` | Pausar |

### Analytics

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/analytics/overview` | KPIs principales |
| `GET` | `/analytics/messages` | Tendencia mensajes (30 días) |
| `GET` | `/analytics/funnel` | Funnel conversión |
| `GET` | `/analytics/sentiment` | Sentimiento |
| `GET` | `/analytics/timing` | Mejor horario |
| `GET` | `/analytics/quality` | Calidad conversaciones |
| `GET` | `/analytics/quality/:phone` | Score conversación específica |
| `GET` | `/analytics/export?type=X` | Export CSV |

### Status & Config

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/status` | Estado del sistema |
| `GET` | `/status/config` | Config del bot |
| `PUT` | `/status/config` | Actualizar config |
| `GET` | `/status/templates` | Templates por industria |
| `PUT` | `/status/kb` | Actualizar knowledge base |

### GDPR

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/gdpr/export/:phone` | Exportar datos (Art. 15/20) |
| `DELETE` | `/gdpr/erase/:phone` | Borrar datos (Art. 17) |
| `PUT` | `/gdpr/consent/:phone` | Gestionar consentimiento |
| `GET` | `/gdpr/stats` | Stats consentimiento |

### Audit

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/audit` | Consultar logs |
| `GET` | `/audit/stats` | Estadísticas |
| `POST` | `/audit/cleanup` | Limpiar antiguos |
| `PUT` | `/audit/retention` | Configurar retención |

### Breach Notification

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/breach/report` | Reportar brecha |
| `GET` | `/breach` | Listar brechas |
| `GET` | `/breach/stats` | Stats |
| `GET` | `/breach/overdue` | Pendientes >72h |
| `GET` | `/breach/:id` | Obtener |
| `PATCH` | `/breach/:id` | Actualizar |
| `POST` | `/breach/:id/contain` | Contener |
| `POST` | `/breach/:id/resolve` | Resolver |
| `POST` | `/breach/:id/notify-authority` | Notificar autoridad |
| `POST` | `/breach/:id/notify-subjects` | Notificar afectados |

### Webhooks

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/webhooks` | Listar webhooks |
| `POST` | `/webhooks` | Crear webhook |
| `GET` | `/webhooks/:id` | Obtener |
| `PATCH` | `/webhooks/:id` | Actualizar |
| `DELETE` | `/webhooks/:id` | Eliminar |
| `GET` | `/webhooks/:id/deliveries` | Historial de deliveries |
| `POST` | `/webhooks/retry-failed` | Reintentar fallidos |
| `GET` | `/webhooks/meta/events` | Eventos disponibles |

**Eventos disponibles:**
- `message.received` — Mensaje entrante
- `message.sent` — Mensaje enviado
- `contact.created` — Contacto creado
- `contact.updated` — Contacto actualizado
- `deal.created` — Deal creado
- `deal.stage_changed` — Deal cambió de etapa
- `deal.closed` — Deal cerrado
- `campaign.completed` — Campaña completada
- `bot.escalated` — Escalamiento a humano

**Webhook payload:**
```json
{
  "event": "message.received",
  "data": { "from": "+1234567890", "name": "Juan", "text": "Hola" },
  "timestamp": "2026-04-29T06:30:00.000Z"
}
```

**HMAC Signature** (si se configura secret):
```
X-MejoraWS-Signature: sha256=<hmac-hex>
```

### MFA

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/mfa/status` | Estado MFA |
| `POST` | `/mfa/setup` | Generar secret (QR URL) |
| `POST` | `/mfa/enable` | Activar MFA (verificar código) |
| `POST` | `/mfa/desactivar` | Desactivar MFA |
| `POST` | `/mfa/verify` | Verificar código |
| `POST` | `/mfa/backup-codes` | Regenerar códigos backup |

### SSE (Server-Sent Events)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/events/stream` | SSE stream (text/event-stream) |
| `GET` | `/events/status` | Estado de conexiones SSE |

**Eventos SSE:**
- `message:new` — Mensaje nuevo (inbound/outbound)
- `message:status` — Estado de mensaje
- `contact:update` — Contacto actualizado
- `deal:update` — Deal actualizado
- `deal:stage` — Deal cambió de etapa
- `campaign:update` — Campaña actualizada
- `campaign:progress` — Progreso de campaña
- `status:update` — Estado del sistema
- `system:alert` — Alerta del sistema

### System

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus metrics |

---

## Errores

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Códigos HTTP:
- `200` — OK
- `201` — Created
- `204` — No Content
- `400` — Bad Request
- `401` — Unauthorized
- `404` — Not Found
- `409` — Conflict
- `429` — Rate Limited
- `500` — Internal Server Error

---

## Ejemplos

### Crear contacto
```bash
curl -X POST http://localhost:3000/api/v1/contacts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Juan Pérez","phone":"+54911234567","email":"juan@email.com","tags":["cliente","vip"]}'
```

### Enviar mensaje
```bash
curl -X POST http://localhost:3000/api/v1/messages/send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"to":"+54911234567","text":"Hola Juan! ¿En qué puedo ayudarte?"}'
```

### Crear webhook
```bash
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://tu-servidor.com/webhook","events":["message.received","deal.closed"],"secret":"tu-secreto"}'
```

### SSE con JavaScript
```javascript
const es = new EventSource('/api/v1/events/stream')
es.addEventListener('message:new', (e) => {
  const data = JSON.parse(e.data)
  console.log('Nuevo mensaje:', data)
})
```
