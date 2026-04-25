# 06 — Riesgos Legales y Compliance

## ⚠️ IMPORTANTE: Este documento NO es asesoría legal

Consulta con un abogado antes de implementar cualquier sistema de comunicación automatizada.

---

## 1. WhatsApp Terms of Service (ToS)

### Lo que prohíbe WhatsApp
Según los [Términos de Servicio de WhatsApp](https://www.whatsapp.com/legal/terms-of-service):

- ❌ **Envíos masivos no solicitados** (spam)
- ❌ **Automatización no autorizada** (bots no oficiales)
- ❌ **Scraping** de números o datos
- ❌ **Recopilación automatizada** de información de usuarios
- ❌ **Mensajes comerciales sin consentimiento**

### Riesgos de incumplimiento
- **Baneo del número** de teléfono asociado
- **Baneo permanente** del dispositivo
- **Acciones legales** de Meta (en casos graves)
- **Pérdida de datos** almacenados en WhatsApp

### Mitigación para uso personal
1. ✅ Solo enviar a contactos que **dieron consentimiento explícito**
2. ✅ Mantener volumen bajo (< 50 mensajes/día)
3. ✅ No hacer scraping de números
4. ✅ Implementar opt-out fácil ("envía STOP para dejar de recibir mensajes")
5. ✅ No revender el servicio a terceros
6. ✅ Mantener delays naturales entre mensajes (no instantáneo)

### Nivel de riesgo: **MEDIO**
- Uso personal con consentimiento = riesgo bajo
- Envío masivo sin consentimiento = riesgo alto

---

## 2. API Oficial de Meta vs No-Oficial

### whatsapp-web.js / Baileys (No-oficial)
| Aspecto | Estado |
|---------|--------|
| Permitido por ToS | ❌ No |
| Uso personal bajo perfil | ⚠️ Zona gris |
| Riesgo de ban | ⚠️ Medio |
| Soporte de Meta | ❌ Ninguno |

### WhatsApp Cloud API (Oficial)
| Aspecto | Estado |
|---------|--------|
| Permitido por ToS | ✅ Sí |
| Costo | Por mensaje (después de 1000 gratis/mes) |
| Limitaciones | Templates aprobados, verificación de negocio |
| Riesgo de ban | ✅ Muy bajo |

### Recomendación
- **MVP / uso personal:** whatsapp-web.js es aceptable si se mantiene volumen bajo
- **Producción / clientes:** Migrar a API oficial de Meta

---

## 3. Protección de Datos Personales

### Regulaciones aplicables

| Regulación | Aplica si... | Requisitos principales |
|------------|--------------|------------------------|
| **GDPR** (UE) | Contactos en la UE | Consentimiento, derecho al olvido, DPO |
| **LOPD** (España) | Contactos en España | Similar a GDPR, registro en AEPD |
| **LGPD** (Brasil) | Contactos en Brasil | Consentimiento, minimización |
| **CCPA** (California) | Contactos en California | Derecho a saber y borrar |
| **Ley 25.326** (Argentina) | Contactos en Argentina | Consentimiento, registro en AAIP |

### Obligaciones generales
1. **Consentimiento explícito** antes de enviar marketing
2. **Minimización de datos** — solo recopilar lo necesario
3. **Derecho al olvido** — poder borrar datos de un contacto
4. **Seguridad** — encriptar datos almacenados
5. **Registro de actividades** — log de cuándo se dio consentimiento
6. **Notificación de brechas** — informar si hay acceso no autorizado

### Implementación en nuestro sistema
```
contacts.consent_marketing  → ¿Dio consentimiento?
contacts.consent_date       → ¿Cuándo?
contacts.metadata           → Fuente del consentimiento
DELETE /api/contacts/:id    → Derecho al olvido
```

---

## 4. Leyes Anti-Spam

### Por país

| País | Ley | Multa máxima | Requisito clave |
|------|-----|--------------|-----------------|
| España | LSSI-CE | €600,000 | Consentimiento previo |
| Argentina | Ley 26.032 | Variable | Consentimiento expreso |
| México | LFPC | Variable | Opt-out obligatorio |
| Colombia | Ley 1581 | 2,000 SMLV | Autorización previa |
| Chile | Ley 19.628 | Variable | Consentimiento informado |
| USA | CAN-SPAM | $46,517/email | Opt-out en cada mensaje |

### Regla universal
**Siempre incluir opción de baja** en cada mensaje de marketing.

---

## 5. Propiedad Intelectual

### Código de terceros
- **whatsapp-web.js**: Apache 2.0 → ✅ Uso libre
- **Baileys**: No tiene licencia clara → ⚠️ Zona gris
- **React/Next.js**: MIT → ✅ Uso libre
- **PostgreSQL**: PostgreSQL License → ✅ Uso libre

### Nuestro código
- Como proyecto personal, el código es de tu propiedad
- Si se usa código de repositorios con licencia, respetar sus términos

---

## 6. Checklist de Compliance

Antes de poner el sistema en producción:

- [ ] Solo contactos con consentimiento explícito
- [ ] Registro de fecha y fuente de consentimiento
- [ ] Opción de opt-out en cada mensaje
- [ ] Política de privacidad accesible
- [ ] Datos encriptados at-rest y in-transit
- [ ] Backup de base de datos
- [ ] Proceso para borrar datos de un contacto
- [ ] No compartir datos con terceros
- [ ] Volumen de mensajes controlado (< 50/día)
- [ ] No scraping de números
- [ ] Delay natural entre mensajes
- [ ] Horarios de envío respetados (no 3am)

---

## 7. Veredicto Legal Final

### Para uso personal ✅
- Contactos que dieron consentimiento
- Volumen bajo (< 50 mensajes/día)
- Sin fines de lucro directo
- Con opción de baja
- **Riesgo: BAJO-MEDIO**

### Para uso comercial ⚠️
- Requiere API oficial de Meta
- Requiere cumplimiento GDPR/LOPD
- Requiere registro como empresa
- **Riesgo: ALTO si no se hace correctamente**

### Para revender como servicio ❌
- Necesita API oficial obligatoriamente
- Necesita contrato de procesamiento de datos
- Necesita seguro de responsabilidad civil
- **Riesgo: MUY ALTO sin estructura legal**
