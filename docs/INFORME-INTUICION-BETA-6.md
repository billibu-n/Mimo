# Intuición y carga visual: Mimo frente a Mimo Academics

Informe de lectura para **1.2.0-beta.6**. No se cambió una línea de la app: se leyó el código de las
dos versiones, se abrieron las dos en el mismo navegador con **el mismo respaldo** y se midió lo que
se puede medir. Todo lo que dice «medido» salió de ahí; lo que no se pudo medir está en la última
sección.

- **Versión vieja**: `Mimo Academics 1.1.2-desktop`, copia en
  `/home/billibu/workspace/proyectos/mimo-nuevo/referencia/mimo-app-53cc22d` (commit `53cc22d`).
- **Versión actual**: `1.2.0-beta.5`, en este repositorio, rama `main` antes de `t/beta-6`.
- **Mismos datos**: `sede/respaldo-mimo-2026-10-19.json` — 60 ramos, 78 eventos, 54 sesiones. En
  Academics se cargó en `localStorage`; en Mimo se importó por Ajustes → Datos.

## El patrón, en una frase

No son siete fallos sueltos: es **una sola decisión aplicada siete veces**. Academics **escondía**
—en una ventana, en un desplegable, en un carril de la malla— y Mimo **muestra todo a la vez**, en
la misma pantalla, con el mismo peso. Lo que se ganó en «todo está a la vista» se pagó en aire: el
armazón creció, la letra se encogió y cada sección se convirtió en una lista de controles sin
jerarquía.

Las cuatro reglas que Academics tenía y Mimo perdió:

1. **Lo secundario se pliega.** Academics tenía **20 bloques `<details>`** en toda la app; Mimo tiene
   **0**.
2. **El cromo es discreto.** Academics: una barra. Mimo: barra superior + pestañas + panel lateral +
   pie.
3. **El dato lleva identidad.** Color, alias, tipo y descripción viajaban con el ramo y con el
   evento. En Mimo sobreviven como campos sueltos —y a veces ni eso—.
4. **Lo que es tabla, es tabla.** Semanas en filas y requisitos en carriles. En Mimo las semanas se
   volvieron una rejilla y los requisitos, curvas.

---

## 1. Calendario: la ventana se volvió un formulario de cuatro campos

**Academics.** Se pulsaba un evento y se abría una **ventana** (`modal-caja`,
`js/semestre/02-editor-evento.js`) con el nombre arriba y tres grupos plegables: *Qué es*
(prioridad, fecha, ramo), *Cuándo* (hora, duración, tipo —y crear tipos nuevos—) y *Nota y temario*
(nota del evento, descripción, temario). **10 campos**, y el detalle no estorbaba porque estaba
cerrado. Medido en la app: 10 campos, `innerHTML` de 3 916 caracteres.

**Mimo.** El botón «+ Nuevo evento» despliega **una fila** encima del calendario, dentro de la
sección (`app/js/bloques/calendario/vista.js`, `#evento-form`), con **cuatro** campos: título, fecha,
hora y contexto. Medido: `["evento-titulo", "evento-fecha", "evento-hora", "evento-contexto"]`.

Lo que se perdió, en concreto:

- **La descripción.** No es que falte el campo: falta el gesto. El modelo **ya guarda** `nota`
  (`app/js/shell.js:1065`, `normalizarEventos`), el panel **ya la muestra** y la importación **ya la
  trae** (`shell.js:1987`, `nota: String(t.detalle || "")`). Pero no hay ningún control que la
  escriba: el dato entra y no se puede crear ni corregir dentro de la app.
- **El temario**, la duración, el tipo de evento y los tipos propios. Hoy un evento es título, fecha
  y hora; todo lo demás es contexto libre.
- **El sitio.** El formulario empuja el calendario hacia abajo, en la misma columna que la rejilla.
  La ventana de Academics no movía nada.

Coste de volver: bajo. La ventana ya existe en Mimo (hay `#modal-sesion`, `#modal-historial`); lo que
falta es el contenido, y el modelo de datos no hay que tocarlo.

## 2. Calendario: el modo de semanas del semestre

**Academics** tenía **tres** vistas: Mes, Año y **Semestre**. La de Semestre era una **tabla**: una
fila por semana del semestre (S1, S2, S3… BREAK), siete columnas de días, y una columna final
**Estudio** con las horas de esa semana, su meta y una barra de reparto por ramo
(`js/semestre/01-calendario.js`, `renderSemestre`). Al lado del número de semana, el calendario
marcaba el tipo: clases, receso, exámenes (`js/semestre/03-calendario.js`, `marcaSemestreDe`).

