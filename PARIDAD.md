# Paridad con mimo-app — el anexo del plan

**El estado y el orden viven en `PLAN.json`** (el del andamiaje de la casa, con `plan.py validate`,
`status` y `next`). Este fichero guarda lo que el plan no puede llevar: de qué fuente sale cada tarea,
qué tiene que cumplir y qué queda fuera. Si los dos discrepan en **estado**, manda `PLAN.json`.

## Para qué es esto

La aplicacion nueva, con el armazon de bloques instalables, con TODO lo que ya funcionaba en mimo-app (referencia) y en el prototipo. El armazon visual esta hecho y congelado; lo que falta es motor. No se inventa funcionalidad: cada tarea cita la fuente de la que sale.

## Regla de oro

- Cada funcion migrada cita su fuente exacta (fichero:linea) de mimo-app o del prototipo. Sin fuente, no entra.
- Donde el prototipo ya tiene version de bloque, se porta el prototipo; donde no, se porta mimo-app. Se dice cual y por que.
- Una tarea = una seccion (o un sustrato comun). No se mezclan secciones en la misma entrega.
- La estetica no se toca en las tareas de motor. Si el motor exige un control nuevo, se declara con su medida antes y despues.
- Una tarea no se cierra sin su lista de paridad completa o su HUECO declarado con motivo, y sin evidencia medida.
- Lo que la app anterior hacia y aqui no se pueda hacer, se escribe como HUECO. No se disimula.

## Las fuentes

### mimo-app — `referencia/mimo-app-53cc22d`

*Papel:* especificacion de lo que funcionaba.

| sección | líneas |
|---|---|
| ajustes | 1960 |
| comun | 2592 |
| estudio | 411 |
| idioma | 538 |
| malla | 2161 |
| notas | 601 |
| semestre | 548 |
| tareas | 206 |
| tiempo | 726 |

### prototipo — `prototipo`

*Papel:* lo ya adaptado a bloques: se prefiere si existe.

| bloque | contenido |
|---|---|
| malla | 2908 lineas en 5 ficheros (motor, ui, prueba-motor, importar, exportar, manifiesto) |
| tiempo | 2468 lineas en 5 ficheros (motor, ui, prueba-motor, importar, exportar, manifiesto) |

## Las tareas, con su fuente

### T0 — Quitar el nombre de la seccion sobre la ventana central

**Hecho** el 2026-10-20 (commit `e88a350`), antes de que existiera el plan.

*Fuente:* orden directa del dueño (2026-10-20): el nombre de la seccion no se repite sobre la ventana central

*Tiene que cumplir:*
- 0 elementos .bloque__nombre dentro de .vista--bloque, medido a 1280

*Entrega:* armazon-paneles.html: vistaDe() ya no pinta el rotulo; la vista es de una sola fila

### T001 — Inventario de paridad: cada funcion de los dos motores, con su destino

*Fuente:* referencia/mimo-app-53cc22d/js/*/ · prototipo/bloques/*/ · prototipo/js/

*Tiene que cumplir:*
- Cada fichero de la referencia aparece con su cuenta de funciones y cada una tiene destino o motivo
- Cada bloque del prototipo aparece con lo que ya resuelve
- Cero funciones sin destino y sin motivo escrito
- El inventario dice cuantos controles de la app anterior no tienen casa en el armazon nuevo

*Entrega:* tablero/inventario-paridad.md con una fila por funcion o capacidad: fuente (fichero:linea), seccion del riel donde cae, o motivo por el que no se migra

### T002 — Tiempo completo, igual que en mimo-app

*Fuente:* referencia/mimo-app-53cc22d/js/tiempo/01-tiempo.js:388-423 (reloj editable: tres input hh/mm/ss; en temporizador se edita el tiempo que queda, en cronometro el acumulado) · referencia/mimo-app-53cc22d/js/tiempo/01-tiempo.js:111-160 (los cuatro modos y su vista) · referencia/mimo-app-53cc22d/js/tiempo/01-tiempo.js:427-435 (play, pausa y parar con sus estados deshabilitados) · referencia/mimo-app-53cc22d/js/tiempo/01-tiempo.js:37-59 (configuracion del pomodoro: trabajo, descanso corto, descanso largo, cada N) · referencia/mimo-app-53cc22d/js/tiempo/01-tiempo.js (alarmaTiempo, registrarMinutos, sesionesDeLaSemana, recordatorios) · prototipo/bloques/tiempo/motor.js (calculo puro ya portado y probado)

