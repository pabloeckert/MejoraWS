# Documento Interno de Ingeniería y Roadmap a Producción (2026–2027) — MejoraWS

> **Uso Interno / Handoff Continuo para Agente de Ingeniería (Gemini 3.8 · Esfuerzo High) y PM**  
> **Fecha de Auditoría:** 16 de Noviembre de 2026  
> **Repositorio:** `c:\github\MejoraWS` (rama `master`, HEAD verificado tras `611b2ef`)  
> **Objetivo Final:** Llevar **MejoraWS (PRD v1.0)** desde su estado actual *"compilado y validado en memoria"* hasta **producción real 24/7 Dockerizada**, alineada con tendencias 2026–2027, con IA Gemini 3.8 (`thinkingLevel: "high"`), seguridad Zero-Trust y envío/recepción física verificada con `3764358152` (`5493764358152@s.whatsapp.net`) y `3765007805` (`5493765007805@s.whatsapp.net`).

---

## 0. Instrucciones de Trabajo para Próximas Sesiones (Modo Continuo · Gemini 3.8 High)

Cuando retomes el trabajo sobre este documento (`"continua"`, `"ejecuta fase X"`, etc.):

1. **Leer primero este archivo completo** y verificar qué `[ ]` checklist sigue pendiente en la **Sección 4**.
2. **Trabajar estrictamente una sub-fase atómica por iteración** siguiendo las invariantes de la **Sección 5** (nunca romper la app Electron operativa ni el flujo de envío directo mientras no se retire explícitamente).
3. **Al completar cada bloque:**
   - Correr `npm run build`, `npm run build:prd`, `npm test` y `npm run doctor`.
   - Actualizar el estado `[ ]` → `[x]` en la tabla de progreso de este documento con la evidencia exacta del comando ejecutado.
   - **Nunca declarar producción sin haber corrido las pruebas de humo contra contenedores Docker reales** (PostgreSQL 16 + Redis 7 + Evolution API v2 + Webhook + Gemini API real).
4. **Si encontrás un bloqueo externo** (falta de Docker instalado en este host Windows, falta `AI_API_KEY`, necesidad de escanear QR físico o configurar token Cloudflare), detenerse en esa puerta de verificación (*Gate*), reportar el estado exacto y pedir la acción puntual al dueño.

---

## 1. Diagnóstico Real del Trabajo Actual (Auditoría Código por Código)

### 1.1 Lo que SÍ funciona y está sólido hoy
- **Núcleo compartido (`@mejoraws/shared`):** Tipos de dominio Kendall & Kendall (`Contact`, `Message`, `ScheduledJob`, `AIConfig`, `ApiKey`), interfaz `IMessagingProvider`, fórmulas anti-ban (Box-Muller jitter, duración `"composing"` proporcional, Spintax, `SAFE_HOURS`, normalización E.164 Argentina `formatToJid` → `549...`, `parseRecipientsText`, `sanitizeRoboticPhrases`).
- **App Desktop Legacy (`electron/` + `src/`):** Conectividad Baileys directa, normalización `549` y `samePhone()`, modal de **Carga Manual y Envío Directo** (copy-paste, CSV/XLSX/TXT, plantillas y probador Spintax), menú interactivo en `arrancar.bat` y diagnóstico `scripts/doctor.mjs`.
- **Esqueleto PRD v1.0:** `docker-compose.yml`, SQL inicial (`database/init.sql` y `001_initial_schema.sql`), servicios Fastify (`apps/orchestrator-api`), Worker BullMQ (`apps/orchestrator-worker`) y React 19 UI (`apps/dashboard-ui`).
- **Cobertura actual en tests:** 8 archivos / 102 tests pasando en Vitest (`npm test`), pero **todos ejecutan contra adaptadores en memoria y mocks** (`InMemoryDataStore`, `UnifiedAcceptanceDataStore`, `InMemoryQueueDispatcher`, mocks HTTP).

### 1.2 Brechas Críticas y Simulados Detectados (Impiden Producción Real Hoy)

