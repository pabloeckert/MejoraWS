# MejoraContacto

App de escritorio (Electron + React + Baileys) para mandar el primer mensaje a una lista chica de
contactos que ya te conocen, con auto-respuesta por keyword y monitoreo en tiempo real.
Uso personal, una sola sesión de WhatsApp, todo corre y se guarda en tu propia máquina — nada sube a
ningún servidor de terceros salvo la conexión directa a WhatsApp Web.

**No es una herramienta de bulk/spam.** Tiene delay random y tope diario a propósito. Si subís el
volumen o le escribís a gente que no te conoce, el riesgo de que WhatsApp banee el número sube en
serio — eso es cosa de Meta, no hay forma de evitarlo del todo con ninguna herramienta no oficial.

## Requisitos

- Node.js 18 o superior instalado.
- Un WhatsApp activo en el celu para escanear el QR (mismo procedimiento que WhatsApp Web).

## Instalación

```
npm install
npm run dev
```

Se abre la ventana de Electron. Tocá **Conectar**, va a aparecer un QR: escaneálo desde
WhatsApp → Configuración → Dispositivos vinculados → Vincular dispositivo.

La sesión queda guardada localmente (carpeta de datos de la app), no hace falta escanear el QR
cada vez que abrís la app.

## Primer uso

1. Importá contactos: botón **Importar CSV/Excel**. Columnas esperadas: `nombre`, `telefono`,
   `variable` (opcional). Hay un `contactos-ejemplo.csv` en la raíz para probar el formato.
   El teléfono va con código de país, sin espacios ni signos (ej: `5493764123456`).
2. Revisá la config: mensaje inicial (con `{nombre}`), delay mín/máx entre envíos, tope diario,
   keywords que disparan la auto-respuesta, y el texto de esa auto-respuesta.
3. Tocá **Iniciar envío**. Vas a ver el estado de cada contacto actualizarse en vivo
   (pendiente → enviado → respondió). Cuando alguien te contesta, te salta una notificación de
   escritorio al toque, matchee o no el keyword.
4. **Detener** en cualquier momento corta la cola sin perder lo ya enviado.

## Empaquetar como .exe

```
npm run dist
```

Genera el instalador en `dist/` (target NSIS para Windows) usando `electron-builder`, ya
configurado en `package.json`.

## Identidad visual

Aplicado el manual de marca de Mejora Continua: base blanco dominante, Azul (#1A3D84) como
estructura/primario, Amarillo (#F7CC13) marcando lo que importa (respuestas), Rojo (#E1061E) solo
para error/detener. Tipografía Bw Modelica (títulos y cuerpo) + League Spartan (labels/soporte),
ambas embebidas localmente en `public/fonts/` — no dependen de internet ni de que la fuente esté
instalada en tu Windows. Logo lockup horizontal en el header, isotipo como ícono de ventana.

Para el instalador `.exe` (`npm run dist`) el ícono del `package.json` sigue apuntando al PNG —
`electron-builder` para Windows pide `.ico`; convertí `public/brand/isotipo-color.png` a `.ico`
(256x256) si querés que el instalador y el acceso directo tengan el ícono de marca también.

## Log de actividad

Cada evento real (conexión, envío, respuesta, auto-respuesta, error, importación) queda anotado
en un archivo local (`logs/actividad.jsonl` dentro de la carpeta de datos de la app en Windows).
Abajo del todo en el dashboard hay una sección **Actividad** con:

- **Abrir carpeta** — te lleva directo al archivo en el Explorador.
- **Copiar resumen** — copia al portapapeles un resumen legible (enviados, tasa de respuesta,
  errores, últimos eventos) listo para pegar en un chat con Claude y afinar delays, keywords o
  el mensaje según cómo está funcionando de verdad.

## Gestión de contactos

- **Selección**: checkbox por fila + "seleccionar todos" (respeta el filtro/búsqueda activo).
  Con selección activa aparece una barra con: enviar solo a estos, incluir/excluir del próximo
  envío masivo, marcar pendiente (para reintentar tras un error), eliminar.
- **Columna "Enviar"**: cada contacto pendiente tiene un check — si lo destildás, "Iniciar envío"
  lo salta sin borrarlo de la lista.
- **Editar / Borrar**: por fila, sin pasar por Excel para corregir un dato suelto.
- **Buscar y filtrar**: por nombre/teléfono y por estado.
- **Zona de peligro** (en Configuración): "Vaciar lista de contactos" borra solo los contactos.
  "Reset total de la app" además vuelve la configuración a los valores de fábrica y limpia el log
  — pide escribir RESETEAR para confirmar. Ninguna de las dos cierra la sesión de WhatsApp, eso
  se hace aparte con "Cerrar sesión" en el header.

## Funciones nuevas

- **Agregar contacto a mano**: botón "+ Agregar contacto" al lado de Importar, para cargar uno
  suelto (nombre, apellido, teléfono, variable) sin pasar por Excel.
- **Tags dinámicos**: `{nombre}`, `{apellido}`, `{variable}` — cualquier campo del contacto se
  puede usar entre llaves en el mensaje o la auto-respuesta.
- **Informe automático**: al terminar cada corrida (completa, detenida a mano, o por tope diario)
  te manda un WhatsApp con el resumen a tu propio número. Se configura en Configuración →
  activar/desactivar y cambiar el número.
- **Revisar con IA**: botón junto al mensaje inicial. Llama a la API de Claude (con tu propia
  API key, la cargás en Configuración) y te dice si el mensaje se entiende, te tira feedback,
  una versión mejorada, y 4 variantes. Las variantes quedan guardadas y la campaña rota entre
  ellas cada 5 envíos, para que no mande el mismo texto exacto siempre. Necesitás una API key de
  [console.anthropic.com](https://console.anthropic.com) — cada revisión consume crédito de tu
  cuenta, no es gratis ni viene incluido en ningún plan de Claude.ai.

## Notas técnicas

- Storage: `lowdb` (JSON local) en la carpeta de datos de usuario de Electron — no SQLite a
  propósito, para no lidiar con compilación de módulos nativos.
- WhatsApp: `baileys` (fork mantenido por WhiskeySockets). Es una librería no oficial que cambia
  seguido — si algo rompe después de un rato sin actualizar, lo primero es mirar el
  [repo de Baileys](https://github.com/WhiskeySockets/Baileys) por cambios de API antes de asumir
  que es un bug del proyecto.
- Esto no lo pude correr ni testear acá (necesita un WhatsApp real y una ventana de escritorio,
  cosa que este entorno no tiene) — corré `npm run dev` y si algo tira error de import/versión,
  pegámelo en el chat y lo arreglamos.