*Tiene que cumplir:*
- Cuando se pulse el reloj, sus tres partes deberan ser editables y el cambio debera guardarse (en temporizador cambia el tiempo que queda; en cronometro el acumulado)
- Cuando el temporizador llegue a cero, debera sonar una alarma una sola vez y el aviso debera poder descartarse sin registrar
- Cuando se configure el pomodoro (trabajo, descanso corto, descanso largo, cada N), el ciclo debera respetarlo y encadenar fases solo
- Cuando se anada un recordatorio con dia y hora, debera avisar a esa hora aunque no haya cronometro corriendo
- Cuando se abra el censo semanal, debera cuadrar con las sesiones registradas (suma de minutos por dia)
- Ninguna funcion de 01-tiempo.js debera quedar sin destino: 0 en la lista de T1

*Entrega:* los cuatro bloques de Tiempo con paridad: reloj editable, recordatorios, configuracion de pomodoro, alarma con sonido, censo semanal

*Riesgo:* el reloj editable cambia el control de la tarjeta; la estetica se mantiene y se mide antes/despues

### T003 — Sustrato comun: almacen, catalogo, fechas y fusión sin pérdida

*Fuente:* referencia/mimo-app-53cc22d/js/comun/04-almacen.js · referencia/mimo-app-53cc22d/js/comun/

*Tiene que cumplir:*
- Los datos que hoy guardan los bloques de Tiempo y Malla deberan leerse tras la unificacion, sin perder ni una sesion ni una nota
- Un almacen viejo debera migrarse al abrir, una sola vez, y quedar marcado con su version
- La exportacion e importacion del prototipo deberan seguir funcionando despues del cambio

*Entrega:* un solo almacen versionado para todos los bloques, con migracion desde lo que ya guardan los motores portados

### T004 — Malla del semestre

*Fuente:* prototipo/bloques/malla/ (2908 lineas: motor, ui, prueba-motor, importar, exportar) · referencia/mimo-app-53cc22d/js/malla/ (2161 lineas)

*Tiene que cumplir:*
- Cada capacidad de malla/ que exista en la referencia tendra su equivalente o su HUECO con motivo
- La reticula debera pintarse igual que en el prototipo (mismas filas y columnas para el mismo semestre) y guardarse
- Importar y exportar deberan devolver el mismo semestre que entro

*Entrega:* el bloque Malla con su reticula, sus ramos y sus estados, dentro de la seccion Malla

### T005 — Estudio y Calificaciones

*Fuente:* referencia/mimo-app-53cc22d/js/estudio/ (411 lineas) · referencia/mimo-app-53cc22d/js/malla/ (calificaciones)

*Tiene que cumplir:*
- El inventario de T1 dira donde vive Calificaciones; si es parte de malla, se parte en su bloque
- Toda capacidad de estudio/ tendra equivalente o HUECO
- Las notas y los promedios deberan cuadrar con los de la app anterior para el mismo semestre

*Entrega:* los bloques de Estudio y de Calificaciones en sus secciones

### T006 — Apuntes (SUPERADA POR T012 — no ejecutar)

*Fuente:* ninguna. La app anterior **no tiene** apuntes libres: su carpeta `notas/` es
Calificaciones (`notas/01-motor.js` = notas por categoria con eximicion), y en el inventario
(T001) esta capacidad quedo como «sin casa» a la espera de decision del dueno.

*Estado:* **bloqueada y superada** el 2026-10-20. El dueno decidio que los apuntes son una
**funcion nueva**, no una migracion: se registra como **T012**, con almacen propio y sin fuente
que citar. T006 no se ejecuta ni se desbloquea: queda como registro del error del plan original
(dar por hecha una migracion que nunca existio).

### T007 — Tareas

*Fuente:* referencia/mimo-app-53cc22d/js/tareas/ (206 lineas)

*Tiene que cumplir:*
- Toda capacidad de tareas/ tendra equivalente o HUECO
- Una tarea con hora debera aparecer en el dia que toca

