# Mimo 1.2.0-beta.2

Mimo es un organizador personal de escritorio que funciona sin conexión: calendario, tareas,
notas, malla, calificaciones, estudio y tiempo. No hay cuenta ni registro, y tus datos viven en
tu equipo.

Esta beta añade **Colaborar** en Ajustes, **color por ramo** (también en el calendario) y la
**ficha de carrera** con título, universidad y país.

## Qué descargar

| Sistema | Archivo |
|---|---|
| Fedora 40+ / RHEL 10+ x86_64 | `Mimo-1.2.0-beta.2-1.x86_64.rpm` |
| Debian / Ubuntu amd64 | `Mimo_1.2.0-beta.2_amd64.deb` |
| Arch Linux x86_64 | `mimo-1.2.0beta.2-1-x86_64.pkg.tar.zst` |
| Windows 10/11 x64 | `Mimo_1.2.0-beta.2_x64-setup.exe` |

También se incluyen `tutorial.json`, `LICENSE` y `SHA256SUMS`.

## Instalar

### Fedora 40+ / RHEL 10+

```bash
sudo dnf install ./Mimo-1.2.0-beta.2-1.x86_64.rpm
mimo
```

### Debian / Ubuntu

```bash
sudo apt install ./Mimo_1.2.0-beta.2_amd64.deb
mimo
```

En Debian 13 o Ubuntu 24.04 en adelante. `apt` resuelve las dependencias.

### Arch Linux

```bash
sudo pacman -U ./mimo-1.2.0beta.2-1-x86_64.pkg.tar.zst
mimo
```

### Windows 10/11 x64

Ejecuta `Mimo_1.2.0-beta.2_x64-setup.exe` y sigue el asistente. Se instala para tu usuario y no
pide administrador. Si Windows no tiene WebView2, el instalador lo descarga y pide conexión una
vez.

El instalador no está firmado. Windows puede mostrar “Windows protegió tu PC”: elige *Más
información* → *Ejecutar de todas formas*.

## Primer arranque

Mimo abre con el **tutorial ya cargado**: la nota **Bienvenido/a a Mimo** y el proyecto **Mimo**
con tareas de ejemplo. No tienes que importar nada.

**Ajustes → Datos → Restablecer de fábrica** deja la app como nueva y vuelve a cargar el tutorial
en el siguiente arranque.

## Verificar la descarga

Cada release publica `SHA256SUMS`. Descárgalo en la misma carpeta que el paquete y ejecuta:

```bash
sha256sum -c SHA256SUMS
```

En Windows puedes usar `certutil -hashfile <archivo> SHA256` y comparar con el archivo.

## Desinstalar

```bash
# Fedora 40+ / RHEL 10+
sudo dnf remove mimo

# Debian / Ubuntu
sudo apt remove mimo

# Arch Linux
sudo pacman -R mimo
```

En Windows: **Configuración → Aplicaciones → Mimo → Desinstalar**. Los respaldos que hayas
exportado no se tocan.

## Privacidad

Mimo no tiene una nube propia ni envía información a un servicio del proyecto. Si no configuras
una sincronización, tus datos no salen del equipo. La sincronización con una nube es opcional y
guarda una copia cifrada; la contraseña de cifrado no se guarda.

## Límites de esta beta

- Los paquetes no están firmados; la integridad se comprueba con `SHA256SUMS`.
- La sincronización con una cuenta real de Tab Digital todavía no se probó desde el binario.
- macOS, iOS y Android no están preparados.

El código, las pruebas y las instrucciones de compilación están en el repositorio. Licencia MIT.
