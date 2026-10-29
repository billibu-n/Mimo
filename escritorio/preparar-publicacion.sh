#!/bin/sh
# Prepara la carpeta de publicación: solo RPM, tutorial, licencia y checksums.
# No copia HTML, fuente, prototipos ni referencias.
set -e

AQUI=$(cd "$(dirname "$0")" && pwd)
PROYECTO=$(cd "$AQUI/.." && pwd)
PUB="$PROYECTO/publicacion"
REL="$AQUI/release"
JSON="$PUB/tutorial.json"
LICEN="$PROYECTO/LICENSE"

[ -d "$PUB" ] || { echo "ALTO: falta $PUB"; exit 1; }
[ -f "$JSON" ] || { echo "ALTO: falta el tutorial $JSON"; exit 1; }
[ -f "$LICEN" ] || { echo "ALTO: falta $LICEN"; exit 1; }
python3 -m json.tool "$JSON" >/dev/null || {
  echo "ALTO: $JSON no es JSON válido"; exit 1;
}

RPM=$(ls "$REL"/Mimo-*.rpm 2>/dev/null | head -n 1 || true)
[ -n "$RPM" ] && [ -f "$RPM" ] || {
  echo "ALTO: no hay RPM en $REL. Construye primero con cargo tauri build --bundles rpm."
  exit 1
}

# Solo se reemplazan RPM generados dentro de publicacion/; no se toca nada más.
rm -f -- "$PUB"/Mimo-*.rpm
cp -- "$RPM" "$PUB"/
cp -- "$LICEN" "$PUB"/LICENSE
BASE=$(basename "$RPM")

(
  cd "$PUB"
  sha256sum "$BASE" tutorial.json LICENSE > SHA256SUMS
)

echo "publicacion lista:"
ls -lh "$PUB"/"$BASE" "$JSON" "$PUB"/LICENSE "$PUB"/SHA256SUMS
echo
echo "No se copió ningún HTML ni carpeta histórica."
