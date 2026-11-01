# Mimo 1.2.0-beta.6

Estado: **pre-release publicada** el 2026-11-01.

Esta beta cierra la puesta a punto antes de la 1.2.0: se probó la app frente por frente y se
corrigieron los fallos que aparecieron. No cambia el formato de los datos; los respaldos de beta.5
se abren tal cual.

## Qué se corrigió

- **Malla.** Un ramo aprobado se puede identificar (color e icono) sin reabrirlo. Si se reabre para
  elegir el icono, se puede volver a cerrar desde Calificaciones: sin notas, Mimo pide confirmación
  y lo cierra como aprobado, igual que desde Malla. Cambiar el código del ramo ahora arrastra sus
  sesiones, sus metas y los contextos de eventos y tareas.
- **Tiempo.** El cronómetro, el temporizador y el pomodoro miden con la hora del equipo, no contando
  ticks. Pausar y reanudar conserva lo medido, una pestaña dormida no descuadra la cuenta y cambiar
  de modo con la cuenta corriendo registra la sesión en vez de perderla.
- **Calendario.** Los eventos sueltos llevan **categorías** propias, sin depender de un ramo. Se
  crean desde la ventana del evento o desde el carril y se ven en el chip del mes, en la semana, en
  la agenda, en el detalle y en la lista del carril.

## Lo que ya venía en este corte

- El recuadro de fondo de Mimo Académics, con el lienzo del tema, en todas las secciones.
- Una sola ventana de edición para toda la app.
- Categorías plegables en Calificaciones, Estudio y Tiempo.
- Color e icono por ramo, con 121 iconos de Lucide, buscador y filtros.

## Verificación

- **27 compuertas web** en verde sobre `app/index.html`, en español, inglés y chino, y en los
  10 temas. La compuerta nueva es `gate-categorias.py`; `gate-tiempo` mide segundos exactos con
  reloj falso, y `gate-malla`/`gate-estudio` cubren el cierre y el renombre de un ramo.
- `gate-tauri.py` se corre aparte, sobre el binario release, cuando el workflow termina.

## Límites de esta beta

- El instalador de Windows no tiene Authenticode; SmartScreen puede avisar.
- Arch no se actualiza desde la app: avisa y abre la release.
- La sincronización con una cuenta real de Nextcloud no se probó desde el binario.
- macOS, iOS y Android no están preparados.

El código, las pruebas y las instrucciones de compilación están en el repositorio. Licencia MIT.