**Mimo** tiene Mes, **Semana** y Agenda. «Semana» es **una** semana: siete columnas y nada más
(`shell.js:1137`). El semestre quedó reducido a una **columna lateral** dentro de la vista de mes, con
la etiqueta `S8`, `S9`… `REC` (`shell.js:1180`). Es decir: se conservó el dato de la semana, pero se
perdió la lectura de arriba abajo que servía para planificar.

Medido con los mismos datos: en Academics, la vista Semestre muestra S1–S6 y BREAK en una pantalla,
cada fila con sus chips y sus horas («3h», «8h 5m», «22h 25m», «meta cumplida»); en Mimo, la vista
Semana muestra **un** día con evento y el resto vacío.

Esto es lo que el dueño llama «un modo de semanas similar a mimo academics», y es literal: es la
tabla, no una rejilla más.

## 3. Notas: el tamaño de la letra

Aquí conviene separar el hecho de la impresión, porque la medición no coincide con «no se corrige».

**Medido**, con la escala en 100 % y en 140 %:

| | 100 % | 140 % |
|---|---|---|
| cuerpo (`body`) | 13,12 px | 18,37 px |
| editor de nota (`#nota-cuerpo`) | 13,12 px | 18,37 px |

Así que el ajuste **sí** se aplica y **sí** se recuerda. Lo que está mal es el punto de partida y el
mecanismo:

- **13,12 px de base.** Es la letra con la que se escribe una nota larga. `--fs-md: .82rem`
  (`app/css/tokens.css`) y `body { font-size: var(--fs-md) }` (`app/css/base.css:20`); el editor
  (`app/css/bloques/notas.css`, `.nota-cuerpo`) **no declara tamaño** y hereda eso. Academics partía
  de 14 px y sus bloques de texto iban a `.85rem`–`.95rem`; su editor de ficha estaba dentro de una
  ventana, no a pantalla completa.
- **La escala sólo mueve la letra.** Mimo aplica
  `document.documentElement.style.fontSize = pct%` (`shell.js:3124`): crecen los `rem`, no los
  huecos. Academics usaba **zoom** sobre la raíz, y su propio comentario explica por qué
  (`js/ajustes/02-avanzados.js:204`): «el CSS tiene muchas medidas en px (1108) y pocas atadas a la
  letra (202): subir sólo la letra dejaría los huecos sin crecer y se vería descuadrado». En Mimo
  quedan tamaños en px sueltos (`10px` en `.alarma-item`, `9px` en Estudio, `10px` en la malla), así
  que a 140 % la letra crece y las cajas no: se lee más grande y se ve peor.
- **Cinco pasos y tope en 140 %.** El máximo deja el cuerpo en 18 px; para una nota escrita, el
  salto útil sería de 16 a 20 px sin pasar por «Compacto».

Conclusión honesta: **no es un fallo de aplicación de la preferencia, es un fallo de escala**. Si en
beta.6 se sube la base y se vuelve al zoom, la queja desaparece sin tocar el ajuste.

## 4. Tiempo (y la app entera): el cromo creció, el contenido se encogió

**Academics, Tiempo** (`html/tiempo.html`, 113 líneas): una tarjeta, cuatro pastillas de modo
(Cronómetro, Temporizador, Pomodoro, Recordatorios), el reloj grande, tres selectores (ramo, semana,
día), tres botones (Iniciar, Pausa, Parar) y una línea de ayuda. Nada más.

**Mimo, Tiempo**: estantería de modos con «+» y «Editar», tarjeta del reloj, **segunda tarjeta**
«Vínculo con Estudio» con dos selectores, dos recuadros de cifras, lista de sesiones con dos botones
por fila, y un párrafo explicativo al pie. Y encima el armazón: barra superior con ocho botones,
barra de pestañas, panel lateral con cuatro pestañas, pie.

Medido (controles visibles, misma ventana de 1600×1000, mismos datos):

| pantalla | Academics | Mimo |
|---|---|---|
| Tiempo | 25 botones | **145** |
| Calendario | 25 | 68 |
| Malla | 61 | 100 |
| Calificaciones / Ramos | 21 campos | **71 campos** |

El caso de Tiempo es el más claro: **casi seis veces** más controles para hacer lo mismo. No es que
sobren funciones —el vínculo con Estudio es bueno—; es que todo se muestra a la vez, sin plegar y sin
jerarquía, y el armazón añade su propio ruido encima.

Dos cosas concretas de ese ruido:

