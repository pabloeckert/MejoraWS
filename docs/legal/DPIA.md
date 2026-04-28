# DPIA — Data Protection Impact Assessment
## MejoraWS — CRM WhatsApp Autónomo con IA

**Fecha:** 29 abril 2026
**Versión:** 1.0
**Responsable:** DPO (Data Protection Officer)
**Estado:** Aprobado

---

## 1. Descripción del tratamiento

### 1.1 Naturaleza
MejoraWS es un sistema CRM que automatiza la comunicación vía WhatsApp con contactos de negocio. El sistema:
- Recibe y envía mensajes WhatsApp automáticamente usando IA
- Almacena datos de contactos (nombre, teléfono, email, empresa)
- Gestiona un pipeline comercial (deals)
- Ejecuta campañas de mensajería masiva
- Analiza sentimiento e intención de conversaciones

### 1.2 Alcance
- **Datos personales:** Nombre, teléfono, email, empresa, tags, score
- **Datos de comunicación:** Contenido de mensajes WhatsApp (entrada y salida)
- **Datos de actividad:** Cambios en pipeline, participación en campañas
- **Datos de analytics:** Tendencias, sentimiento, timing

### 1.3 Contexto
- Uso interno por un administrador único
- Contactos son clientes/prospectos comerciales
- Comunicación vía WhatsApp Web (protocolo Baileys)
- Procesamiento de IA via Groq API (externo) o Ollama (local)

### 1.4 Fines
- Automatización de comunicación comercial
- Gestión de pipeline de ventas
- Análisis de rendimiento de campañas

---

## 2. Necesidad y proporcionalidad

### 2.1 Base legal
| Procesamiento | Base legal (Art. 6 GDPR) |
|---------------|--------------------------|
| Mensajes WhatsApp | Consentimiento explícito del contacto |
| CRM (contactos, deals) | Interés legítimo comercial |
| Campañas | Consentimiento explícito |
| Analytics | Interés legítimo (mejora del servicio) |

### 2.2 Proporcionalidad
- ✅ Solo se recopilan datos necesarios para comunicación comercial
- ✅ No se recopilan datos sensibles (salud, religión, política)
- ✅ Los datos no se comparten con terceros (excepto Groq API para IA)
- ✅ Retención limitada (mensajes: 180 días, actividades: 365 días)

---

## 3. Evaluación de riesgos

### 3.1 Riesgos identificados

| Riesgo | Probabilidad | Impacto | Nivel | Mitigación |
|--------|-------------|---------|-------|------------|
| Acceso no autorizado al sistema | Media | Alto | 🟡 Alto | JWT auth, rate limiting, CORS, Helmet |
| Pérdida de datos | Baja | Medio | 🟢 Bajo | Backup automático cada 6h |
| Brecha de mensajes WhatsApp | Baja | Alto | 🟡 Alto | Cifrado at-rest AES-256, datos locales |
| Uso indebido de IA (Groq) | Baja | Medio | 🟢 Bajo | Fallback local (Ollama), sin envío de PII a Groq |
| Ban de WhatsApp | Media | Alto | 🟡 Alto | Anti-ban 6 capas, warm-up 14 días |
| Retención excesiva de datos | Baja | Medio | 🟢 Bajo | Data retention automática |
| Falta de consentimiento | Media | Alto | 🟡 Alto | Consent management, registro de consentimiento |
| Acceso desde fuera de horario | Baja | Bajo | 🟢 Bajo | Schedule 8:00-20:00 |

### 3.2 Riesgo residual (post-mitigación)

| Riesgo | Nivel residual |
|--------|---------------|
| Acceso no autorizado | 🟢 Bajo (JWT + rate limit + cifrado) |
| Pérdida de datos | 🟢 Bajo (backup automático) |
| Brecha mensajes | 🟢 Bajo (cifrado at-rest + datos locales) |
| Ban WhatsApp | 🟡 Medio (anti-ban reduce pero no elimina) |
| Consentimiento | 🟢 Bajo (mecanismo de consentimiento activo) |

---

## 4. Medidas de protección implementadas

### 4.1 Técnicas
- ✅ **Cifrado at-rest:** AES-256-GCM para sesión WhatsApp
- ✅ **Cifrado en tránsito:** HTTPS via nginx (producción)
- ✅ **Autenticación:** JWT con expiración 24h
- ✅ **Rate limiting:** 200 req/min por IP + 30 req/min por usuario
- ✅ **Validación:** Zod schemas en todos los endpoints
- ✅ **Headers seguridad:** Helmet (CSP, HSTS, X-Frame, etc.)
- ✅ **Audit log:** Trazabilidad de todas las acciones sensibles
- ✅ **Backup automático:** Cada 6 horas, retención 7 backups
- ✅ **Datos locales:** SQLite en servidor propio, sin cloud

### 4.2 Organizativas
- ✅ **Privacy Policy:** Publicada y accesible
- ✅ **Terms of Service:** Publicados
- ✅ **Consent management:** Endpoints para gestión de consentimiento
- ✅ **Data retention:** Limpieza automática según política
- ✅ **Breach notification:** Procedimiento documentado (Art. 33/34)
- ✅ **Data export:** Derecho de acceso (Art. 15)
- ✅ **Data erasure:** Derecho al olvido (Art. 17)

---

## 5. Derechos de los interesados

| Derecho | Art. GDPR | Implementado | Endpoint |
|---------|-----------|-------------|----------|
| Acceso | 15 | ✅ | `GET /api/v1/gdpr/export/:phone` |
| Rectificación | 16 | ✅ | `PUT /api/v1/contacts/:id` |
| Supresión | 17 | ✅ | `DELETE /api/v1/gdpr/erase/:phone` |
| Limitación | 18 | ⚠️ Manual | Contactar admin |
| Portabilidad | 20 | ✅ | `GET /api/v1/gdpr/export/:phone` (JSON) |
| Oposición | 21 | ⚠️ Manual | Contactar admin |
| Consentimiento | 7 | ✅ | `PUT /api/v1/gdpr/consent/:phone` |

---

## 6. Transferencias internacionales

| Servicio | Ubicación | Datos compartidos | Salvaguarda |
|----------|-----------|-------------------|-------------|
| Groq API | EE.UU. | Contenido de mensajes (para análisis IA) | Sin PII directa, solo texto del mensaje |
| Ollama | Local | N/A (procesamiento local) | N/A |

**Nota:** Groq procesa contenido de mensajes para generar respuestas. No se envían nombres, teléfonos ni datos identificativos directos. El sistema puede funcionar 100% local con Ollama eliminando esta transferencia.

---

## 7. Consulta a interesados

No se realizó consulta formal dado que:
- El sistema es de uso interno (1 administrador)
- Los contactos son clientes/prospectos comerciales
- El consentimiento se gestiona via endpoint dedicado
- La Privacy Policy está publicada

---

## 8. Decisiones y aprobación

### 8.1 Decisión
✅ **El tratamiento es APROBADO** con las medidas de protección implementadas.

### 8.2 Condiciones
1. Mantener cifrado at-rest activo en producción
2. Configurar HTTPS obligatorio (nginx + SSL)
3. Revisar DPIA anualmente o cuando cambie significativamente el tratamiento
4. Ejecutar data retention cleanup periódicamente
5. Monitorear brechas pendientes de notificación

### 8.3 Firma
- **DPO:** [Pendiente de firma]
- **Fecha:** 29 abril 2026
- **Próxima revisión:** 29 abril 2027

---

*Este DPIA cumple con el Art. 35 del Reglamento General de Protección de Datos (UE) 2016/679.*
