# Revisión de simetría de los bloques migrados (R96-REV, 2026-10-20)

Revisor de solo lectura, sin escrituras (`git status --short -- tablero/` = 0 antes y después). Brief y molde:
`~/workspace/harness/encargos/2026-10-20-bloque-r96-revision-simetria.md`. Alcance: los bloques cerrados
T002 (tiempo), T004 (malla), T005 (estudio + calificaciones) y el sustrato T003. Prohibido leer
`armazon-paneles.html` y `js/tareas.js` por estar en escritura en ese momento.

## Medidas del revisor
- `grep -c "document\." tiempo.js malla.js estudio.js` = 0, 0, 4. Los ocho toques de `document.` de
  `estudio.js` (417, 689, 719, 758) y `calificaciones.js` (358, 667, 715, 792) son de la UI; ningún motor nombra el DOM.
- Las claves i18n que contó por `grep` (223) **no mandan**: el gate vivo mide **272/272** con 0 desajustes.
  Un revisor no sustituye a un instrumento.

## Hallazgos (ordenados por riesgo, coste)
| id | fichero:línea | qué es | por qué rompe la simetría | coste | riesgo si se deja |
|---|---|---|---|---|---|
| F2 | `estudio.js` (fin), `calificaciones.js` (fin) | no cuelgan `Motor`/`UI` en `window` con asignación explícita, aunque la cabecera lo promete (`estudio.js:31`); funcionan por el `var` global del `<script>` | el patrón de exportación de `malla.js:888/1653` y `tiempo.js:1153-1154` no se cumple | M | un instrumento o bloque futuro que toque la API por `window` queda acoplado a un accidente del cargador |
| E1 | `calificaciones.js:164` | lee `Mimo.leer().estudio`, namespace de otro bloque, sin puente declarado | `CONTRATO-BLOQUES.md` §13.1: un bloque mira solo sus colecciones | M | cambiar la forma de `estudio` rompe en cruz y el corte motor/vista no lo detecta |
| F3 | `tiempo.js:41, 265-273, 292` | conserva la clave vieja `mimo.bloque.tiempo` como reserva y re-escribe ahí si falta `MimoComun` | único bloque con doble camino de persistencia | M | si no carga `almacen.js` resucita un cajón que `respaldo.js` no cubre: dos verdades |
| F1 | `estudio.js:417,689,719,758`, `calificaciones.js:358,667,715,792` | la UI usa `document.` directo sin la concesión única `var D = window.document` con guard | `malla.js:13` lo declara como patrón y `malla.js:899`/`tiempo.js:694` lo cumplen | S | asimetría de forma; la UI se rompe en contexto sin `document` |
| V1 | `tiempo.js` (3 `disabled`) vs `malla.js:1147-1150`, `calificaciones.js:404` (`aria-pressed`) | el control no disponible se expresa distinto por sección | no hay patrón único para «acción no disponible ahora» | S | misma intención, tres formas de pintada; los medidores no lo atan |
| I1 | los tres medidores CDP (0 coincidencias de foco/teclado/Tab) | ningún instrumento mide foco, teclado ni `disabled` por sección | hueco de cobertura de la parte accesible de la simetría | S | regresiones de teclado pasan en verde hasta T011 |

## Instrumentos
Los tres CDP repiten el patrón intacto: puerto libre por socket (`tiempo2:71-72`, `malla:80-81`, `estudio:77-78`),
Chromium con `--remote-debugging-port` y perfil en `/tmp`, cierre por PID (`proc.terminate()`), `--fichero` con
default `armazon-paneles.html` y `RESUMEN: %d choque(s) de %d medidas` con EXIT por choques (`estudio.py:500`).
`medir-tablero.py` es estático y su RESUMEN es de techo: distinto por diseño, no asimetría.

## Veredicto
Arreglar `F1` y `F2` (barato) antes de seguir con T008/T009; `E1` y `F3` al cierre de paridad T011 con decisión del
dueño; `V1` e `I1` solo se anotan y no se tocan (diseño por bloque ya medido en verde).

Dudas fuera del dictamen (sin línea que las sostenga): 208 claves del diccionario sin uso en los ficheros legibles
—su consumidor es el armazón, de lectura prohibida— y si Estudio/Calificaciones necesitan `disabled` en sus botones
de guardar.
