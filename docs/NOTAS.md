# Notas — Markdown estilo Jupyter

## Qué usa Jupyter

Una celda de texto de Jupyter **no es un archivo `.md`**: el cuaderno es un `.ipynb` (JSON) y
la celda guarda `cell_type: "markdown"` con el texto en `source`. Jupyter lo renderiza con
**Markdown GFM** (el mismo lenguaje de GitHub) y añade LaTeX con MathJax. Por eso admite
títulos, listas anidadas, citas, reglas, tablas, bloques de código, enlaces, imágenes y HTML
seguro.

Referencia: [Markdown Cells — Jupyter Notebook](https://jupyter-notebook.readthedocs.io/en/stable/examples/Notebook/Working%20With%20Markdown%20Cells.html).

Mimo guarda el Markdown directamente en `nota.cuerpo`; no introduce `.ipynb` ni celdas
ejecutables. Así el respaldo sigue siendo el mismo JSON aditivo.

## Qué acepta Mimo

| Sintaxis | Resultado |
|---|---|
| `#`, `##`, `###`, hasta `######` | títulos H1–H6 |
| `Título` + línea `===` o `---` | título H1/H2 subrayado |
| `**texto**`, `*texto*`, `~~texto~~` | negrita, cursiva, tachado |
| `<u>texto</u>` | subrayado (Markdown no tiene subrayado propio) |
| `` `código` `` y bloques ```` ``` ```` | código en línea y bloque |
| `> cita` | cita |
| `-`, `*`, `1.` | listas y listas anidadas |
| `- [ ]`, `- [x]` | tareas |
| `\| a \| b \|` | tabla GFM |
| `---` | regla horizontal |
| `[texto](https://…)` | enlace en otra pestaña |
| `![alt](ruta.png)` | imagen |
| `<mark>`, `<ins>`, `<sup>`, `<sub>`, `<kbd>` | HTML seguro |
| `$…$`, `$$…$$`, `\(...\)`, `\[...\]` | fórmulas KaTeX |

Los encabezados también se pueden escribir con la línea de subrayado (`===` para H1, `---`
para H2), que es la forma clásica de Markdown y la que Jupyter acepta.

## Herramientas del editor

La barra de formato inserta la sintaxis sobre la selección o en la línea actual:

- **H1 / H2 / H3**: prefijo de título, y lo quita si ya estaba.
- **B / I / U / S**: negrita, cursiva, subrayado y tachado.
- **`</>`**: código en línea o bloque si la selección tiene varias líneas.
- **❝ / • / ☑**: cita, lista y tarea.
- **▦**: tabla de dos columnas.
- Atajos: `Ctrl+B`, `Ctrl+I` y `Ctrl+U` dentro del cuerpo.

El botón **Vista previa / Editar** alterna el render. La barra de formato se oculta en la
vista previa.

## Seguridad y límites

- El HTML generado pasa por **DOMPurify**: se quitan `<script>`, manejadores `on*` y URL
  peligrosas. Un `<script>` en una nota no se ejecuta.
- Las imágenes locales o remotas se muestran, pero no se convierten en adjuntos del JSON.
- No hay celdas ejecutables, kernels, salidas de código ni `attachment:` de Jupyter.
- No se implementa `==resaltado==`; para eso está `<mark>texto</mark>`.
- Si faltan `marked` o `DOMPurify`, la app cae al render básico seguro y no rompe la nota.

## Dependencias locales

`app/vendor/marked/` y `app/vendor/dompurify/` se copian con la app y funcionan sin red y
dentro de Tauri. Las versiones, hashes y licencias están en el `LEEME.md` de cada carpeta.

## Pruebas

`gate-correcciones` comprueba títulos, tabla, subrayado, tareas, bloque de código, saneado,
dos fórmulas KaTeX, el botón de negrita y 411 sin desborde. `gate-idioma` sigue midiendo que
la interfaz de Notas se traduzca a inglés y chino.
