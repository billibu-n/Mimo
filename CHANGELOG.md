# Cambios

## 1.2.0-beta.9 — en curso

### Tareas

- La columna **Hoy** pasa a **Hoy y atrasadas**: una tarea con fecha anterior a hoy ya no
  desaparece del tablero. Se distinguen tres situaciones de fecha —`atrasada`, `en_fecha` y
  `sin_fecha`— sin confundirlas con `hecha`.
- Cada ocurrencia lleva una clave `id@fecha` (o `id@sin-fecha`) para que un vínculo o una
  nota no apunten a la ocurrencia equivocada de una serie.
- Una serie recurrente que empezó antes de hoy se abre en su **primera ocurrencia pendiente**,
  no en la de hoy; el check marca esa fecha, no la actual.

### Progreso (bloque nuevo)

- **Progreso** entra como bloque nativo opcional, naturaleza `personal`, código `09`. Se
  instala y se quita desde el catálogo; quitar no borra sus datos y reinstalar los devuelve.
- Cuatro formas de medir: `suma`, `último`, `mejor` y `conteo`; cinco períodos: día, semana,
  mes, año y única; dos sentidos: piso (`subir`) y techo (`bajar`). Una meta de trayecto puede
  declarar un valor inicial para medir el avance real (30 → 50 kg, 90 → 75 kg).
- Registro rápido por paso, registro exacto con fecha y nota, edición, borrado con deshacer,
  archivar/restaurar y duplicar. El progreso **no se guarda**: se calcula con
  `dominio/progreso.js` a partir de las metas y los registros.
- Tarjetas con anillo, mini-gráfico y racha; panel de detalle con barras o línea, línea de
  objetivo, historial y racha actual/mejor. A 411 px no desborda.
- **Academics opcional**: una meta puede alimentarse de las sesiones de Estudio (`fuente:
  "sesiones"`) sin copiarlas. Si Estudio no está, avisa que no hay fuente y no inventa horas.
- **Tareas sin acoplar**: el vínculo se guarda en la meta (`tareaId`). Si Progreso está, la
  tarjeta del tablero muestra el número y el panel de la tarea ofrece Registrar; completar la
  tarea no cambia el registro. Tareas sigue funcionando si Progreso no está.
- **Categorías plegables**: cada meta vive en una categoría editable (nombre, icono y color);
  `General` siempre existe y no se elimina; borrar otra mueve sus metas a `General` sin
  borrar ninguna. El estado plegado se guarda.
- **Muchas fichas y orden**: una categoría pinta 6 fichas (3 en ventana angosta) y ofrece
  «Ver N más»; las fichas se arrastran por el asa `⋮⋮` dentro o entre categorías, y
  `Alt+↑/↓` ordena con teclado. El orden se guarda en `meta.orden` y `meta.categoriaId`.
- `gate-progreso-categorias` mide las categorías, el plegado, el límite de 6, el arrastre,
  el teclado y la eliminación sin pérdida de metas.
- Entra en el catálogo (10 fichas), en el buscador, en el panel y en el esquema aditivo
  (`datos.progreso`). `mimo.entorno` y el respaldo lo llevan sin cambiar la versión del
  documento.
- `gate-progreso-motor` mide normalización, agregación, períodos, pisos/techos, rachas y
  series; `gate-progreso` mide el bloque de punta a punta, el vínculo con Tareas, la fuente de
  Estudio, el borrado con deshacer, la reinstalación y 411. El arnés pasa a 40 compuertas.

## 1.2.0-beta.8 — 2026-11-05

### Rendimiento

- Las órdenes nativas del espejo de estado (`estado_guardar`, `estado_leer` y los respaldos)
  pasan a ejecutarse en el runtime asíncrono de Tauri, no en el hilo principal. Un guardado
  lento ya no puede bloquear el repintado de la ventana.

### Tipografía

- Ajustes estrena **Tipo de letra**: la opción predeterminada es la pila clásica de Mimo, que
  ahora nombra **Noto Sans antes de Helvetica** para que WebKitGTK no caiga en Nimbus Sans y la
  app de escritorio pinte la misma letra que el navegador.
