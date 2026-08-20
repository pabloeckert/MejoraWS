# MejoraContacto — instrucciones permanentes para Claude

Electron + React 19 + Vite + Tailwind v4 + Baileys. Herramienta personal de Pablo para escribir y enviar mensajes de WhatsApp organizados por carpetas (una por cada uso: el cumple de su hijo, prospección comercial de Mejora Continua, avisos a asociados, etc.), con revisión de copy por IA que sigue el manual de marca de Mejora Continua solo cuando corresponde.

## Criterio de modelo y esfuerzo — Mejora Continua

Antes de cada tarea, decidí en silencio y nombrá en una línea al arranque: `Modelo: X · Esfuerzo: Y — razón corta`.

**Modelo:**
- **Sonnet (default).** Todo lo cotidiano: features, fixes, debugging, scripts, refactors chicos. Es el piso — no bajar salvo tarea trivial de alto volumen (ahí Haiku si está disponible en el flujo).
- **Opus.** Solo si aparece una de estas señales: el cambio toca dependencias cruzadas donde un error se propaga en cascada; ya se intentó con Sonnet y falló o quedó a medias; hay más de 2 restricciones en conflicto real (performance vs legibilidad vs deadline, etc); es una decisión de arquitectura cara de revertir. Nunca Opus "por las dudas" o porque la tarea suena importante.

**Esfuerzo / extended thinking:** normal por default. Alto solo con ambigüedad real, múltiples restricciones en conflicto, o un bug que ya resistió un intento con esfuerzo normal.

**Higiene de sesión:** un propósito por sesión, no mezclar tareas grandes no relacionadas en el mismo hilo largo. No repetir contexto que ya está en el repo — leerlo, no explicarlo de nuevo en el prompt. Automatización real (loops, cron, CI, correr sin la app abierta) → confirmar que efectivamente necesita correr desacoplado antes de armar el script.

*(Versión condensada para Code. El criterio completo vive en la skill `optimo-de-uso`. Si cambia, actualizar también ahí y en `C:\Github\CLAUDE.md`.)*

## Dogma: transcripción continua de la sesión

**Esto es una orden permanente, no una preferencia puntual.** En cada sesión de trabajo sobre este proyecto, sin que haga falta que Pablo lo vuelva a pedir:

1. Actualizar este `CLAUDE.md` si algo de lo aprendido en la sesión cambia cómo hay que trabajar acá (nuevas reglas, nuevos hallazgos estructurales, nuevas convenciones).
2. Actualizar **`TRANSCRIPCION-SESION.md`** (el archivo de transcripción de este proyecto) agregando de corrido todo lo que pasó desde la última actualización.

### Cómo tiene que quedar la transcripción

- Texto corrido, en prosa continua. **Nunca** indicar quién habla en cada tramo (nada de "Usuario:" / "Claude:" ni equivalentes).
- Se transcribe **todo a texto**: adjuntos (imágenes, PDFs, videos) descritos o transcriptos en su contenido real, código HTML/MD final completo, archivos pegados.
- Se **incluyen** literalmente, sin filtrar nada: comandos de terminal, JSON crudo de herramientas, outputs técnicos (curl, git, SQL, resultados de test), decisiones, hallazgos, explicaciones y código. "Quiero literal todo, sin filtrar nada" — instrucción explícita de Pablo.
- Se sigue el estilo ya establecido en el archivo: encabezados `##`/`###` por tema o hito, bloques de código con el lenguaje correspondiente, tablas cuando ayudan a resumir, y el texto narrativo en español rioplatense.
- Antes de escribir, leer el final del archivo existente para no duplicar contenido ni cortar el hilo — continuar exactamente desde donde quedó la última vez.
- Si el archivo crece mucho, no resumir ni recortar lo viejo: se sigue agregando al final.

### Cuándo hacerlo

Al cierre de cada bloque de trabajo relevante (no hace falta después de cada mensaje suelto), y siempre antes de dar por cerrada la sesión o cuando Pablo pida explícitamente un cierre/informe.

## MejoraSuite — bridge local (2026-08-15)

