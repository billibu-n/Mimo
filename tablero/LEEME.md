# Tablero de direcciones · D1

Abre `direcciones.html` con doble clic: un solo fichero, sin red ni fuentes
externas. La barra enciende claro/oscuro; `?tema=oscuro` abre en oscuro.
Por debajo de 900 px las tres columnas se apilan.

## Qué mide `medir-tablero.py`

Lee el `<style>`, quita comentarios y cuenta por dirección (`[data-dir="x"]`)
los valores distintos de: `font-size`; px de margen, relleno y `gap` (el 0 no
cuenta); px/% de `border-radius`; ms de `transition`/`animation`; y hex escritos
fuera de los `:root` de tokens. El armazón (barra, rejilla, conmutador y estos
pies) no se mide; los tokens de `:root` tampoco cuentan.

Techos por dirección (tamaños/espacios/radios/duraciones/hex):
A 5/8/2/2/0 · B 5/8/2/2/0 · C 5/8/2/3/0

`python3 medir-tablero.py` sale 1 si alguna pasa su techo.
`python3 medir-tablero.py --autoprueba`: 5 casos, uno forzado en rojo.