| ID | Severidad | Archivo(s) Afectados | Problema Real Verificado en Código | Impacto en Producción |
|---|---|---|---|---|
| **G-01** | **CRÍTICA** | `apps/orchestrator-api/src/presentation/routes/apiV1Routes.ts` (L266, L1080, L1133)<br>`apps/orchestrator-worker/src/index.ts` (L52–149) | El webhook `POST /api/v1/webhooks/evolution` responde usando la función estática `buildRetentionReply()` (2 frases fijas hardcoded). **No llama a Gemini/OpenAI/Anthropic** ni dispara HTTP POST a `OWNER_ALERT_WEBHOOK_URL` (solo guarda `last_ai_alert` en `metadata`). Además `orchestrator-worker/src/index.ts` re-exporta `AIRetentionEngine` y `MultiProviderLLMAdapter`, pero **solo levanta el worker de salida (`outbound_messages`)**. | La IA real nunca responde por WhatsApp ni avisa al webhook externo del dueño. |
| **G-02** | **CRÍTICA** | `apps/orchestrator-worker/src/infrastructure/ai/MultiProviderLLMAdapter.ts` (L132–155)<br>`.env.example` (L45–47)<br>`database/migrations/001_initial_schema.sql` (L81) | 1) Default configurado en `openai` / `gpt-4o-mini` (modelo 2024).<br>2) La llamada REST a Gemini no envía `generationConfig.thinkingConfig` (`thinkingLevel: "high"`), ni `responseSchema` estructurado.<br>3) Toma `candidates?.[0]?.content?.parts?.[0]?.text` **sin filtrar bloques `part.thought === true`**; si un modelo razonador emite partes de pensamiento primero, se trunca o se filtra razonamiento interno al cliente. | Incompatibilidad o fuga de texto interno con modelos Gemini 3.x/4.x y mayor latencia/costo por doble llamada. |
| **G-03** | **CRÍTICA** | `apps/orchestrator-api/src/presentation/routes/apiV1Routes.ts` (L926)<br>`apps/orchestrator-api/src/presentation/middleware/auth.ts` | `POST /api/v1/webhooks/evolution` carece de secreto/firma de validación. Al habilitar `cloudflared` (PRD § 1.2), terceros podrían inyectar webhooks falsos. Además `/api/v1/auth/login` (L294) usa comparación simple de string sin `timingSafeEqual`, sin rate-limit anti fuerza bruta y cookie sin bandera `Secure` condicional bajo HTTPS. | Riesgo de spoofing de mensajes, disparo no autorizado de envíos y fuerza bruta al login maestro. |
| **G-04** | **ALTA** | `apps/orchestrator-worker/src/application/OutboundMessageProcessor.ts` (L212–221)<br>`apps/orchestrator-api/src/presentation/routes/apiV1Routes.ts` (L974–1003) | Condición de carrera en `sent_cache`: el worker registra `markMessageSentBySystem(sendResult.messageId)` **después** de que `sendMessage()` responde. Si Evolution envía el webhook `fromMe: true` milisegundos antes de esa escritura en Redis, `apiV1Routes` asumirá que respondió el humano desde el celular físico y silenciará la IA (`HUMAN_TAKEOVER` por 24h). | Auto-silenciamiento accidental de la IA tras sus propios envíos o envíos Smart Drip. |
| **G-05** | **ALTA** | `docker-compose.yml` (L52)<br>`apiV1Routes.ts` (L951–955)<br>`EvolutionApiProvider.ts` (L189) | `docker-compose.yml` fija `atendai/evolution-api:v2.1.2`. En WhatsApp 2025–2027 aumentó drásticamente el uso de identificadores opacos `@lid` (*Linked IDs*). Hoy `apiV1Routes` extrae `normalizePhone(targetJid.split('@')[0])` sin inspeccionar `key.remoteJidAlt` ni resolver LID→PN, creando contactos basura con IDs de 15 dígitos en lugar del teléfono real, y `syncContacts()` descarta todo JID que no termine en `@s.whatsapp.net`. | Mensajes entrantes de usuarios con `@lid` fallan al responder o duplican contactos sin teléfono válido. |
| **G-06** | **ALTA** | `apps/orchestrator-api/Dockerfile`<br>`apps/orchestrator-worker/Dockerfile`<br>`apps/dashboard-ui/Dockerfile` | Todos los Dockerfiles ejecutan `RUN npm run build \|\| true` (silenciando errores de TypeScript en build), copian código fuente + `devDependencies` sin podar, ejecutan como `root`, no copian todos los `package.json` del monorepo para `npm ci`, y carecen de `HEALTHCHECK`. | Imágenes Docker rotas pasando el build en silencio y contenedores inseguros. |
| **G-07** | **ALTA** | `database/init.sql`<br>`apps/orchestrator-api/src/infrastructure/persistence/PostgresDataStore.ts` | `init.sql` solo corre al inicializar un volumen PostgreSQL vacío; no existe runner automático de migraciones versionadas (`002_...`, `schema_migrations`). Además `getAIConfig()` asume fila `id=1` existente sin fallback autocurable si falta. | Fallos tras actualizar esquema en producción o arranque contra DB preexistente. |
| **G-08** | **ALTA** | `apps/dashboard-ui/src/App.jsx` (L254)<br>`apps/orchestrator-api/src/presentation/routes/apiV1Routes.ts`<br>`apps/dashboard-ui/nginx.conf` | 1) No existe endpoint de subida multimedia (`POST /api/v1/media/upload`) pese a tener `@fastify/multipart` y `@fastify/static` en `package.json`.<br>2) La UI solo consulta la API una vez al montar: **no hay SSE (`/api/v1/events`) ni polling**, por lo que QR (caduca cada 30s), mensajes entrantes y alertas IA no se refrescan en vivo. | Operador ciego ante mensajes nuevos y expiración del QR sin recargar manualmente; imposible subir PDFs/imágenes locales desde Web. |
| **G-09** | **MEDIA** | `package.json`, `scripts/doctor.mjs` (L96), `apps/dashboard-ui/vite.config.js` (L9), `vite.config.js` | Desalineación de puertos y scripts locales: `apps/dashboard-ui/vite.config.js` usa `port: 5176` (`strictPort: true`), que colisiona con el Vite raíz de Electron (también `5176`), mientras `doctor.mjs` escanea `5173`. Además `npm run dev:prd` no inicia `orchestrator-worker` ni valida modo local unificado. | Confusión al levantar plataforma web en Windows sin Docker. |
| **G-10** | **MEDIA** | `IMessagingProvider` (solo implementado por `EvolutionApiProvider`) | Falta adaptador oficial `MetaCloudApiProvider` listo para **WhatsApp Coexistence (2026–2027)** y estrategia clara para migrar cuentas comerciales de Baileys/Evolution a Cloud API oficial sin tocar reglas de negocio. | Exposición continua a restricciones de WhatsApp Web no oficial si crece el volumen. |
| **G-11** | **ALTA** | `apps/orchestrator-api/Dockerfile`, `apps/orchestrator-worker/Dockerfile`, `SmartDripCalculator.ts`, `packages/shared/src/index.ts` | `node:20-alpine` no incluye `tzdata` por defecto y `isWithinSafeHours`/`clampToSafeHours` dependen de `.getHours()`/`.setHours()` del SO. En contenedores Alpine sin `tzdata`, `TZ=America/Argentina/Buenos_Aires` puede caer silenciosamente en **UTC**. | Ventana `SAFE_HOURS` (`08:30–20:30`) desplazada **3 horas** en producción (disparando a las 05:30 AR). |
| **G-12** | **MEDIA** | `EvolutionApiProvider.ts` (en `api` y `worker`), `InMemoryDataStore.ts` (L187), `electron/bridge.mjs` | 1) `EvolutionApiProvider` (245 líneas) está duplicado casi idéntico entre `orchestrator-api` y `orchestrator-worker`.<br>2) `InMemoryDataStore.createMessage` ignora actualizaciones de `status` si el `whatsapp_message_id` ya existe (divergencia vs `PostgresDataStore`).<br>3) Falta plan de compatibilidad del bridge MejoraSuite (`electron/bridge.mjs` :4180 `/status`, `/events`, `/send`, `/add-and-send`) para que MejoraCRM/MejoraContactos no pierdan integración al migrar a PRD v1.0. | Deuda técnica por código duplicado, divergencia test-vs-prod y ruptura potencial de MejoraSuite si se apaga Electron. |

