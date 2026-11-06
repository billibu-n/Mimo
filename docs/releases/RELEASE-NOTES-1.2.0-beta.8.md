# Mimo 1.2.0-beta.8

Estado: **pre-release publicada** el 2026-11-05. Incluye la app web en GitHub Pages y los
instaladores de escritorio de la misma versión.

Esta beta cierra el corte de la beta.7 con cuatro frentes nuevos: el panel derecho se puede
arrastrar, la tipografía ofrece diez familias además de la clásica, la vista dividida vuelve a
su botón superior y `Ctrl+Z`/`Ctrl+Y` respetan el texto que estás escribiendo. No cambia el
formato de los datos: los respaldos de la beta.7 se abren tal cual.

## Lo nuevo de este corte

### Panel derecho

- El panel se redimensiona **arrastrando su asa** en el borde izquierdo, como el panel lateral
  de un navegador. El ancho se limita a **240–560 px** y se guarda al soltar.
- El asa también responde al teclado: flechas izquierda/derecha mueven 10 px, **Shift** 40 px,
  **Inicio** restablece 320 px y el doble clic hace lo mismo.
- El panel **nace cerrado siempre**; se abre con el botón superior, el pie o cuando un bloque lo
  pide. La tarjeta **Paneles** de Ajustes desaparece porque ya no tiene sentido.
- **Vista dividida** deja de ocupar una tarjeta en Ajustes y vuelve a su **botón en la barra
  superior**, con estado visible.

### Tipografía

- El selector **Tipo de letra** suma diez familias del equipo: Cantarell, Adwaita Sans,
  Liberation Sans, Nimbus Sans, Carlito, Caladea, Liberation Serif, Latin Modern Roman,
  Montserrat y Noto Sans Mono, además de la clásica, la del sistema, la monoespaciada y la
  personalizada.
- Una muestra **Aa Bb Cc · Mimo 123** y el estado de la familia activa enseñan el cambio al
  instante. Si el equipo no tiene esa familia, el motor usa la de respaldo y lo avisa.
- **Otra fuente…** ahora muestra el campo, el botón **Aplicar**, admite Enter y enfoca el nombre
  al elegirla. Antes quedaba a medias y parecía que no hacía nada.

### Atajos y deshacer

- **Ctrl+Z y Ctrl+Y dentro de un campo de texto ya no tocan el estado de la app**: deshacen lo
  escrito en tareas, notas, sincronización y cualquier `input`, `textarea` o `contenteditable`.
- Fuera de un campo, el historial de la app sigue funcionando y cada deshacer o rehacer deja su
  aviso: «Deshecho: último cambio de la app.» o «Rehecho: último cambio de la app.».
- Esto evita que un `Ctrl+Z` borre una tarea o una nota sin que lo notes.

### Rendimiento

- Las órdenes nativas del espejo de estado (`estado_guardar`, `estado_leer` y los respaldos)
  corren en el runtime asíncrono de Tauri, no en el hilo principal. Un guardado lento ya no
  puede bloquear el repintado de la ventana.

### Tiempo

- La sección se ordena en tres piezas: reloj con controles de colores e iconos, registro con
  ramo, tarea, semana y día, y sesiones a la derecha con altura propia y desplazamiento interno.
- La lista prioriza la semana actual, separa por días, pone lo más reciente arriba y permite
  editar cada sesión: duración en `1:00:00`, día, ramo, tarea y semana. Una sesión puede quedar
  sin ramo y sin tarea.

### Tareas

- Tareas incluye un **anillo semanal** junto a los cuatro KPI: hechas y pendientes de la semana,
  porcentaje pendiente en el centro y leyenda con el total. Cuenta ocurrencias, no tareas.
- El anillo no depende del filtro y se mantiene en Tablero, «Al día» y Árbol.

### Ramos y calendario

- El color y el icono de un ramo son **opcionales**: la identidad ofrece «Sin color» y «Sin
  icono» y guarda la ausencia como una decisión del usuario.
- Un ramo sin identidad sigue apareciendo por su código en Malla, Estudio, Calificaciones,
  Tiempo, Calendario y Tareas.
- El calendario lista los **ramos como categorías automáticas**, con su tinte e icono y su
  cuenta de eventos. Cada ramo se puede ocultar o mostrar y el filtro se aplica a todas las
  vistas.
- La descripción Markdown del evento vuelve a la ventana y al panel de detalle.
- La tarea gana hora opcional y «Mostrar en el calendario»; sus datos no se duplican: el
  calendario lee la tarea viva y el chip abre Tareas. Un evento nuevo se puede guardar como
  evento o como tarea.

### Sincronización

- Los cuatro paneles de la sección nacen cerrados; se abren al pulsarlos. La tarjeta queda más
  corta y sin ruido visual.

## Descargas

| Sistema | Archivo |
|---|---|
| Fedora 40+ / RHEL 10+ x86_64 | `Mimo-1.2.0-beta.8-1.x86_64.rpm` |
| Debian 13 / Ubuntu 24.04+ amd64 | `Mimo_1.2.0-beta.8_amd64.deb` |
| Arch Linux x86_64 | `mimo-1.2.0beta.8-1-x86_64.pkg.tar.zst` |
| Windows 10/11 x64 | `Mimo_1.2.0-beta.8_x64-setup.exe` |

La release incluye además `tutorial.json`, `LICENSE`, `LEEME.md`, `SHA256SUMS`, `beta.json` y
las firmas `.sig` de los paquetes que usa el actualizador.

## Verificación

- **38 compuertas web** en verde con `python3 pruebas/correr-gates.py`.
- `gate-panel` mide el panel cerrado al arrancar, el arrastre, los topes, el teclado, el doble
  clic, la persistencia y 411; `gate-fuente` mide las diez familias y «Otra fuente…»;
  `gate-atajos` mide el deshacer nativo y el de la app con sus avisos.
- `gate-release` valida los paquetes Linux, las firmas `.sig` y el manifiesto del actualizador;
  `gate-tauri` abre el binario Linux real y mide persistencia, WebDAV nativo y que la familia
  tipográfica elegida llega al WebView.
- `SHA256SUMS` se verifica sobre los assets descargados de la release.
- La app web publicada en <https://billibu-n.github.io/Mimo/> muestra `1.2.0-beta.8` en la
  cabecera y en Ajustes.

## Límites de esta beta

- El instalador de Windows no tiene Authenticode; SmartScreen puede avisar.
- La cámara del QR solo se probó en el navegador con la API disponible; no con hardware real.
- La sincronización no se probó contra una cuenta real de Nextcloud en este corte; el motor de
  lectura sí se probó con el QR real del dueño.
- Arch no se actualiza desde la app: avisa y abre la release. Se instala con `pacman -U`.
- macOS, iOS y Android no están preparados.

El código, las pruebas y las instrucciones de compilación están en el repositorio. Licencia MIT.
