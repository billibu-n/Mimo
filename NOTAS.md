# NOTAS — Mimo Nuevo (estado durable del proyecto)

> Escrito el **2026-10-20** en sesión de mapeo, a petición del dueño. Sustituye como fuente de
> estado al `HANDOFF-2026-10-19-iter4a.md`, que **quedó obsoleto** (ver §3). Todo lo que sigue
> está medido en disco con el comando que se cita; lo que no se pudo medir va como **HUECO**.
> Zona `proyectos/`: trabajo propio, sin cliente, no hereda obligaciones de `clientes/`.

## 1. Qué es

Prototipo de un **organizador global con bloques instalables**: un armazón que monta bloques
(Calendario, Tareas, Malla, Estudio…) con un contrato de bloques escrito. Repo propio
`billibu-n/mimo-nuevo` (rama `main`), publicado en GitHub Pages desde `prototipo/`
(`.github/workflows` → `upload-pages-artifact` con `path: prototipo`).

- Contrato de diseño: `CONTRATO-BLOQUES.md`, **v0.3, 881 líneas**. Es la verdad del proyecto: fija
  la forma del manifiesto, el ciclo de vida, los puentes, los packs, el catálogo y la superficie
  `montar · desmontar · panel`.
- Primer bloque real: **Malla** (612 líneas de motor + 997 de interfaz + 853 de vista mapa).

## 2. Estado medido (2026-10-20, solo lectura)

| Pieza | Estado | Medida |
|---|---|---|
| Contrato v0.3 | cerrado, con **14 decisiones abiertas** | 881 líneas |
| Iteración 3 (armazón, fichas, i18n, instalación) | hecha y publicada | commit `c9fab8e` 2026-10-19 19:08 |
| Iteración 4a (Malla con vista de mapa) | **hecha y commiteada** | commit `b79e3d5` 2026-10-19 20:31 |
| Ficheros del BRIEF-4A | **0 faltan** (8 de 8 existen) | `glob` + `read` sobre `prototipo/` |
| Tamaño del prototipo | 19 ficheros, 14.212 líneas, 461.707 B | `wc -lc` |
| Tokens de estado de Malla | 18 `--malla-*` (8 de estado) | `grep -o -- '--malla-[A-Za-z0-9_-]*' css/estilos.css` |
| Colores hex en `vista-mapa.css` | **0** (solo `var()`) | `grep -cE '#[0-9a-fA-F]{3,8}'` |
| Claves i18n | 351 en cada idioma, 59 `malla.*`, 3 `malla.vista.*` | aplanado de `es.json`/`en.json` |
| Datos de ejemplo | 84 cursos, **0 secciones, 0 anuales** | `datos/malla-ejemplo.json` |
| Capturas de la iteración 4 | 6/6 en `prototipo/capturas/iter4/` | `ls | wc -l` |
| Sin commitear | 1 fichero: `HANDOFF-2026-10-19-iter4a.md` | `git status --short` |
| Remoto | `origin/main` apunta a `b79e3d5` | `git branch -vv` |

**La iteración 4a está terminada.** `vista-mapa.js` (853 líneas), el selector en `ui.js`
(`.malla-vista__sel`, líneas 457-460), las extensiones en `manifiesto.json`, los `<link>`/`<script>`
en `index.html` (líneas 18 y 952), las 7 claves i18n y las clases `.malla-vista` en
`bloques/malla/estilos.css` (líneas 38-46) están en disco **y dentro del commit**.

El respaldo real del dueño ([respaldo-mimo-2026-10-10.json](respaldo-mimo-2026-10-10.json), 97 KB,
formato 2) trae **87 cursos** en `estado.catalogo` —tres más que el ejemplo—, pero `estado.secciones`
vacío y **0 anuales**. Por eso el mapa no puede lucir secciones con datos reales todavía.

## 3. El traspaso estaba obsoleto (ARREGLADO el 2026-10-20)

