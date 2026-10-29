# Catálogo de bloques — contrato para la fase 2

**Estado:** diseño acordado, no implementado. Este documento fija el motor para que la
implementación no cambie el esquema de datos ni rompa los bloques existentes.

## 1. Lo que se quiere

- Una **barra superior de filtros/tags** por naturaleza del bloque.
- Cada ficha se puede **presionar** y abre una **ventana de detalle** con información útil:
  qué hace, qué datos toca, qué requiere, versión, capturas y notas.
- El catálogo sigue siendo el mismo motor de instalación/desinstalación; no se duplica lógica.

## 2. Metadatos del bloque

`BLOQUES` pasa de nombre/desc a una ficha completa. Los campos nuevos son aditivos: si faltan,
la ficha usa el icono y la descripción corta actuales.

```js
BLOQUES.tiempo = {
  nombre: "Tiempo",
  tipo: "seccion",              // seccion | aporte | pack
  naturaleza: "tiempo",         // base | tiempo | academico | aporte | kit
  tags: ["cronómetro", "pomodoro", "alarmas"],
  icono: "i-tiempo",
  desc: "Cronómetro, temporizador, pomodoro y alarmas.",
  detalle: {
    resumen: "Un solo lugar para medir el tiempo y registrar sesiones.",
    queHace: ["Cronómetro", "Temporizador", "Pomodoro", "Alarmas", "Sesiones por ramo"],
    datos: ["sesiones", "alarmas", "tiempoModo", "tiempoRamo"],
    requiere: [],
    imagenes: [
      { src: "img/bloques/tiempo-1.webp", alt: "Cronómetro y estantería de modos" }
    ],
    version: "1.0",
    changelog: ["1.0: cronómetro, temporizador, pomodoro y alarmas"],
    notas: "Quitar el bloque no borra las sesiones."
  }
};
```

Los bloques base (`calendario`, `tareas`, `notas`, `ajustes`) viven en un mapa
`CATALOGO_BASE` con la misma forma, pero `fija: true` y sin botón de quitar.

### Naturalezas

| Naturaleza | Qué agrupa |
|---|---|
| `base` | Calendario, Tareas, Notas, Ajustes |
| `tiempo` | Tiempo y sus modos |
| `academico` | Malla, Calificaciones, Estudio |
| `aporte` | Evaluaciones y otros aportes al calendario |
| `kit` | Academics u otros paquetes |

Los `tags` son libres y se muestran como chips secundarios; no sustituyen a `naturaleza`.

## 3. Barra de filtros

```html
<div class="catalogo-filtros" id="catalogo-filtros" role="toolbar" aria-label="Filtrar bloques">
  <button type="button" data-filtro="todos" aria-pressed="true">Todos <b>10</b></button>
  <button type="button" data-filtro="base">Base <b>4</b></button>
  <button type="button" data-filtro="tiempo">Tiempo <b>1</b></button>
  <button type="button" data-filtro="academico">Académico <b>3</b></button>
  <button type="button" data-filtro="aporte">Aportes <b>1</b></button>
  <button type="button" data-filtro="kit">Kits <b>1</b></button>
</div>
```

- Estado `catalogoFiltro` en `prefs.catalogoFiltro` (aditivo; por defecto `todos`).
- El filtro se aplica en `pintarCatalogo()` sobre una lista única `catalogoIds()`; no se
  reordena el estado ni se toca `instalados`.
- Los contadores salen de la lista completa, no de la filtrada.
- Un chip activo tiene `aria-pressed="true"` y foco visible.
- Si el filtro no deja fichas: mensaje «No hay bloques de esta naturaleza» + botón «Ver todos».

## 4. Ficha presionable y detalle

- La ficha entera es un `<button class="bcard" type="button" data-bloque="tiempo">`, no un
  `article` con un botón dentro. El botón de instalar/quitar queda dentro y hace
  `event.stopPropagation()`.
- Al presionar la ficha se abre `#modal-bloque` (ventana propia, no reutilizar el catálogo).
- La ventana muestra:
  - icono grande y nombre;
  - naturaleza y tags;
  - `detalle.resumen`;
  - lista «Qué hace»;
  - lista «Qué datos toca»;
  - «Requiere» si hay dependencias;
  - galería de imágenes (si no hay, icono de respaldo);
  - versión, changelog y notas;
  - botón Instalar/Quitar y estado actual;
  - botón Cerrar.
- `ESC` cierra el detalle antes que el catálogo; se añade a `cerrarCapaSuperior()`.
- Al cerrar, el foco vuelve a la ficha que lo abrió.
- En 411 px el detalle ocupa el ancho disponible, una columna, imágenes a lo ancho.

## 5. Imágenes

- Ruta: `app/img/bloques/<id>-<n>.webp`.
- Tope 5 MB por archivo, WebP, ancho recomendado 960 px.
- Si falta la imagen o falla la carga, se muestra el icono del bloque; nunca un hueco roto.
- Las imágenes no entran al JSON del usuario: son recursos del catálogo.
- Los textos alternativos salen de `detalle.imagenes[].alt` y se traducen si hace falta.

## 6. Lo que no cambia

- `instalar(id)` y `quitar(id)` siguen siendo la única puerta de instalación.
- `estado.instalados`, `estado.kits` y `estado.panel` no cambian de forma.
- Los datos de un bloque no se borran al quitarlo.
- El esquema aditivo `mimo.entorno` / `mimo.malla` no se toca: el catálogo es código, no
  estado del usuario. Solo se agrega `prefs.catalogoFiltro`.
- Un bloque futuro puede declarar `naturaleza` y `detalle` sin migración: los campos que
  falten usan los valores actuales.

## 7. Pruebas de la fase 2

`gate-bloques` debe añadir:

1. los chips existen y los contadores suman la lista completa;
2. filtrar por `tiempo` deja solo Tiempo; por `academico`, Malla/Calificaciones/Estudio;
3. una ficha es un botón y abre el detalle;
4. el detalle muestra resumen, «Qué hace», datos y versión;
5. sin imagen, aparece el icono de respaldo;
6. instalar desde el detalle actualiza la barra y el catálogo;
7. ESC cierra primero el detalle y después el catálogo;
8. el foco vuelve a la ficha;
9. 411 sin desborde;
10. `prefs.catalogoFiltro` sobrevive a recargar.

## 8. Orden de implementación

1. Metadatos (`naturaleza`, `tags`, `detalle`) + `catalogoIds()` + filtros.
2. Ficha como botón y `#modal-bloque` con textos, sin imágenes.
3. Imágenes y respaldo.
4. `gate-bloques` y capturas.
5. Cierre y commit.

No se implementa en la ronda R21; queda como el siguiente frente de producto.
