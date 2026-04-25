# 04 — Roadmap Técnico del MVP

## Fase 0: Setup (Día 1-2)

### Infraestructura
- [ ] Crear cuenta en DigitalOcean/Hetzner
- [ ] Provisionar VPS (2 vCPU, 4GB RAM, 80GB SSD)
- [ ] Instalar Docker + Docker Compose
- [ ] Configurar dominio + DNS (Cloudflare)
- [ ] Configurar SSL (Let's Encrypt)
- [ ] Crear repo GitHub privado

### Desarrollo
- [ ] Inicializar proyecto Node.js con TypeScript
- [ ] Configurar Prisma + PostgreSQL
- [ ] Configurar Redis
- [ ] Setup de ESLint, Prettier, Husky
- [ ] Docker Compose base
- [ ] GitHub Actions CI/CD básico

---

## Fase 1: WhatsApp Connection (Semana 1)

### Objetivo: Conectar WhatsApp y poder enviar/recibir mensajes

**Día 1-2: Conexión básica**
- [ ] Integrar whatsapp-web.js
- [ ] Implementar flujo de autenticación QR
- [ ] Guardar sesión para persistencia
- [ ] Health check de conexión

**Día 3-4: Mensajería básica**
- [ ] Enviar mensaje de texto
- [ ] Recibir mensaje y procesar
- [ ] Enviar media (imagen, documento)
- [ ] Logging de mensajes

**Día 5: Testing y estabilidad**
- [ ] Reconexión automática
- [ ] Manejo de errores
- [ ] Test con número de prueba
- [ ] Documentar API interna

**Entregable:** Servicio que mantiene conexión WhatsApp activa y puede enviar/recibir mensajes.

---

## Fase 2: CRM Básico (Semana 2-3)

### Objetivo: Gestionar contactos y pipeline de ventas

**Semana 2: Backend CRM**
- [ ] Modelo de datos: contacts, tags, activities
- [ ] CRUD de contactos
- [ ] Sistema de tags
- [ ] Registro automático de actividades (mensajes enviados/recibidos)
- [ ] Búsqueda y filtrado de contactos

**Semana 3: Backend CRM (cont.) + Frontend**
- [ ] Modelo de datos: deals (pipeline)
- [ ] CRUD de deals
- [ ] Movimiento entre etapas del pipeline
- [ ] Frontend: Lista de contactos con filtros
- [ ] Frontend: Kanban board del pipeline
- [ ] Frontend: Detalle de contacto con historial
- [ ] Frontend: Dashboard con métricas básicas

**Entregable:** Dashboard web donde ver contactos, pipeline y actividades.

---

## Fase 3: Bot con IA (Semana 3-4)

### Objetivo: Bot que responde automáticamente con contexto

**Semana 3 (paralelo con CRM):**
- [ ] Integrar OpenAI API (GPT-4o-mini)
- [ ] Sistema de prompts configurable
- [ ] Detección de intención del mensaje
- [ ] Respuesta automática con contexto

**Semana 4: Memoria y aprendizaje**
- [ ] Configurar pgvector
- [ ] Generar embeddings de conversaciones
- [ ] Retrieval de contexto relevante (RAG)
- [ ] Knowledge base: agregar documentos FAQ
- [ ] Escalamiento a humano (palabra clave o timeout)
- [ ] Configuración de horarios de atención

**Entregable:** Bot que responde preguntas frecuentes y escala a humano cuando es necesario.

---

## Fase 4: Marketing Module (Semana 4-5)

### Objetivo: Enviar campañas de marketing segmentadas

**Semana 4 (paralelo con Bot):**
- [ ] Modelo de datos: campaigns, campaign_contacts
- [ ] Crear campaña con template
- [ ] Segmentar contactos por tags/etapa
- [ ] Programar envío

**Semana 5: Envío y métricas**
- [ ] Cola de envío con BullMQ
- [ ] Rate limiting (max 20 mensajes/minuto)
- [ ] Delay aleatorio entre mensajes
- [ ] Tracking de estados (enviado, entregado, leído)
- [ ] Frontend: Crear/editar campañas
- [ ] Frontend: Ver estadísticas de campaña
- [ ] Frontend: Preview de mensaje antes de enviar

**Entregable:** Sistema de campañas con envío escalonado y métricas.

---

## Fase 5: Polish y Estabilidad (Semana 5-6)

### Objetivo: Estabilidad, UX y preparación para uso diario

**Semana 5-6:**
- [ ] Manejo robusto de errores
- [ ] Reconexión automática de WhatsApp
- [ ] Notificaciones de desconexión
- [ ] Backup automático de base de datos
- [ ] Logs centralizados
- [ ] Métricas de sistema (RAM, CPU, disco)
- [ ] Optimización de queries lentas
- [ ] Responsive design del dashboard
- [ ] Documentación de uso personal
- [ ] Testing manual completo

**Entregable:** Sistema estable y usable diariamente.

---

## Gantt Visual

```
Semana:    1      2      3      4      5      6
         ┌──────┬──────┬──────┬──────┬──────┬──────┐
WhatsApp │██████│      │      │      │      │      │
CRM      │      │██████│██████│      │      │      │
Bot IA   │      │      │██████│██████│      │      │
Marketing│      │      │      │██████│██████│      │
Polish   │      │      │      │      │██████│██████│
         └──────┴──────┴──────┴──────┴──────┴──────┘
```

---

## Dependencias Críticas

```
WhatsApp Connection ──► CRM (registra actividades)
                   ──► Bot IA (procesa mensajes)
                   ──► Marketing (envía campañas)

CRM ──► Bot IA (accede a info de contacto)
     ──► Marketing (segmenta contactos)

Bot IA ──► Marketing (puede activar campañas)
```

---

## Tecnologías por Fase

| Fase | Dependencias npm principales |
|------|------------------------------|
| 1 | whatsapp-web.js, qrcode-terminal, express |
| 2 | prisma, @prisma/client, zod |
| 3 | openai, langchain, pgvector |
| 4 | bullmq, ioredis |
| 5 | winston (logging), node-cron |

---

## Criterios de Aceptación del MVP

El MVP está **completo** cuando:

1. ✅ WhatsApp está conectado y estable
2. ✅ Puedo ver mis contactos en el dashboard
3. ✅ Puedo mover deals en el pipeline Kanban
4. ✅ El bot responde automáticamente a mensajes
5. ✅ El bot usa contexto de conversaciones previas
6. ✅ Puedo crear y enviar una campaña de marketing
7. ✅ Puedo ver métricas básicas
8. ✅ El sistema se mantiene estable por 24h+
