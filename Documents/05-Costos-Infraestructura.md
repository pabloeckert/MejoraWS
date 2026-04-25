# 05 — Costos e Infraestructura

## Costos del MVP (Uso Personal)

### Infraestructura Mensual

| Componente | Proveedor | Costo/mes | Notas |
|------------|-----------|-----------|-------|
| VPS | DigitalOcean | $6-12 | 2 vCPU, 4GB RAM |
| Dominio | Cloudflare | $0-10/año | ~$1/mes |
| SSL | Let's Encrypt | $0 | Gratuito |
| Backup | DigitalOcean | $1-2 | Snapshots automáticos |
| DNS/CDN | Cloudflare | $0 | Plan gratuito |
| **Subtotal infra** | | **$7-15/mes** | |

### Servicios de IA

| Componente | Proveedor | Costo/mes estimado | Notas |
|------------|-----------|--------------------|-------|
| LLM (GPT-4o-mini) | OpenAI | $2-10 | ~5000 mensajes/mes |
| Embeddings | OpenAI | $0.50-2 | ~10k documentos |
| **Subtotal IA** | | **$2.50-12/mes** | |

### Herramientas de Desarrollo

| Componente | Costo | Notas |
|------------|-------|-------|
| GitHub | $0 | Repo privado gratuito |
| VS Code | $0 | Editor gratuito |
| Node.js | $0 | Open source |
| PostgreSQL | $0 | Open source |
| Redis | $0 | Open source |
| **Subtotal dev** | **$0** | |

### Resumen de Costos

| Escenario | Costo/mes | Costo/año |
|-----------|-----------|-----------|
| **Mínimo** | $7 | $84 |
| **Normal** | $15 | $180 |
| **Intensivo** | $27 | $324 |

### Comparación con Alternativas

| Alternativa | Costo/mes | Limitaciones |
|-------------|-----------|--------------|
| **MejoraWS (nuestro)** | $7-27 | Mantenimiento propio |
| WhatsApp Business API oficial | $0-500+ | Templates aprobados, limitaciones |
| Twilio WhatsApp | $0.005-0.01/msg | + costos por mensaje |
| Respond.io | $79-299/mes | SaaS, no customizable |
| ManyChat | $15-65/mes | Limitado, no CRM real |
| HubSpot CRM + WhatsApp | $0-800/mes | WhatsApp como integración |

**Conclusión:** Nuestra solución es **significativamente más económica** que cualquier alternativa SaaS, con la ventaja de ser 100% customizable.

---

## Costos de Desarrollo (Tiempo)

| Fase | Horas estimadas | Semana |
|------|-----------------|--------|
| Setup | 4-6h | 1 |
| WhatsApp Connection | 12-16h | 1 |
| CRM Backend | 16-20h | 2 |
| CRM Frontend | 16-20h | 3 |
| Bot IA | 16-20h | 3-4 |
| Marketing Module | 12-16h | 4-5 |
| Polish + Testing | 12-16h | 5-6 |
| **TOTAL** | **88-114h** | **6 semanas** |

Si se valora el tiempo a $0 (proyecto personal de aprendizaje), el costo es solo de infraestructura.

---

## Escalamiento de Costos

### De 100 a 10,000 contactos

| Contactos | VPS | IA | Total/mes |
|-----------|-----|-----|-----------|
| 100 | $6 | $3 | $9 |
| 500 | $12 | $5 | $17 |
| 1,000 | $12 | $8 | $20 |
| 5,000 | $24 | $15 | $39 |
| 10,000 | $48 | $25 | $73 |

**Nota:** A partir de 5,000 contactos, considerar migrar a API oficial de Meta.

---

## Recomendaciones de Ahorro

1. **Usar GPT-4o-mini** en vez de GPT-4o (10x más barato)
2. **Cachear respuestas** del bot para preguntas repetidas
3. **Usar pgvector** en vez de Pinecone (ahorro de $70+/mes)
4. **VPS de Hetzner** ($4.50/mes) en vez de DigitalOcean
5. **Backups incrementales** en vez de snapshots completos
