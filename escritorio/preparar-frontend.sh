#!/bin/sh
# Prepara el frontend que consume Tauri: copia a `escritorio/app/` SOLO la app universal.
#
# La fuente de verdad es `app/` en la raiz del proyecto (la misma que abren los gates y el
# navegador). No se apunta Tauri a `app/` directamente porque empaquetaria `pruebas/` y
# `maqueta/`, que no son aplicacion. Aqui se copia con LISTA BLANCA: index.html, css/, js/,
# img/ y vendor/ (KaTeX, Markdown y Comfortaa, offline).
#
# `escritorio/app/` es GENERADO y esta en `.gitignore`; se rehace en cada pasada.
# FALLA EN VOZ ALTA si falta algo imprescindible.

set -e
AQUI=$(cd "$(dirname "$0")" && pwd)
PROYECTO=$(cd "$AQUI/.." && pwd)
ORIGEN="$PROYECTO/app"
DESTINO="$AQUI/app"

ARCHIVOS="index.html"
CARPETAS="css js img vendor"

# Si falta uno de estos, el binario saldria vacio o sin cifrado/LaTeX: se para.
IMPRESCINDIBLES="index.html js/shell.js js/sync.js css/base.css css/shell.css vendor/katex/katex.min.js vendor/katex/katex.min.css vendor/marked/marked.min.js vendor/dompurify/purify.min.js vendor/fonts/comfortaa-semibold.woff2 img/icon-64.png"

echo "origen : $ORIGEN"
echo "destino: $DESTINO"

for f in $IMPRESCINDIBLES; do
  if [ ! -f "$ORIGEN/$f" ]; then
    echo
    echo "ALTO: no encuentro $f en $ORIGEN"
    echo "Este script vive en <proyecto>/escritorio/ y espera la app universal en <proyecto>/app/."
    exit 1
  fi
done

rm -rf "$DESTINO"
mkdir -p "$DESTINO"

for f in $ARCHIVOS; do
  cp "$ORIGEN/$f" "$DESTINO/$f"
done

for c in $CARPETAS; do
  if [ ! -d "$ORIGEN/$c" ]; then
    echo "ALTO: falta la carpeta $c en $ORIGEN"
    exit 1
  fi
  cp -r "$ORIGEN/$c" "$DESTINO/$c"
done

# La app universal no debe arrastrar la suite de pruebas ni la maqueta.
for prohibido in pruebas maqueta; do
  if [ -e "$DESTINO/$prohibido" ]; then
    echo "ALTO: $prohibido/ entro en el frontend empaquetado."
    exit 1
  fi
done

contar() {
  n=0
  for f in "$1"/*; do
    [ -e "$f" ] || continue
    if [ -d "$f" ]; then
      m=$(contar "$f")
      n=$((n + m))
    else
      n=$((n + 1))
    fi
  done
  echo "$n"
}

N=$(contar "$DESTINO")
echo "frontend listo: $N archivos"

if [ "$N" -lt 25 ]; then
  echo
  echo "ALTO: solo $N archivos. El frontend esta INCOMPLETO."
  echo "Mira que $ORIGEN tenga index.html, css/, js/, img/ y vendor/."
  exit 1
fi
