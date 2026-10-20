# Tablero de Mimo · D1 (direcciones) y D2 (armazón)

Dos ficheros, cada uno autosuficiente (CSS y JS en línea, sin red ni fuentes).

- `direcciones.html` — tres direcciones de una pantalla, para elegir tono.
  `?tema=oscuro` abre en oscuro; por debajo de 900 px las columnas se apilan.
- `armazon.html` — el armazón completo (riel, losa, estantería) en tres pieles,
  cinco estados y dos temas. La barra de arriba son los «controles de la muestra».
  Se fija por URL: `armazon.html?piel=b&tema=oscuro&estado=gabinete`
  (piel `a|b|c`, tema `claro|oscuro`,
  estado `normal|gabinete|edicion|vacia|apariencia`).
  Esc cierra el gabinete; el clic fuera también.

## Qué mide `medir-tablero.py`

Lee el `<style>`, quita comentarios y cuenta por dirección (`[data-dir="x"]`)
o piel (`[data-piel="x"]`) los valores distintos de: `font-size`; px de margen,
relleno y `gap` (el 0 no cuenta); px/% de `border-radius`; ms de
`transition`/`animation`; y hex escritos fuera de los `:root` de tokens.
El CSS común y los tokens de `:root` no se miden.

Techos por dirección/piel (tamaños/espacios/radios/duraciones/hex):
A 5/8/2/2/0 · B 5/8/2/2/0 · C 5/8/2/3/0

```
python3 medir-tablero.py                      # mide direcciones.html
python3 medir-tablero.py --fichero armazon.html
python3 medir-tablero.py --autoprueba         # 7 casos, con rojos forzados
```

Sale 1 si alguna dirección o piel pasa su techo.
## Capturas

`capturas/` guarda las 12 de escritorio (1440 × 900) y las 3 de 411, una por piel.
