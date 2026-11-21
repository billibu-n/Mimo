# Plan de correcciones estéticas — Mimo

> **Estado:** Fase 0, E-14 y E-17 hechas. Fase 1 en curso: sigue E-18.
> **Base:** `t/beta-9` en `4896e08`.
> **Rama de trabajo:** `t/estetica`, creada desde `4896e08`; se mergea a `t/beta-9` al cerrar.
> **Fuente de verdad:** este archivo. Si el chat se compacta o se pierde, se retoma por §0.
> **Regla:** una unidad = un commit verificable. El estado de este documento se actualiza en el mismo commit que el código.

## 0. Cómo retomar (leer solo esto)

1. `git log --oneline -5` y `git status --short`.
2. Abre §4 y busca la primera fila con estado `en curso` o `pendiente`.
3. Corre `python3 pruebas/correr-gates.py` (41/41 esperado) y `python3 pruebas/gate-estetica.py`.
4. Abre la ficha de esa unidad en §5. Su columna «Contexto mínimo» lista los archivos y el criterio.
5. No re-abras la auditoría: los 22 hallazgos y su evidencia están en §3.
6. Al terminar: actualiza estado, commit y bitácora en el mismo commit. No dejes una unidad a medias sin escribir «en curso» y el paso exacto.

Si hay una decisión sin responder, usa el default de §2 y márcala `provisional`. No bloquees la unidad por eso; se revisa al cerrar la fase.

## 1. Objetivo y criterio de cierre

**Objetivo:** que las 9 secciones usen un solo sistema de forma, color y componentes, sin perder la identidad de cada bloque. La geometría vive en una grilla de 5 px y los controles (botón, campo, desplegable) se definen una sola vez.

**Cierre ejecutable:**

- 42/42 gates en verde (41 actuales + `gate-estetica.py`).
- `gate-estetica.py` en verde con sus asserts de tokens, contraste, grilla, controles y disposición.
- 10 temas: texto normal ≥ 4,5:1; texto grande ≥ 3:1; elementos gráficos ≥ 3:1. El badge de información ≥ 4,5:1.
- 1440, 411 y 140 % de letra: sin desborde horizontal y sin etiquetas cortadas en las 9 secciones.
- Toda medida de geometría es múltiplo de 5 a 100 % (salvo los trazos y las formas declaradas en §1.1).
- Un botón, un campo y un desplegable con las mismas propiedades computadas en las 9 secciones.
- Un solo modal, un solo conmutador, un solo plegable, un solo estado vacío, una sola escala de iconos.
- `docs/DISENO.md` escrito y `CHANGELOG.md` actualizado.
- Ninguna fila de §4 queda `pendiente`; las descartadas citan su decisión (`D-xx`) y el motivo.

**No objetivos:** nuevas funciones, base de alimentos/calorías, cambio de esquema de datos, bump de versión, release, push a `master`. Este plan es presentación y semántica de lectura.

## 1.1 Grilla de 5 px y capa de componentes

**Regla:** a 100 % de escala, toda medida de geometría (espacio, radio, altura, ancho, sombra) es múltiplo de 5. Se deja de mezclar 4/8/12/16 con 5/10/15.

### Escala base (reemplaza `tokens.css`)

| Token | Antes | Ahora | Uso |
|---|---|---|---|
| `--sp-1` | 4 | 5 | hueco mínimo |
| `--sp-2` | 8 | 10 | gap entre controles |
| `--sp-3` | 12 | 15 | padding de control |
| `--sp-4` | 16 | 20 | padding de tarjeta |
| `--sp-5` | 20 | 25 | padding de modal |
| `--sp-6` | 24 | 30 | gap de sección |
| `--sp-7` | 32 | 40 | separación grande |
| `--sp-8` | 40 | 50 | aire de vacío |
| `--r-sm` | 6 | 5 | control |
| `--r-md` | 9 | 10 | tarjeta |
| `--r-lg` | 14 | 15 | contenedor |
| `--alto-topbar` | 53 | 55 | |
| `--alto-navbar` | 55 | 55 | |
| `--alto-kpi` | 68 | 70 | |
| `--alto-pie` | 42 | 40 | |
| `--ancho-rail` | 222 | 220 | |
| `--ancho-panel` | 320 | 320 | |
| `--ancho-contenido` | 1240 | 1240 | |
| `--lienzo-pad` | 22/24/52 | 20/25/50 | |

### Componente universal (mismos tokens para toda la app)

| Token | Valor | Consume |
|---|---|---|
| `--control-alto` | 35 | `.btn`, `.icono-btn`, `select`, `input.entrada` |
| `--control-alto-sm` | 25 | `.btn--chico`, `.chip`, `.tarea-check` |
| `--control-alto-lg` | 40 | buscador del modal, acción de cabecera |
| `--control-pad-x` | 15 | |
| `--control-pad-x-sm` | 10 | |
| `--control-radio` | `--r-sm` (5) | |
| `--control-borde` | 1px | trazo, no medida |
| `--campo-alto` | 35 | |
| `--campo-pad-x` | 10 | |
| `--campo-radio` | 5 | |
| `--menu-item-alto` | 30 | `.menu-ctx button` |
| `--menu-pad` | 5 | |
| `--menu-radio` | 10 | |
| `--tarjeta-pad` | 20 | `.card` |
| `--tarjeta-radio` | 15 | |
| `--modal-pad` | 25 | |
| `--modal-radio` | 15 | |
| `--chip-alto` | 25 | chips de estado |
| `--chip-radio` | 999px | cápsula, no medida |
| `--icono-sm` | 15 | denso |
| `--icono-md` | 20 | UI |
| `--icono-lg` | 25 | cabecera |

