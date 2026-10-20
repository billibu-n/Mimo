# Inventario de paridad — mimo-nuevo

Mapa de las capacidades de usuario de los dos motores (referencia + prototipo) con su destino en la app nueva. Base de rutas: `referencia/mimo-app-53cc22d/js/` (la app anterior) y `prototipo/` (lo ya adaptado a bloques). Plan vigente: `PLAN.json` (T001..T011); destino `T2..T11` = tareas de ese plan.

## 1. Las nueve carpetas de la referencia

| carpeta (líneas) | ficheros `.js` (líneas) | capacidades de usuario |
|---|---|---|
| ajustes (1960) | 01-borrador 7 · 02-avanzados 340 · 03-panel 298 · 05-ayuda 72 · 05-semestres 114 · 06-actualizar 317 · 07-ical 128 · 08-g2-puente 510 · 09-paneles 55 · 10-colaborar 119 | tema/colores/densidad/relleno con borrador; formatos de hora y títulos; semestres extra; iCal; actualizar; colaborar |
| comun (2592) | 00-cabecera 26 · 01-utilidades 214 · 02-estado 29 · 03-catalogo 372 · 04-almacen 314 · 05-avisos 9 · 06-arranque 491 · 07-select 144 · 08-barra 97 · 09-pwa 48 · 10-respaldo-carpeta 320 · 10a-carpeta-tauri 81 · 10b-migracion-tauri 81 · 11-avisos 133 · 12-contexto 155 · 13-marca-juego 78 | estado/almacén/catálogo; navegación; select propio; avisos; respaldo; PWA; Tauri; menú contextual |
| estudio (411) | 01-estudio 411 | barras de horas por ramo; meta semanal; gráfico de puntos |
| idioma (538) | 00-motor 155 · 01-inicio 3 · 01-panel 37 · es 173 · en 170 | motor i18n; selector de idiomas; diccionarios |
| malla (2161) | 01-importar 504 · 02-editor-ramos 529 · 03-dibujo 554 · 04-pdf 464 · 06-simulador 110 | importar/exportar; editor de ramo; estados; PDF; simulador |
| notas (601) | 01-motor 184 · 02-notas 417 | motor de calificaciones; lista/resumen/detalle |
| semestre (548) | 01-calendario 105 · 02-editor-evento 262 · 03-calendario 181 | tabla semanal; editor de evento; calendario mes/año/sem |
| tareas (206) | 01-tareas 206 | tablero de tareas 3 columnas; filtros; drag&drop |
| tiempo (726) | 01-tiempo 726 | cronómetro; temporizador; pomodoro; recordatorios; censo semanal; reloj editable; alarma |

## 2. El prototipo

