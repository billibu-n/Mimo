# Mimo de escritorio (Tauri 2) — paquete `rpm`

```bash
cd ~/workspace/proyectos/mimo-nuevo/escritorio
./preparar-frontend.sh                 # prototipo/ -> app/
cargo tauri build --bundles rpm        # compila y empaqueta
```

Deja el instalable en `src-tauri/target/release/bundle/rpm/Mimo-0.1.0-1.x86_64.rpm` (2,9 MB) y el
binario suelto en `src-tauri/target/release/mimo`.

## Instalar, abrir, desinstalar

```bash
# en un Fedora con permisos de administrador
sudo dnf install ./src-tauri/target/release/bundle/rpm/Mimo-0.1.0-1.x86_64.rpm
mimo                                   # o desde el menu, como "Mimo"
sudo dnf remove mimo
```

El paquete se llama `mimo` (Tauri deriva el nombre rpm del `productName` en kebab-case); el nombre
visible es "Mimo". Instala `/usr/bin/mimo`, `/usr/share/applications/Mimo.desktop` y los iconos.

## Que hace cada pieza

- `preparar-frontend.sh` copia `prototipo/` a `app/` con **lista blanca** (`index.html`, `css/`,
  `js/`, `i18n/`, `datos/`, `bloques/`, `iconos/`). No se apunta Tauri a `prototipo/` porque asi
  se empaquetarian `capturas/` y `evidencia/` dentro del binario. `app/` es generado, esta en
  `.gitignore` y se rehace en cada pasada. El script **para con exit 1** si falta `index.html` o
  alguna de las tres rutas que la app pide por `fetch`; si el catalogo se copio a medias avisa y
  reintenta una vez a los 5 s (el prototipo lo toca otro bloque en paralelo).
- `src-tauri/` es el caparazon: `productName` "Mimo", identificador `cl.mimo.app`, ventana
  1280x900 y `bundle.targets` solo `["rpm"]` (AppImage y deb fuera a proposito).
- Sin servidor web: las tres peticiones relativas las sirve el protocolo de recursos de Tauri
  desde `app/` (`i18n/<lang>.json`, `datos/bloques.json`, `bloques/malla/manifiesto.json`).
- `MIMO_SONDA=1 ./src-tauri/target/release/mimo` escribe `/tmp/mimo-sonda.json` con el origen, el
  estado de esas tres peticiones y el recuento de nodos. Sin la variable no hace nada.
- Requisitos (Fedora, ya instalados aqui): `cargo` y `cargo-tauri` 2.x, `rpmbuild`, `webkit2gtk4.1`,
  `javascriptcoregtk4.1`, `libsoup3`, `librsvg2`, `gtk3` y `fakeroot`.
