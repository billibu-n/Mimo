# Mimo de escritorio (Tauri 2) — RPM, DEB, Arch y Windows

```bash
cd escritorio
CARGO_TARGET_DIR="$HOME/.cache/mimo-tauri-target" \
  PATH="$HOME/.cargo/bin:$PATH" cargo tauri build --bundles deb,rpm
mkdir -p release
cp "$HOME/.cache/mimo-tauri-target/release/mimo" release/
cp "$HOME/.cache/mimo-tauri-target/release/bundle/rpm/"*.rpm release/
cp "$HOME/.cache/mimo-tauri-target/release/bundle/deb/"*.deb release/
```

Para la release de GitHub, `sh preparar-publicacion.sh` deja en `publicacion/` los paquetes que
encuentre en `release/` (RPM, DEB, instalador Windows y paquete Arch), `tutorial.json`, `LICENSE`,
`SHA256SUMS` y `LEEME.md`. No copia HTML ni carpetas históricas.

`cargo tauri build` usa directamente `<proyecto>/app/` como `frontendDist` (`../../app`). No hay
copia intermedia ni paso de preparación: la app universal es la única fuente.

El binario suelto queda en `release/mimo`. `CARGO_TARGET_DIR` saca la compilación de `~/sede`;
`release/` está ignorado en git y es un enlace a `~/sede/respaldos/mimo-1.2.0-release` para no
gastar el presupuesto de la casa. Los paquetes **no están firmados**; se declara como hueco hasta
que haya claves de firma.

## Windows y Arch

Windows se compila **en Windows**, no se cruza desde Linux:

```powershell
cd escritorio
tauri build --bundles nsis
```

El instalador queda en `src-tauri/target/release/bundle/nsis/`. La configuración
`src-tauri/tauri.windows.conf.json` fija NSIS x64 por usuario e incluye el bootstrapper de
WebView2.

Arch usa `packaging/arch/PKGBUILD`; compila desde el tarball del tag y no necesita el CLI de
Tauri:

```bash
cd packaging/arch
makepkg -si
```

Antes de publicar el `PKGBUILD` hay que cambiar `sha256sums=('SKIP')` por el SHA-256 del tarball
del tag y regenerar `.SRCINFO`.

## Instalar, abrir, desinstalar

```bash
# en un Fedora con permisos de administrador
sudo dnf install ./release/Mimo-1.2.0-beta.2-1.x86_64.rpm
mimo                                   # o desde el menu, como "Mimo"
sudo dnf remove mimo
```

El paquete se llama `mimo` (Tauri deriva el nombre rpm del `productName` en kebab-case); el nombre
visible es "Mimo". Instala `/usr/bin/mimo`, `/usr/share/applications/Mimo.desktop` y los iconos.

## Que hace cada pieza

- `app/` es la **app universal** y la única fuente: `index.html`, `tutorial.json`, `css/`, `js/`,
  `img/` y `vendor/`. Tauri la empaqueta directamente; las pruebas viven en `pruebas/` y la
  documentación técnica en `docs/`, fuera del frontend. Si falta `sync.js`, KaTeX, Markdown,
  Comfortaa o el icono, el build falla.
- `src-tauri/` es el caparazón: `productName` "Mimo", identificador `cl.mimo.escritorio`, ventana
  1280x900 y `bundle.targets` `["deb", "rpm"]`; Windows usa `tauri.windows.conf.json` con NSIS.
- **Sin servidor web:** el protocolo de recursos de Tauri sirve `index.html`, CSS, JS, imágenes,
  KaTeX, marked/DOMPurify y Comfortaa desde `app/`.
- **Puente HTTP nativo:** `http_pedir` (Rust + reqwest) hace GET/PUT/MKCOL/OPTIONS con cabeceras y
  ETag. Existe porque el WebView de Tauri **no exime a `fetch` de CORS**; la petición nativa sí.
  La app lo detecta y lo usa solo dentro de Tauri; en el navegador sigue usando `fetch`. Solo
  admite `http`/`https`.
- **Carpeta de sincronización nativa:** WebKitGTK no tiene File System Access, así que el diálogo
  lo abre Tauri (`tauri-plugin-dialog`) y Rust lee/escribe `mimo-sync.json` de forma atómica
  (temporal + `rename` + verificación). La ruta elegida se recuerda en la configuración de la app;
  la página no elige rutas ni escribe otros archivos. Si se desconoce, la app pide «Elegir carpeta».
- **Sonda:** `MIMO_SONDA=1 ./release/mimo` escribe `MIMO_SONDA_SALIDA` (por
  defecto `/tmp/mimo-sonda.json`) y sale. Mide navegación, fps, nota en `localStorage`, Ajustes y
  una sincronización WebDAV real contra un servidor local. No imprime credenciales. Requiere
  `DISPLAY` o `WAYLAND_DISPLAY`.
- **Headless:** `MIMO_HEADLESS=1 ./release/mimo` coloca la ventana fuera de la pantalla y de la
  barra de tareas. Lo usa `gate-tauri` para no abrir la app encima de la persona.
- **Tasa de pantalla:** en Linux se apaga la preferencia interna de WebKitGTK que acerca la
  página a 60 fps; la app sigue la tasa del monitor (60, 120, 144...). En Windows y macOS la
  tasa ya la marca el sistema.
- **Gate:** `python3 pruebas/gate-tauri.py` comprueba el binario, el RPM, la persistencia, la
  sync nativa contra `pruebas/webdav.py` la ida y vuelta de la carpeta nativa y el tutorial precargado (33 medidas).
  No está en `correr-gates.py` porque necesita compilar y abrir ventana; se corre aparte al cerrar
  U6c.
- Requisitos (Fedora, ya instalados aquí): `cargo` y `cargo-tauri` 2.12, `rpmbuild`,
  `webkit2gtk-4.1`, `javascriptcoregtk-4.1`, `libsoup-3.0`, `librsvg2`, `gtk3` y `fakeroot`.
