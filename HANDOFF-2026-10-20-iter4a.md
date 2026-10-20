# HANDOFF — Mimo Nuevo — 2026-10-20, cierre de la iteración 4a

## Goal
Dejar la **iteración 4a (vista de mapa de Malla)** cerrada de verdad: con sus cifras de verificación
en disco y con la vista por defecto siendo el mapa, sin tocar motor, Academics ni el contrato.
Criterio del encargo: 84 nodos, 12 cabeceras, flechas de tres tipos y 8 ratios de contraste ≥ 4,5.

## Current state
- **HECHO — contrato v0.3**, `CONTRATO-BLOQUES.md`, 881 líneas. Es la verdad de diseño del proyecto.
- **HECHO — iteración 3** (armazón, fichas, i18n, instalación): commit `c9fab8e`, 2026-10-19 19:08.
- **HECHO — iteración 4a** (Malla con vista mapa): commit `b79e3d5`, 2026-10-19 20:31. Los **8 de 8**
  ficheros que pide el BRIEF-4A existen: `vista-mapa.js` (853 l), `vista-mapa.css` (206 l),
  `ui.js` (997 l, selector `.malla-vista__sel` en 457-460), `manifiesto.json` (extensiones
  vista-mapa/vista-tarjetas, `vistas.porDefecto=mapa`), `datos/bloques.json`, `index.html`
  (`<link>` l.18, `<script>` l.952), `i18n/es.json` y `en.json` (351 claves, 59 `malla.*`),
  `bloques/malla/estilos.css` (`.malla-vista` l.38-46). 0 hex en `vista-mapa.css`.
- **HECHO — 6 capturas** en `prototipo/capturas/iter4/`, 19 oct 20:21.
- **HECHO — evidencia medida del 4a**: `prototipo/evidencia/iter4a.txt`, 93 líneas, medida el
  2026-10-20 en Chromium 155 headless por CDP. Cifras: **84 nodos** y **12 cabeceras**; vista por
  defecto `mapa`; MA2002 con flechas entra 2 / sale 3 / resto 97 y `aria-pressed="true"`; **8 ratios
  WCAG** claro 6,10 · 5,85 · 5,51 · 6,70 y oscuro 7,31 · 7,64 · 5,52 · 6,95 (mínimo 5,51, umbral
  4,5); toggle con 84 tarjetas y selección conservada; anchos 1440/1200/960 sin desborde; consola 0
  excepciones y 0 errores; desinstalar deja calendario.
- **HECHO — secciones y anual demostrados con banco sintético** (no con datos del dueño, que trae
  `secciones = []` y 0 anuales): 2 títulos de sección con fondo y anual `grid-column: 2 / span 2`
  (388 px = 2×188 + 12). Captura: `prototipo/capturas/iter4/07-banco-secciones-anual-1440.png`.
- **HECHO — estado durable del proyecto**: `NOTAS.md`, escrito el 2026-10-20. **Es la fuente de
  estado de este proyecto**, no `TASKS.json` de la sede (decisión del dueño, 2026-10-20).
- **HECHO — este fichero**: sustituye a `HANDOFF-2026-10-19-iter4a.md`, que declaraba «no empezado»
  ocho cosas que ya estaban hechas dentro de `b79e3d5` (se escribió a mitad de iteración y nunca se
  actualizó). Copia fiel del viejo: `HANDOFF-2026-10-19-iter4a.md.bak-2026-10-20`,
  sha256 `c69080dd…44283c`.
- **A MEDIAS**: nada de código.
- **NO HECHO a propósito**: las **14 decisiones abiertas** del contrato (son del dueño) y la
  **iteración 4e** (fusión de importar/exportar de todos los bloques). Decidido en la sesión del
  2026-10-20.

## Open blockers
Ninguno técnico. Lo que bloquea el paso siguiente **no es un error, es una decisión**:
- 6 preguntas en `CONTRATO-BLOQUES.md` §6 y 8 en «Lo que la v0.3 NO decide» (numeradas 7-14).
  La 11 (¿quién enciende una extensión y dónde se ve?) y la 12 (¿el panel se abre solo?) son las que
  más condicionan lo siguiente.
- Sin `fetch` no está comprobado que GitHub tenga `b79e3d5`: el ref local `origin/main` apunta ahí,
  pero eso es un dato local. `git fetch` lo resuelve; **no se hizo a propósito** (bloque de lectura).

