# Mimo de escritorio (Tauri 2) — paquete `rpm`

```bash
cd ~/sede/proyectos/mimo-nuevo/escritorio
./preparar-frontend.sh                 # app/ -> escritorio/app/ (lista blanca)
CARGO_TARGET_DIR="$HOME/.cache/mimo-tauri-target" \
  PATH="$HOME/.cargo/bin:$PATH" cargo tauri build --bundles rpm
mkdir -p release
cp "$HOME/.cache/mimo-tauri-target/release/mimo" release/
cp "$HOME/.cache/mimo-tauri-target/release/bundle/rpm/"*.rpm release/
```

`cargo tauri build` ejecuta `preparar-frontend.sh` antes de compilar (`beforeBuildCommand`), así que
el paso manual solo hace falta para inspeccionar el frontend preparado.

Deja el instalable en `release/Mimo-1.2.0-1.x86_64.rpm` (5,55 MiB) y el binario suelto en
`release/mimo` (18,4 MB). `CARGO_TARGET_DIR` saca los 3 GB de compilación de `~/sede`; `release/`
está ignorado en git y es un enlace a `~/sede/respaldos/mimo-1.2.0-release` para no gastar el
presupuesto de la casa. El RPM **no está firmado**; se
declara como hueco hasta que haya clave de firma.

## Instalar, abrir, desinstalar

```bash
# en un Fedora con permisos de administrador
sudo dnf install ./release/Mimo-1.2.0-1.x86_64.rpm
mimo                                   # o desde el menu, como "Mimo"
sudo dnf remove mimo
```

El paquete se llama `mimo` (Tauri deriva el nombre rpm del `productName` en kebab-case); el nombre
visible es "Mimo". Instala `/usr/bin/mimo`, `/usr/share/applications/Mimo.desktop` y los iconos.

## Que hace cada pieza

- `preparar-frontend.sh` copia la **app universal** (`<proyecto>/app/`) a `escritorio/app/` con
  lista blanca: `index.html`, `css/`, `js/`, `img/` y `vendor/`. Deja fuera `pruebas/` y `maqueta/`;
  si falta `sync.js`, KaTeX, Comfortaa o el icono, para con exit 1. `app/` es generado, está en
  `.gitignore` y se rehace en cada pasada.
- `src-tauri/` es el caparazón: `productName` "Mimo", identificador `cl.mimo.escritorio`, ventana
  1280x900 y `bundle.targets` solo `["rpm"]` (AppImage y deb fuera a propósito).
- **Sin servidor web:** el protocolo de recursos de Tauri sirve `index.html`, CSS, JS, imágenes,
  KaTeX y Comfortaa desde `app/`.
- **Puente HTTP nativo:** `http_pedir` (Rust + reqwest) hace GET/PUT/MKCOL/OPTIONS con cabeceras y
  ETag. Existe porque el WebView de Tauri **no exime a `fetch` de CORS**; la petición nativa sí.
  La app lo detecta y lo usa solo dentro de Tauri; en el navegador sigue usando `fetch`. Solo
  admite `http`/`https`.
- **Carpeta de sincronización nativa:** WebKitGTK no tiene File System Access, así que el diálogo
  lo abre Tauri (`tauri-plugin-dialog`) y Rust lee/escribe `mimo-sync.json` de forma atómica
  (temporal + `rename` + verificación). La ruta elegida se recuerda en la configuración de la app;
  la página no elige rutas ni escribe otros archivos. Si se desconoce, la app pide «Elegir carpeta».
- **Sonda:** `MIMO_SONDA=1 ./release/mimo` escribe `MIMO_SONDA_SALIDA` (por
  defecto `/tmp/mimo-sonda.json`) y sale. Mide navegación, nota en `localStorage`, Ajustes y una
  sincronización WebDAV real contra un servidor local. No imprime credenciales. Requiere
  `DISPLAY` o `WAYLAND_DISPLAY`.
- **Gate:** `python3 app/pruebas/gate-tauri.py` comprueba el binario, el RPM, la persistencia, la
  sync nativa contra `app/pruebas/webdav.py` y la ida y vuelta de la carpeta nativa (30 medidas).
  No está en `correr-gates.py` porque necesita compilar y abrir ventana; se corre aparte al cerrar
  U6c.
- Requisitos (Fedora, ya instalados aquí): `cargo` y `cargo-tauri` 2.12, `rpmbuild`,
  `webkit2gtk-4.1`, `javascriptcoregtk-4.1`, `libsoup-3.0`, `librsvg2`, `gtk3` y `fakeroot`.