> Los tokens de **color** de componente (`--campo-bg`, `--campo-borde`, `--control-borde`, `--menu-bg`, `--menu-borde`) van bajo `[data-tema]`, no en `:root`: un `var()` compuesto en `:root` se resolvería donde el tema aún no existe, como ya pasa con `--lienzo`.

### Excepciones declaradas

- **Trazos:** bordes de 1–3 px, separadores y anillo de foco de 2/4 px no son medidas de layout; no se redondean a 5.
- **Formas:** cápsulas (`999px`) y círculos (`50%`) son formas, no radios medidos.
- **`--esc`:** a 140 % los valores crecen proporcionalmente (5 → 7). La grilla es a 100 %.
- **Tipografía:** ver D-09. Por defecto sigue en `rem` para que «Tamaño de letra» funcione; si se fuerza a 5 px, se decide ahí.

### Regla de oro

Un botón, un campo y un desplegable se definen **una vez**. Las secciones no escriben `height`, `padding`, `border-radius` ni `font-size` de control: usan `.btn`, `.entrada`, `select` o `.chip`, y esos consumen los tokens. Si una sección necesita una variante, agrega un modificador de **color**, no de forma.

## 2. Decisiones que hay que tomar

| ID | Decisión | Default propuesto | Estado |
|---|---|---|---|
| D-01 | ¿Qué llena el anillo de Tareas? | Lo **cumplido**: arco `--ok`, pista `--pista`, texto «% al día». Deja de ser un donut de lo pendiente. | pendiente |
| D-02 | ¿Qué cuenta «Hoy y atrasadas»? | **Ocurrencias** (las tarjetas que hay que hacer), igual en KPI y columna. Se renombra el KPI a «pendientes hoy/atrasadas». | pendiente |
| D-03 | ¿De qué color es «disponible»? | `--ac` (azul) en Malla, leyenda y Calificaciones. `--q` queda solo para estimado/proyectado. | pendiente |
| D-04 | ¿De qué color es «activo»? | `--ok` (verde) en lista y resumen. «Sin examen / no hace falta» pasa a neutro (`--sup2`/`--muted`), no a `--warn`. | pendiente |
| D-05 | ¿La paleta de ramos se adapta al tema? | Sí: se conservan los 9 tonos de identidad y se deriva `--ramo-visible` con `color-mix` hacia `--fg` en temas oscuros, para garantizar 3:1 sin cambiar el tono. | pendiente |
| D-06 | ¿Píldora única? | Chips de estado = cápsula (`999px`); badges neutros = `--r-sm` (5). Se eliminan los radios sueltos 4/99; 5/10/15 son los tres tokens. | pendiente |
| D-07 | ¿Escala tipográfica? | 5 tamaños base + 3 roles (`--fs-h1`, `--fs-num`, `--fs-display`). Se elimina todo texto bajo `--fs-xs`. | pendiente |
| D-08 | ¿KPIs con color? | Número siempre `--fg`; el color va en borde superior o punto. Malla y Calificaciones dejan de teñir el número. | pendiente |
| D-09 | ¿La tipografía también es múltiplo de 5? | **No por defecto:** la grilla aplica a geometría; la letra sigue en `rem` (5 tamaños + roles) para que «Tamaño de letra» funcione. Alternativa: fijar 10/15/20/25/35 px, que pierde el escalado y baja los rótulos a 10 px. | pendiente |

> Si el dueño no responde, se implementa el default y se marca `provisional` en la bitácora. Al cerrar cada fase se revisan las provisionales.

## 3. Diagnóstico (E-01…E-22)

La evidencia es `archivo:línea` del estado auditado. El chat que originó esto puede perderse; esta tabla basta para reproducir.

| ID | Sev | Hallazgo | Evidencia | Estado |
|---|---|---|---|---|
| E-01 | Media | 15 tamaños en `rem` fuera de los 5 tokens; textos de 7–9 px | `tokens.css:10-15`; `shell.css:28,267,269,320`; `notas.css:11,25-30`; `progreso.css:41`; `tiempo.css:30` | pendiente |
| E-02 | Media | Medidas en px fijo que no siguen `--esc` (280, 360, 196, 420, 78, 22) | `notas.css:2,10`; `calificaciones.css:21`; `malla.css:42`; `tiempo.css:25`; `tareas.css:22`; `progreso.css:25` | pendiente |
| E-03 | Media | 9 radios fuera de la escala; dos formas de píldora | `tokens.css:32-35`; `shell.css:167`; `calendario.css:31`; `malla.css:47`; `progreso.css:65` | pendiente |
| E-04 | Baja | Borde de estado de 3, 4 y 5 px según sección | `tareas.css:63`; `calificaciones.css:9`; `malla.css:47`; `progreso.css:110`; `calendario.css:31` | pendiente |
| E-05 | Baja | 14 sombras y 13 duraciones; modales con 3 sombras hardcodeadas | `base.css:75`; `shell.css:84,396`; `actualizaciones.css:7`; `progreso.css:88` | pendiente |
| E-06 | Media | Dos modales con anatomía, tamaño, título, pie y superficie distintos | `shell.css:82-93`; `progreso.css:87-90` | pendiente |
| E-07 | Media | Cinco lenguajes de «elegir una opción» | `shell.css:32`; `calificaciones.css:4`; `tareas.css:49,80`; `tiempo.css:37` | pendiente |
| E-08 | Media | Tres plegables con chevron y cabecera distintos | `shell.css:112-130`; `progreso.css:110-130`; `shell.css:600` | pendiente |
| E-09 | Baja | Seis estados vacíos distintos; Notas no tiene vacío | `shell.css:36,205,451`; `progreso.css:61`; `calificaciones.css:8`; `malla.css:76` | pendiente |
| E-10 | Media | KPIs neutros en cuatro secciones y coloreados en Malla/Calificaciones | `base.css:146`; `malla.css:9-17`; `calificaciones.css:61-69` | pendiente |
| E-11 | Baja | Iconos de 11 a 26 px sin escalera | `shell.css:3`; `calendario.css:52`; `.ramo-ico` 14–26 | pendiente |
| E-12 | Media | «Disponible» es morado, azul y ámbar según la vista | `malla/vista.js` (`kpi--q`); `malla.css:13,34,51`; `calificaciones.css:9` | pendiente |
| E-13 | Media | «Activo» verde en lista y morado en resumen; «sin examen» en ámbar | `shell.js:3635` vs `3754-3755` | pendiente |
| E-14 | **Alta** | Badge «Desde Estudio» ilegible en temas oscuros (1,83–2,35:1) | `progreso.css:23` | pendiente |
| E-15 | Media | Paleta de ramos fija, pensada para fondo claro; 8/9 bajo 3:1 en oscuro | `identidad.js:23` | pendiente |
| E-16 | Media | Tintes semánticos entre 7 % y 45 %, sin escala | `tareas.css:63-68`; `calificaciones.css:9`; `calendario.css:16-22`; `malla.css:49-52` | pendiente |
| E-17 | **Alta** | Anillo de Tareas llena lo pendiente con `--fg`; el texto SVG no escala | `shell.js:2183,2193,2196` | pendiente |
| E-18 | **Alta** | «Hoy y atrasadas»: 4 en KPI y 8 en columna en la misma pantalla | `shell.js:2220` vs `2253` | pendiente |
| E-19 | Media | Sparkline sin estado vacío: barras de 1 px o un punto suelto | `progreso.css:48-59`; `progreso/bloque.js` (`spark`) | pendiente |
| E-20 | Media | Notas sin nota abierta muestra título y toolbar deshabilitados | `notas.css:10-17` | pendiente |
| E-21 | Media | A 411, el rail del Calendario va antes de la grilla y la empuja fuera | `calendario.css:29` | pendiente |
| E-22 | Media | A 140 %, se recorta «Calendario» y se cortan placeholders de Notas | `base.css:82`; `notas.css:17` | pendiente |

