# Arnés de gates de MIMO v2 (M02)

**Esto mide la app real (`app/index.html`), no la maqueta.** Los gates existen para no declarar
verde por impresión: cada uno devuelve 0/1 y cita su medida.

## Correr

```bash
python3 app/pruebas/correr-gates.py     # los 13 gates, resumen al final
```

El viejo está en `referencia/academics-1.1.2/` y no entra en esta suite: es oráculo, no producto.

Los gates que aceptan `--demo` exigen **dos** cosas: la app buena sale 0 y el fixture roto sale 1.
Un gate que no discrimina es un gate roto.

## Qué mide cada uno

| Gate | Bueno | Roto |
|---|---|---|
| `gate-ui` | base 4 en orden, panel de 4, 1440/1100/411 sin desborde, 0 consola, split, temas, cajón | `min-width:1600px` fuerza desborde y debe salir 1 |
| `gate-shell` | el shell universal: instalar Tiempo, quitar hijo, kit Academics, tarea, nota, panel por sección, temas | sin demo: mide `app/index.html` |
| `gate-diseno` | 5 tamaños, 8 espacios, 3 radios, 1 duración, 9 temas, contraste AA | `fg = bg` en un tema debe salir 1 |
| `gate-datos` | formato 2 -> v3 conserva 87 cursos, 18 aprobados, 54 sesiones y 3.838 min; ida y vuelta | catálogo no objeto debe rechazarse |
| `gate-busqueda` | Ctrl+K encuentra tareas, notas, eventos, ramos y periodos y navega | sin demo: mide `app/index.html` |
| `gate-correcciones` | respaldo académico importado (ramos, tareas, sesiones, metas, bloques), reloj editable, sesión corregida, clic derecho, pareja de temas, 3 grupos de Ajustes y KaTeX en Notas | importación incompleta, reloj no editable, tema sin pareja o fórmula rota |
| `gate-sync` | guarda un `mimo-sync.json`, lo carga en otro contexto, detecta conflicto local/remoto, aplica cada lado y deja respaldo | archivo sin formato, conflicto no detectado o pérdida de la copia local |
| `gate-webdav` | WebDAV/Nextcloud local con ETag: sin clave no sube, el remoto va cifrado, `If-None-Match`/`If-Match`, segundo equipo, cola sin red que sobrevive a recargar y se reintenta al volver, conflicto y ambas salidas, clave mala y remoto corrupto | sin clave subiendo, texto claro en el remoto, cola que se pierde o conflicto que pisa una copia |
| `gate-bloques` | manifiestos v1.1 sin huérfanos; Tiempo con 4 dentro; quitar un hijo no tumba al padre; kit Academics | manifiesto sin `tiempo` deja `pomodoro` huérfano y debe salir 1 |

## Fixtures

- `fixtures/respaldo-sintetico.json`: **datos inventados** con las mismas cuentas que el respaldo
  real (87/18/54/3.838). Es el que se versiona.
- El respaldo real **no se versiona**: el repo es público y contiene nombres, notas y sesiones del
  dueño. Para probarlo en local:
  `python3 app/pruebas/gate-datos.py --fichero /ruta/al/respaldo-real.json`.
- `fixtures/manifiestos-v1.1.json`: contrato mínimo de bloques, hijos y kit.

## Límites declarados

- La maqueta no persiste la estantería de Tiempo: el gate mide que el padre sigue y la cuenta baja,
  no que el cambio sobreviva a F5.
- El kit de la maqueta quita **todos** sus bloques, incluso los instalados aparte; el contrato real
  (M16) solo quita los que instaló el kit. El gate comprueba que no quedan pestañas huérfanas, no
  la propiedad fina del kit.
- `datos_v3.py` es un **adaptador de referencia** para medir la migración, no el almacén de la app.
  M20 lo sustituye conservando estas medidas.
- No hay capturas nuevas: la evidencia son las salidas de los gates y la maqueta ya capturada en
  T-45.
- `gate-webdav` usa `webdav.py`, un servidor local con CORS y ETag. **No se probó contra un
  Nextcloud real**: si el servidor no envía CORS, el navegador bloquea la petición y queda el
  archivo manual. La app abierta como `file://` envía `Origin: null`; la lista de CORS del servidor
  debe aceptarlo o la app debe servirse desde un origen propio (o desde Tauri).
- El cifrado se mide con dos contextos y una contraseña compartida; no hay recuperación de clave.
  Si se pierde, la copia local sigue intacta y la remota no se puede leer.