## Recent decisions
- **El estado durable de Mimo vive en `proyectos/mimo-nuevo/NOTAS.md`**, no en `TASKS.json` ni en
  `ESTADO.md` de la sede: esos ya no caben enteros (146 KB y 247 KB; deuda T-47). Decisión del dueño,
  2026-10-20. Revertir: añadir una tarea puntero en `~/workspace/TASKS.json`.
- **No se reescribe el HANDOFF viejo en el sitio**: se archiva como `.bak-2026-10-20` verificado por
  sha256 y el traspaso pasa a este fichero. Revertir: copiar el `.bak` sobre este.
- **Las 14 decisiones no se contestan por el agente**, ni siquiera con recomendación aplicada: son
  preferencias de producto. Revertir: nada que revertir, no se tocó nada.
- **No se toca `capturas/` del `.gitignore`** en esta ronda: es una decisión de publicación del
  dueño, no un defecto que arreglar por cuenta propia.

## Files-of-interest
- `proyectos/mimo-nuevo/NOTAS.md` — **empieza por aquí**: estado medido, huecos, pendientes, caminos
  muertos y los comandos de comprobación en 30 segundos.
- `proyectos/mimo-nuevo/CONTRATO-BLOQUES.md` — §6 (preguntas 1-6), «Lo que la v0.3 NO decide»
  (7-14, al final), §12.6, §13.4. Es la verdad de diseño.
- `proyectos/mimo-nuevo/BRIEF-4A.md` — §5 es la lista literal de verificaciones con sus selectores.
- `proyectos/mimo-nuevo/prototipo/evidencia/iter4a.txt` — **la evidencia medida del 4a**, 93 líneas con
  cada cifra y su selector. Es lo que convierte «está hecho» en un dato.
- `proyectos/mimo-nuevo/prototipo/bloques/malla/vista-mapa.js` — 853 líneas, la vista de mapa.
- `proyectos/mimo-nuevo/prototipo/bloques/malla/manifiesto.json` — donde se declaran extensiones,
  vistas y scripts.

## Recovery hints
```
cd ~/workspace/proyectos/mimo-nuevo && git log -1 --format="%h %ad %s" --date=format:"%Y-%m-%d %H:%M"
# esperado: b79e3d5 2026-10-19 20:31 Iteración 3+4a: shell, fichas, i18n, Malla con vista mapa
```
Si sale ese commit, **la 4a está hecha**: no la rehagas. Después lee `NOTAS.md` §5 y elige entre las
14 decisiones del dueño o la iteración 4e. Antes de medir en navegador: servidor en
`127.0.0.1:8081` (**nunca el 8080**, es la GUI del harness) y CDP en `9333`.

## Caminos muertos
- **El plan `plan-mimo.md`, `plan-mimo-abierto.md`, `mapeo-mimo.md` y `mimo-lab.md` no son
  ejecutables**: describen OpenHands, `/projects`, nodo Kali, Gemini y Ollama 11434, todo retirado.
  Sus 9 tareas técnicas están muertas; solo sobreviven ideas (FSRS, grafo de malla, modo examen) sin
  evidencia de que este proyecto las heredara.
- **No usar `datos/malla-ejemplo.json` para demostrar secciones o anuales**: trae 84 cursos y
  **0 secciones, 0 anuales**. El respaldo del dueño tampoco: `estado.secciones = []` y 0 anuales.
  Se demuestra con banco sintético y se declara como banco.
- **No tocar `bloques/malla/motor.js`** al trabajar en vistas: el encargo lo prohíbe y el motor ya
  devuelve todo lo necesario (`estados()`, `requisitosFaltantes()`, `getSemestres()`).
- **No copiar CSS de Academics**: se porta la lógica, nunca la hoja. `vista-mapa.css` debe seguir en
  0 hex, solo `var(--malla-*)`.
- **Leer el HANDOFF anterior sin contrastarlo con el disco cuesta una iteración entera**: es el fallo
  que este fichero corrige. El traspaso se contrasta con `git log` antes de creérselo.
- **No arrancar el servidor en el 8080**: está ocupado por la GUI del harness del dueño.

## Trabajo en segundo plano
Ninguno vivo. El bloque `M1` (medición en navegador de la iteración 4a) cerró el 2026-10-20: escribió
`prototipo/evidencia/iter4a.txt` y la captura 07, y mató por PID el servidor y el navegador
(8081/8082/9333 cerrados, verificado). Su encargo está en
`~/workspace/harness/encargos/2026-10-20-bloque-m1-evidencia-iter4a.md`.
