# KaTeX 0.19.1 — render de fórmulas en Notas

Motor local, sin CDN: la app debe funcionar sin red y dentro de Tauri.

- Origen: `https://registry.npmjs.org/katex/-/katex-0.19.1.tgz`
- SHA-256 del paquete: `24da5a599eb2fcede2e270b99a6ff48bca816beecc95feeb84e8cccbd1bb34fd`
- Licencia: MIT (ver `LICENSE`).
- Se copiaron `katex.min.js`, `katex.min.css`, `contrib/auto-render.min.js` y los 20
  `fonts/*.woff2` (0,2 MB). No se copian `.woff` ni `.ttf`; WebKit/Chromium usan woff2.
- Delimitadores en Notas: `$...$` y `$$...$$`; también `\(...\)` y `\[...\]`.
- Si el motor no carga, `renderMarkdown()` devuelve el HTML sin fórmulas; no rompe la nota.
