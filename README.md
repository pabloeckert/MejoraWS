# MejoraWS — CRM WhatsApp Autónomo con IA

> **89+ repos analizados.** Admin configura parámetros → IA hace todo: responde como humano, crea campañas, gestiona pipeline y reporta KPIs.
> **Sin Meta API** — usa Baileys (WhatsApp Web directo), $0 de costo.

## 🎯 Qué es

Un CRM WhatsApp **100% autónomo** con:
- 📥 **Importación inteligente** CSV/Excel/VCF/JSON/Google Contacts (MejoraContactos)
- 🤖 **Bot IA** que responde como un humano (Groq AI gratis)
- 📣 **Marketing automático** con campañas creadas por IA
- 📊 **Pipeline CRM** que se gestiona solo
- 🛡️ **Anti-ban** de 6 capas con warm-up 14 días
- 📈 **KPIs y gráficas** en tiempo real
- 💰 **Costo: $0** (todo local/gratis)
- 🚫 **Sin Meta API** — Baileys + baileys-antiban

## 📄 Documentación

| Documento | Descripción |
|-----------|-------------|
| [Documents/01-DOCUMENTACION-CONSOLIDADA.md](Documents/01-DOCUMENTACION-CONSOLIDADA.md) | **📚 Documento maestro** — TODA la documentación en un solo archivo |
| [Documents/PROMPT.md](Documents/PROMPT.md) | Prompt de continuidad de sesión |

> **Trigger:** Cuando digas **"documentar"**, se actualizan los avances en `01-DOCUMENTACION-CONSOLIDADA.md`.

## 🚀 Para empezar

```bash
# 1. Instalar Ollama (LLM gratis local)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b

# 2. Clonar
git clone https://github.com/pabloeckert/MejoraWS.git
cd MejoraWS

# 3. Leer el plan
cat Documents/01-DOCUMENTACION-CONSOLIDADA.md
```

## Stack ($0)

```
WhatsApp:  Baileys + baileys-antiban (SIN Meta API)
LLM:       Groq API (gratis) + Ollama (backup local)
Database:  SQLite + Prisma
Frontend:  Next.js + TailwindCSS + shadcn/ui
Costo:     $0/año
```

## Plan por Etapas (28 días)

| Etapa | Días | Entregable |
|-------|------|-----------|
| 1 | 1-3 | WhatsApp conectado + envío/recepción |
| 2 | 4-7 | Bot IA que responde solo |
| 3 | 8-12 | CRM con contactos importados |
| 4 | 13-17 | Campañas automáticas |
| 5 | 18-22 | Dashboard visual con KPIs |
| 6 | 23-28 | Sistema 100% autónomo |

---
*89+ repos · 36 roles evaluados · 6 módulos · MVP VIABLE a $0 · Sin Meta API · 28 abril 2026*
