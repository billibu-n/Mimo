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
| **T2** interfaz, estilos, i18n y registro en el shell | **HECHO** | 1.124 l de `ui.js`, `estilos.css` sin un hex, 431 claves por idioma sin asimetrías; medido en Chromium: **0 excepciones y 0 avisos**, 16 pares de contraste ≥ 4,5 y los tres anchos sin desborde (`prototipo/evidencia/tiempo-ui.txt`) |

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

De T2: falta `iconos/tiempo.svg` (la navegación cae en `ic-bloque`) y el sprite no tiene play/pausa
(los botones van solo con texto). Sin medir de punta a punta: el aviso de fin de temporizador, el
descanso largo del pomodoro, teclado, `prefers-reduced-motion`, el ancho 680 y reinstalar conservando
datos. **Y el hueco que muerde al paquete:** el catálogo declara `configuraciones: tiempo.semana`
(horas objetivo por semana, default 20) y `ofrece: tiempo.horas`, pero el motor **no implementa la
meta semanal** (sí da `minutosSemana` y `agregadosPorRamo`). O se implementa antes de la ronda del
pack, o se corrige el catálogo: hoy el shell enseñaría un ajuste que no hace nada.

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
git log --oneline -4                             # -> cabecera de la rama estado-2026-10-20
git status --short                               # -> vacio = todo guardado
ls prototipo/evidencia/iter4a.txt                # -> existe, 93 lineas de cifras
cd prototipo && node bloques/tiempo/prueba-motor.js   # -> 14 PASA, 0 FALLA
cd .. && python3 tablero/medir-tablero.py        # -> las tres pieles dentro de su techo
ls tablero/armazon.html tablero/direcciones.html # -> los dos tableros de diseno
ls referencia/mimo-app-53cc22d/js                # -> la app anterior, para portar motores
```

## 9. Frente de diseño (abierto el 2026-10-20, rama `estado-2026-10-20`)

Se abrió **antes** de seguir migrando bloques, por decisión del dueño: la app actual es «sobria
aunque funcional», y eso se decide una vez, no siete. Diagnóstico medido del prototipo: **45
espacios distintos, 7 radios escritos a mano, 46 hex directos y cero movimiento de interfaz**
(solo dos animaciones de adorno, `12s` y `18s`). La app anterior tenía carácter con **231 hex y 9
temas**: expresividad comprada con caos.

- **`tablero/direcciones.html`** — tres pieles con los mismos siete componentes. Declaran y cumplen
  sus techos: **A** Papel y tinta (5 tamaños · 8 espacios · 2 radios · 2 duraciones · 0 hex) · **B**
  Instrumento (5/8/2/2/0) · **C** Materia (5/8/2/3/0). Contraste mínimo texto-fondo 5,88 · 5,60 ·
  5,24 en claro y 6,77 · 6,61 · 7,18 en oscuro.
- **`tablero/armazon.html`** — el **armazón aprobado**: riel de bloques instalados + losa +
  **estantería que lista las VISTAS del bloque abierto** (Cronómetro · Temporizador · Pomodoro ·
  Registro), no las secciones. Cinco estados: normal, gabinete, edición, vacía y apariencia; los
  tres primeros se alcanzan por URL (`?piel=a|b|c&tema=claro|oscuro&estado=…`). Añadir un bloque es
  un «+» y un botón; quitarlo es el modo edición del riel; el estado vacío enseña el gabinete en vez
  de un «no hay nada».
- **`tablero/medir-tablero.py`** — el contador del sistema visual (AU-131): recuenta valores
  distintos por dimensión, avisa al pasar el techo y **se prueba rompiéndolo** (`--autoprueba`, 4
  casos en rojo). `--fichero` le permite medir el armazón; sin argumento mide `direcciones.html`.
- **La apariencia será un bloque, no un fichero**: los temas dejan de ser `<link>` a CSS y pasan a
  ser **datos** (fondo, superficie, tinta, acento). Ya están declarados seis: Papel, Arena, Marea,
  Grafito, Medianoche y Alto contraste.

**El quiebre de la losa, medido** (`tablero/evidencia-quiebre.txt`, 2026-10-20 13:08; 26 cargas, 6 de
borde y 2 de botón, más el desempate del padre): con el panel derecho abierto la losa vale
**`ancho − 736`** (13 de 13 anchos ≥ 900, rectángulos de Chromium, no restas) y con los paneles cerrados
`ancho − 384`. Hay **dos suelos y dos umbrales**, y no coinciden (164 px de diferencia): **1256** px para
que la losa conserve los 520 del encargo (a 1257 → 521,00; a 1255 → 519,00) y **1092** px para que no
recorte nada (a 1093 → 357,00 sin recorte; a 1091 → 355,00 con `.losa__cuerpo` 356/355). El quiebre de hoy
está en **899**, así que **entre 900 y 1255 la losa se ahoga sin avisar**: a 1100 mide 364,00 con el pomo
en 268,00; a 950, 214,00 con el anillo recortado (356/214); a 900, 164,00. A 1100 el panel **empuja**
(716,00 → 364,00, `.velo` none): el defecto se reproduce con el botón, no solo por URL.

**Los huecos declarados del boceto son ocho, no cinco** (§12 de `evidencia-paneles.txt`, a-h): además de
«Instalar no instala», «las fichas no cambian tema» y «Ajustes vacío», la URL no se reescribe, el riel
queda bajo el velo en superpuesto, no hay trampa de foco en los paneles, el tema oscuro apaga la sombra y
el riel mide 256. Los tres primeros son de **comportamiento con confirmación falsa** (la ficha mueve su
anillo y parece que cambió el tema): se declaran al dueño antes de que toque botones.

**Decisión tomada:** la piel es la **C · Materia** (aprobada por el dueño el 2026-10-20; el `armazon.html`
de tres pieles queda como comparador, no como propuesta). **HUECO conocido de la piel B, si se comparara:**
el filete da 1,31:1 sobre la superficie y la pista del anillo del pomodoro se pierde en su panel; en la C
no aplica. **Nada de esto se ha aplicado al prototipo**: el armazón es una muestra aparte y `prototipo/`
sigue intacto.

**Decisión tomada (2026-10-20, con los números delante):** el quiebre es **por panel**, no por viewport.
Cada panel empuja solo si, con su ancho real, a la losa le quedan **≥ 520 px** (`LOSA_MIN`); si no, ese
panel se superpone. Con los dos abiertos eso son los umbrales medidos: **riel 904** y **panel derecho
1256**; con el riel plegado, 704. Se descartaron, con el dueño delante, un quiebre único en 1256 (a 1100
el riel se superpondría sin necesidad), bajar el suelo a 356/1092 (la losa bajaría a 364 y el anillo
tocaría el borde) y plegar el riel solo al abrir el panel (le mueve al usuario una elección manual).
Los huecos del boceto **se quedan como están**: el dueño queda avisado por escrito y el boceto se aprueba
por aspecto e interacción, no por función.


**Ronda 92 — el modelo de bloques (dos niveles, decidido el 2026-10-20).** El riel lista
SECCIONES y cada sección tiene sus BLOQUES instalados: Tiempo trae de fábrica solo Cronómetro y
Temporizador, y Pomodoro, Registro y Alarmas se instalan y se quitan desde el gabinete del panel
derecho (el riel no crece con bloques). Se guarda en `localStorage` (`mimo.armazon.v1`) y `?reset=1`
vuelve a fábrica. Descartado, con el dueño delante: «todo es bloque y un bloque puede contener
bloques sin límite» (hay que decidir qué pasa al quitar un contenedor con hijos) y «sin secciones»
(se pierde la navegación ya aprobada). La v5 queda en `c21759e`; la v6 se mide en
`tablero/evidencia-bloques.txt`. Después, Ronda 93: migrar los motores de `prototipo/` y de
`referencia/mimo-app-53cc22d/` con el i18n `es`/`en` desde el primer bloque.
