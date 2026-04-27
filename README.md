# MejoraWS — CRM WhatsApp Autónomo con IA

> **88+ repos analizados.** Una app donde el admin configura parámetros y la IA hace todo: responde como humano, crea campañas, gestiona el pipeline y reporta KPIs.

## 🎯 Qué es

Un CRM WhatsApp **100% autónomo** con:
- 📥 **Importación inteligente** CSV/Excel/VCF/JSON/Google Contacts (MejoraContactos)
- 🤖 **Bot IA** que responde como un humano (Groq AI gratis)
- 📣 **Marketing automático** con campañas creadas por IA
- 📊 **Pipeline CRM** que se gestiona solo
- 🛡️ **Anti-ban** de 6 capas con warm-up 14 días
- 📈 **KPIs y gráficas** en tiempo real
- 💰 **Costo: $0** (todo local/gratis)

## 📄 Documentación

| Documento | Descripción |
|-----------|-------------|
| [Documents/01-DOCUMENTACION-CONSOLIDADA.md](Documents/01-DOCUMENTACION-CONSOLIDADA.md) | **📚 Documento maestro** — Toda la documentación en uno, evaluación 36 roles |
| [Documents/02-PLAN-ETAPAS.md](Documents/02-PLAN-ETAPAS.md) | **🗺️ Plan por etapas** — 28 días, resultados utilizables en cada etapa |
| [Documents/03-PROYECTO-DESKTOP.md](Documents/03-PROYECTO-DESKTOP.md) | **🖥️ MCC** — MejoraWS Command Center, app desktop personal (Electron) |
| [Documents/00-PLAN-MAESTRO.md](Documents/00-PLAN-MAESTRO.md) | Plan original del proyecto (89+ repos, arquitectura, módulos) |
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
cat Documents/00-PLAN-MAESTRO.md
```

## Stack ($0)

```
WhatsApp:  Baileys + baileys-antiban
LLM:       Groq API (gratis) + Ollama (backup local)
Database:  SQLite + Prisma
Frontend:  Next.js + TailwindCSS + shadcn/ui
Costo:     $0/año
```

---
*88+ repos · 36 roles evaluados · MVP VIABLE a $0 · 26 abril 2026*
