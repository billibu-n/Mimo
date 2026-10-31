# Instalar Mimo

Mimo es una aplicación de escritorio. Descarga el archivo de tu sistema desde la
[última release](https://github.com/billibu-n/Mimo/releases/tag/v1.2.0-beta.5), instálalo y ábrelo. No hay
cuenta ni registro.

| Sistema | Archivo | Instalación |
|---|---|---|
| Fedora 40+ / RHEL 10+ x86_64 | `Mimo-1.2.0-beta.5-1.x86_64.rpm` | `sudo dnf install ./Mimo-1.2.0-beta.5-1.x86_64.rpm` |
| Debian 13 / Ubuntu 24.04+ amd64 | `Mimo_1.2.0-beta.5_amd64.deb` | `sudo apt install ./Mimo_1.2.0-beta.5_amd64.deb` |
| Arch Linux x86_64 | `mimo-1.2.0beta.5-1-x86_64.pkg.tar.zst` | `sudo pacman -U ./mimo-1.2.0beta.5-1-x86_64.pkg.tar.zst` |
| Windows 10/11 x64 | `Mimo_1.2.0-beta.5_x64-setup.exe` | Doble clic; instalación por usuario |

## Fedora 40+ / RHEL 10+

```bash
sudo dnf install ./Mimo-1.2.0-beta.5-1.x86_64.rpm
mimo
```

El paquete pide `glibc >= 2.39`, `libwebkit2gtk-4.1` y `libgtk-3`. En Fedora 40 o superior se
resuelven solos. Si el menú no muestra Mimo de inmediato, cierra sesión y vuelve a entrar, o
ejecuta `update-desktop-database ~/.local/share/applications` si instalaste a mano.

## Debian / Ubuntu

```bash
sudo apt install ./Mimo_1.2.0-beta.5_amd64.deb
mimo
```

`apt` resuelve `libc6 (>= 2.39)`, `libssl3`, `libwebkit2gtk-4.1-0` y `libgtk-3-0`. Se probó el
desempaquetado en Debian; Ubuntu 24.04 o superior es el objetivo para WebKitGTK 4.1.

Si `apt` se queja de dependencias, actualiza el sistema y vuelve a intentar:

```bash
sudo apt update
sudo apt install ./Mimo_1.2.0-beta.5_amd64.deb
```

## Arch Linux

```bash
sudo pacman -U ./mimo-1.2.0beta.5-1-x86_64.pkg.tar.zst
mimo
```

El paquete declara `webkit2gtk-4.1`, `gtk3`, `libsoup3`, `openssl`, `cairo`, `pango`,
`gdk-pixbuf2`, `at-spi2-atk`, `librsvg` y `hicolor-icon-theme`. También puedes compilarlo desde
el `PKGBUILD` del repositorio:

```bash
cd packaging/arch
makepkg -si
```

Todavía no está en AUR.

## Windows 10/11

1. Descarga `Mimo_1.2.0-beta.5_x64-setup.exe`.
2. Doble clic. Se instala para tu usuario y crea una entrada en el menú Inicio; no pide
   administrador.
3. Abre **Mimo** desde el menú Inicio.

El instalador incluye el bootstrapper de WebView2. Si Windows no tiene WebView2, necesita
conexión para descargarlo una vez.

> **Aviso de SmartScreen:** el instalador no está firmado. Windows puede decir “Windows protegió
> tu PC”. Pulsa *Más información* → *Ejecutar de todas formas*. No es un error de Mimo: es una
> beta sin certificado de código.

## Primer arranque

La app abre con el **tutorial ya cargado**:

- La nota **Bienvenido/a a Mimo**, que explica cómo usar Mimo y sus secciones.
- El proyecto **Mimo**, con tareas de ejemplo completadas y pendientes.

No tienes que importar ningún archivo. **Ajustes → Datos → Restablecer de fábrica** deja la app
como nueva y vuelve a cargar el tutorial en el siguiente arranque.

## Verificar el archivo

Cada release publica `SHA256SUMS`. Descárgalo en la misma carpeta que el paquete y ejecuta:

```bash
sha256sum -c SHA256SUMS
```

En Windows:

```powershell
certutil -hashfile Mimo_1.2.0-beta.5_x64-setup.exe SHA256
```

Compara la salida con la línea del archivo en `SHA256SUMS`. Si no coincide, no lo instales.

## Desinstalar

```bash
# Fedora 40+ / RHEL 10+
sudo dnf remove mimo

# Debian / Ubuntu
sudo apt remove mimo

# Arch
sudo pacman -R mimo
```

En Windows: **Configuración → Aplicaciones → Mimo → Desinstalar**. Los datos de la app se
eliminan con el restablecimiento de fábrica; los respaldos que hayas exportado no se tocan.

## Problemas comunes

| Síntoma | Qué hacer |
|---|---|
| El menú no muestra Mimo | Cierra sesión y vuelve a entrar; el menú se cachea. |
| El icono se ve genérico | Cierra y vuelve a abrir la app; el paquete refresca las cachés al instalar. |
| Windows bloquea el instalador | *Más información* → *Ejecutar de todas formas*. |
| No abre en Linux | Comprueba `ldd $(command -v mimo)` y que WebKitGTK 4.1 esté instalado. |
| No sincroniza | Revisa la carpeta elegida o la dirección de la nube; la contraseña de cifrado no se guarda. |

## Requisitos y alcance

- Linux x86_64 con glibc 2.39 o superior y WebKitGTK 4.1.
- Windows 10/11 x64 con WebView2.
- No hay versión para macOS, iOS ni Android en esta beta.
- Los paquetes llevan firma minisign para el actualizador y `SHA256SUMS`; el instalador de Windows no tiene Authenticode.

Para compilar desde el código, consulta [escritorio/README.md](escritorio/README.md).
