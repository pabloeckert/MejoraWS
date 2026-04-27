# 📂 Documents — Índice

> Todos los documentos del proyecto MejoraWS en un solo lugar.
> **Trigger:** Cuando digas **"documentar"**, se actualizan los avances.

---

## Documentos

| # | Archivo | Descripción | Líneas |
|---|---------|-------------|--------|
| 00 | [00-PLAN-MAESTRO.md](00-PLAN-MAESTRO.md) | Plan original del proyecto (89+ repos, arquitectura, módulos) | ~900 |
| 01 | [01-DOCUMENTACION-CONSOLIDADA.md](01-DOCUMENTACION-CONSOLIDADA.md) | **DOCUMENTO MAESTRO** — Toda la documentación en uno, evaluación 36 roles | ~700 |
| 02 | [02-PLAN-ETAPAS.md](02-PLAN-ETAPAS.md) | Plan por etapas con resultados utilizables en cada una (28 días) | ~500 |
| 03 | [03-PROYECTO-DESKTOP.md](03-PROYECTO-DESKTOP.md) | MCC — MejoraWS Command Center, app desktop personal (Electron) | ~600 |
| — | [PROMPT.md](PROMPT.md) | Prompt de continuidad de sesión | ~90 |

---

## Cómo Usar

### Leer la documentación completa
```bash
cat Documents/01-DOCUMENTACION-CONSOLIDADA.md
```

### Ver el plan por etapas
```bash
cat Documents/02-PLAN-ETAPAS.md
```

### Ver el proyecto desktop
```bash
cat Documents/03-PROYECTO-DESKTOP.md
```

### Actualizar avances
Decí **"documentar"** y se actualizará la sección "Registro de Avances" en `01-DOCUMENTACION-CONSOLIDADA.md`.

---

## Mapa de Relaciones

```
01-DOCUMENTACION-CONSOLIDADA.md (documento maestro)
├── Contiene toda la info de 00-PLAN-MAESTRO.md (consolidada)
├── Referenciado por 02-PLAN-ETAPAS.md (qué construir)
├── Referenciado por 03-PROYECTO-DESKTOP.md (qué complementa)
└── Actualizado por "documentar" trigger

02-PLAN-ETAPAS.md (cómo construir)
├── Basado en 01-DOCUMENTACION-CONSOLIDADA.md
├── 6 etapas × ~4-5 días = 28 días total
└── Cada etapa tiene entregable UTILIZABLE

03-PROYECTO-DESKTOP.md (qué construir además)
├── Complementa MejoraWS
├── App desktop: MCC (MejoraWS Command Center)
├── Electron + React + TypeScript
└── 17 días de desarrollo
```

---

*Creado: 27 abril 2026*