---

## 2. Actualización Tecnológica a Tendencias 2026–2027

### 2.1 Estrategia WhatsApp Dual-Track (*QR Local vs. Coexistence Oficial*)
- **Realidad 2026–2027:** WhatsApp endureció la detección de sesiones Baileys/Web no oficiales (requiriendo parches frecuentes por `@lid`, cipher/device updates y mayor control de velocidad), mientras Meta lanzó **WhatsApp Coexistence** (*Onboard WhatsApp Business App Users*): permite operar el **mismo número en la App WhatsApp Business del teléfono físico + API Cloud oficial de Meta en paralelo**, espejando mensajes en tiempo real sin baneo por emulación de cliente.
- **Decisión Arquitectónica para MejoraWS:**
  1. **Vía A Mejorada (Self-Hosted Free / Evolution API v2):** Actualizar la imagen en `docker-compose.yml` desde `atendai/evolution-api:v2.1.2` hacia **`evoapicloud/evolution-api` estable (`v2.3.x` / `v2.4.x`)**, incorporando resolución explícita `@lid` (`remoteJidAlt` + cache PN↔LID) y manteniendo todas las defensas conductuales (Smart Drip Box-Muller, `SAFE_HOURS`, `"composing"`, tope horario y opt-out inmediato).
  2. **Vía B Preparada (*Coexistence Ready* 2026–2027):** Implementar `MetaCloudApiProvider` cumpliendo `IMessagingProvider` (mismo contrato Clean Architecture) + endpoint webhook `/api/v1/webhooks/meta-cloud` (verificación HMAC-SHA256 `X-Hub-Signature-256`). Así el dueño puede pasar de QR/Baileys a Coexistence oficial cambiando `MESSAGING_PROVIDER=meta_cloud` en `.env` sin perder IA ni bandeja unificada. *(Nota operativa en Coexistence: las listas de difusión nativas del celular pasan a solo lectura y todo disparo masivo debe usar plantillas aprobadas de Meta).*