- **Bloque Malla** (`prototipo/bloques/malla/`: motor 612, ui 997, vista-mapa 853, importar 370, exportar 76, manifiesto 53). El manifiesto ofrece `malla.getCurso/getEstadoCurso/getRamosActivos` y declara extensiones editor/importar-pdf/simulador/vista-mapa/vista-tarjetas. El motor ya es cálculo puro (estados, requisitos, simular, créditos) sobre `mimo.bloque.malla`, sin DOM. Se aparta de la referencia en que la UI (reticula/vista-mapa) y el importar/exportar viven en ficheros del bloque, no en un solo panel.
- **Bloque Tiempo** (`prototipo/bloques/tiempo/`: motor 629, ui 1124, prueba-motor 430, importar 220, exportar 65, manifiesto 36). Manifiesto ofrece `tiempo.horas`, config `tiempo.semana`, datos `tiempo.registro`. Motor = cálculo puro (crono/temp/pomo/registro) ya portado a `tablero/js/tiempo.js`. Se aparta de la referencia en que NO porta pintarReloj, alarma con sonido, recordatorios ni setInterval (lo declara como no portado en su cabecera).
- El i18n del prototipo (`prototipo/js/i18n.js` + `prototipo/i18n/{es,en}.json`) ya está reencarnado en `tablero/js/i18n.js`, con diccionarios embebidos (en file:// el fetch de JSON es CORS).

## 3. El mapa

| capacidad | fuente | sección del riel | destino |
|---|---|---|---|
| cronómetro play/pausa/parar/reiniciar | tiempo/01-tiempo.js:256-380 | Tiempo | ya está: tablero/js/tiempo.js |
| temporizador cuenta atrás | tiempo/01-tiempo.js:94-110 | Tiempo | ya está: tablero/js/tiempo.js |
| pomodoro trabajo/descanso/largo encadenados | tiempo/01-tiempo.js:7-32 | Tiempo | ya está: tablero/js/tiempo.js |
| registro de sesiones por día/semana/ramo | tiempo/01-tiempo.js:69-79 | Tiempo | ya está: tablero/js/tiempo.js |
| reloj editable a mano (3 inputs hh/mm/ss) | tiempo/01-tiempo.js:388 | Tiempo | T2 |
| cuatro modos y su vista (incluye recordatorios) | tiempo/01-tiempo.js:111-160 | Tiempo | T2 |
| configuración de pomodoro (trabajo/corto/largo/cada N) | tiempo/01-tiempo.js:37-59 | Tiempo | T2 |
| alarma con sonido (alarma.mp3 + Web Audio) | tiempo/01-tiempo.js:478 | Tiempo | T2 |
| censo semanal de sesiones | tiempo/01-tiempo.js:74 | Tiempo | T2 |
| recordatorios por día/hora (cuarto modo) | tiempo/01-tiempo.js:515 | Tiempo | T2 |
| play/pausa/parar con estados deshabilitados | tiempo/01-tiempo.js:427-435 | Tiempo | T2 |
| estados de ramo (aprobado/curso/disponible/bloqueado) | malla/03-dibujo.js:22 | Malla | T4 |
| requisitos faltantes y "basta uno" | malla/03-dibujo.js:52 | Malla | T4 |
| ramo anual / semestres que ocupa | malla/03-dibujo.js:82 | Malla | T4 |
| importar malla CSV/TSV/JSON + pegar desde foto | malla/01-importar.js:69 | Malla | T4 |
| exportar malla (CSV / malla.json) | malla/01-importar.js:486 · 03-dibujo.js:531 | Malla | T4 |
| editor de ramo (modal, requisitos, secciones) | malla/02-editor-ramos.js:7 | Malla | T4 |
| mover ramo de nivel / reordenar columnas | malla/02-editor-ramos.js:446 | Malla | T4 |
| importar malla desde PDF (pdf.js, coordenadas) | malla/04-pdf.js:398 | Malla | T4 |
| simulador de tomar ramo (sin guardar) | malla/06-simulador.js:25 | Malla | T4 |
| motor de bloque Malla (getCurso/simularCon/estados) | prototipo/bloques/malla/motor.js:586-602 | Malla | T4 (ya adaptado a bloque) |
| barras de horas por ramo vs meta | estudio/01-estudio.js:2 | Estudio | T5 |
| meta semanal propia por semana | estudio/01-estudio.js:60 | Estudio | T5 |
| gráfico de puntos con línea objetivo | estudio/01-estudio.js:369 | Estudio | T5 |
| motor de calificaciones (categorías/componentes/examen) | notas/01-motor.js:2 | Calificaciones | T5 |
| normalizar nota 1.0–7.0 + presentación | notas/01-motor.js:34 | Calificaciones | T5 |
| nota mínima + eximición | notas/01-motor.js:21 | Calificaciones | T5 |
| sincronizar evento ↔ componente de nota | notas/01-motor.js:179 | Calificaciones | T5 |
| lista y resumen de notas | notas/02-notas.js:2 | Calificaciones | T5 |
| detalle de ramo/notas | notas/02-notas.js:64 | Calificaciones | T5 |
| tablero de tareas 3 columnas | tareas/01-tareas.js:12 | Calendario | T7 |
| filtros + anillo de progreso + KPIs | tareas/01-tareas.js:63 | Calendario | T7 |
| drag&drop de tareas entre columnas | tareas/01-tareas.js:151 | Calendario | T7 |
| tabla semanal académica (chips, mini-barras) | semestre/01-calendario.js:54 | Calendario | T8 |
| filtros ramo/tipo/vista + orden por prioridad | semestre/01-calendario.js:2 | Calendario | T8 |
| editor de evento (modal, nota→ramo) | semestre/02-editor-evento.js:24 | Calendario | T8 |
| calendario comercial mes/año/semestre | semestre/03-calendario.js:128 | Calendario | T8 |
| crear/editar/borrar semestres extra | ajustes/05-semestres.js:25 | Calendario | T8 |
| iCal exportar/importar | ajustes/07-ical.js:33 | Calendario | T8 |
| tema + colores de estado + densidad + relleno | ajustes/02-avanzados.js:285 | Gabinete (Ajustes) | T9 |
| formatos de hora + abreviar títulos | ajustes/03-panel.js:2 | Gabinete (Ajustes) | T9 |
| ayuda contextual por ajuste | ajustes/05-ayuda.js:34 | Gabinete (Ajustes) | T9 |
| ventanas emergentes de Ajustes | ajustes/09-paneles.js:13 | Gabinete (Ajustes) | T9 |
| puente pastillas ↔ casillas del motor | ajustes/08-g2-puente.js:50 | Gabinete (Ajustes) | T9 |
| selector de idiomas | idioma/01-panel.js:8 | Gabinete (Ajustes) | T9 |
| buscar actualización (GitHub releases) | ajustes/06-actualizar.js:75 | Gabinete (Ajustes) | HUECO: repo viejo `mimo-app` |
| colaborar (issues/discussions) | ajustes/10-colaborar.js:102 | Gabinete (Ajustes) | HUECO: enlaces al repo viejo |
| motor i18n (t/cambiar/aplicar, caída a es) | idioma/00-motor.js:124 | Sustrato | ya está: tablero/js/i18n.js |
| diccionarios es/en (8 idiomas de fábrica) | idioma/es.js:1 · en.js:1 | Sustrato | T10 |
| almacén único + guardar (localStorage) | comun/03-catalogo.js:359 | Sustrato | T3 |
| catálogo efectivo + niveles | comun/03-catalogo.js:15 | Sustrato | T3 |
| select propio (reemplaza al nativo) | comun/07-select.js:16 | Sustrato | T3 |
| avisos/confirmar/pedir propios | comun/11-avisos.js:130 | Sustrato | T3 |
| utilidades fecha/hora/títulos/inflector | comun/01-utilidades.js:2 | Sustrato | T3 |
| navegación de secciones + atajos Ctrl+1..7 | comun/06-arranque.js:58 | Sustrato | ya está: tablero/armazon-paneles.html |
| menú contextual (clic derecho) | comun/12-contexto.js:38 | Sustrato | T3 |
| respaldo en carpeta (3 versiones) | comun/10-respaldo-carpeta.js:143 | Sustrato | T3 |
| sincronización con servidor local | comun/04-almacen.js:7 | Sustrato | HUECO: la nueva no sirve `api/datos` |
| PWA instalable/offline (service worker) | comun/09-pwa.js:39 | Sustrato | HUECO: en file:// no registra SW |
| puente Tauri (carpeta + migración) | comun/10a-carpeta-tauri.js:1 · 10b-migracion-tauri.js:1 | Sustrato | HUECO: la nueva es web, sin Tauri |
| marca-juego (icono easter egg) | comun/13-marca-juego.js:10 | Sustrato | HUECO: guiño cosmético, no capacidad |

## 4. Lo que ya funciona en la app nueva (v7)

- Cronómetro, temporizador, pomodoro y registro (motor portado de `prototipo/bloques/tiempo/motor.js` a `tablero/js/tiempo.js`).
- Idioma es/en con cambio en caliente y persistencia (120 claves por idioma, `tablero/js/i18n.js`).
- Bloques instalables: instalar, quitar, persistir y reset (`?reset=1`), en el riel de 5 secciones + gabinete (`tablero/armazon-paneles.html`).
- Huecos declarados en la v7: Alarmas se instala pero no avisa; el arco del anillo del pomodoro es estático; el temporizador sube de minuto en minuto; sin sonido ni notificación del sistema; el registro apunta al minuto entero.

## 5. Sin casa

| capacidad | motivo | propuesta |
|---|---|---|
| PWA instalable/offline | file:// no deja registrar service worker | T3 si el tablero pasa a servirse por http(s) |
| puente Tauri (carpeta, migración) | la nueva no es app de escritorio | no migrar; queda en la referencia |
| buscar actualización + colaborar | apuntan al repo `mimo-app` viejo | T9 reapuntando a `mimo-nuevo`, o HUECO |
| barra lateral retráctil 3 modos | el armazón nuevo tiene riel+gabinete fijos | HUECO, salvo que Ajustes quiera el modo |
| apuntes libres (bloque "Apuntes") | en mimo-app no hay apuntes libres: la carpeta `notas/` es de calificaciones | **decidido (2026-10-20):** el dueño lo quiere como FUNCION NUEVA, no migrada → **T012** (sexta seccion del riel, almacen propio y busqueda); T006 queda superada |
| marca-juego (icono easter egg) | guiño cosmético, no capacidad de usuario | no migrar |

## Cierre

- Carpetas cubiertas: 9/9. Filas del mapa: 61. Filas `sin verificar`: 0. Filas `HUECO`: 6.
- Tres capacidades más grandes que faltan: Malla completa (reticula, ramos, estados, PDF — T4); Calificaciones (notas por categoría con eximición — T5); Ajustes/Apariencia completos (tema, formatos, semestres, iCal — T9).