> **Resuelto.** El traspaso vigente es `HANDOFF-2026-10-20-iter4a.md`, que declara la 4a cerrada.
> El viejo se archivó como `HANDOFF-2026-10-19-iter4a.md.bak-2026-10-20`, con sha256 verificado
> (`c69080dd…44283c`). Se deja aquí el diagnóstico porque explica **por qué** el traspaso se
> contraste siempre con `git log` antes de creérselo.

`HANDOFF-2026-10-19-iter4a.md` se escribió **a mitad** de la iteración y nunca se actualizó. Declara
«no empezado» o «no existe todavía» ocho cosas que sí existen, todas dentro de `b79e3d5`:
`vista-mapa.js`, `ui.js`, `manifiesto.json`, `datos/bloques.json`, `index.html`, `i18n/es.json` +
`en.json`, `bloques/malla/estilos.css`, y las capturas.

**Riesgo concreto (ya neutralizado):** la sesión siguiente leía ese traspaso, creía que la 4a estaba
por hacer y la rehacía. Era el defecto más caro del proyecto y se arregló escribiendo un fichero. La
lección que queda: **un «HECHO» solo vale con su commit o su comando detrás**.

## 4. Huecos de evidencia (lo que no se puede afirmar)

- **~~La verificación del 4a no tiene artefacto~~ CERRADO (2026-10-20).** Está en
  `prototipo/evidencia/iter4a.txt` (93 líneas, cada cifra con su selector): 84 nodos y 12 cabeceras,
  vista por defecto `mapa`, MA2002 con flechas entra 2 / sale 3 / resto 97, **8 ratios WCAG**
  (claro 6,10 · 5,85 · 5,51 · 6,70; oscuro 7,31 · 7,64 · 5,52 · 6,95; mínimo 5,51), toggle con 84
  tarjetas y selección conservada, anchos 1440/1200/960 sin desborde, consola 0 excepciones y 0
  errores, desinstalar deja calendario. Medido en Chromium 155 headless por CDP, con el import
  disparado por el camino real del prototipo. **Los ratios medidos difieren en la tercera decimal de
  los precalculados** en el BRIEF (6,09/5,85/5,50/6,70 y 7,30/7,63/5,53/6,92): mandan los medidos,
  los dos juegos pasan el umbral.
- **Secciones y anuales: demostrados con banco, no con datos del dueño.** El banco sintético da 2
  títulos de sección con fondo y un anual a `grid-column: 2 / span 2` (388 px = 2×188 + 12), con
  captura `prototipo/capturas/iter4/07-banco-secciones-anual-1440.png`. Con los datos del dueño sigue
  siendo imposible: `estado.secciones = []` y 0 anuales.
- **Las capturas no se publican:** `.gitignore` incluye `capturas/` (línea 4). Las 7 PNG del 4a
  (6 de la iteración + la 07 del banco) viven solo en el disco del dueño; las URLs
  `http://127.0.0.1:8081/capturas/iter4/...` mueren al cerrar el servidor.
- **El estado del remoto no está verificado:** `origin/main` apunta a `b79e3d5` en el ref local, pero
  no se hizo `fetch`. Que el commit esté en GitHub se deduce del ref, no se ha comprobado.
- **El banco se midió sin i18n** (`t(k)=k`): los textos de la captura 07 salen como claves
  (`malla.badge.anual`). Es el comportamiento documentado de `vista-mapa.js`, no un defecto, pero
  significa que **la captura no sirve como muestra de la interfaz traducida**.
- **La licencia no está:** el proyecto anterior decidió MIT, pero `mimo-nuevo` **no tiene fichero
  `LICENSE`** y el repo es público. Es una decisión del dueño, no un olvido que se resuelva solo.

## 5. Pendientes, por orden de coste/valor

1. **~~Reescribir el traspaso~~ HECHO (2026-10-20):** `HANDOFF-2026-10-20-iter4a.md` declara la 4a
   cerrada y el viejo queda archivado como `.bak-2026-10-20`.
