# Arnés de gates de MIMO v2 (M02)

**Esto mide la app real (`app/index.html`).** Los gates existen para no declarar verde por
impresión: cada uno devuelve 0/1 y cita su medida.

## Correr

```bash
python3 pruebas/correr-gates.py     # los 16 gates web, resumen al final
```

El binario de escritorio se mide aparte, porque compila. El gate lo arranca en modo headless
(`MIMO_HEADLESS=1`): la ventana existe, pero no aparece ni ocupa la barra de tareas.

```bash
cd escritorio
PATH="$HOME/.cargo/bin:$PATH" cargo tauri build --bundles rpm
cd .. && python3 pruebas/gate-tauri.py
```

Los gates que aceptan `--demo` exigen **dos** cosas: la app buena sale 0 y el fixture roto sale 1.
Un gate que no discrimina es un gate roto.

## Qué mide cada uno

| Gate | Bueno | Roto |
|---|---|---|
| `gate-shell` | el shell universal: instalar Tiempo, quitar hijo, kit Academics, tarea, nota, panel por sección, temas | sin demo: mide `app/index.html` |
| `gate-bloques` | registro válido, base fija, Calificaciones sin Malla, curso creado desde Calificaciones, Malla lo ve y al quitarla los datos siguen; Tiempo sin Estudio y Estudio sin Tiempo | registro duplicado, base removible, curso o sesión perdidos |
| `gate-diseno` | 5 tamaños, 8 espacios, 3 radios, 1 duración, 9 temas, contraste AA | `fg = bg` en un tema debe salir 1 |
| `gate-datos` | formato 2 -> v3 conserva 87 cursos, 18 aprobados, 54 sesiones y 3.838 min; ida y vuelta | catálogo no objeto debe rechazarse |
| `gate-busqueda` | Ctrl+K encuentra tareas, notas, eventos, ramos y periodos y navega | sin demo: mide `app/index.html` |
| `gate-correcciones` | respaldo académico importado (ramos, tareas, sesiones, metas, bloques), reloj editable, sesión corregida, clic derecho, pareja de temas, 4 grupos de Ajustes, KaTeX en Notas, enlace de registro y espaciado de la sync en 1440/411 | importación incompleta, reloj no editable, tema sin pareja, fórmula rota, sin enlace o tarjeta sin aire |
| `gate-sync` | guarda un `mimo-sync.json`, lo carga en otro contexto, detecta conflicto local/remoto, aplica cada lado y deja respaldo | archivo sin formato, conflicto no detectado o pérdida de la copia local |
| `gate-webdav` | WebDAV/Nextcloud local con ETag: sin clave no sube, el remoto va cifrado, `If-None-Match`/`If-Match`, segundo equipo, cola sin red que sobrevive a recargar y se reintenta al volver, conflicto y ambas salidas, clave mala y remoto corrupto | sin clave subiendo, texto claro en el remoto, cola que se pierde o conflicto que pisa una copia |
| `gate-ronda14` | calendario con semana del periodo (S1/S2/REC/EX) y mapa editable de receso/exámenes, alto contraste claro, chino simplificado, bandera de Sudamérica, split de dos secciones completas, arrastre/reordenación de pestañas, deshacer, componente→calendario, meta semanal, ESC y Ctrl+1..9 según el orden, pantalla de carga | periodo sin columna, tema claro ausente, idioma/arrastre rotos, sin deshacer, sin meta, ESC o atajos que no responden o carga que se queda |
| `gate-tauri` | binario release: app universal, tutorial precargado, navegación, nota en `localStorage`, Ajustes, sync WebDAV nativa (sin preflight CORS), remoto cifrado, persistencia entre aperturas y RPM | falta el binario, la ventana no abre, el tutorial no se precarga o el remoto queda en claro |
| `gate-tutorial` | `app/tutorial.json` y `publicacion/tutorial.json` son el mismo `mimo.backup`, con el proyecto Mimo, 11 tareas y la nota con Markdown | JSON distinto, sin proyecto o sin la nota |

## Fixtures

- `fixtures/respaldo-sintetico.json`: **datos inventados** con las mismas cuentas que el respaldo
  real (87/18/54/3.838). Es el que se versiona.
- El respaldo real **no se versiona**: el repo es público y contiene nombres, notas y sesiones del
  dueño. Para probarlo en local:
  `python3 pruebas/gate-datos.py --fichero /ruta/al/respaldo-real.json`.
- `fixtures/manifiestos-v1.1.json`: contrato mínimo de bloques, hijos y kit.

## Límites declarados

- `datos_v3.py` es un **adaptador de referencia** para medir la migración, no el almacén de la app.
  M20 lo sustituye conservando estas medidas.
- `gate-webdav` usa `webdav.py`, un servidor local con CORS y ETag. **No se probó contra un
  Nextcloud real**: si el servidor no envía CORS, el navegador bloquea la petición y queda el
  archivo manual. La app abierta como `file://` envía `Origin: null`; la lista de CORS del servidor
  debe aceptarlo o la app debe servirse desde un origen propio (o desde Tauri).
- El cifrado se mide con dos contextos y una contraseña compartida; no hay recuperación de clave.
  Si se pierde, la copia local sigue intacta y la remota no se puede leer.
