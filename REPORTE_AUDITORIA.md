# Reporte de auditoría — MejoraWS

Fecha: 2026-09-10
Contexto: auditoría de higiene/calidad de C:\Github, tercer intento sobre este repo. Los dos intentos anteriores no dejaron `REPORTE_AUDITORIA.md`; el segundo se colgó justo después de confirmar "37/37 tests pasando" (se reprodujo el mismo resultado exacto en esta pasada, ver abajo) y antes de llegar al audit de vulnerabilidades. Esta pasada retoma desde ahí y completa el resto.

**Regla dura respetada: no se hizo ningún `git commit`, `git add` ni `git push`. Todo cambio queda en el working tree.**

## Estado de git al arrancar

- Rama `master` (no `main`, a diferencia de los otros dos repos de la suite), sincronizada con `origin/master`.
- Único cambio en el working tree: `package-lock.json` modificado (de una `npm install` de esta sesión o de una anterior, sin cambios en `package.json`). No se revirtió, se dejó así, sin commitear.
- `git log -10`: trabajo reciente normal (saneo de número real expuesto, comparación en tiempo constante del token del bridge, suite de Vitest nueva, fix de número de teléfono hardcodeado). Nada llamativo sin resolver.
- No se encontró ningún proceso ni artefacto obviamente colgado del intento anterior; se procedió con comandos nuevos sin tocar nada existente.

## Archivos sensibles trackeados

- `git ls-files | grep -iE ".env|.key|credentials|.pem"` sin resultados. No hay ningún `.env`, `.key`, `credentials*` ni `.pem` trackeado.
- `contactos-ejemplo.csv` (raíz, trackeado): contenido verificado:

  ```
  nombre,telefono,variable
  Juan Pérez,5493764123456,cliente potencial
  María Gómez,5493764987654,ex cliente
  ```

  Son datos claramente ficticios (nombres genéricos, números de ejemplo con prefijo de área 376), documentado como tal en el propio README ("Hay un contactos-ejemplo.csv en la raíz para probar el formato"). Sin datos reales.
- El log de commits reciente (917794b, 29ef88f, 8511f8f) muestra que el proyecto ya pasó por una limpieza propia de secretos: un número de teléfono real hardcodeado como default y un número real expuesto en docs ya fueron saneados en commits anteriores, y se agregó comparación en tiempo constante para el token del bridge. No queda nada de eso pendiente hoy.

## Lint / typecheck / build / tests

- Lint: no hay script `lint` en `package.json` ni configuración de ESLint (`.eslintrc*` / `eslint.config*`) en el repo. No es un JS estándar con linter configurado; se omite este paso porque no hay nada que correr (no es un olvido, el proyecto nunca tuvo lint configurado).
- Typecheck: no hay `tsconfig*`, el proyecto es JS puro (Electron + React con .jsx/.mjs), no TypeScript. No aplica.
- `npm run build` (vite build): OK, compiló en ~1.1s. Un solo warning no bloqueante: el bundle principal (index-*.js, 585KB) supera los 500KB recomendados por Vite; no es un bug, es una app de escritorio Electron sin necesidad real de code-splitting agresivo.
- `npm test` (Vitest sobre electron/pure.mjs): 37/37 tests pasando, 1 archivo de test, en 588ms. Coincide con lo que ya había confirmado el intento anterior antes de colgarse, no hubo regresión desde entonces.
- No se corrió ningún e2e/Playwright: el proyecto no tiene ese tipo de suite (es Electron, no hay playwright.config), no aplica la restricción de "no correr e2e si no está instalado" porque directamente no existe esa suite acá.
- Nota del propio README/CLAUDE.md: la lógica de Electron/Baileys (electron/main.mjs) no se puede testear automatizado en este entorno (necesita WhatsApp real y ventana de escritorio); esto ya está documentado y aceptado como limitación conocida, no es un hueco de cobertura nuevo.

## npm audit

1 vulnerabilidad (high), sin cambios posibles:

| Paquete | Severidad | Fix disponible | Nota |
|---|---|---|---|
| xlsx (SheetJS) | high | sin fix disponible upstream | Prototype pollution + ReDoS, mismo caso que en MejoraContactos y MejoraCRM. Usado en src/App.jsx para importar listas de contactos. Riesgo ya documentado explícitamente en el propio README ("Notas técnicas"): acotado porque el archivo lo elige y confía el propio usuario, con nota de migrar a exceljs si algún día se acepta importar archivos de origen no confiable. |

No hay nada que `npm audit fix` pueda resolver (0 moderate/low, la única vulnerabilidad no tiene fix). No se aplicó ningún bump mayor.

## Basura / duplicados