## 4. Estado de las unidades

Se actualiza en el mismo commit del cambio. `Commit` es el SHA corto.

| ID | Fase | Unidad | Estado | Commit |
|---|---|---|---|---|
| E-00 | 0 | Baseline + gate | hecho | E-00 |
| E-14 | 1 | Badge q legible | hecho | E-14 |
| E-17 | 1 | Anillo de Tareas | hecho | E-17 |
| E-18 | 1 | Conteo hoy/atrasadas | pendiente | — |
| E-01 | 2A | Escala tipográfica | pendiente | — |
| E-12 | 2A | «Disponible» | pendiente | — |
| E-13 | 2A | «Activo» y «sin examen» | pendiente | — |
| E-15 | 2A | Paleta de ramos | pendiente | — |
| E-16 | 2A | Escala de tintes | pendiente | — |
| E-25 | 2B | Grilla de 5 px | pendiente | — |
| E-02 | 2B | Medidas de bloque a la grilla | pendiente | — |
| E-03 | 2B | Radios 5/10/15 | pendiente | — |
| E-04 | 2B | Borde de estado 5 px | pendiente | — |
| E-05 | 2B | Sombras en la grilla | pendiente | — |
| E-26 | 2B | Capa de componentes | pendiente | — |
| E-27 | 2B | Migración de controles | pendiente | — |
| E-28 | 2B | Barrido de px sueltos | pendiente | — |
| E-06 | 3 | Un solo modal | pendiente | — |
| E-07 | 3 | Un solo conmutador | pendiente | — |
| E-08 | 3 | Un solo plegable | pendiente | — |
| E-09 | 3 | Un solo estado vacío | pendiente | — |
| E-10 | 3 | KPIs coherentes | pendiente | — |
| E-11 | 3 | Escala de iconos | pendiente | — |
| E-19 | 4 | Sparkline con vacío | pendiente | — |
| E-20 | 4 | Notas sin nota | pendiente | — |
| E-21 | 4 | Calendario móvil | pendiente | — |
| E-22 | 4 | 140 % sin recortes | pendiente | — |
| E-23 | 5 | Higiene de CSS | pendiente | — |
| E-24 | 5 | Contrato, changelog y cierre | pendiente | — |

## 5. Fichas de ejecución

Cada ficha es autosuficiente: con esto y §3 se puede ejecutar sin el chat.

### Fase 0 — baseline

**E-00 · Baseline y gate**

- **Cambio:** crear `pruebas/gate-estetica.py` con el esqueleto de cuatro bloques (`tokens`, `contraste`, `disposicion`, `semantica`) y asserts que ya pasan (10 temas con las mismas variables; 1440 sin desborde). Agregarlo a `GATES` en `correr-gates.py` (42 gates).
- **Criterio:** `python3 pruebas/gate-estetica.py` sale 0 y `correr-gates.py` sigue 42/42. El gate imprime los ratios de contraste de los 10 temas como informe.
- **Contexto mínimo:** `pruebas/gatelib.py` (abrir app), `pruebas/gate-escala.py` (patrón de 140 %), `pruebas/gate-diseno.py`.
- **Commit:** `estetica E-00: gate de estetica - baseline de tokens, contraste y disposicion`

### Fase 1 — Alta (primero lo que se lee mal)

**E-14 · Badge q legible**

- **Cambio:** `.prog-badge--q` deja de usar `--ac-fuerte` sobre `--info-bg`. Pasa a `color:var(--fg)`, `background:var(--info-bg)` y borde `color-mix(--ac 35%)`. Si se prefiere un token, agregar `--info-fg` a los 10 temas.
- **Criterio:** el badge mide ≥ 4,5:1 en los 10 temas; `gate-estetica` lo asserta. Captura en Clásico/Medianoche/Negro/DeepSea.
- **Contexto mínimo:** `progreso.css:19-23`; `progreso/bloque.js:247`; `temas/*.css`.
- **Commit:** `estetica E-14: badge de informacion legible en los diez temas`

