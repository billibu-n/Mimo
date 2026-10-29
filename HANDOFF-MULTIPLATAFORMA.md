# Handoff — empaquetado multiplataforma

Fecha: 2026-10-29. Estado: **preparado para revisar y subir; nada publicado**.

## Lo que ya está hecho y medido

- **Linux RPM y DEB** construidos con el mismo binario y el mismo frontend:
  - `publicacion/Mimo-1.2.0-beta.1-1.x86_64.rpm`
  - `publicacion/Mimo_1.2.0-beta.1_amd64.deb`
  - Ambos instalan `/usr/bin/mimo`, un solo `Mimo.desktop`, iconos hicolor y AppStream.
  - El DEB se desempaquetó en Debian 12 limpio; el RPM lo mide `gate-tauri`.
- **`gate-tauri` 32/32** con el binario final, incluida la sincronización WebDAV.
- **Icono nativo**: `_NET_WM_ICON` presente, `_GTK_APPLICATION_ID` ausente y un solo
  lanzador. El arreglo quedó en R34 (`5fb146f`).
- **Preparación portable**: `escritorio/preparar-frontend.py` funciona en Linux y Windows;
  `preparar-frontend.sh` queda como envoltorio.
- **DEB**: `bundle.linux.deb` con AppStream, postinstalación y `libc6 >= 2.39`.
- **Windows**: `tauri.windows.conf.json` con NSIS x64 por usuario y bootstrapper de WebView2.
- **Arch**: `packaging/arch/PKGBUILD`, `.SRCINFO`, `mimo.install` y README. Compila desde el
  tarball del tag.
- **CI**: `.github/workflows/empaquetar.yml` construye Linux (DEB+RPM), Windows (NSIS) y, solo
  en tags, Arch. Sube artefactos; **no crea release ni publica nada**.
- **Compatibilidad**: `COMPATIBILIDAD.md` con mínimos, formatos y límites.

## Lo que falta, en orden

1. **Revisar y commitear** estos cambios (el commit se hace al cerrar este handoff).
2. **Probar Windows**: ejecutar el workflow `Empaquetar` con `workflow_dispatch` y descargar
   `windows-nsis-x64`. No se ha compilado Windows desde este Fedora; el CI es la primera
   prueba real.
3. **Arch**: `ring` y `aws-lc-rs` fallaban al enlazar con `lld`. Se cambió `reqwest` a
   **TLS nativo** (OpenSSL en Linux, Schannel en Windows). `makepkg` ya construyó el paquete
   localmente; falta que el CI del tag lo repita y lo suba. El `PKGBUILD` tiene
   `sha256sums=('SKIP')` hasta que exista el tag.
4. **Publicar el tag** `v1.2.0-beta.1` solo con autorización del dueño. El workflow de Arch
   se dispara con el tag.
5. **Reemplazar el checksum de Arch**:
   ```bash
   cd packaging/arch
   URL="https://github.com/billibu-n/mimo-nuevo/archive/refs/tags/v1.2.0-beta.1.tar.gz"
   SUMA=$(curl -L "$URL" | sha256sum | cut -d' ' -f1)
   sed -i "s/^sha256sums=.*/sha256sums=('$SUMA')/" PKGBUILD
   makepkg --printsrcinfo > .SRCINFO
   ```
6. **Reunir artefactos** en `escritorio/release/` (RPM, DEB, `*setup.exe`, `*.pkg.tar.zst`),
   ejecutar `sh escritorio/preparar-publicacion.sh` y verificar `sha256sum -c SHA256SUMS`.
7. **Generar el tutorial real** desde la app (`Ajustes → Datos → Respaldo → Guardar tutorial`)
   antes de la release. `publicacion/tutorial.json` sigue siendo la semilla.
8. **Crear la release** (pre-release, sin firma) solo con autorización. No hay tag ni release
   creados.

## Comandos de construcción

```bash
# Linux
cd escritorio
python3 preparar-frontend.py
CARGO_TARGET_DIR="$HOME/.cache/mimo-tauri-target" \
  PATH="$HOME/.cargo/bin:$PATH" cargo tauri build --bundles deb,rpm

# Windows (PowerShell, en Windows)
cd escritorio
python preparar-frontend.py
tauri build --bundles nsis
```

## Decisiones y límites

- No se cruza Windows desde Linux; se compila en Windows o en GitHub Actions.
- No hay macOS, iOS ni Android preparados. Tauri móvil exige otro alta, firma y tiendas.
- RPM, DEB y Windows van **sin firmar**; solo hay SHA-256.
- El RPM/DEB declara `glibc >= 2.39`; por eso Fedora 40+, Ubuntu 24.04+ y Debian 13+.
- `publicacion/` no lleva HTML ni binario suelto.