2. **~~Re-medir la verificación del 4a~~ HECHO (2026-10-20):** `prototipo/evidencia/iter4a.txt`, medido
   en Chromium 155 headless por CDP. Servidor y navegador muertos por PID al terminar; 8081/8082/9333
   cerrados.
3. **Las 14 decisiones abiertas** del contrato (§6: 6 preguntas; «Lo que la v0.3 NO decide»: 8 más).
   Bloquean el diseño de la siguiente iteración; son del dueño, no se deducen de un comando.
   **Es el siguiente trabajo real.**
4. **Iteración 4e**: la fusión de importar/exportar de **todos** los bloques en un solo JSON. El
   contrato la nombra cinco veces y el botón de exportar ya dice que llega en la 4e (§13.4, línea 856).
5. **Ideas heredadas sin clasificar**: FSRS y grafo de malla (B1/B2), sugerencia de plan, modo examen
   (B3-B5). Estaban como pendientes en el plan de la app anterior y no hay evidencia en disco de que
   este proyecto las haya heredado: ni vivas ni muertas, **HUECO** declarado.
6. **Higiene**: `capturas/` fuera del control de versiones (¿es intencional?), y falta `LICENSE`.

## 6. Decisiones del dueño (2026-10-20, ronda de migración)

Estas mandan sobre las anteriores cuando chocan.

**Nuevas, y no se re-litigan:**
- **El objetivo máximo es una aplicación de escritorio** (salir de la web, entorno propio). Revoca la
  decisión de la app anterior que daba el escritorio Tauri por *aplazado*: aquí es la meta, no un
  extra. Motivo del cambio, en palabras del dueño: «poder desalojarse de la web y tener un entorno
  propio».
- **Plataforma primero: Linux Fedora, paquete `rpm`.** Los demás sistemas (Windows, macOS) y el
  teléfono se abordan **cuando la app esté completa**; el móvil exigirá adaptar la interfaz, y eso es
  una tarea futura, no de esta migración. La arquitectura debe quedar **flexible para globalizar**.
- **No se copia: se analiza y se incorpora.** Se portan motores, cálculo y funciones; la interfaz y el
  dibujo se rehacen con lo nuevo.
- **Existe un bloque-paquete (`academics`)** que es a la vez un conjunto de bloques, y trae sus
  secciones y configuraciones adicionales.
- **La app anterior se congela en 1.1.2** y la nueva debe reemplazarla por completo.
- **La app es global, no académica.** El respaldo real del dueño es **un caso de prueba** para mirar y
  comprobar el estado, **no el estándar**: la herramienta tiene que servir a cualquiera.
- **GitHub Pages es solo para que el dueño vea los cambios**; no es un canal de uso. No se retira
  todavía, se retira cuando la app de escritorio esté completa.
- **Funciones con red**: comprobar actualizaciones **sí** (contra las Releases del dueño); «Colaborar»
  se reduce a un enlace a GitHub; **iCal** pasa al armazón.

**Del plan de la app anterior, siguen valiendo como criterio:** rama + PR, nunca `push` a `main` sin
OK; **fuente única** versionada; ventana «Colaborar» solo GitHub, sin correo público; **MIT** como
licencia elegida (aún sin fichero aquí). Y del contrato: la malla **no recalcula** en la vista mapa
(usa `MimoMallaMotor.estados()`/`getSemestres()`), y el **cálculo se porta, el dibujo no** (§11.4).

## 6b. Plan de migración, por rondas

Cada ronda deja evidencia medida en un fichero, como la iteración 4a. El orden sale de las
dependencias medidas, no del gusto.

