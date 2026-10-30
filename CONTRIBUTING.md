# Contribuir

Mimo es un proyecto personal de Billibu. Las contribuciones son bienvenidas como issues o
pull requests pequeños y enfocados.

## Antes de abrir un cambio

1. Reproduce el problema en la beta publicada o en `main`.
2. Ejecuta las pruebas que tocan tu cambio.
3. No incluyas datos reales, credenciales, respaldos ni capturas con información personal.

## Construir y probar

```bash
python3 pruebas/correr-gates.py

cd escritorio
CARGO_TARGET_DIR="$HOME/.cache/mimo-tauri-target" \
  PATH="$HOME/.cargo/bin:$PATH" cargo tauri build --bundles deb,rpm
python3 ../pruebas/gate-tauri.py
```

En Windows:

```powershell
cd escritorio
tauri build --bundles nsis
```

## Estilo

- Español para documentación y mensajes de la app; inglés para claves internas.
- Un cambio verificable por commit.
- No se toca `main` directamente ni se publican releases desde un pull request.
- No se agregan dependencias nuevas sin justificar tamaño, licencia y modo offline.