Este proyecto es parte de una fusión en curso con MejoraCRM (`C:\Github\Negocio\MejoraCRM`, rector) y MejoraContactos (`C:\Github\Negocio\MejoraContactos`). Los tres siguen siendo independientes; MejoraWS queda embebido dentro de los otros dos. Fuente de verdad de la arquitectura completa: `C:\Github\Negocio\MejoraCRM\mejorasuite\ESPECIFICACION.md` (leer ahí antes de proponer cambios de arquitectura acá).

`electron/bridge.mjs` expone `GET /status` y `GET /events` (SSE) en `http://127.0.0.1:4180`, autenticado con un token en `X-Bridge-Token` (generado en `userData/bridge-token.txt`). Es de solo lectura a propósito — **no reescribir la lógica de envío de WhatsApp para exponerla por acá sin releer primero `mejorasuite/DECISIONES.md`** (ya se evaluó y se decidió no tocar Baileys). Un `POST /send` eventual (Fase 1b) tiene que reusar la cola/delay/tope diario existente en `main.mjs`, nunca bypasearla.

**Fase 2 (2026-08-15):** este proyecto ahora embebe MejoraContactos (`https://pabloeckert.github.io/MejoraContactos/`) en una pestaña nueva ("Contactos", junto a "Campañas" en `src/App.jsx`) usando `WebContentsView` (la API moderna de Electron — no `BrowserView`, que está deprecada). Se crea una sola vez (`ensureContactosView()` en `main.mjs`) y se muestra/oculta con `setVisible()`, nunca se destruye, para no perder el estado de MejoraContactos al cambiar de pestaña. Las coordenadas donde se dibuja las manda el renderer (`getBoundingClientRect()` de un slot dedicado) vía IPC (`contactos:show`/`contactos:updateBounds`/`contactos:hide`, expuestos en `preload.cjs`). Verificado de punta a punta vía Chrome DevTools Protocol (`--remote-debugging-port`), no solo por lectura de código — confirmado un segundo target CDP con el contenido real de MejoraContactos cargado dentro de la ventana.

**Fase 3 (2026-08-15):** la dirección inversa — MejoraContactos (una web pública, sin acceso a filesystem) necesitaba una forma de hablarle al bridge de la Fase 1 y de "abrir" esta app si no está corriendo. Dos cosas nuevas acá:
1. `bridge.mjs` ahora manda `Access-Control-Allow-Private-Network: true` en cada respuesta — sin eso, Chrome bloquea con un preflight fallido cualquier fetch desde una página HTTPS pública hacia `127.0.0.1` (spec de Private Network Access).
2. Botón **"Copiar token de conexión"** en el header (`App.jsx`) — como MejoraContactos no puede leer `bridge-token.txt` del disco, el token se copia a mano una vez y se pega en el panel nuevo de MejoraContactos (que lo guarda cifrado en su localStorage, mismo mecanismo que ya usa para las API keys de IA).
3. Protocolo `mejoraws://` registrado (`app.setAsDefaultProtocolClient`, con el workaround de pasar `execPath` + argv en modo dev) + `app.requestSingleInstanceLock()` para que un click en "Abrir MejoraWS" desde afuera enfoque la ventana existente en vez de abrir una segunda instancia. **Sin verificar el click-through real** (necesita el instalador empaquetado o una prueba manual de Pablo — no hay forma de simular un click en un protocolo custom del SO desde las herramientas de este entorno).

Verificado end-to-end en dos rondas (el commit `435b6b3` ya probó el botón de copiar token con Electron real + CDP, confirmando con `Get-Clipboard` de Windows que el token copiado coincide byte a byte con `bridge-token.txt`; una ronda posterior probó el otro lado — MejoraContactos real corriendo en `localhost:8080` contra este bridge, preflight OPTIONS con la cabecera PNA devolviendo 204, y `/status` respondiendo 401 con token inventado y 200 con el token real). Lo único NO verificado end-to-end en ninguna de las dos rondas es el fetch desde el dominio público real (`https://pabloeckert.github.io`, HTTPS) — el entorno de pruebas bloquea por su cuenta los fetches desde páginas externas hacia IPs privadas, así que ese último tramo específico queda pendiente de una prueba manual de Pablo. Tampoco el click-through real del protocolo `mejoraws://` (necesita el instalador empaquetado). Ver `mejorasuite/DECISIONES.md` del repo de MejoraCRM.
