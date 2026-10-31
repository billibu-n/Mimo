# Compatibilidad de Mimo 1.2.0-beta.5

Mimo es una aplicación de escritorio Tauri 2. El mismo código y el mismo frontend se empaquetan
para Linux y Windows. Esta tabla dice qué está preparado y qué no.

## Plataformas preparadas

| Sistema | Formato | Arquitectura | Mínimo | Estado |
|---|---|---|---|---|
| Fedora | RPM | x86_64 | Fedora 40 (glibc 2.39) | construido y medido |
| Debian | DEB | amd64 | Debian 13 (glibc 2.41) | construido y medido |
| Ubuntu | DEB | amd64 | Ubuntu 24.04 (glibc 2.39) | construido; se instala con `apt` |
| Arch Linux | `PKGBUILD` | x86_64 | rolling, glibc actual | construido y medido |
| Windows 10/11 | NSIS `.exe` | x64 | WebView2 | construido y medido |

El binario Linux usa símbolos hasta **GLIBC_2.39**. Por eso los paquetes declaran
`glibc >= 2.39` (RPM) y `libc6 (>= 2.39)` (DEB). En un sistema con glibc anterior el paquete
se rechaza al instalar en vez de fallar después al abrir.

Las dependencias de escritorio Linux son **WebKitGTK 4.1**, **GTK 3** y **OpenSSL** (TLS
nativo). No se empaqueta una copia de WebKit: se usa la del sistema, que es la que recibe
parches de seguridad.

## Lo que no está preparado

- **macOS**: no hay `.app` ni `.dmg`. El código no se probó en macOS.
- **iOS y Android**: Tauri 2 puede apuntar a móvil, pero eso no es este proyecto. Requiere
  inicializar las carpetas móviles, permisos, firma, tiendas y una interfaz adaptada. No se
  promete en 1.2.0.
- **Windows ARM64**: solo se prepara x64.
- **AppImage, Flatpak y Snap**: no se incluyen. El RPM y el DEB son los formatos Linux
  soportados; Arch usa su propio `PKGBUILD`.
- **Firma**: los paquetes llevan firma minisign para el actualizador y `SHA256SUMS`. El
  instalador Windows no tiene Authenticode, así que SmartScreen puede avisar.

## Cómo se construye cada uno

### Linux (RPM + DEB)

En un Fedora con las dependencias de Tauri:

```bash
cd escritorio
cargo tauri build --bundles deb,rpm
```

Si el sistema no trae `dpkg-deb`, el DEB se puede construir dentro de un contenedor Debian; el
RPM no necesita nada extra. GitHub Actions lo hace en `ubuntu-24.04` con las dependencias de
Tauri instaladas.

### Windows (NSIS x64)

Se compila **en Windows** o en GitHub Actions (`windows-latest`). No se cruza desde Linux:

```powershell
cd escritorio
tauri build --bundles nsis
```

El instalador es por usuario y no pide administrador. Incluye el bootstrapper de WebView2: si
Windows no lo tiene, el instalador pide conexión para descargarlo.

### Arch Linux

```bash
cd packaging/arch
makepkg -si
```

El `PKGBUILD` compila desde el tarball del tag. Antes de publicar hay que reemplazar
`sha256sums=('SKIP')` por el SHA-256 real del tarball y regenerar `.SRCINFO`. Todavía no está
en AUR.

## Qué mide la puerta

`python3 pruebas/gate-tauri.py` mide el binario Linux real: carga la app, navega, crea
datos, sincroniza por WebDAV y comprueba el RPM. La compilación de Windows y Arch la valida el
flujo de GitHub Actions; no se afirma que se hayan probado en hardware Windows o Arch desde
este equipo Fedora.