*Entrega:* el bloque de Tareas con sus plazos

### T008 — Semestre y Calendario

*Fuente:* referencia/mimo-app-53cc22d/js/semestre/ (548 lineas) · referencia/mimo-app-53cc22d/js/comun/ (fechas)

*Tiene que cumplir:*
- Toda capacidad de semestre/ tendra equivalente o HUECO
- El calendario debera cuadrar con la malla del mismo semestre

*Entrega:* el calendario del semestre con sus semanas y la seccion Semestre

### T009 — Ajustes y Apariencia

*Fuente:* referencia/mimo-app-53cc22d/js/ajustes/ (1960 lineas, 10 ficheros) · tablero/armazon.html (iteracion anterior: Fondo, Superficie, Acento, Piel y el modo edicion)

*Tiene que cumplir:*
- Cada seccion de ajustes/ tendra equivalente o HUECO
- Los cambios de ajustes deberan persistir y no romper ningun techo del sistema visual (medir-tablero en EXIT=0)

*Entrega:* Ajustes con todas sus secciones, no solo tema, pie e idioma

### T010 — Idioma completo

*Fuente:* referencia/mimo-app-53cc22d/js/idioma/ (538 lineas) · prototipo/i18n/es.json, en.json · tablero/js/i18n.js (120 claves por idioma hoy)

*Tiene que cumplir:*
- Cada rotulo de cada seccion migrada debera tener su clave en es y en en
- 0 claves ausentes y 0 claves crudas visibles, medido en cada idioma

*Entrega:* diccionarios completos de las secciones migradas, con 0 claves sin traducir en los dos idiomas

### T011 — Cierre de paridad y entrega

*Fuente:* la app anterior abierta al lado, seccion por seccion

*Tiene que cumplir:*
- 0 funciones sin marca
- 0 HUECOS sin motivo
- Un recorrido completo de la app nueva, seccion por seccion, sin un aviso de consola

*Entrega:* tablero/paridad-final.md: la lista de comprobacion completa, con cada funcion de mimo-app marcada como migrada, distinta a proposito o hueco

### T012 — Apuntes libres (FUNCION NUEVA, pedido del dueno 2026-10-20)

*Fuente:* **ninguna en la app anterior.** No es migracion y no se cita fichero: lo pidio el dueno
el 2026-10-20, y el inventario (T001) ya habia comprobado que `notas/` es Calificaciones. Se marca
como pedido del dueno para que nadie lo confunda con paridad.

*Tiene que cumplir:*
- Seccion **nueva** en el riel (sera la **sexta**), con su bloque de **notas libres**, almacen
  propio (clave nueva, versionada) y busqueda dentro de las notas
- Una nota escrita debera sobrevivir a recargar y a cambiar de seccion
- La busqueda debera encontrar por titulo y por cuerpo, y decir cuantas coincidencias hay
- Con seis secciones, la losa debera seguir midiendo 544,00 a 1280 y 32,00 de sangria a 1100:
  seis filas de riel no pueden romper el techo (`python3 tablero/medir-tablero.py --fichero
  tablero/armazon-paneles.html` en EXIT=0, y las 8 vistas a 411 sin desbordar)
- Depende de **T003** (el almacen unico): no inventa un segundo almacen paralelo

*Entrega:* la sexta seccion del riel con su bloque de Apuntes (notas + buscador), su almacen y sus
claves es/en

## Lo que NO es esta app

- Rondas de estetica sin pedido del dueño: el armazon esta congelado
- Funciones que la app anterior no tenia y que no pida el dueño
- Reescribir motores que ya funcionan para 'mejorarlos'

## Huecos declarados hoy

- Alarmas se instala pero no avisa
- el arco del anillo del pomodoro es estatico
- el temporizador sube de minuto en minuto
- sin sonido ni notificacion del sistema
- el registro apunta al minuto entero

## Lo que ya funciona (v7, commit `20fa481`)

- Tiempo: cronometro, temporizador, pomodoro y registro (motor portado de prototipo/bloques/tiempo/motor.js)
- idioma es/en con cambio en caliente y persistencia (120 claves por idioma)
- bloques: instalar, quitar, persistir y reset (?reset=1)
