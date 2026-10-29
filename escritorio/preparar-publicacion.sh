#!/bin/sh
# Prepara la carpeta de publicación: solo RPM, semilla JSON y checksums.
# No copia HTML, fuente, prototipos ni referencias.
set -e

AQUI=$(cd "$(dirname "$0")" && pwd)
PROYECTO=$(cd "$AQUI/.." && pwd)
PUB="$PROYECTO/publicacion"
REL="$AQUI/release"
JSON="$PUB/mimo-inicial.json"

[ -d "$PUB" ] || { echo "ALTO: falta $PUB"; exit 1; }
[ -f "$JSON" ] || { echo "ALTO: falta la semilla $JSON"; exit 1; }
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
BASE=$(basename "$RPM")

(
  cd "$PUB"
  sha256sum "$BASE" mimo-inicial.json > SHA256SUMS
)

echo "publicacion lista:"
ls -lh "$PUB"/"$BASE" "$JSON" "$PUB"/SHA256SUMS
echo
echo "No se copió ningún HTML ni carpeta histórica."
