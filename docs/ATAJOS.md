# Atajos y acciones genéricas

Mimo usa un pequeño registro de acciones comunes. Las teclas y los botones llaman a la misma
función; no hay dos caminos que puedan desincronizarse.

## Historial

- Hasta **60 pasos** por sesión. Los cambios de texto se agrupan con una pausa de 500 ms para no
  crear un paso por cada tecla.
- `Ctrl+Z` deshace; `Ctrl+Y` o `Ctrl+Shift+Z` rehace.
- El botón de la barra superior (icono de flecha) abre **Historial y atajos**, con los cuatro
  botones y el contador de pasos.
- Al recargar la app el historial empieza de nuevo; los datos guardados no se pierden.

## Atajos

| Atajo | Acción |
|---|---|
| `Ctrl+Z` | Deshacer |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Rehacer |
| `Ctrl+S` | Guardar y, si hay sincronización configurada, sincronizar |
| `Ctrl+R` / `F5` | Refrescar la vista sin recargar ni perder el estado |
| `Ctrl+K` | Buscar en Mimo |
| `Ctrl+1..9` | Ir a la sección en el orden actual de las pestañas |
| `Escape` | Cerrar la capa superior: historial, buscador, modal, menú o panel |
| Clic derecho / `Shift+F10` | Acciones del elemento |

## Portapapeles y selección

- `Ctrl+C`, `Ctrl+V` y `Ctrl+X` siguen siendo los del sistema dentro de los campos de texto.
- En una nota, `Ctrl+B`, `Ctrl+I` y `Ctrl+U` dan formato a la selección.

## Dónde se prueba

`gate-ronda14` comprueba `Ctrl+Z`, `Ctrl+Y`, `Ctrl+S`, `Ctrl+R`, el panel de historial y `ESC`.
`gate-correcciones` cubre el resto de acciones de la ronda.