### 2.2 Motor de IA Agéntica con Gemini 3.8 (`thinkingLevel: "high"`)
- **Modelo por defecto recomendado (2026–2027):** `gemini-3.8-flash` (proveedor `gemini`) con `thinkingConfig: { thinkingLevel: "high" }` en evaluación de retención/escalado, y opción configurable en DB/env.
- **Patrón de llamada moderno:**
  1. Enviar `generationConfig.thinkingConfig = { thinkingLevel: "high" }` (soportado por Gemini 3.x: `"low" | "medium" | "high"`; evitar `includeThoughts: true` en producción hacia cliente final, y **filtrar defensivamente `parts.filter(p => !p.thought && typeof p.text === 'string')`** siempre antes de concatenar la respuesta).
  2. Utilizar **Salida Estructurada JSON (`responseMimeType: "application/json"`, `responseSchema`)** en una sola invocación REST para obtener atómicamente:
     - `replyText`: respuesta humana empática (sin jerga robótica ni menciones de transferencia).
     - `intent`: `'CONTAIN' | 'COMMERCIAL_HANDOFF' | 'OPT_OUT' | 'DEFER'`.
     - `confidence`: `0..1`.
     - `ownerSummaryTwoLines`: resumen accionable de 2 líneas para la alerta inmediata al dueño.
  3. **Telemetría FinOps y Resiliencia:** Persistir `promptTokenCount`, `thoughtsTokenCount` (facturado como output) y `candidatesTokenCount` en PostgreSQL + reintento con *exponential backoff* ante HTTP `429`/`503` + fallback seguro multi-proveedor/contextual para no perder el *speed-to-lead*.

### 2.3 Seguridad Zero-Trust, Observabilidad y DX 2026–2027
- **Red y Túnel:** Exponer hacia Internet vía `cloudflared` **únicamente `dashboard-ui` (Nginx)** y rutas públicas autorizadas (webhooks con firma verificada). Proteger `/api/v1/webhooks/evolution` con header secreto obligatorio (`EVOLUTION_WEBHOOK_SECRET`), `/api/v1/auth/login` con `@fastify/rate-limit` + `timingSafeEqual`, y cookie JWT `HttpOnly; SameSite=Lax; Secure` cuando `COOKIE_SECURE=true` / HTTPS.
- **Tiempo Real Nativo:** Stream **Server-Sent Events (`GET /api/v1/events`)** desde `orchestrator-api` (respaldado por Redis Pub/Sub entre `worker` y `api`) para refresco instantáneo de QR, estado de línea, mensajes y alertas al dueño sin WebSockets pesados ni F5 manual.
- **Contenedores Production-Grade:** Dockerfiles multi-stage con `tsc` estricto (sin `|| true`), `npm ci --workspaces`, usuario no-root (`USER node`), `HEALTHCHECK`, y migrador SQL idempotente con tabla `schema_migrations`.

---

## 3. Revisión del Plan Maestro Original vs. Nuevo Plan a Producción

El plan original (Pasos 1–5 en `GAP_ANALYSIS_Y_PLAN_MAESTRO_PRD_V1.md`) completó el diseño arquitectónico base, pero dejó fuera el **cableado real de extremo a extremo en ejecución** (`API ↔ Redis ↔ Worker ↔ Gemini 3.8 ↔ Evolution ↔ Postgres ↔ Dashboard en vivo`) y el endurecimiento de contenedores/seguridad.

Reemplazamos el cierre anterior por **6 Fases de Endurecimiento y Salida a Producción (`P0` a `P5`)**:

| Fase | Nombre | Meta Principal | Gate de Salida (Verificación) |
|---|---|---|---|
| **P0** | Estabilización Local, Puertos y Limpieza Monorepo | Corregir colisión de puertos (`5176` vs `5173`), sincronizar Vitest, ajustar `doctor.mjs` y `dev:prd` | `npm run build && npm run build:prd && npm run doctor && npm test` en verde |
| **P1** | Motor IA Real con Gemini 3.8 (`high`) y Webhook Seguro | Cablear `AIRetentionEngine` + `MultiProviderLLMAdapter` real en cola asíncrona (`inbound_ai`), soporte nativo Gemini 3.8 `thinkingLevel: "high"` + JSON schema + filtro `thought`, disparo real `OwnerWebhookNotifier`, anti race-condition en `sent_cache` y autenticación de webhook | Tests de integración con payload real Gemini (mocked HTTP + contrato real) y prueba unitaria filtro `part.thought === true` |
| **P2** | Evolution API 2026 (`@lid`), Media Upload y Tiempo Real (SSE) | Actualizar imagen Docker Evolution, resolver `@lid`/`remoteJidAlt`, endpoint `POST /api/v1/media/upload` + Nginx proxy `/media/`, y SSE `GET /api/v1/events` con Redis Pub/Sub hacia `dashboard-ui` | Tests de `@lid` + upload PDF/imagen + reconexión SSE y actualización en vivo de QR/Inbox |
| **P3** | Hardening Seguridad, Migraciones SQL y Dockerfiles Reales | Eliminar `\|\| true` en Dockerfiles, correr `USER node`, agregar `HEALTHCHECK`, rate-limit login, `timingSafeEqual`, migrador automático `002_ai_telemetry_and_migrations.sql` | `docker compose config` válido; `docker compose build` sin errores ocultos |
| **P4** | Preparación Coexistence (`MetaCloudApiProvider`) y Observabilidad | Implementar adaptador `MetaCloudApiProvider` (`IMessagingProvider`) + webhook HMAC Meta + métricas FinOps de tokens IA en Dashboard | Tests de contrato `IMessagingProvider` pasando sobre Evolution y Meta Cloud |
| **P5** | Despliegue Real, Vinculación QR y Certificación con `3764358152` y `3765007805` | Levantar stack completo con Docker (`postgres`+`redis`+`evolution-api`+`api`+`worker`+`dashboard-ui`), vincular QR real y ejecutar 10+ escenarios E2E reales sobre dispositivos físicos | Confirmación física en teléfonos de destino, handoff desde celular físico verificado y checklist Go-Live firmado |

---

## 4. Backlog Técnico Detallado y Checklist de Ejecución (Estado Vivo)

### Fase P0 — Higiene de Entorno, Puertos y Scripts
- [ ] **P0.1** Corregir conflicto de puertos en desarrollo local: dejar Root Electron Vite en `5176` y asignar puerto `5174` (o `5173` consistente) a `apps/dashboard-ui/vite.config.js`, actualizando `scripts/doctor.mjs`, `.env.example` y `apps/orchestrator-worker/src/config/env.ts` (`DASHBOARD_BASE_URL` en dev vs. Docker `5176`).
- [ ] **P0.2** Actualizar `dev:prd` en `package.json` para levantar `dev:api`, `dev:worker` y `dev:dashboard` en conjunto (con `concurrently -k`).
- [ ] **P0.3** Alinear versión de `vitest` a `^5.1.0` en `apps/orchestrator-api/package.json` y `apps/orchestrator-worker/package.json` para evitar inconsistencias de dependencias en `node_modules`.
- [ ] **P0.4** Añadir script `typecheck` en todos los workspaces y raíz (`tsc --noEmit`).
- [ ] **P0.5** Corregir divergencia en `InMemoryDataStore.createMessage()` (actualizar `status` en conflicto de `whatsapp_message_id` igual que `PostgresDataStore`) y unificar `clampDateToSafeHours` usando cálculo consciente de `env.TZ` (`Intl.DateTimeFormat`).

### Fase P1 — IA Real Gemini 3.8 (`high`), Desacoplamiento Inbound y Seguridad Webhook
- [ ] **P1.1** Actualizar defaults de `.env.example`, `database/migrations/001_initial_schema.sql`, `apps/orchestrator-api/src/config/env.ts`, `apps/orchestrator-worker/src/config/env.ts`, `InMemoryWorkerStore` y `apps/dashboard-ui/src/App.jsx` a `AI_PROVIDER=gemini`, `AI_MODEL=gemini-3.8-flash` y `AI_THINKING_LEVEL=high`.
- [ ] **P1.2** Refactorizar `MultiProviderLLMAdapter.ts`:
  - Soporte explícito en Gemini `v1beta/models/{model}:generateContent` para `generationConfig.thinkingConfig: { thinkingLevel: env.AI_THINKING_LEVEL }` (solo cuando corresponda a familia Gemini 3.x/4.x; usar `thinkingBudget` si es `gemini-2.5-*`).
  - Filtrar obligatoriamente `candidates[0].content.parts.filter(p => !p.thought && typeof p.text === 'string')`.
  - Implementar modo estructurado JSON (`responseMimeType: 'application/json'`, `responseSchema`) para devolver `{ replyText, intent, confidence, ownerSummaryTwoLines }` en **1 sola llamada** (manteniendo fallback compatible para `openai`/`anthropic`).
  - Incorporar reintentos con *exponential backoff* ante HTTP `429`/`503` y captura de `usageMetadata` (`promptTokenCount`, `thoughtsTokenCount`, `candidatesTokenCount`).