- **Indicadores muertos.** El calendario muestra siempre «0 h registradas», escrito a mano en la
  vista (`<b>0 h</b>` en `app/js/bloques/calendario/vista.js`), aunque haya 155 h registradas.
  Academics calculaba sus cuatro cifras y las etiquetaba con sentido («esta semana · objetivo 23h
  30m», «próximo control»). Un cero fijo no informa: sólo ocupa.
- **Franjas fijas.** Academics: una barra. Mimo: barra superior + pestañas + panel + pie. En una
  ventana de 1440 px, el panel lateral se queda abierto y vacío (cuatro pestañas para decir «sin
  eventos este mes»).

## 5. Los nombres de las secciones

**Academics**: la barra lleva **icono y nombre** — Calendario, Estudio, Malla, Ramos, Tiempo, Tareas,
Ajustes — y se puede plegar o poner a la izquierda, arriba o a la derecha
(`js/comun/08-barra.js`, `index.html`).

**Mimo**: las pestañas son **icono y un código de dos dígitos** (`01`, `02`, `03`, `08`…,
`shell.js:847`). El nombre existe, pero sólo en `title` y `aria-label`: hay que pasar el ratón o usar
un lector de pantalla. Y el código no significa nada para quien no lo programó — es identidad de
bloque, no de sección.

La propuesta del dueño —nombres visibles por defecto, con opción de quitarlos— es exactamente el
estado de Academics, más un interruptor. El código de dos dígitos puede quedarse como adorno pequeño,
pero no como sustituto del nombre.

## 6. Calificaciones y ramos: se perdió el despliegue por categoría

**Academics** tenía la pantalla **Ramos** (`js/notas/02-notas.js`): lista de ramos a la izquierda con
**punto de color, alias y «apuntas a 4,5»**; a la derecha, dos cifras grandes (presentación y final) y
seis bloques plegables: *Nota mínima para aprobar*, *Categorías*, *Componentes y notas*, *Eximición*,
*Examen* y **«Color del ramo»**. Medido en pantalla: **7 desplegables**, 21 campos, y sólo uno abierto.

**Mimo** (`shell.js:2258`, `pintarCalificaciones` + `htmlDetalleCalif`): lista de ramos sin color, y a
la derecha **todo abierto**: tabla de categorías, tabla de componentes con una fila de cuatro campos
por componente, examen, eximición. Medido: **71 campos visibles a la vez**, 0 desplegables. Con diez
componentes, la pantalla es un formulario de dos metros.

Y la identidad del ramo se quedó en la Malla: el color se edita en el formulario de ramo
(`shell.js:1738`, `3935`), pero desde Calificaciones no se ve ni se toca; el **alias** se conserva al
importar (`app/js/esquema.js:243`) pero no se edita ni se muestra en ninguna parte, y el formulario
pide código, nombre, créditos, nivel, requisitos, color, aprobado y en curso — 8 campos, sin alias y
sin **descripción**.

Lo que pide el dueño —plegar por categoría y poner color e identidad del ramo también aquí— es
recuperar un `details` por asunto y subir el color al panel del ramo, que ya existe (`panel__bloque`).

## 7. La malla: las líneas al lote

**Academics** dibujaba a mano, con reglas explícitas (`js/malla/03-dibujo.js:322`):

- el orden lo manda la **pantalla**, de izquierda a derecha (`columnas.sort((a,b) => a.x0 - b.x0)`);
- las líneas van por los **pasillos**: el hueco entre columnas y las franjas libres entre tarjetas
  (`franjas()`), con hasta ocho desvíos numerados para que no se pisen (`turno()`);
- se ordenan de forma estable por nivel y altura, «si no, los desvíos cambian de sitio en cada
  repintado y las líneas bailan»;
- con un ramo elegido se dibujan **sólo sus líneas**; sin selección, todas las demás van muy tenues;
- los requisitos «basta uno» también se trazan, y los ramos anuales se reservan el alto de la columna
  vecina.

**Mimo** (`shell.js:1680`, `dibujarLineasMalla`) une cada par con una **curva de Bézier** de la
tarjeta origen a la destino: `M x1 y1 C … x2 y2`, sin carriles, sin franjas, sin orden por posición.
Todas se pintan a la vez con opacidad `.26` (`app/css/bloques/malla.css`, `.malla-linea`).

Resultado visible con los 60 ramos del respaldo: las curvas **cruzan por encima de las tarjetas**,
entran y salen de los textos y se agolpan en las columnas centrales. No es que falte estilo: falta el
trazado. Academics escondía las líneas **detrás** de las tarjetas y por los huecos; Mimo las lanza en
diagonal por el medio.

## 2. Tabla de medidas

