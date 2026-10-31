# Mimo 1.2.0-beta.5

Mimo es un organizador personal de escritorio que funciona sin conexión: calendario, tareas,
notas, malla, calificaciones, estudio y tiempo. No hay cuenta ni registro, y tus datos viven en
tu equipo.

Esta beta trabaja la **sincronización**: el pie dice cuándo se guardó y cuándo se sincronizó, cada
sincronización deja un comprobante, «En mi Nextcloud» se configura con la dirección del servidor y
se puede autorizar desde el navegador. Además, tamaño de letra en Ajustes, la hora de Alarmas ya
corre y cada bloque tiene su código.

**Si beta.4 te falló al instalar en Fedora, este RPM lo corrige**: la dependencia de glibc estaba
declarada con un nombre que ningún sistema provee.

## Qué descargar

| Sistema | Archivo |
|---|---|
| Fedora 40+ / RHEL 10+ x86_64 | `Mimo-1.2.0-beta.5-1.x86_64.rpm` |
| Debian / Ubuntu amd64 | `Mimo_1.2.0-beta.5_amd64.deb` |
| Arch Linux x86_64 | `mimo-1.2.0beta.5-1-x86_64.pkg.tar.zst` |
| Windows 10/11 x64 | `Mimo_1.2.0-beta.5_x64-setup.exe` |

También se incluyen `tutorial.json`, `LICENSE`, `SHA256SUMS`, las firmas `.sig` de los paquetes
que usa el actualizador y `beta.json` como referencia del manifiesto.

## Instalar

### Fedora 40+ / RHEL 10+

```bash
sudo dnf install ./Mimo-1.2.0-beta.5-1.x86_64.rpm
mimo
```

### Debian / Ubuntu

```bash
sudo apt install ./Mimo_1.2.0-beta.5_amd64.deb
mimo
```

En Debian 13 o Ubuntu 24.04 en adelante. `apt` resuelve las dependencias.

### Arch Linux

```bash
sudo pacman -U ./mimo-1.2.0beta.5-1-x86_64.pkg.tar.zst
mimo
```

### Windows 10/11 x64

Ejecuta `Mimo_1.2.0-beta.5_x64-setup.exe` y sigue el asistente. Se instala para tu usuario y no
pide administrador. Si Windows no tiene WebView2, el instalador lo descarga y pide conexión una
vez.

El instalador no tiene Authenticode. Windows puede mostrar “Windows protegió tu PC”: elige
*Más información* → *Ejecutar de todas formas*.

## Actualizaciones

Abre **Ajustes → Actualizaciones** y pulsa **Buscar actualizaciones**. Mimo consulta un manifiesto
firmado, avisa de la versión nueva, crea un respaldo y la instala en Windows, Fedora/RHEL y
Debian/Ubuntu. La comprobación también ocurre al arrancar y cada 6 horas.

En **Arch Linux** Mimo avisa y abre la página de la release; el plugin de Tauri no puede instalar
un `.pkg.tar.zst` desde la app. Actualiza con `pacman -U` como siempre.

La firma del actualizador es minisign y la valida Mimo. No es la misma que una firma GPG de los
assets.

## Primer arranque

Mimo abre con el **tutorial ya cargado**: la nota **Bienvenido/a a Mimo** y el proyecto **Mimo**
con tareas de ejemplo. No tienes que importar nada.

**Ajustes → Datos → Restablecer de fábrica** deja la app como nueva y vuelve a cargar el tutorial
en el siguiente arranque.

## Verificar la descarga

Cada release publica `SHA256SUMS` y las firmas `.sig`. Descarga `SHA256SUMS` en la misma carpeta
que el paquete y ejecuta:

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

Mimo no tiene una nube propia ni envía información a un servicio del proyecto. La comprobación de
actualizaciones hace una petición HTTPS al manifiesto público de GitHub y se puede desactivar en
Ajustes. Si no configuras una sincronización, tus datos no salen del equipo. La sincronización con
una nube es opcional y guarda una copia cifrada.

## Límites de esta beta

- Arch no se actualiza in-app.
- El instalador de Windows no tiene Authenticode; SmartScreen puede avisar.
- La sincronización con una cuenta real de Tab Digital todavía no se probó desde el binario.
- macOS, iOS y Android no están preparados.

El código, las pruebas y las instrucciones de compilación están en el repositorio. Licencia MIT.