- El selector suma **diez familias del equipo**: Cantarell, Adwaita Sans, Liberation Sans,
  Nimbus Sans, Carlito, Caladea, Liberation Serif, Latin Modern Roman, Montserrat y Noto Sans
  Mono, además de la clásica, la del sistema, la monoespaciada y la personalizada. Cada una
  cambia `--fuente`, se guarda y sobrevive a recargar; la muestra «Aa Bb Cc · Mimo 123» y el
  estado nombran la familia activa.
- **Otra fuente…** ya no queda a medias: muestra el campo, el botón **Aplicar**, admite Enter,
  enfoca el nombre al elegirla y avisa con el toast. Si el nombre queda vacío, no cambia la
  letra y pide uno; si el equipo no tiene la familia, cae en la clásica.
- `gate-fuente` mide las diez familias, la muestra, el botón, la persistencia y 411.

### Panel derecho

- El panel se redimensiona **arrastrando su asa** (7 px en el borde izquierdo), como el panel
  lateral de un navegador. El ancho se limita a 240–560 px y se guarda al soltar.
- El asa también responde al teclado: flechas izquierda/derecha mueven 10 px (40 con Shift),
  Inicio restablece 320 px y el doble clic hace lo mismo. Tiene rol `separator` y anuncia el
  ancho actual.
- El panel **nace cerrado siempre**; se abre con el botón superior, el pie o cuando un motor
  lo llama. La tarjeta **Paneles** de Ajustes desaparece, junto con el ancho y el «abierto al
  iniciar» que ya no tenían sentido.
- **Vista dividida** deja de ocupar una tarjeta en Ajustes y vuelve a su **botón en la barra
  superior**, con estado `aria-pressed`; el diálogo de dos secciones no cambia.
- `gate-panel` mide el arranque cerrado, el arrastre, los topes, el teclado, el doble clic, la
  persistencia y 411.

### Atajos y deshacer

- **Ctrl+Z y Ctrl+Y dentro de un campo de texto ya no tocan el estado de la app**: mandan el
  historial nativo del navegador, así deshacen lo escrito en tareas, notas, sincronización y
  cualquier `input`, `textarea` o `contenteditable`.
- Fuera de un campo, el historial de la app sigue funcionando y cada deshacer o rehacer deja su
  **aviso pequeño** («Deshecho.» / «Rehecho.»). Esto evita que un Ctrl+Z borre una tarea o una
  nota sin que el usuario lo note.
- `gate-atajos` mide el texto nativo, que la nota no desaparezca, el historial fuera del campo
  y los avisos de deshacer y rehacer.

### Tareas

- Tareas incluye un **anillo semanal** junto a los cuatro KPI: hechas y pendientes de la
  semana, porcentaje pendiente en el centro y leyenda con el total. Cuenta ocurrencias, no
  tareas, así una serie con tres días suma tres; al completar una tarea el anillo se mueve sin
  recargar.
- El anillo no depende del filtro y se mantiene en Tablero, «Al día» y Árbol. `gate-tareas-anillo`
  mide las cuentas, el centro, la leyenda, el estado vacío y 411.

### Tiempo

- La sección se reordena en tres piezas: reloj con controles de colores e iconos, registro con
  ramo, tarea, semana y día, y sesiones a la derecha con altura propia y desplazamiento interno.
- La lista prioriza la semana actual, separa por días, pone lo más reciente arriba y permite
  editar cada sesión: duración en `1:00:00`, día, ramo, tarea y semana. Una sesión puede quedar
  sin ramo y sin tarea.
- La tarea elegida en el registro se guarda en la sesión y se puede corregir después.

### Identidad de los ramos

- El color y el icono son **opcionales**: la identidad ofrece «Sin color» y «Sin icono» y guarda
  la ausencia como una decisión del usuario, sin inventar un valor automático.
- Un ramo sin identidad sigue apareciendo por su código en Malla, Estudio, Calificaciones,
  Tiempo, Calendario y Tareas; el icono y el punto simplemente no se pintan.
- `gate-identidad-opcional` mide el guardado vacío, la persistencia y que no se invente un icono.

### Calendario y vínculos