- [ ] **P1.3** Conectar `AIRetentionEngine` real en el flujo de producción (eliminando `buildRetentionReply()` hardcoded de `apiV1Routes.ts`):
  - **Opción arquitectónica limpia (PRD § 2):** `orchestrator-api` persiste el mensaje entrante en Postgres y encola un job en cola BullMQ `inbound_ai_events`; **`orchestrator-worker`** consume `inbound_ai_events` ejecutando `AIRetentionEngine` + `MultiProviderLLMAdapter` + `OwnerWebhookNotifier` (HTTP POST real a `OWNER_ALERT_WEBHOOK_URL` / `ai_config.alert_webhook_url`) + encola la respuesta en `outbound_messages` (con simulación `"composing"`).
  - En modo fallback sin Redis (`InMemoryQueueDispatcher` para tests E2E sin Docker), proveer ejecutor in-process o inyección opcional en `buildApp` para mantener la suite `test_prd_v1_acceptance.test.ts` verde sin mocks triviales.
- [ ] **P1.4** Corregir race condition de `sent_cache`:
  - En `OutboundMessageProcessor.ts` y `POST /api/v1/conversations/:contactId/messages`, registrar una llave corta de envío en vuelo en Redis (`outbound_inflight:{jid}`, TTL 15s) **antes** de invocar `messagingProvider.sendMessage(...)`, además de `sent_cache:{messageId}` inmediatamente al recibir respuesta.
  - En `apiV1Routes.ts` (`fromMe: true`), verificar `sent_cache:{waMsgId}` O coincidencia de envío en vuelo antes de declarar `HUMAN_TAKEOVER`.
- [ ] **P1.5** Asegurar endpoints críticos en `apiV1Routes.ts` y `auth.ts`:
  - Exigir header `x-evolution-secret` / token en `POST /api/v1/webhooks/evolution` (configurado también en `docker-compose.yml` vía `WEBHOOK_GLOBAL_HEADERS` o query secret interno).
  - Agregar `@fastify/rate-limit` sobre `/api/v1/auth/login`.
  - Usar `crypto.timingSafeEqual` en comparación de `ADMIN_PASSWORD`, `MASTER_API_KEY` y secretos.
  - Hacer dinámica la directiva `Secure` en cookie `AUTH_COOKIE_NAME` cuando `request.protocol === 'https'` o `env.COOKIE_SECURE === true`.

### Fase P2 — WhatsApp 2026 (`@lid`), Subida de Multimedia y Tiempo Real (SSE)
- [ ] **P2.1** Actualizar `docker-compose.yml` imagen Evolution API de `atendai/evolution-api:v2.1.2` a versión estable verificada `evoapicloud/evolution-api` (`v2.3.x` / `v2.4.x`) y documentar variables de entorno requeridas en `.env.example`.
- [ ] **P2.2** Manejar identificadores `@lid` en `apiV1Routes.ts` y `EvolutionApiProvider.ts`:
  - Inspeccionar `key.remoteJidAlt` / `key.participantAlt` cuando `remoteJid.endsWith('@lid')`.
  - Si solo llega `@lid` sin `remoteJidAlt`, consultar perfil/chat en Evolution API para resolver o almacenar `lid` en `contacts.metadata.lid` sin contaminar `phone_number` con dígitos LID falsos.
  - Actualizar `EvolutionApiProvider.syncContacts()` para preservar y mapear contactos con LID cuando traigan número alternativo.
- [ ] **P2.3** Implementar subida de multimedia real en `orchestrator-api`:
  - Endpoint `POST /api/v1/media/upload` autenticado usando `@fastify/multipart` (límite 16 MB, validación estricta de MIME allowlist: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, Office docs, audio OGG/MP3).
  - Servir archivos vía `@fastify/static` bajo `/api/v1/media/:filename` (con volumen compartido `uploads_data` en `docker-compose.yml` y proxy en `apps/dashboard-ui/nginx.conf`) para que Evolution API dentro de `whatsapp_net` descargue el adjunto sin exponer rutas de disco del host.
  - Conectar selector de archivo local en el Módulo 2 (*Programador Inteligente*) e Inbox de `apps/dashboard-ui/src/App.jsx`.
