#!/bin/sh
# Prepara la carpeta de publicación: paquetes construidos, tutorial, licencia y checksums.
# No copia HTML, fuente, prototipos ni referencias.
#
# Deben estar en escritorio/release/ los artefactos que se quieran publicar:
#   Mimo-*.rpm                         Fedora / RHEL
#   Mimo_*.deb                         Debian / Ubuntu
#   Mimo_*setup.exe                    Windows x64 (NSIS)
#   mimo-*.pkg.tar.zst                 Arch Linux
set -e

AQUI=$(cd "$(dirname "$0")" && pwd)
PROYECTO=$(cd "$AQUI/.." && pwd)
PUB="$PROYECTO/publicacion"
REL="$AQUI/release"
JSON="$PUB/tutorial.json"
APPJSON="$PROYECTO/app/tutorial.json"
LICEN="$PROYECTO/LICENSE"

[ -d "$PUB" ] || { echo "ALTO: falta $PUB"; exit 1; }
[ -f "$JSON" ] || { echo "ALTO: falta el tutorial $JSON"; exit 1; }
[ -f "$APPJSON" ] || { echo "ALTO: falta el tutorial de la app $APPJSON"; exit 1; }
cmp -s "$APPJSON" "$JSON" || {
  echo "ALTO: app/tutorial.json y publicacion/tutorial.json no coinciden."
  echo "Copia el JSON aprobado a los dos o vuelve a generarlo desde la app."
  exit 1
}
[ -f "$LICEN" ] || { echo "ALTO: falta $LICEN"; exit 1; }
python3 -m json.tool "$JSON" >/dev/null || {
  echo "ALTO: $JSON no es JSON válido"; exit 1;
}

tomar() {
  # Imprime el primer archivo que coincida, o nada.
  for f in "$REL"/$1; do
    [ -f "$f" ] && { printf '%s\n' "$f"; return 0; }
  done
  return 0
}

RPM=$(tomar 'Mimo-*.rpm')
DEB=$(tomar 'Mimo_*.deb')
EXE=$(tomar 'Mimo_*setup.exe')
ARCH=$(tomar 'mimo-*.pkg.tar.zst')

[ -n "$RPM$DEB" ] || {
  echo "ALTO: no hay RPM ni DEB en $REL."
  echo "Construye con: cd escritorio && cargo tauri build --bundles deb,rpm"
  exit 1
}

# Solo se reemplazan paquetes generados dentro de publicacion/.
rm -f -- "$PUB"/Mimo-*.rpm "$PUB"/Mimo_*.deb "$PUB"/Mimo_*setup.exe "$PUB"/mimo-*.pkg.tar.zst

FICHEROS=""
for f in "$RPM" "$DEB" "$EXE" "$ARCH"; do
  [ -n "$f" ] || continue
  cp -- "$f" "$PUB"/
  FICHEROS="$FICHEROS $(basename "$f")"
done
cp -- "$LICEN" "$PUB"/LICENSE

(
  cd "$PUB"
  # shellcheck disable=SC2086
  sha256sum $FICHEROS tutorial.json LICENSE > SHA256SUMS
)

echo "publicación lista:"
for f in $FICHEROS tutorial.json LICENSE SHA256SUMS; do
  ls -lh "$PUB/$f"
done
[ -n "$EXE" ] || echo "AVISO: falta el instalador Windows; se copiará cuando exista en release/."
[ -n "$ARCH" ] || echo "AVISO: falta el paquete Arch; se copiará cuando exista en release/."
echo
echo "No se copió ningún HTML ni carpeta histórica."