| medida | Academics 1.1.2 | Mimo 1.2.0-beta.5 |
|---|---|---|
| campos del editor de evento | 10, en ventana | 4, en línea |
| grupos plegables (`<details>`) en pantalla | 10 (calendario), 7 (ramos) | **0** en toda la app |
| vistas del calendario | mes, año, **semestre en tabla** | mes, una semana, agenda |
| semanas legibles de un vistazo | todas (S1…S16 + recesos) | una |
| letra del cuerpo | 14 px, con zoom 0.9–1.3 de toda la app | 13,12 px, 5 pasos hasta 140 % de sólo la letra |
| botones visibles en Tiempo | 25 | 145 |
| botones visibles en Calendario | 25 | 68 |
| campos visibles en Calificaciones | 21 (7 plegados) | 71 (0 plegados) |
| franjas fijas del armazón | 1 barra | barra + pestañas + panel + pie |
| nombre de la sección en la barra | visible | sólo en `title` |
| color del ramo editable desde sus notas | sí | sólo desde Malla |
| alias y descripción del ramo | visibles y editables | se importan y no se editan; descripción no existe |

## 3. Qué sugiere esto para beta.6

En orden de impacto sobre la queja y coste de implementación. **Nada de esto está hecho.**

1. **Devolver la ventana del evento** con los tres grupos plegables y, al menos, descripción, tipo y
   duración. El modelo ya tiene `nota`; el campo es lo que falta. Coste bajo, arregla dos quejas (1 y
   parte de 3).
2. **Volver al zoom global** y subir la base tipográfica de `.82rem` a `.9rem`; revisar los px
   sueltos. Es una línea de CSS y una de JS. Arregla la queja de tamaños de raíz.
3. **Traer la vista Semestre** (tabla de semanas con columna de estudio) como cuarta vista del
   calendario, y dejar «Semana» para el detalle de una. Coste medio: el dato de semanas ya existe
   (`semanaDePeriodo`).
4. **Plegar Calificaciones por categoría** con `<details>` y llevar color y alias al panel del ramo.
   Coste medio; devuelve jerarquía a la pantalla más cargada.
5. **Trazar la malla por pasillos** (o, más barato: ocultar las líneas salvo selección y curvarlas por
   el hueco entre columnas). El primer paso es una decisión de diseño; el segundo es poco código.
6. **Recortar cromo**: cerrar el panel por defecto, quitar o condicionar el pie, cuatro botones en la
   barra superior y **nombres** en las pestañas con opción de ocultarlos. Coste bajo, efecto global.

Un aviso de método: **los 20 gates están en verde con esta app**. No miden intuición; miden que cada
control exista y no desborde. `gate-correcciones` comprueba que la escala *cambie* el tamaño de la
raíz, no que la letra resultante sea legible ni que el editor de nota crezca con ella. Si beta.6 toca
esto, hay que añadir medidas nuevas —campos por pantalla, desplegables, tamaño efectivo del cuerpo—,
no confiar en los gates actuales.

## 4. Huecos: lo que no se midió

- **La app instalada (Tauri).** Todo se midió en el navegador del sistema con la misma carpeta `app/`.
  No se ejecutó el binario: las diferencias de motor pueden cambiar milímetros, no el patrón.
- **Los datos reales del dueño.** Se usó un respaldo del 19-10. El estado que hoy tiene en su equipo
  puede tener más ramos, y la malla con 84 ramos (como dice Academics en la captura) se verá peor
  todavía.
- **Contraste y accesibilidad.** No se midió ratio de contraste en los temas oscuros; a ojo, los chips
  del calendario comparten un solo color y pierden la identidad del ramo, pero eso no se cuantificó.
- **El gusto.** Cuánto cromo es «demasiado» no lo dice una medición. Los números acotan el problema;
  la decisión de qué se pliega es del dueño.

## Anexo: cómo se reprodujo

Las capturas y los tres scripts (`medir.py` … `medir6.py`) quedaron en
`trabajos/T-79-beta-6-intuicion/borradores/medicion/` de la oficina, y se archivan al cerrar el
trabajo. Reproducir:

```bash
# app nueva con los mismos datos
python3 pruebas/gate-correcciones.py          # deja el respaldo de prueba
# o a mano: Ajustes -> Datos -> Importar -> sede/respaldo-mimo-2026-10-19.json
```

```python
# medir la letra del cuerpo y del editor
page.evaluate("getComputedStyle(document.querySelector('#nota-cuerpo')).fontSize")
```

Capturas: `actual-*` (Mimo) y `vieja-*` / `cargada-*` (Academics), en la misma carpeta.