- [ ] **P2.4** Tiempo Real sin F5 (**SSE + Redis Pub/Sub**):
  - Endpoint `GET /api/v1/events` (SSE autenticado por JWT Cookie / API key) emitiendo eventos: `qr.updated`, `connection.updated`, `message.created`, `message.status`, `ai.alert`.
  - Reemplazar la carga única en `apps/dashboard-ui/src/App.jsx` por suscripción SSE + fallback de polling conservador cada 15s (QR cada 10s cuando está `connecting`).

### Fase P3 — Migraciones SQL, Hardening Dockerfiles y Operación VPS
- [ ] **P3.1** Crear migración `database/migrations/002_ai_telemetry_and_migrations.sql` con:
  - Tabla `schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())`.
  - Tabla `ai_usage_logs(id UUID, contact_id UUID, provider TEXT, model TEXT, prompt_tokens INT, thought_tokens INT, output_tokens INT, latency_ms INT, intent TEXT, created_at TIMESTAMPTZ)`.
  - Actualizar fallback en `PostgresDataStore.getAIConfig()` y `PostgresWorkerStore.getAIConfig()` para auto-insertar fila por defecto si `id=1` no existe.
- [ ] **P3.2** Crear ejecutor de migraciones al arranque de `orchestrator-api` (`src/infrastructure/persistence/runMigrations.ts`) antes de levantar Fastify.
- [ ] **P3.3** Reescribir `apps/orchestrator-api/Dockerfile`, `apps/orchestrator-worker/Dockerfile` y `apps/dashboard-ui/Dockerfile`:
  - **Eliminar `|| true`** en todos los `RUN npm run build`.
  - Instalar `tzdata` en imágenes Alpine (`apk add --no-cache tzdata`) para garantizar `TZ=America/Argentina/Buenos_Aires` real en Postgres/Node.
  - Copiar los manifiestos de todos los workspaces requeridos y usar `npm ci`.
  - Ejecutar Node como usuario no privilegiado (`USER node`) en etapa `runner` con únicamente producción (`dist` + deps de runtime).
  - Agregar `HEALTHCHECK` HTTP en `orchestrator-api` (`/api/v1/health/live` ligero sin auth para Docker healthcheck, distinto de `/api/v1/system/health` privado) y `dashboard-ui`.
  - Agregar `healthcheck` a `orchestrator-api`, `orchestrator-worker` y `dashboard-ui` en `docker-compose.yml` + política de rotación de logs (`json-file`, `max-size: 10m`, `max-file: 3`).

### Fase P4 — Coexistence Ready (`MetaCloudApiProvider`) y FinOps Dashboard
- [ ] **P4.1** Crear `apps/orchestrator-api/src/infrastructure/providers/MetaCloudApiProvider.ts` (y compartido en `@mejoraws/shared` o paquete adaptador común para no duplicar `EvolutionApiProvider.ts` entre `api` y `worker`!) implementando `IMessagingProvider`:
  - Envío vía Graph API (`v21.0+`) de texto, URLs, imágenes, PDFs y plantillas aprobadas.
  - Webhook `/api/v1/webhooks/meta-cloud` (`GET` hub challenge + `POST` verificación `X-Hub-Signature-256`) preparado para **WhatsApp Coexistence** (capturando mensajes enviados desde la app móvil `smb_message_echoes` para mantener el silenciamiento `HUMAN_TAKEOVER` igual que con celular físico!).
- [ ] **P4.2** Consolidar `EvolutionApiProvider.ts` duplicado hoy entre `apps/orchestrator-api` y `apps/orchestrator-worker` moviéndolo a `@mejoraws/shared` (Clean Code: cero duplicación).
- [ ] **P4.3** Agregar panel de métricas de costos/tokens Gemini 3.8, alertas recientes de escalado y estado de cola Dead-Letter (`DLQ`) en `apps/dashboard-ui`.
- [ ] **P4.4** Validar contrato de compatibilidad para **MejoraSuite** (`MejoraCRM` / `MejoraContactos` actualmente atados a `electron/bridge.mjs` :4180 `/status`, `/events`, `/send`, `/add-and-send`) exponiendo puente equivalente o adaptador documentado sobre `orchestrator-api`.