**E-17 · Anillo de Tareas**

- **Decisión:** D-01. Default: llenar lo cumplido.
- **Cambio:** en `pintarAnilloTareas`, `pct = hechas/total`; arco `--ok` para hechas y `--pista` para el resto; texto «% al día». Reemplazar `font-size="24"` y `"10"` por clases CSS con `--fs-lg`/`--fs-xs` para que escalen.
- **Criterio:** la longitud del arco hecho / circunferencia = `hechas/total`; el texto = `Math.round(hechas/total*100)`; a 140 % el `font-size` computado del texto del anillo crece. `gate-estetica` lo asserta.
- **Contexto mínimo:** `shell.js:2180-2201`; `tareas.css:8`; captura 411.
- **Commit:** `estetica E-17: anillo de tareas mide lo cumplido y escala con la letra`

**E-18 · Conteo hoy/atrasadas**

- **Decisión:** D-02. Default: ocurrencias en KPI y columna.
- **Cambio:** `#kpi-hoy` usa la misma lista que `colHoy` (las ocurrencias visibles con `fecha <= hoy`), o `colHoy` usa `itemsHoy` si se elige tareas. Etiqueta del KPI: «pendientes hoy/atrasadas» para distinguirla de «abiertas».
- **Criterio:** con el filtro «Todas», `#kpi-hoy` y el contador de la columna «Hoy y atrasadas» son iguales en un estado con una serie recurrente. `gate-estetica` crea la serie y lo asserta.
- **Contexto mínimo:** `shell.js:2210-2264`; `gate-tareas-tablero.py` (fixture de serie).
- **Commit:** `estetica E-18: una sola cuenta para hoy y atrasadas`

### Fase 2A — Lenguaje (tipo y color)

**E-01 · Escala tipográfica**

- **Decisión:** D-07 y D-09. Agregar `--fs-h1:1.55rem`, `--fs-num:1.7rem`, `--fs-display:3.4rem`; mantener los 5 base. Mapear: `.sec-cab h1` → `--fs-h1`; `.nota-titulo` → `--fs-xl`; `.nota-preview h1..h4` → `--fs-xl/lg/md/sm`; `.prog-num b` → `--fs-num`; `.tiempo-reloj` → `--fs-display`; `.cod` y `.cod--tab` → `--fs-xs` (se elimina el texto bajo 11,2 px). `.marca .wordmark` → `--fs-h1`.
- **Criterio:** no queda `font-size` en `rem` fuera de los 8 tokens; ningún texto computado < 11,2 px en 1440. `gate-estetica` recorre el CSS y falla con la lista. Si D-09 se inclina por px, los 8 tokens se redefinen a 10/15/20/25/35 y el criterio pasa a esa lista.
- **Contexto mínimo:** `tokens.css:10-15`; grep de `font-size:` en `app/css`.
- **Commit:** `estetica E-01: escala tipografica con roles y sin textos de 7 px`

**E-12 · «Disponible»**

- **Decisión:** D-03. `--ac` para disponible en KPI, leyenda y tarjeta; `--q` solo estimado/proyectado. El KPI «% de la carrera» pasa a neutro (`--fg`) para no tener dos azules.
- **Criterio:** un mismo estado produce el mismo color computado en `#malla-k-libres`, `.malla-leyenda i.disponible` y `.ramo-card--disponible`; Calificaciones `.calif-disponible` usa `--ac`/`--info-bg`, no `--warn`. `gate-estetica` compara.
- **Contexto mínimo:** `malla/vista.js` (KPIs); `malla.css:9-17,34,51`; `calificaciones.css:9`.
- **Commit:** `estetica E-12: disponible es azul en toda la app`

**E-13 · «Activo» y «sin examen»**

- **Decisión:** D-04. `calif-caja--est` usa `--ok` si el estado es activo/aprobado; `--q` queda para estimado. La caja de examen sin necesidad usa `--sup2`/`--muted`, no `--warn`.
- **Criterio:** lista y resumen de Calificaciones coinciden en color para «activo»; «sin examen» no usa `--warn`. `gate-estetica` compara clases y colores.
- **Contexto mínimo:** `shell.js:3630-3640,3750-3755`; `calificaciones.css:61-69`.
- **Commit:** `estetica E-13: activo verde y sin examen neutro`

**E-15 · Paleta de ramos**

- **Decisión:** D-05. Introducir `--ramo-visible` en los temas oscuros: `color-mix(in srgb, var(--ramo) 70%, var(--fg))`, y usar `--ramo-visible` en iconos, puntos y bordes; `--ramo` queda para fondos/tintes. En temas claros, `--ramo-visible: var(--ramo)`.
- **Criterio:** los 9 colores de `identidad.js` miden ≥ 3:1 contra `--sup` en los 10 temas, incluidos los temas oscuros y un color personalizado. `gate-estetica` pinta una muestra por color y mide.
- **Contexto mínimo:** `identidad.js:23`; `shell.css` (`.ramo-punto`, `.ramo-ico`); `calendario.css` (`.cal-ramo`, `.evento-chip__ico`); `temas/*.css`.
- **Commit:** `estetica E-15: color de ramo legible en temas oscuros`

**E-16 · Escala de tintes**

