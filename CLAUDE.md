# MejoraContacto — instrucciones permanentes para Claude

Electron + React 19 + Vite + Tailwind v4 + Baileys. Herramienta personal de Pablo para escribir y enviar mensajes de WhatsApp organizados por carpetas (una por cada uso: el cumple de su hijo, prospección comercial de Mejora Continua, avisos a asociados, etc.), con revisión de copy por IA que sigue el manual de marca de Mejora Continua solo cuando corresponde.

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