### Fase P5 — Certificación Real en Contenedores y Salida a Producción
- [ ] **P5.1** Validación de configuración e imágenes: `docker compose config`, `docker compose build --no-cache`, `docker compose up -d`.
- [ ] **P5.2** Verificación de servicios vivos: PostgreSQL tablas + migraciones aplicadas, Redis `PING` + BullMQ colas activas, Evolution API instancia `principal_v1` creada, Nginx sirviendo Dashboard y proxiando `/api/` y SSE.
- [ ] **P5.3** Vinculación QR real desde el Dashboard Web y verificación de `connectionState === 'open'`.
- [ ] **P5.4** Pruebas de humo reales (envíos físicos controlados con `ENFORCE_WHITELIST=true` hacia `3764358152` → `5493764358152@s.whatsapp.net` y `3765007805` → `5493765007805@s.whatsapp.net`):
  1. Envío individual de texto + Spintax + simulación `"composing"`.
  2. Envío programado Smart Drip con lote y verificación de timestamps.
  3. Envío con archivo adjunto (imagen y PDF subidos vía Dashboard).
  4. Respuesta real desde teléfono receptor → respuesta real generada por **Gemini 3.8 High** (verificando cero texto robótico y cero bloque `thought`).
  5. Palabra clave comercial → alerta real recibida en `OWNER_ALERT_WEBHOOK_URL` con resumen de 2 líneas + link al chat.
  6. Intervención desde celular físico del dueño → transición inmediata a `HUMAN_TAKEOVER` sin respuesta IA encima.
  7. Botón de Pánico Global pausa/reanuda cola BullMQ en vivo.
- [ ] **P5.5** Despliegue final en VPS Linux (o servidor host elegido) con HTTPS vía Cloudflare Tunnel (`docker compose --profile tunnel up -d`) y backup programado `pg_dump`.

---

## 5. Invariantes de Ingeniería y Reglas Anti-Regresión

1. **No romper lo existente:** La app desktop (`electron/main.mjs`, `src/App.jsx`) y el flujo de *Carga Manual y Envío Directo* deben seguir compilando (`npm run build`) y pasando sus pruebas (`electron/pure.test.mjs`) mientras conviven con la plataforma Docker PRD v1.0.
2. **Desacoplamiento estricto (`IMessagingProvider`):** Ningún caso de uso en `orchestrator-api` ni `orchestrator-worker` puede importar Baileys o acoplarse a detalles HTTP crudos de Evolution/Meta fuera de su adaptador.
3. **Nunca ocultar errores de build ni usar fallbacks silenciosos inseguros:** Todo fallo de TypeScript en Docker debe abortar la imagen; en runtime, toda falla de API externa (Gemini / Evolution) debe quedar registrada con trazabilidad y retry controlado.
4. **Cero secretos en Git:** Nunca commitear `.env`, sesiones `evolution_instances`, tokens de Cloudflare o claves reales `sk_live_` / Gemini API Keys.
5. **Validación mínima después de cada commit/fase:**
   ```bash
   npm run build
   npm run build:prd
   npm test
   npm run doctor
   ```

---

## 6. Bloqueos Actuales y Decisiones Necesarias del Dueño para Producción

Para avanzar hasta **P5 (Producción Real)** sin frenos ni suposiciones:

1. **Entorno de Contenedores (`Docker`):** En esta máquina Windows actual **Docker no está instalado**. Se necesita definir si:
   - *(Opción A)* Instalamos Docker Desktop en este equipo para pruebas locales E2E en vivo antes de subir al VPS, o
   - *(Opción B)* Conectamos/desplegamos directamente en un **VPS Linux (Ubuntu 24.04 · 2 vCPU / 4 GB RAM)** con Docker Engine + Docker Compose v2.
2. **Credenciales Reales (`.env` de Producción):**
   - `AI_API_KEY` de Google AI Studio (para `gemini-3.8-flash` con esfuerzo `high`).
   - `OWNER_ALERT_WEBHOOK_URL` real (n8n, Make, Apps Script, Slack, Discord o endpoint propio donde recibir alertas de escalado).
   - `CLOUDFLARE_TUNNEL_TOKEN` y dominio (si necesitás acceso remoto HTTPS para webhooks o paneles fuera de la red local).
   - Claves maestras definitivas (`ADMIN_PASSWORD`, `JWT_SECRET`, `MASTER_API_KEY`, `EVOLUTION_API_KEY`, `POSTGRES_PASSWORD`).
3. **Estrategia de Línea WhatsApp:** Confirmar si salimos primero con **Vía A (QR en Evolution API)** con límites estrictos anti-ban, o si tenés lista una app **WhatsApp Business + Portfolio Meta** para activar **Coexistence** en Fase P4–P5.
4. **Sesión de Prueba Física:** Momento en que puedas escanear el QR desde la línea emisora para validar recepción real en `3764358152` y `3765007805`.
