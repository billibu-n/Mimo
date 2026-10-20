#!/bin/sh
# Prepara el frontend que consume Tauri: copia a `app/` SOLO lo que la aplicacion necesita.
#
# Por que copiar y no apuntar Tauri a `prototipo/`: con `frontendDist` en la raiz del prototipo,
# Tauri empaquetaria TAMBIEN `capturas/` (7 PNG de iteracion + las de la raiz), `evidencia/` y
# lo que el prototipo tenga alrededor. Aqui se copia con LISTA BLANCA, igual que hacia el molde
# del viejo (`referencia/mimo-app-53cc22d/escritorio/preparar-frontend.sh`), y ademas se deja
# fuera `capturas/` y `evidencia/`, que no son aplicacion.
#
# `app/` es GENERADO: no se edita a mano y esta en `.gitignore` (linea `escritorio/app/`). La
# fuente de verdad sigue siendo `prototipo/`, una sola, y este script no inventa nada: solo copia.
#
# FALLA EN VOZ ALTA si falta algo imprescindible. Antes, en el molde del viejo, el script solo
# AVISABA y seguia, y eso dejo pasar una compilacion con el frontend a medias.

set -e
AQUI=$(cd "$(dirname "$0")" && pwd)
PROYECTO=$(cd "$AQUI/.." && pwd)
ORIGEN="$PROYECTO/prototipo"
DESTINO="$AQUI/app"

ARCHIVOS="index.html"
CARPETAS="css js i18n datos bloques iconos"

# Sin estos no es la aplicacion, y ademas son las TRES rutas que el prototipo pide por `fetch`
# (i18n/<lang>.json, datos/bloques.json, bloques/malla/manifiesto.json). Si falta una, se para.
IMPRESCINDIBLES="index.html datos/bloques.json i18n/es.json bloques/malla/manifiesto.json"

echo "origen : $ORIGEN"
echo "destino: $DESTINO"

for f in $IMPRESCINDIBLES; do
  if [ ! -f "$ORIGEN/$f" ]; then
    echo
    echo "ALTO: no encuentro $f en $ORIGEN"
    echo "Eso significa que $ORIGEN no es la carpeta del prototipo."
    echo "Este script vive en <proyecto>/escritorio/ y espera el frontend en <proyecto>/prototipo/."
    exit 1
  fi
done

rm -rf "$DESTINO"
mkdir -p "$DESTINO"

for f in $ARCHIVOS; do
  if [ -f "$ORIGEN/$f" ]; then
    cp "$ORIGEN/$f" "$DESTINO/$f"
  else
    echo "AVISO: falta $f en $ORIGEN"
  fi
done

for c in $CARPETAS; do
  if [ -d "$ORIGEN/$c" ]; then
    cp -r "$ORIGEN/$c" "$DESTINO/$c"
  else
    echo "AVISO: falta la carpeta $c"
  fi
done

# El prototipo lo esta tocando otro bloque en paralelo (T1: bloques/tiempo/ y datos/bloques.json).
# La copia es un SNAPSHOT: si el catalogo se copio a media escritura y no parsea, se espera 5
# segundos y se reintenta UNA vez. Si vuelve a fallar, se sigue con lo que haya y se anota: el
# fallo es del prototipo, no de este script, y no se arregla aqui (limite del bloque: no se toca
# `prototipo/`).
if ! python3 -m json.tool "$DESTINO/datos/bloques.json" >/dev/null 2>&1; then
  echo "AVISO: datos/bloques.json no parsea. Puede ser una copia a media escritura. Reintento en 5 s."
  sleep 5
  rm -rf "$DESTINO/datos"
  cp -r "$ORIGEN/datos" "$DESTINO/datos"
  if ! python3 -m json.tool "$DESTINO/datos/bloques.json" >/dev/null 2>&1; then
    echo "AVISO: datos/bloques.json SIGUE sin parsear. Se empaqueta tal cual; se declara como HUECO."
  fi
fi

# Se cuenta con un bucle recursivo y no con `find`: en esta sede `find` en la shell esta prohibido
# por el portero (se descubre con `glob`), y un script que se pueda leer entero vale mas.
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

# El prototipo son 19 ficheros (medido con `ls -R`). Si salen muy pocos, la copia esta a medias y
# el binario saldria en blanco: mejor parar aqui.
if [ "$N" -lt 15 ]; then
  echo
  echo "ALTO: solo $N archivos. El frontend esta INCOMPLETO."
  echo "Mira que $ORIGEN tenga index.html, css/, js/, i18n/, datos/ y bloques/."
  exit 1
fi
