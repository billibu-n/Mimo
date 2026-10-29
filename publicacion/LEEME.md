# Publicación Mimo 1.2.0-beta.1

Esta carpeta es la **única** que se sube a la release de GitHub. No contiene HTML, código
fuente, prototipos, referencias ni iteraciones anteriores.

## Qué se publica

| Archivo | Plataforma | Estado |
|---|---|---|
| `Mimo-1.2.0-beta.1-1.x86_64.rpm` | Fedora 40+ / RHEL 10+ x86_64 | listo |
| `Mimo_1.2.0-beta.1_amd64.deb` | Debian / Ubuntu amd64 | listo |
| `Mimo_1.2.0-beta.1_x64-setup.exe` | Windows 10/11 x64 (NSIS) | listo |
| `mimo-1.2.0beta.1-1-x86_64.pkg.tar.zst` | Arch Linux x86_64 | listo |
| `tutorial.json` | Todas | listo |
| `LICENSE` | Todas | listo |
| `SHA256SUMS` | Todas | se regenera al publicar |
| `LEEME.md` | Todas | esta guía |

Los paquetes Linux instalan la misma aplicación: `/usr/bin/mimo`, un solo `Mimo.desktop`, los
iconos de hicolor y el metadato AppStream `cl.mimo.escritorio.metainfo.xml`.

## Instalar

### Fedora 40+ / RHEL 10+

```bash
sudo dnf install ./Mimo-1.2.0-beta.1-1.x86_64.rpm
mimo
```

### Debian / Ubuntu

```bash
sudo apt install ./Mimo_1.2.0-beta.1_amd64.deb
mimo
```

`apt` resuelve las dependencias. En Debian 13 o Ubuntu 24.04 en adelante; necesita
`libwebkit2gtk-4.1-0`, `libgtk-3-0` y `libssl3`.

### Windows 10/11 x64

Ejecuta `Mimo_1.2.0-beta.1_x64-setup.exe` y sigue el asistente. Es una instalación por usuario,
sin permisos de administrador. Si Windows no tiene WebView2, el instalador incluye el
bootstrapper y pide conexión para descargarlo.

El instalador **no está firmado**. Windows SmartScreen puede mostrar "Windows protegió tu PC";
es esperado en una beta sin certificado de código.

### Arch Linux

```bash
sudo pacman -U ./mimo-1.2.0beta.1-1-x86_64.pkg.tar.zst
mimo
```

El `PKGBUILD` también está en `packaging/arch/` para compilar desde el tarball del tag.
Todavía **no está en AUR**.

## Cuál es el archivo que se genera

**`publicacion/tutorial.json`** es el original y el que se publica. No hay otra copia y no
hace falta editarlo a mano.

Se genera desde la propia app:

1. Abre Mimo en un perfil limpio. Si ya tiene datos, usa **Ajustes → Datos → Restablecer de fábrica**.
2. Crea las notas y tareas de bienvenida que quieras.
3. Ve a **Ajustes → Datos → Respaldo → Guardar tutorial**.
4. Guarda el archivo como `publicacion/tutorial.json`.
5. Regenera checksums con `sh escritorio/preparar-publicacion.sh`.

El JSON es un respaldo `mimo.backup` normal. La app lo **precarga** en el primer arranque y
después de **Restablecer de fábrica**: abre la nota de bienvenida y el proyecto **Mimo** sin
pedir nada. El archivo de la release queda además como copia importable:

1. Abre **Ajustes → Datos → Respaldo → Importar**.
2. Elige `tutorial.json`.
3. Confirma el reemplazo.

Para cambiar el tutorial de la app hay que reemplazar `app/tutorial.json` por el JSON aprobado,
reconstruir y volver a publicar. `publicacion/tutorial.json` es la copia que se sube a la release;
un gate comprueba que ambos coincidan.

## Icono y nombre en el sistema

Los paquetes Linux instalan **una sola** entrada `Mimo.desktop` con `Name=Mimo`, `Icon=mimo` y
`StartupWMClass=mimo`, los iconos `mimo.png` en hicolor y el metadato AppStream
`cl.mimo.escritorio.metainfo.xml`. La ventana publica `_NET_WM_ICON` con la mascota y el
lanzador declara el mismo nombre de icono; no hay una segunda entrada oculta ni app id GTK que
pueda desviar la asociación. El script de postinstalación refresca las cachés de iconos,
lanzadores y AppStream.

GNOME Software puede mostrar el icono genérico del **archivo RPM o DEB local** antes de
instalarlo; la ficha AppStream se lee al instalar. Después de instalar, cierra y vuelve a abrir
la aplicación.

En Windows el icono sale del `.ico` incluido en el instalador y en el ejecutable.

## Restablecer de fábrica

**Ajustes → Datos → Restablecer de fábrica** borra de este equipo las notas, tareas, malla,
temas y la configuración de sincronización. No toca los archivos que hayas exportado. Al
reabrir, Mimo vuelve a cargar el tutorial incluido en la aplicación.

## Cómo regenerar la publicación

Cada vez que cambies el tutorial, reconstruyas un paquete o descargues los artefactos de
GitHub Actions:

```bash
cd /ruta/a/mimo
sh escritorio/preparar-publicacion.sh
```

El script copia los paquetes que encuentre en `escritorio/release/` (RPM, DEB, instalador
Windows y paquete Arch), valida el JSON, copia `LICENSE` y reescribe `SHA256SUMS`. No toca el
HTML ni copia carpetas históricas. Si falta Windows o Arch, avisa y sigue con lo que haya.

## Verificar

```bash
cd publicacion
sha256sum -c SHA256SUMS
```

## Qué no se publica

- `app/` (HTML/CSS/JS fuente).
- `escritorio/app/` (copia generada).
- `escritorio/release/` (build interno; se copian solo los paquetes).
- `prototipo/`, `referencia/`, `tablero/` y documentos viejos.
- `mimo` binario suelto: los paquetes ya lo contienen. Si se quiere portable, se agrega a
  propósito.

## Firma

El RPM, el DEB y el instalador de Windows siguen **sin firmar**. La release debe declararlo; no
se promete una firma que no existe. La firma de código en Windows y la firma GPG de los
paquetes Linux quedan como huecos hasta que haya claves.
