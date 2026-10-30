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

## Agregar un bloque

Un bloque vive en `app/js/bloques/<id>/` y no necesita tocar otra carpeta:

1. `vista.js` exporta el HTML del bloque en `window.MimoBloque<Nombre>Vista`.
2. `bloque.js` exporta `montar(api)` y `desmontar(api)`. Usa `api.root` y
   `api.ctx`; no llames funciones internas de otro bloque.
3. `app/css/bloques/<id>.css` contiene solo sus estilos. El host lo carga al montar.
4. El manifiesto se registra con `MimoRegistro.registrar` e incluye `id`, `nombre`,
   `tipo`, `vista`, `css`, `montar`, `desmontar`, `pintar`, `requiere` y `provee`.
5. Añade el `<script>` de `vista.js` y `bloque.js` antes de `shell.js`, y el
   manifiesto en `registrarManifiestos()`.

Antes de cerrar:

```bash
python3 pruebas/gate-bloques.py
python3 pruebas/gate-arquitectura.py
python3 pruebas/correr-gates.py
```

La base Calendario/Tareas/Notas/Ajustes no se quita. Un bloque opcional debe poder
faltar sin romper la app y sin borrar sus datos al quitarlo.