- **Cambio:** definir en `tokens.css` (bajo `[data-tema]`) `--tinte-ok`, `--tinte-warn`, `--tinte-bad` al 10 %; usar `--pill-*-bg` para badges de texto y `--tinte-*` para lavados de superficie. Eliminar los `color-mix` de 7/9/12/14/18 % de los bloques; los bordes al 35/40/45 % pasan a `--line`/`--ac` o a un `--borde-tinte` único.
- **Criterio:** `grep -R "color-mix" app/css/bloques` solo muestra los tokens o porcentajes de la allowlist; las capturas de «atrasada», «receso», «disponible» y «curso» tienen la misma intensidad.
- **Contexto mínimo:** `tokens.css`; `tareas.css:63-68`; `calificaciones.css:9`; `calendario.css:16-22`; `malla.css:49-52`.
- **Commit:** `estetica E-16: una escala de tintes para los estados`

### Fase 2B — Grilla de 5 px y controles

> Orden obligatorio: E-25 → E-02 → E-03 → E-04 → E-05 → E-26 → E-27 → E-28. E-25 cambia el ritmo de toda la app; las demás se apoyan en él. Esta es la fase «ardua»: no se mezcla con color ni con componentes.

**E-25 · Grilla de 5 px**

- **Cambio:** reescribir la escala base de `tokens.css` según §1.1: `--sp-1..8` a 5/10/15/20/25/30/40/50; `--r-sm/md/lg` a 5/10/15; `--alto-topbar` 55, `--alto-kpi` 70, `--alto-pie` 40, `--ancho-rail` 220, `--lienzo-pad` 20/25/50; `--sombra` a `0 5px 10px rgb(15 23 42 / .06)`.
- **Criterio:** todos los px de `tokens.css` son múltiplos de 5 salvo los trazos (1–3 px de borde y 2/4 px de foco). La app no desborda a 1440 ni a 411. Capturas de las 9 secciones en Clásico y DeepSea; el ritmo se revisa antes de seguir.
- **Contexto mínimo:** `tokens.css` completo; `base.css` (topbar, navbar, contenido, rail, panel, tarjeta, KPI, botón); `gate-escala.py`.
- **Commit:** `estetica E-25: grilla de 5 px en toda la geometria`

**E-02 · Medidas de bloque a la grilla**

- **Cambio:** las medidas de caja que dependen del texto pasan a `calc(px * var(--esc))` y a múltiplos de 5: 280/360/420 se conservan; 196 → 200; 78 → 80; 22 → 25; `100vh - 220px` se conserva. Los círculos (check, punto) usan el token de 25 o 35 según su altura.
- **Criterio:** a 140 %, `#nota-toolbar`, `.notas-lista`, `.calif-lista`, `.malla-col` y `.prog-ring` no recortan texto; no hay `scrollWidth > clientWidth` en esos contenedores. `gate-estetica` lo mide.
- **Contexto mínimo:** los archivos de E-02 en §3; `gate-escala.py`.
- **Commit:** `estetica E-02: medidas de bloque en la grilla y con escala`

**E-03 · Radios y píldoras**

- **Decisión:** D-06. Valores permitidos: `--r-sm` (5), `--r-md` (10), `--r-lg` (15), `50%` (círculos), `999px` (solo chips de estado), `0` (solo alto contraste). Desaparecen los radios sueltos 4/99; `.ramo-card` → `--r-md`; `.evento-chip` → `--r-sm`; `.prog-barra` → `--r-sm`.
- **Criterio:** `gate-estetica` lista los `border-radius` y falla con valores fuera de la allowlist. `5/10/15` solo aparecen como `var(--r-sm/md/lg)`, nunca en crudo. Captura de chips/badges en Clásico y Alto contraste.
- **Contexto mínimo:** `tokens.css:32-35`; grep de `border-radius` en `app/css`.
- **Commit:** `estetica E-03: radios 5/10/15 y una sola silueta de chip`

**E-04 · Borde de estado único**

- **Cambio:** todo borde izquierdo de estado a 5 px (Malla se queda en 5; Tareas/Progreso/Calendario suben de 3 a 5; Calificaciones sube de 4 a 5).
- **Criterio:** en las clases de estado (`.tarea-fila--atrasada`, `.calif-disponible`, `.calif-cierre`, `.ramo-card`, `.prog-grupo`) el borde izquierdo es 5 px; no quedan 3/4 px en esas clases. Los chips densos (`.evento-chip`), los blockquotes y los separadores conservan 1–3 px como trazos. Captura de Tareas/Malla/Calificaciones.
- **Contexto mínimo:** los cinco archivos de E-04.
- **Commit:** `estetica E-04: borde de estado de 5 px en todas las secciones`

**E-05 · Sombras y movimiento**

- **Cambio:** `--sombra` (reposo) y `--sombra-2` (modal) con offsets/blur múltiplos de 5: `0 5px 10px rgb(15 23 42 / .06)` y `0 10px 30px rgb(0 0 0 / .18)`; agregar `--t-lenta:.18s`; reemplazar las tres sombras de modal y las duraciones .18/.25/.35 por tokens. Las animaciones de pulso/girar conservan su duración propia y se documentan.
- **Criterio:** no queda `box-shadow:0 ... rgb(...)` hardcodeado fuera de tokens; todos los offsets/blur son múltiplos de 5; `grep` de `transition:.*[0-9]s` solo permite `var(--t)`/`var(--t-lenta)` y las animaciones declaradas.
- **Contexto mínimo:** `tokens.css`; `shell.css:84,396`; `progreso.css:88`; `actualizaciones.css:7`.
- **Commit:** `estetica E-05: elevacion y duracion desde tokens`

**E-26 · Capa de componentes**

