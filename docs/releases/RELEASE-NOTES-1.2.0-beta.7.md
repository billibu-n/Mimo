# Mimo 1.2.0-beta.7

Estado: **web beta.7 publicada en GitHub Pages** el 2026-11-05. Los instaladores de escritorio
siguen siendo los de la beta.6; la beta.7 todavía no tiene tag ni assets de release.

Esta beta cierra el corte que empezó en la beta.6: el modal de tareas, la sincronización por QR
o texto, el tablero de Tareas y la puesta a punto de Malla, Calificaciones, Estudio y Calendario.
No cambia el formato de los datos: los respaldos de la beta.6 se abren tal cual.

## Lo nuevo de este corte

### Tareas

- La vista **Hoy** pasa a **Al día**: muestra las tareas no hechas **vencidas, de hoy y sin
  fecha**, una sola vez, ordenadas de la más antigua a la más reciente y con las sin fecha al
  final. Quedan fuera las futuras y las hechas; las series entran solo con su ocurrencia de hoy.
  Se eligió «Al día» y no «Pendientes» porque es la bandeja accionable de hoy, no todo lo
  abierto; «Pendientes» ya nombra un filtro del tablero.
- Se retira el **gráfico de barras semanal** de la sección de Tareas. La sección queda con el
  tablero, los filtros y la lista.
- El modal de tarea deja la fecha **opcional**, usa el mismo editor Markdown de Notas para la
  descripción y permite **series** diarias, semanales, mensuales o anuales con días excluidos y
  fin por fecha o por número de veces. «Diaria + L–V» configura «correr 30 minutos de lunes a
  viernes» en dos clics.

### Sincronización

- La tarjeta de Sincronización abre una **ventana única** con cuatro paneles desplegables:
  Enlace o QR, Conexión manual, Cifrado y Enlace y sincronización.
- Se puede **pegar el texto completo** de Nextcloud o **subir/arrastrar la imagen del QR**;
  **jsQR 1.4.0** lo decodifica en el cliente, sin servidor. El motor
  `app/js/dominio/sync-enlace.js` desarma `nc://onetime-login/user:…&password:…&server:…` en
  servidor, usuario, contraseña de aplicación y ruta WebDAV, y muestra el resultado antes de
  confirmar.
- El enlace resuelto se ve enmascarado, se puede revelar, copiar completo y descomponer en sus
  partes (servidor, usuario, contraseña, ruta, carpeta y archivo). Al cerrar se borra el texto
  pegado; el flujo manual sigue en el panel 2.

### Lo que ya venía en el corte

- **Malla**: grafo ortogonal con corredores compartidos, entrada sin selección y ficha con
  edición, identidad, cierre y borrado.
- **Calificaciones**: activo/disponible/historial, nota final editable en su caja, cierre sin
  examen y paso al Historial una sola vez.
- **Estudio**: meta semanal del ramo, tabla semanal y gráfico con la meta dentro de las barras.
- **Calendario**: motor de mes, año y semestre, corte desde la semana actual y categorías de
  evento con color.
- **Interfaz**: 10 temas, chino simplificado, i18n de las ocho secciones y una sola ventana de
  edición.

## Verificación

- **32 compuertas web** en verde con `python3 pruebas/correr-gates.py`.
- `gate-tareas-tablero` mide el tablero sin barras y el criterio de **Al día**; `gate-tareas-modal`
  mide fecha opcional, descripción Markdown, series y 411; `gate-sync-enlace` mide texto, QR,
  enlace y partes, saneado y 411.
- La app web publicada en <https://billibu-n.github.io/Mimo/> muestra `1.2.0-beta.7` en la
  cabecera y en Ajustes.

## Límites de esta beta

- Los **instaladores** de escritorio siguen en la beta.6: no hay tag, assets ni paquetes de la
  beta.7 en este corte. La beta.7 se prueba como **app web**.
- La cámara del QR solo se probó en el navegador con la API disponible; no con hardware real.
- La sincronización no se probó contra una cuenta real de Nextcloud en este corte; el motor de
  lectura sí se probó con el QR real del dueño.
- Arch no se actualiza desde la app; macOS, iOS y Android no están preparados.

El código, las pruebas y las instrucciones de compilación están en el repositorio. Licencia MIT.