- La barra lateral lista los **ramos como categorías automáticas**, con su tinte e icono y su
  cuenta de eventos; no hay que crear una categoría por ramo. Un ramo sin color se identifica
  igual por su código y su marca.
- Cada ramo se puede ocultar o mostrar; el filtro se aplica a las cinco vistas y a los totales.
- La descripción Markdown del evento vuelve a la ventana y al panel de detalle.
- La tarea gana hora opcional y «Mostrar en el calendario»; sus datos no se duplican: el
  calendario lee la tarea viva y el chip abre Tareas.
- Un evento nuevo se puede guardar como evento o como tarea desde su propia ventana. Las
  evaluaciones con fecha siguen entrando al calendario con el contexto del ramo.

### Sincronización

- Los cuatro paneles de la sección nacen cerrados; se abren al pulsarlos. La tarjeta queda más
  corta y sin ruido visual.

### Publicación

- La beta.8 se publica como **app web en GitHub Pages** (`https://billibu-n.github.io/Mimo/`) y
  como **pre-release de escritorio** con tag `v1.2.0-beta.8`: RPM para Fedora/RHEL, DEB para
  Debian/Ubuntu, NSIS para Windows y paquete para Arch Linux.
- La [pre-release](https://github.com/billibu-n/Mimo/releases/tag/v1.2.0-beta.8) queda con 12
  assets, firmas `.sig`, `beta.json`, `tutorial.json`, `LICENSE` y `SHA256SUMS` verificado.
- **38 compuertas web** en verde, más `gate-release` sobre los paquetes firmados y `gate-tauri`
  sobre el binario Linux; `beta.json` queda en la rama `updates`.

## 1.2.0-beta.7 — 2026-11-05

### Publicación

- La beta.7 se publica como **app web en GitHub Pages** (`https://billibu-n.github.io/Mimo/`) y
  como **pre-release de escritorio** con tag `v1.2.0-beta.7`: RPM para Fedora/RHEL, DEB para
  Debian/Ubuntu, NSIS para Windows y paquete para Arch Linux.
- **32 compuertas web** en verde, más `gate-release` sobre los paquetes y `gate-tauri` sobre el
  binario Linux; `beta.json` queda en la rama `updates`.

### Sincronización

- La tarjeta de Sincronización y el pie abren una **ventana única** (`modal.js`) con cuatro
  paneles desplegables: Enlace o QR, Conexión manual, Cifrado y Enlace y sincronización. El
  flujo manual de siempre queda como respaldo dentro del mismo modal.
- Se puede **pegar el texto completo** de la página o **subir/arrastrar una imagen con QR**;
  el lector local **jsQR 1.4.0** (Apache-2.0, en `app/vendor/jsqr/`) lo decodifica en el
  cliente, sin servidor. Si el navegador ofrece cámara, también se puede capturar.
- El motor `app/js/dominio/sync-enlace.js` desarma `nc://onetime-login/user:…&password:…&server:…`
  (y el texto que lo rodea, las etiquetas o una URL WebDAV) en servidor, usuario, contraseña de
  aplicación y ruta; muestra el resultado antes de confirmar y lo normaliza a los campos que
  ya usaba la sincronización.
- El enlace resultante se muestra enmascarado, se puede revelar, copiar completo y descomponer
  en sus partes (servidor, usuario, contraseña, ruta WebDAV, carpeta y archivo). Al cerrar se
  borra el texto pegado para no dejar la contraseña de aplicación en Ajustes.

### Malla

- El grafo de requisitos se dibuja con **tramos ortogonales y esquinas redondeadas**
  (`--malla-radio`), no con curvas que atravesaban las tarjetas. Cada arista sale del borde
  derecho de su ramo y viaja por los huecos de columna y por las **franjas entre dos fichas**:
  varios cables comparten carril y franja, no se abre una pista por arista ni se baja a una
  banda inferior. El trazado no entra en ninguna ficha y no crece hacia abajo.
- El orden de las líneas es estable: se ordenan por nivel, posición y código, y cada corredor
  se reutiliza con el mismo criterio en cada repintado. Al elegir un ramo quedan visibles solo
  sus aristas y los ramos vinculados; el resto se atenúa. Al deseleccionar vuelve la vista
  general.
- Los requisitos del **mismo nivel** se dibujan rodeando la columna por la derecha.
- Al entrar a Malla desde la barra de secciones, el tablero aparece **sin selección**: no se
  arrastra el ramo abierto en Calificaciones ni en otra vista. **Ver en Malla** y la búsqueda sí
  abren el ramo concreto.

### Tareas

- El **Tablero** vuelve a ser la vista inicial y recupera los filtros de la versión anterior:
  Todas, Pendientes, Hoy, Ramos y Personales, con su cuenta.
- La tarjeta del tablero se puede **completar** con un clic: queda tachada y pasa a Hechas.
  El menú contextual ofrece Completar/Reabrir y **subir o bajar la prioridad**.
- El clic derecho vuelve a abrir acciones en Tareas, Malla, Calendario, Notas, Periodos y
  Sesiones.
- Se retira el **gráfico de barras semanal** de Tareas: la sección queda con el tablero, los
  filtros y la lista, sin la tarjeta de siete días.
- La vista **Hoy** pasa a **Al día**: muestra las tareas **no hechas vencidas, de hoy y sin
  fecha**, una sola vez, ordenadas de la más antigua a la más reciente y con las **sin fecha
  al final**; quedan fuera las futuras y las hechas. Las series entran solo con su ocurrencia
  de hoy. Se elige «Al día» y no «Pendientes» porque la vista es la bandeja accionable de hoy
  (vencidas + hoy + sin fecha), no el listado de todo lo abierto: las futuras siguen en el
  Tablero y en el Árbol, y «Pendientes» ya nombra un filtro del tablero.
- El **modal de tarea** deja la fecha **opcional** (nace vacía, con atajos Hoy/Mañana/Sin
  fecha) y las tareas sin fecha se ven en su propia tira del tablero. La **descripción** usa
  el mismo editor Markdown de Notas —barra de formato, vista previa, tablas, KaTeX y saneado—
  y el panel la pinta con ese motor.
- Las tareas pueden ser **series**: frecuencia diaria, semanal, mensual o anual; intervalo;
  días de la semana; fin por fecha o por número de veces. Cada fecha de la serie es una
  ocurrencia: el tablero, «Al día» y el árbol la muestran, y completar una
  ocurrencia no cierra la serie. «Diaria + L–V» configura en dos clics «correr 30 minutos de
  lunes a viernes». La regla se guarda en `recurrencia` con las ocurrencias cumplidas en
  `hechas`.

### Calificaciones

- Calificaciones distingue **activo**, **disponible** e **historial**. Por defecto muestra solo
  los activos; el filtro deja ver los disponibles (en la Malla pero sin cursar) y los cerrados.
  Un ramo disponible se añade con el botón o desde el modal, sin inventar notas.
- **Retirar de Calificaciones** es desvincular, no borrar: pide confirmación, conserva el ramo y
  sus notas, y ofrece **Deshacer**. El borrado destructivo queda como una acción aparte.
- Las **notas se editan a mano** en la propia sección: categorías, componentes y examen. La
  **nota final se edita en su propia caja** del resumen, con el mismo trato en sitio que el
  reloj de Tiempo; no hay un control aparte. Manda sobre el cálculo, la escala es 1.0–7.0 y el
  umbral de aprobación sale de la nota mínima (4.0 por defecto); todo se guarda en
  `mimo.shell.v1` y se recalcula al reabrir.
- Al cerrar, la final (calculada o manual) pasa al **Historial** una sola vez y queda visible
  en la lista y en el detalle; no se inventan notas ni se duplica el ramo.
- **Cerrar un curso** ya no queda bloqueado cuando falta la nota del examen: se usa la
  presentación como final provisional, se avisa del resultado y el ramo se puede reabrir.
- Cada ramo ofrece **Editar** e **Identidad** en la cabecera. El clic derecho de la lista abre
  Abrir ficha, Ver en Malla, Editar ramo, Identidad, Añadir/Retirar, Cerrar/Reabrir y Borrar
  ramo; el clic derecho de la sección añade Nuevo ramo y Ver Malla.

### Estudio

- El bloque **Meta por semana** desaparece: en su lugar queda una línea compacta con la
  **meta semanal del ramo**, sin una fila de inputs por semana.
- El techo del gráfico y la línea de meta usan esa **meta semanal del ramo** (la suma de las
  metas de los ramos), no el total del semestre ni el máximo de otras semanas; las barras se
  escalan contra ella y la barra máxima llega al 100 %.
- El campo global **Meta semanal** se oculta cuando hay metas de ramo: la meta se edita en la
  columna **Meta semanal** de la tabla.
- La **línea de meta** se dibuja dentro del área de las barras y el techo toma el máximo de la
  semana actual si supera la meta; una semana de 30 h con meta de 20 h deja la barra por encima
  de la línea, sin arrastrar el máximo de otras semanas.
- La tabla **Horas por ramo** también es semanal: **Horas semanales** muestra lo registrado en
  la semana actual y **Avance** compara contra la meta semanal del ramo, sin multiplicar por las
  semanas del período (5,5 h de meta son el 100 %).

### Calendario

- Vuelve el motor de **mes, año y semestre** de Mimo Académics: grilla mensual de 42 celdas
  con número de día y marcas de la semana del periodo, los 12 meses del año con un punto por
  día con eventos y la tabla de semanas con la columna de estudio.
- Las vistas se navegan con las flechas (mes, año o periodo) y **Hoy** vuelve al periodo
  actual. En el año, pulsar un día abre su mes. La tabla del semestre marca la semana actual
  y mide las horas registradas por semana.
- La cabecera del calendario ofrece **Desde la semana actual**: oculta las semanas
  anteriores en la tabla y en las marcas del periodo, sin perder la fila actual, los chips ni
  las horas. Es reversible y se conserva al reabrir.
- Los chips recuperan el tinte suave y el borde de color del ramo; la categoría del evento
  sigue visible en mes, semana, semestre y detalle.

### Pruebas

- Nueva `gate-malla-grafo.py`: 39 aristas del fixture con corredores compartidos (5 carriles
  para 6 columnas y 3 franjas para 13 saltos), sin banda inferior, sin entrar en ninguna ficha,
  selección que deja 3 aristas y 3 ramos vinculados con 26 atenuados, y el mismo trazado al
  repintar, a 1440 y 411 px.
- Nueva `gate-calendario-motor.py`: Mes/Año/Semestre/Semana, 42 celdas, 12 meses,
  18 semanas con estudio, navegación, corte y categorías, a 1440 y 411.
- `gate-calificaciones.py` amplía la distinción activo/disponible, el alta desde el modal, el
  retiro no destructivo con deshacer, la nota final manual que pasa al Historial y persiste al
  recargar, el cierre sin nota de examen, el clic derecho y el filtro de ramos de la Malla.
- `gate-tareas-tablero.py`: tablero inicial, filtros, completar/tachar, prioridad en el menú,
  clic derecho en tres secciones y 411; **sin gráfico de barras** y con **Al día** (vencidas,
  hoy y sin fecha, una vez, sin futuras ni hechas).
- Nuevas `gate-tareas-modal.py` (fecha opcional, descripción Markdown y repetición) y
  `gate-sync-enlace.py` (QR/texto, enlace y partes, saneado y 411). La suite web pasa a
  **32 compuertas**.
- Se retiró la vista **Agenda**: los eventos siguen en mes, semana, semestre y detalle.

## 1.2.0-beta.6 — 2026-11-01

### Pruebas antes de publicar

- Cacería adversarial sobre las ocho secciones, el panel, la vista dividida, los plegables, la
  ventana única, la importación y la persistencia. Cada corrección entra con su compuerta.
- **27 compuertas web** en verde: las 26 anteriores más `gate-categorias.py`; `gate-tiempo` usa
  reloj falso para medir segundos exactos y `gate-malla`/`gate-estudio` cubren el cierre y el
  renombre de un ramo.

### Calificaciones

- Calificaciones distingue **activo**, **disponible** e **historial**. Por defecto muestra solo
  los activos; el filtro deja ver los disponibles (en la Malla pero sin cursar) y los cerrados.
  Un ramo disponible se añade con el botón o desde el modal, sin inventar notas.
- **Retirar de Calificaciones** es desvincular, no borrar: pide confirmación, conserva el ramo y
  sus notas, y ofrece **Deshacer**. El borrado destructivo queda como una acción aparte.
- Las **notas se editan a mano** en la propia sección: categorías, componentes, examen y una
  **nota final manual** que manda sobre el cálculo. La escala es 1.0–7.0 y el umbral de
  aprobación sale de la nota mínima (4.0 por defecto); todo se guarda en `mimo.shell.v1` y se
  recalcula al reabrir.
- Al cerrar, la final (calculada o manual) pasa al **Historial** una sola vez y queda visible
  en la lista y en el detalle; no se inventan notas ni se duplica el ramo.
- **Cerrar un curso** ya no queda bloqueado cuando falta la nota del examen: se usa la
  presentación como final provisional, se avisa del resultado y el ramo se puede reabrir.
- Cada ramo ofrece **Editar** e **Identidad** en la cabecera. El clic derecho de la lista abre
  Abrir ficha, Ver en Malla, Editar ramo, Identidad, Añadir/Retirar, Cerrar/Reabrir y Borrar
  ramo; el clic derecho de la sección añade Nuevo ramo y Ver Malla.

### Calendario

- **Categorías de evento.** Un evento suelto puede llevar una etiqueta propia, sin ramo: se crea
  desde su ventana o desde el carril, y se ve en el chip del mes, en la semana, en la agenda, en
  el detalle y en la lista de categorías. Es el «tipo» de Mimo Académics, con el color estable de
  la identidad del ramo.

### Malla

- La ficha de un ramo aprobado ofrece **Cambiar color e icono** sin tener que reabrirlo. Si se
  reabre para elegirlo, se puede volver a cerrar desde Calificaciones: sin notas, pide confirmación
  y lo cierra como aprobado, igual que desde Malla.
- Cambiar el **código** de un ramo ahora arrastra sus sesiones, sus metas y los contextos de
  eventos y tareas. Antes las horas desaparecían de Estudio y Tiempo.

### Calificaciones

- Las categorías y los componentes que crea la app nacen con el nombre en el idioma activo; antes
  aparecían en español aunque la interfaz estuviera en inglés o chino.

### Tiempo

- El cronómetro, el temporizador y el pomodoro **miden con la hora del equipo**, no contando
  ticks. Pausar y reanudar conserva lo medido y una pestaña dormida no regala ni roba segundos.
- Cambiar de modo con la cuenta corriendo registra la sesión en vez de perderla.

### Interfaz

- Vuelve el recuadro de fondo de Mimo Académics en todas las secciones, con el lienzo del tema
  (`R99`).
- Una sola ventana de edición (`#modal-editor`) para los siete formularios (`R100`).
- Categorías plegables en Calificaciones, Estudio y Tiempo (`R101`).
- Color e icono por ramo desde `identidad.js`, con 121 iconos de Lucide y buscador (`R102`,
  `R103`, `R103b`).

## 1.2.0-beta.5 — 2026-10-31

### Sincronización

- El pie dice cuándo se guardó y cuándo se sincronizó —«Local · 12:03», «Nube · 12:04»,
  «Sin subir · 12:05»— con un punto de color; el título del botón da el detalle y un clic abre
  la tarjeta.
- Comprobante de cada sincronización (qué se movió, cuándo, cuánto pesa, cuántas cosas) y botón
  «Ver la copia» que lee el destino de verdad.
- «En mi Nextcloud» se configura con la dirección del servidor: Mimo comprueba `status.php`, lee
  el perfil por OCS y arma la ruta WebDAV.
- Autorización desde el navegador con el Login Flow v2: abre el navegador, espera el permiso y
  recibe usuario y contraseña de aplicación sin que se escriban.
- La contraseña de aplicación va al **llavero del sistema**; si no hay, se guarda cifrada con la
  clave derivada. «Desconectar» la borra.
- Los errores HTTP se explican con una acción, no con un código.

### Interfaz

- La hora de Alarmas es la real y sigue corriendo (antes se congelaba al abrir).
- **Tamaño de letra** en Ajustes → Apariencia: del 90 % al 140 %, se recuerda en el equipo.
- Cada bloque lleva un **código de dos dígitos** (01–08) y Estudio tiene icono propio: ya no
  comparte el de Tiempo.
- La mascota lleva a la primera sección (`Ctrl+1`); si ya estás ahí, no hace nada.
- El botón de historial usa un icono de historial, no una flecha de deshacer.
- Fuera el botón de desarrollador «Guardar tutorial».

### Pruebas

- `gate-senal.py` (21 comprobaciones): señal del pie, comprobante y contraseña de aplicación.
- `gate-webdav`: conector de Nextcloud y autorización desde el navegador contra un servidor falso.
- `gate-tauri`: 39 comprobaciones sobre el binario release, con sync nativa y RPM.

### Notas

- El RPM se firma con GPG en CI. Beta.4 queda como se publicó, sin esa firma.
- Los conectores Dropbox y Google Drive quedan pendientes de registrar las aplicaciones:
  <https://github.com/billibu-n/Mimo/issues/1>.

## 1.2.0-beta.4 — 2026-10-30

### Actualización

- Actualizador in-app con `tauri-plugin-updater`, manifiesto estático en la rama `updates`,
  firma minisign y `requireSignedVersion`.
- Canales `beta` y `stable`; comprobación al arrancar, al volver a la ventana y cada 6 h,
  además del botón manual.
- En Windows NSIS, Linux DEB y Linux RPM la instalación se ofrece desde la app; Arch recibe
  aviso y enlace porque el plugin no instala `.pkg.tar.zst`.
- Respaldo nativo obligatorio antes de instalar; si el respaldo falla, no se instala.

### Datos

- Espejo nativo atómico del estado; si `localStorage` falla por cuota, aparece un aviso
  persistente y se puede exportar o restaurar la copia nativa.
- Respaldo antes de importar, con retención y SHA-256.
- Un respaldo con versión de esquema futura se rechaza en vez de aplicarse.
- La contraseña de aplicación WebDAV ya no se guarda en `localStorage`; queda en la sesión.

### Corregido

- El enlace Linux ya no depende de símbolos privados de WebKitGTK: se buscan en runtime y, si
  no existen, Mimo conserva el límite de 60 fps sin romper la compilación en Ubuntu.
- `version.js` es la fuente única de la versión visible.

### Pruebas

- 19 gates web: se suman `gate-respaldo` y `gate-actualizacion`.
- `gate-release` valida paquetes, firmas y manifiesto.
- `gate-tauri` mide el espejo nativo, el respaldo, el canal de actualización y la tarjeta.

### Limitaciones

- El paquete Arch no se actualiza in-app.
- Windows sin Authenticode puede mostrar SmartScreen.
- La cuenta real de Nextcloud sigue pendiente de una prueba con credenciales del dueño.

## 1.2.0-beta.3 — 2026-10-30

### Arquitectura

- Los bloques ya tienen carpeta propia: `app/js/bloques/<id>/` con vista, ciclo de
  vida y estilos. `index.html` conserva solo el armazón; Calendario, Tareas, Notas,
  Tiempo, Malla, Calificaciones y Estudio se inyectan desde su bloque.
- `MimoRegistro` expone `montar`/`desmontar`, resuelve dependencias `requiere` y
  permite construir el catálogo desde los manifiestos.
- El dominio de cursos y sesiones emite eventos; las mutaciones de la interfaz pasan
  por esas funciones.
- El catálogo tiene ficha presionable y detalle en `#modal-bloque`.
- Notas es el bloque piloto completo: estado, Markdown, vista y `AbortSignal` viven
  en su carpeta.

### Producto

- **Evaluaciones se elimina y desvincula**: fuera del catálogo, del kit Academics,
  del esquema, de las exportaciones y de los estados guardados. No hay una vista
  pendiente con ese nombre.

### Corregido

- El calendario vuelve a mostrar el rail de «Nuevo evento / Contextos / Calendarios»
  en una columna paralela al calendario en escritorio; en móvil sigue en una columna.
- Tiempo, Estudio y las sugerencias del calendario solo ofrecen cursos en estado
  «en curso». Los cursos cerrados dejan de aparecer en esos selectores y tablas;
  sus datos históricos no se borran y Calificaciones los conserva.
- En Ajustes, la tarjeta de colaboración ya no habla de dinero: dice «Colaborar».

### Pruebas

- `gate-bloques` mide el montaje dinámico, el desmontaje, la reinstalación, los
  eventos de dominio y las dependencias.
- `gate-arquitectura` comprueba que las secciones no vuelvan a `index.html`, que
  cada bloque tenga vista y que `evaluaciones` no reaparezca.
- 17 gates web en verde.

## Sin publicar (beta.2)

- La app se empaqueta directamente desde `app/`. Se eliminó la copia `escritorio/app` y el paso
  `preparar-frontend`; las pruebas viven en `pruebas/` y la documentación técnica en `docs/`.
- Los verificadores pueden correr con `MIMO_HEADLESS=1`: la ventana queda fuera de la pantalla y
  de la barra de tareas.
- En Linux, la app deja de acercarse a 60 fps y sigue la tasa del monitor (medido a 145 fps en
  una pantalla de 144 Hz).

## 1.2.0-beta.2 — 2026-10-29

Segunda beta pública. Mantiene todo lo de la beta anterior y añade cambios de uso diario.

### Añadido

- **Colaborar** en Ajustes: compartir Mimo, abrir una discusión en GitHub y apoyar el proyecto
  con una donación.
- **Color por ramo**, editable desde la ficha del ramo. El color se usa en Estudio y tiñe los
  eventos del calendario que llevan ese ramo como contexto.
- **Ficha de la carrera** en Malla: título, universidad y país. Se guarda con la malla y viaja
  en las exportaciones e importaciones.
- Al escribir el contexto de un evento, el calendario sugiere los ramos de la malla.

### Corregido

- Se retiraron explicaciones internas de Ajustes y se reescribieron los textos que hablaban de
  formatos, siglas y detalles de implementación.
- La sección Malla ya no muestra la etiqueta técnica del kit.
- Los textos de sincronización explican qué se cifra y qué no, sin siglas.

### Limitaciones de esta beta

- Los paquetes no están firmados; solo hay `SHA256SUMS`.
- La sincronización con una cuenta real de Tab Digital aún no está probada desde el binario.
- macOS, iOS y Android no están preparados.

## 1.2.0-beta.1 — 2026-10-29

Primera beta pública de Mimo para escritorio.

### Añadido

- Aplicación Tauri 2 para Linux x86_64 y Windows x64.
- Paquetes RPM (Fedora/RHEL), DEB (Debian/Ubuntu) y `PKGBUILD` para Arch Linux.
- Instalador NSIS por usuario para Windows 10/11, con bootstrapper de WebView2.
- Calendario, tareas, notas Markdown, malla, calificaciones, estudio y tiempo.
- Sincronización manual local y WebDAV/Nextcloud cifrada con AES-GCM.
- Temas claros/oscuros, español/inglés/chino y atajos de teclado.
- Historial de 60 pasos con `Ctrl+Z`/`Ctrl+Y`, guardado con `Ctrl+S` y refresco con `Ctrl+R`.
- `tutorial.json` exportable desde la app y **precargado** en el primer arranque y tras
  restablecimiento de fábrica.
- Repositorio e instalación con el nombre **Mimo**; guía de instalación para Fedora, Debian,
  Ubuntu, Arch y Windows.
- Flujo de GitHub Actions que construye Linux, Windows y Arch sin publicar una release.

### Corregido

- El icono nativo de Linux vuelve a mostrarse en el menú y la barra de tareas: un solo
  `Mimo.desktop`, `StartupWMClass=mimo`, sin `enableGTKAppId` y con `_NET_WM_ICON` presente.
- El enlace TLS usa el backend nativo del sistema: OpenSSL en Linux y Schannel en Windows.

### Limitaciones de esta beta

- Los paquetes no están firmados; solo hay `SHA256SUMS`.
- La sincronización con una cuenta real de Tab Digital aún no está probada desde el binario.
- macOS, iOS y Android no están preparados.
- El `tutorial.json` se precarga en la app; en la release queda además como copia importable.
