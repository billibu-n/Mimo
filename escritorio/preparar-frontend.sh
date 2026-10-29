#!/bin/sh
# Compatibilidad: la preparacion real vive en preparar-frontend.py, que funciona
# igual en Linux, Windows y macOS. Este envoltorio se conserva para los comandos
# y documentos que ya llaman a preparar-frontend.sh.
set -e
AQUI=$(cd "$(dirname "$0")" && pwd)
exec python "$AQUI/preparar-frontend.py" "$@"