- `dist/` no está trackeado (correctamente ignorado vía .gitignore).
- `mejora-contacto.zip` (324KB, en la raíz): existe en disco pero no está trackeado, está explícitamente en .gitignore con el comentario "respaldo local, no es codigo fuente". Es decir, es un backup local intencional del propio Pablo, no basura de un build ni un accidente. No se tocó ni se sugiere borrarlo sin confirmación explícita (podría ser un respaldo que todavía quiere conservar); si ya no lo necesita, es candidato a limpieza manual, pero queda fuera del alcance de "limpiar automáticamente" de esta auditoría porque no es un artefacto regenerable (dist/build/cache) sino un zip de respaldo con nombre propio.
- No se encontraron otros .zip sueltos ni duplicados evidentes de código.
- `TRANSCRIPCION-SESION.md` (168KB): es intencional y documentado, el propio CLAUDE.md ordena mantener una transcripción continua de cada sesión de trabajo. No es basura, es el artefacto que el dogma de este repo pide mantener.

## Documentación

- README.md: consistente con el código actual, instalación, primer uso, empaquetado, identidad visual, log de actividad, gestión de contactos, y la sección "MejoraSuite" describiendo la relación con MejoraCRM/MejoraContactos. Sin inconsistencias grandes encontradas.
- CLAUDE.md, inconsistencia encontrada (mismo patrón que en MejoraCRM): la sección "MejoraSuite, bridge local (2026-08-15)" (línea 41) dice textualmente que el proyecto es parte de una fusión con "MejoraCRM (C:\Github\Negocio\MejoraCRM, rector)" y "MejoraContactos (C:\Github\Negocio\MejoraContactos)", y remite a C:\Github\Negocio\MejoraCRM\mejorasuite\ESPECIFICACION.md como fuente de verdad de arquitectura. Esas rutas están obsoletas: los tres repos viven hoy en C:\Github\Herramientas\MejoraSuite\, no en C:\Github\Negocio\. El archivo mejorasuite/ESPECIFICACION.md referenciado no se pudo verificar desde este repo (vive en el repo de MejoraCRM, no en este), pero el patrón de ruta vieja es el mismo que ya se encontró y documentó en la auditoría de MejoraCRM (CLAUDE.md y COMMERCIAL_ROADMAP.md de ese repo tienen el mismo problema). No se corrigió (edición de contenido fuera del alcance técnico estricto de esta pasada); queda documentado para corregir junto con las de MejoraCRM.
- No hay SECURITY.md, CHANGELOG.md, COMMERCIAL_ROADMAP.md ni DOCS.md en este repo, no aplica revisarlos.
- Nota menor sin impacto: el nombre del paquete en package.json es "mejora-contacto" (minúscula, con guion) mientras el repo se llama MejoraWS y el productName del instalador es "MejoraContacto"; son tres formas distintas del mismo nombre pero es un patrón de naming ya consistente dentro de cada contexto (npm package name vs repo vs producto empaquetado), no una inconsistencia real que confunda.

## Pendiente de decisión humana

1. xlsx/SheetJS: sin fix upstream, mismo caso que los otros dos repos de la suite, evaluar reemplazo (exceljs) o aceptar el riesgo (ya evaluado y documentado como aceptable en el propio README).
2. Corregir las rutas C:\Github\Negocio\... obsoletas en CLAUDE.md (línea 41), junto con las mismas rutas obsoletas ya encontradas en CLAUDE.md/COMMERCIAL_ROADMAP.md de MejoraCRM, conviene resolver las tres en una sola pasada de documentación.
3. Decidir si conservar o borrar mejora-contacto.zip (324KB, respaldo local intencional, no tocado en esta auditoría).
4. Pendientes ya documentados en el propio proyecto y no verificables desde este entorno (no son hallazgos nuevos, se listan por completitud): el fetch real desde https://pabloeckert.github.io (dominio público HTTPS) contra el bridge local, y el click-through real del protocolo mejoraws:// (ambos necesitan prueba manual de Pablo o el instalador empaquetado).

## Conclusión

Repo sano. Sin secretos ni datos reales trackeados (el historial de saneo de números reales ya está resuelto en commits previos). Build y tests en verde (37/37, sin regresión respecto al intento anterior que se había colgado en este mismo punto). Lint/typecheck no aplican (proyecto JS sin esa tooling configurada, no es un olvido). Única vulnerabilidad de npm audit es la misma de xlsx sin fix upstream que ya afecta a los otros dos repos de la suite, ya evaluada y aceptada por el propio proyecto. Único hallazgo de documentación es la misma ruta obsoleta C:\Github\Negocio\... que ya apareció en MejoraCRM, recomendable corregir ambas juntas.