- **Cambio:** agregar a `tokens.css` los tokens de §1.1 (`--control-*`, `--campo-*`, `--menu-*`, `--tarjeta-*`, `--modal-*`, `--chip-*`, `--icono-*`) y reescribir `.btn`, `.btn--chico`, `.icono-btn`, `.entrada`, `select`, `textarea`, `.menu-ctx`, `.card`, `.modal` y `.chip` para consumirlos. Ningún componente vuelve a declarar alto, padding, radio ni fuente propios.
- **Criterio:** el `.btn` base mide 35 de alto, radio 5 y padding 15; `.btn--chico` 25/10; `select.entrada` e `input.entrada` miden 35 y comparten borde/radio/foco; `.menu-ctx button` mide 30 de alto y radio 10. `banco-tokens.html` gana una sección «Controles» con todas las variantes en los 10 temas. `gate-estetica` bloque `controles` compara los computados.
- **Contexto mínimo:** `tokens.css`; `base.css:156-180`; `shell.css` (`.icono-btn`, `.menu-ctx`, `.modal`); `banco-tokens.html`.
- **Commit:** `estetica E-26: boton, campo y menu desde tokens universales`

**E-27 · Migración de controles**

- **Cambio:** eliminar los controles de una sección que declaran su propia forma: `.tarea-add`, `.calif-x`, `.sesion-x`, `.tab-add`, `.btn-control`, `.footer__btn`, `.rec-dia`, `.ident-cat`, `.cchip`, `.tareas-filtro`, los botones de `.calif-filtro` y `.conmutador`, `.prog-card__pie .btn`, `.semana-chip`, `.cal-mes-cel`. Cada uno pasa a `.btn`/`.btn--chico`/`.chip` o consume los tokens; se borra su `height`, `padding`, `border-radius` y `font-size` local.
- **Criterio:** ningún CSS de bloque declara forma de botón, campo, select o chip. `gate-estetica` muestrea Tareas, Progreso, Calificaciones y Ajustes y verifica que el mismo control computa igual. Captura de los 4 bancos.
- **Contexto mínimo:** grep de `height:`, `padding:`, `border-radius:` y `font-size:` en `app/css/bloques`; `banco-tokens.html`.
- **Commit:** `estetica E-27: ningun bloque redefine la forma de un control`

**E-28 · Barrido de px sueltos**

- **Cambio:** reemplazar todo `px` crudo de geometría en `app/css` por un token de la grilla o por el múltiplo de 5 más cercano: `gap:6px` → `--sp-1`/`--sp-2`, `padding:0 6px` → `--sp-1`, `margin-bottom:7px` → `--sp-2`, `2px/4px/9px/14px` → 5/5/10/15. Los únicos px crudos que quedan son los de `tokens.css` y los trazos declarados (1–3 px, foco 2/4, cápsula 999).
- **Criterio:** `gate-estetica` bloque `grilla` recorre las declaraciones CSS y falla con cualquier px de geometría que no sea múltiplo de 5; imprime la lista para corregirla. Capturas de las 9 secciones.
- **Contexto mínimo:** grep de `[0-9]px` en `app/css`; `tokens.css`; allowlist de §1.1.
- **Commit:** `estetica E-28: barrido de px a la grilla de 5`

### Fase 3 — Componentes (media; E-09/E-11 son baja)

> Todas consumen los tokens de E-25/E-26. Ninguna ficha vuelve a declarar alto, padding, radio ni fuente de control; solo cambia la estructura o el color.

**E-06 · Un solo modal**

- **Cambio:** una implementación `.modal` en `shell.css` (overlay, caja, cabecera, pie, cierre). Tamaño por modificador (`--ancho`, `--alto`), padding `--modal-pad` (25), radio `--modal-radio` (15), título `--fs-xl`, pie con acción primaria a la derecha, fondo `--sup`, sombra `--sombra-2`, un solo `z-index` (60; el anidado usa 70). Migrar `.prog-modal` de Progreso a las clases comunes y borrar `progreso.css:87-104`.
- **Criterio:** no existe `.prog-modal`; «Nueva tarea» y «Nueva meta» comparten título, pie, fondo y sombra. `gate-estetica` compara `getComputedStyle` de ambas cajas.
- **Contexto mínimo:** `shell.css:82-103`; `progreso.css:87-104`; `progreso/vista.js` (modales).
- **Commit:** `estetica E-06: un solo modal con una anatomia`

**E-07 · Un solo conmutador**

- **Cambio:** `.seg` (contenedor + botones + activo) para vistas y filtros; `.chip` (cápsula) para filtros de taxonomía. Ambos ya existen como tokens y clases base en E-26. Migrar Tareas (`.conmutador`), Calificaciones (`.calif-filtro`), Tareas (`.tareas-filtro` a `.chip`) y Tiempo (modos a `.seg`). `.rec-frec` usa `.seg` dentro del modal.
- **Criterio:** solo existen `.seg` y `.chip`; ningún bloque define su propio grupo de botones. Captura de las cuatro secciones.
- **Contexto mínimo:** `shell.css:32-34`; `calificaciones.css:4-7`; `tareas.css:49-53,80-87`; `tiempo.css:37-40`.
- **Commit:** `estetica E-07: un conmutador y un chip para toda la app`

**E-08 · Un solo plegable**

- **Cambio:** `.plegable` como único componente (cabecera, chevron, cuerpo, `aria-expanded`, `inert`). Progreso usa `.plegable` con modificador de tono para el borde izquierdo; Sync usa el mismo componente en vez de `<details>` o se documenta como excepción nativa.
- **Criterio:** no queda `.prog-grupo__cuerpo`/`.prog-grupo__chev`; el chevron gira igual en Calificaciones, Progreso y Sync. `gate-plegable.py` sigue verde.
- **Contexto mínimo:** `shell.css:106-130`; `progreso.css:110-133`; `progreso/bloque.js` (`grupoHTML`).
- **Commit:** `estetica E-08: un solo plegable y un solo chevron`

**E-09 · Un solo estado vacío**