| # | Qué | Por qué ahí |
|---|---|---|
| 1 | Bloque **`tiempo`** (726 l) + gate de escritorio `rpm` | 0 llamadas a `cursoDe()`: prueba la tubería sin acoplarse |
| 2 | Bloque **`calificaciones`** (601 l) | Depende del catálogo (`cursoDe()`), que en el nuevo posee Malla: estrena el **puente** |
| 3 | Bloque **`estudio`** (411 l) | Independiente |
| 4 | Bloque **`evaluaciones`** (262 l, aporte) | Estrena la mecánica de **aporte** al calendario |
| 5 | Pack **`academics`** + **4e** (fusión import/export) | El paquete completo; la 4e ya está prometida en el botón de exportar |
| 6 | Extensiones de Malla: **editor** (529), **PDF** (464), **simulador** (110) | Ya declaradas en el manifiesto, hoy inexistentes |
| 7 | Armazón: **ajustes** (1.960 l) + **`kit-temas-oscuros`** (7 temas) | Lo que no es bloque |
| 8 | Empaquetado `rpm` final y retirada de la web | La meta |

## 6c. Ronda 1, en curso (2026-10-20)

| Parte | Estado | Evidencia |
|---|---|---|
| **T1** bloque `tiempo`: motor, manifiesto y formato 2 | **HECHO** | 5 ficheros en `prototipo/bloques/tiempo/`; `node prototipo/bloques/tiempo/prueba-motor.js` → **14 PASA / 0 FALLA**, exit 0 |
| **E1** escritorio Tauri 2, paquete `rpm` | **HECHO** | `escritorio/src-tauri/target/release/bundle/rpm/Mimo-0.1.0-1.x86_64.rpm` (2,9 MiB); los 3 `fetch` responden 200 bajo `tauri://localhost` (`escritorio/evidencia-sonda.json`) |
| **T2** interfaz, estilos, i18n y registro en el shell | **PENDIENTE** | es el siguiente bloque |

Lo que T1 dejó medido: `motor.js` 629 l sin DOM (`document.`=0, `window`=1), `MimoMalla`=0 (sigue
independiente de Malla), ida y vuelta exportar→importar con comparación profunda, y el respaldo real
del dueño importa 10 claves (9 sobreviven) con **54 sesiones rescatadas** (3.838 min). Decisiones de
portado que hay que conocer: las sesiones viven en `tiempo.registro`; `lunes` se deriva de la fecha y
no de la semana elegida; la fase corta se llama `descanso`; y **no se alimenta la rejilla
`sem.minutos` del viejo** (los totales se derivan del registro) — eso queda como HUECO declarado.

**HUECOS de la ronda:** el `rpm` no se pudo **instalar** (no hay root en esta máquina; sí se leyó su
contenido con `rpm -qlp`); el `identifier` `cl.mimo.app` choca con el bundle de macOS (lo exige el
contrato, se deja); y `escritorio/app/` es un snapshot anterior a `bloques/tiempo/`, que se refresca
volviendo a correr `preparar-frontend.sh`.

## 7. Caminos muertos (heredados; no repetirlos)

- **El plan `plan-mimo.md` y compañía no es ejecutable hoy**: su infraestructura (OpenHands, `/projects`,
  nodo Kali, Gemini, Ollama 11434) está retirada. Solo sobreviven ideas, no tareas.
- **No usar `datos/malla-ejemplo.json` para demostrar secciones o anuales**: no los tiene (0 y 0).
- **No tocar `bloques/malla/motor.js`** al trabajar en vistas: el encargo lo prohíbe y el motor ya da
  lo necesario.
- **No copiar CSS de Academics**: se copia la lógica, nunca la hoja de estilo.
- **No arrancar el servidor en el 8080** (ocupado por la GUI del harness): va en el 8081.

## 8. Cómo comprobar el estado en 30 segundos

```bash
cd ~/workspace/proyectos/mimo-nuevo
git log -1 --format="%h %ad %s" --date=format:"%Y-%m-%d %H:%M"   # -> b79e3d5 ... 20:31
git status --short                                                # -> NOTAS, HANDOFF, evidencia (sin commit)
ls prototipo/evidencia/iter4a.txt                                 # -> existe, 93 lineas de cifras
cd prototipo && python3 -c "import json;d=json.load(open('i18n/es.json'));print(len(d))"  # -> 17 top
ls referencia/mimo-app-53cc22d/js                                # -> la app anterior, para portar motores
```
