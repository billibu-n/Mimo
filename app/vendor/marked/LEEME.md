# marked 4.3.0 — Markdown de las notas

Motor local, sin CDN: la app debe funcionar sin red y dentro de Tauri.

- Origen: `https://registry.npmjs.org/marked/-/marked-4.3.0.tgz`
- SHA-256 del paquete: `bc795399d6e7c096521080d66ce6ca96a00875b4bb0df36e0f041815484f633b`
- Licencia: MIT (ver `LICENSE.md`).
- Se usa el mismo lenguaje que las celdas Markdown de Jupyter: GFM con tablas,
  bloques de código, listas, citas, encabezados y HTML seguro.
- El HTML resultante pasa por DOMPurify antes de mostrarse; sin DOMPurify no se
  usa marked y la nota cae al render básico seguro.