- **Cambio:** `.vacio` (título, texto, acciones primaria/secundaria, borde discontinuo, `--r-lg`, máx. 460 px). Migrar `.empty`, `.prog-vacio`, `.catalogo-vacio`, `.calif-sin`, `.malla-sin`, `.buscar-vacio`; Notas usa `.vacio` dentro del editor.
- **Criterio:** una sola clase en las 9 secciones; ninguna sección inventa su vacío. Captura de 3 vacíos.
- **Contexto mínimo:** los seis selectores de E-09; `notas/bloque.js` (estado sin nota).
- **Commit:** `estetica E-09: un solo estado vacio con accion`

**E-10 · KPIs coherentes**

- **Decisión:** D-08. Número siempre `--fg`; el color va en borde superior de 5 px o punto. Malla y Calificaciones dejan de teñir el número.
- **Criterio:** `.malla-kpis .kpi b` y `.calif-resumen b` computan `--fg`; el color de estado sigue visible en el borde/punto. Captura de Malla/Calificaciones.
- **Contexto mínimo:** `base.css:146-153`; `malla.css:9-17`; `calificaciones.css:61-69`.
- **Commit:** `estetica E-10: el numero del KPI no cambia de color`

**E-11 · Escala de iconos**

- **Cambio:** tres tamaños de la grilla: 15 (denso: chips de calendario), 20 (UI: botones/tarjetas), 25 (cabeceras/vacíos), desde `--icono-sm/md/lg` de E-26. `.icono` por defecto 20; `.ramo-ico` 14/15/16 → 15; 22/26 → 25; evento 11 → 15; progreso 17/19 → 20.
- **Criterio:** todos los `width/height` de iconos pertenecen a {15,20,25}. `gate-estetica` lista los valores.
- **Contexto mínimo:** `shell.css:3`; `calendario.css:52`; `progreso.css` (`.prog-card__ico`, `.prog-grupo__ico`); `shell.css` (`.ramo-ico`, `.ramo-ico--lg`).
- **Commit:** `estetica E-11: escala de iconos de 15, 20 y 25`

### Fase 4 — Pantallas y responsive

**E-19 · Sparkline con vacío**

- **Cambio:** si la serie tiene 0 valores no nulos, no pintar el SVG: mostrar «Sin registros todavía» en `--muted`. Con 1 valor, un punto y el valor, sin línea de meta ni barras de 1 px. La altura pasa a `calc(34px * var(--esc))`.
- **Criterio:** 0 y 1 registro no producen barras de 1 px; el texto de vacío es legible. `gate-progreso.py` cubre el caso.
- **Contexto mínimo:** `progreso/bloque.js` (`spark`, `sparkLinea`); `progreso.css:48-59`.
- **Commit:** `estetica E-19: sparkline con estado vacio legible`

**E-20 · Notas sin nota**

- **Cambio:** sin nota seleccionada, el panel derecho muestra `.vacio` («Elige una nota o crea una» + CTA) y oculta título/toolbar; no se muestra «Título de la nota» ni «Sin nota abierta» a la vez.
- **Criterio:** `#nota-titulo` no visible cuando no hay nota; `.vacio` visible con CTA; crear desde ahí abre el editor. `gate-editor.py` lo cubre.
- **Contexto mínimo:** `notas/bloque.js` (`pintar`), `notas.css:10-20`.
- **Commit:** `estetica E-20: notas sin nota muestra un vacio con accion`

**E-21 · Calendario móvil**

- **Cambio:** a ≤900 px, la tarjeta del calendario va primero (`order`), el rail se colapsa en un `.plegable` «Filtros y ramos» debajo, y «Nuevo evento» se mueve a la cabecera de la sección (visible en todos los tamaños).
- **Criterio:** a 411×860 la grilla del mes aparece en la primera pantalla (o con un solo scroll corto); no hay desborde; «Nuevo evento» sigue accesible. Captura 411.
- **Contexto mínimo:** `calendario/vista.js` (orden del rail); `calendario.css:2,29`; `base.css` (`.rail`).
- **Commit:** `estetica E-21: en el telefono primero el calendario`

**E-22 · 140 % sin recortes**

- **Cambio:** tabs con `scroll-snap` y un degradado en el borde que indique scroll; a 140 %, la pestaña activa queda completa. Notas: etiquetas sobre los campos y `grid-template-columns:repeat(auto-fit,minmax(180px,1fr))`; placeholders cortos («Contexto», «Etiquetas») para que no se corten.
- **Criterio:** a 140 %, ninguna pestaña queda cortada a la mitad y `#nota-toolbar` no tiene `scrollWidth > clientWidth`; el foco recorre todos los campos. `gate-escala.py` y captura.
- **Contexto mínimo:** `base.css:82`; `notas.css:16-17`; `shell.css` (`.tabs`).
- **Commit:** `estetica E-22: 140 por ciento sin etiquetas cortadas`

### Fase 5 — Cierre

**E-23 · Higiene de CSS**

- **Cambio:** eliminar `.tarea-fila` grid muerto (`tareas.css:19`), `.evento-chip` block duplicado (`calendario.css:31,63`) y `.alarma-item` flex de `shell.css:436` (dejar el grid de `tiempo.css:90`); usar o borrar `--hoy-bg`.
- **Criterio:** no hay selectores con `display` contradictorio; `grep -- --hoy-bg app/css app/js` solo aparece en la definición o en un uso.
- **Commit:** `estetica E-23: sin reglas duplicadas ni tokens muertos`

**E-24 · Contrato, changelog y cierre**

- **Cambio:** escribir `docs/DISENO.md` con la escala final (tamaños, radios, iconos, colores semánticos, componentes), actualizar `CHANGELOG.md` con una entrada `## 1.2.0-beta.9 — correcciones estéticas`, y dejar §4 sin pendientes.
- **Criterio:** 42/42; `gate-estetica` verde; `docs/DISENO.md` enlazado desde `docs/BLOQUES.md` o `README`; merge `t/estetica` → `t/beta-9` con `--no-ff`. Sin push a `master`.
- **Commit:** `estetica E-24: contrato de diseno y cierre`

## 6. El gate como memoria ejecutable

`pruebas/gate-estetica.py` es lo que evita que una compactación borre el criterio. Se construye en E-00 y crece con cada unidad:

| Bloque | Qué mide | Cuándo se activa |
|---|---|---|
| `tokens` | tamaños, radios, bordes y sombras contra la allowlist | E-01, E-03, E-04, E-05, E-11 |
| `grilla` | que todo px de geometría sea múltiplo de 5, salvo trazos y formas | E-25, E-02, E-28 |
| `controles` | que `.btn`, `.entrada`, `select`, `.chip` y `.menu-ctx` computen igual en todas las secciones | E-26, E-27 |
| `contraste` | ratios de los 10 temas para texto, gráficos, badge q y ramos | E-14, E-15, E-12, E-13 |
| `disposicion` | 1440/411/140: desborde y recortes en 9 secciones | E-02, E-21, E-22 |
| `semantica` | KPI vs columna, arco del anillo, estados y clases | E-17, E-18, E-12, E-13 |

Regla: el gate **no** se pone rojo por una unidad que aún no se hace. E-00 crea los cuatro bloques que ya pasan; E-25 agrega `grilla`, E-26 agrega `controles`. Cada unidad agrega su assert al mismo tiempo que su cambio; así el suite queda 42/42 en todo momento y el gate solo contiene lo ya prometido.

## 7. Definición de hecho global

- [ ] 42/42 gates.
- [ ] `gate-estetica` verde en `tokens`, `grilla`, `controles`, `contraste`, `disposicion`, `semantica`.
- [ ] 10 temas: texto 4,5:1; grande 3:1; gráficos 3:1; badge q 4,5:1.
- [ ] 1440/411/140 sin desborde ni recorte en las 9 secciones.
- [ ] Toda medida de geometría es múltiplo de 5 a 100 %; solo quedan 1 px de trazo, 2 px de foco, cápsulas y círculos.
- [ ] Botón, campo, select y menú comparten tokens y computan igual en las 9 secciones.
- [ ] Un modal, un conmutador, un plegable, un vacío, una escala de iconos.
- [ ] `docs/DISENO.md` y `CHANGELOG.md`.
- [ ] §4 sin `pendiente`; las descartadas con `D-xx`.

## 8. Riesgos y rollback

| Riesgo | Mitigación |
|---|---|
| Una refactorización amplia rompe una sección | Una unidad = un commit; capturas antes/después en 1440, 411 y 140; 10 temas. |
| La grilla de 5 px cambia el ritmo de toda la app | E-25 va sola y primero en 2B; no se mezcla con color ni componentes; revisión visual de las 9 secciones antes de E-02. |
| La migración de controles toca casi todos los bloques | E-26 define los tokens y E-27 migra por sección; el gate `controles` detecta cualquier control que se resista. |
| Los cambios de color alteran la identidad del tema | Solo se ajusta luminosidad, no el tono; revisión al cerrar Fase 2A. |
| E-18 cambia una cifra visible | Se decide con D-02 y se anota en `CHANGELOG.md`; sin cambio de esquema. |
| El gate se vuelve frágil | Se assertan estilos computados e invariantes, no píxeles ni screenshots. |
| Se pierde el contexto | Este documento + el gate; ninguna unidad depende del chat. |
| Scope creep | No hay funciones nuevas ni bump/release en este plan. |

**Rollback:** `git revert <sha>` de la unidad. Las unidades de CSS no tocan datos; E-17/E-18 conservan el código anterior en el historial. No hay migración.

## 9. Bitácora

| Fecha | Unidad | Commit | Nota |
|---|---|---|---|
| 2026-11-21 | — | — | Plan creado desde la auditoría E-01…E-22. Sin cambios de UI. |
| 2026-11-21 | — | — | Plan actualizado: grilla de 5 px, capa de componentes y unidades E-25/E-26/E-27. Sigue sin cambios de UI. |
| 2026-11-21 | E-00 | E-00 | Gate `gate-estetica.py` creado y agregado al suite (42). Baseline verde: 10 temas, contraste de `--muted`, 9 secciones sin desborde a 1440. |
| 2026-11-21 | E-14 | E-14 | Badge «Desde Estudio» con `--fg` sobre `--info-bg`: 9,74–21:1 en los 10 temas (antes 1,83–2,35 en tres oscuros). Gate lo asserta. |
| 2026-11-21 | E-17 | E-17 | El anillo llena lo cumplido con `--ok` sobre pista `--pista`; texto «% al día»; el texto SVG pasa a `--fs-lg`/`--fs-xs` y el anillo a 110 px. Con 2 hechas/1 pendiente marca 67 %. `gate-tareas-anillo` actualizado. |

## 10. Cola por gravedad (resumen)

- **Alta (3):** E-14, E-17, E-18. Fase 1.
- **Media (15):** E-01, E-02, E-03, E-06, E-07, E-08, E-10, E-12, E-13, E-15, E-16, E-19, E-20, E-21, E-22. Fases 2A–4.
- **Baja (4):** E-04, E-05, E-09, E-11. Se ejecutan dentro de Fase 2B/3 porque los componentes los consumen; no se dejan para el final para no rehacer trabajo.
- **Transversal (4):** E-25, E-26, E-27, E-28. No vienen de un hallazgo: son la grilla de 5 px y la capa de componentes que hacen universales el botón, el campo y el menú. Van en Fase 2B y son la base de E-06…E-11.
