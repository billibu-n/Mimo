# Mimo

[![Versión](https://img.shields.io/github/v/release/billibu-n/mimo?include_prereleases&label=versi%C3%B3n&color=16a34a)](https://github.com/billibu-n/Mimo/releases/tag/v1.2.0-beta.5)
[![Plataforma](https://img.shields.io/badge/plataforma-Linux%20%7C%20Windows-2563eb)](#descargar)
[![Licencia](https://img.shields.io/badge/licencia-MIT-3da639)](LICENSE)

**Mimo** es un organizador personal de escritorio que funciona **sin conexión**. Reúne
calendario, tareas, notas, malla, calificaciones, estudio y tiempo en una sola aplicación. Tú
decides qué bloques usar: la interfaz se adapta a ti, no al revés.

No hay cuenta, no hay nube propia y no se envía nada a un servidor. Tus datos viven en tu equipo.

## Descargar

[![Descargar la última versión](https://img.shields.io/badge/Descargar_la_%C3%BAltima_versi%C3%B3n-16a34a?style=for-the-badge&logo=github&logoColor=white)](https://github.com/billibu-n/Mimo/releases/tag/v1.2.0-beta.5)

**Descarga → instala → abre.** No necesitas cuenta ni configurar nada para empezar.

| Tu sistema | Archivo | Cómo instalarlo |
|---|---|---|
| **Fedora 40+ / RHEL 10+** | [Mimo-1.2.0-beta.5-1.x86_64.rpm](https://github.com/billibu-n/Mimo/releases/download/v1.2.0-beta.5/Mimo-1.2.0-beta.5-1.x86_64.rpm) | `sudo dnf install ./Mimo-1.2.0-beta.5-1.x86_64.rpm` |
| **Debian / Ubuntu 24.04+** | [Mimo_1.2.0-beta.5_amd64.deb](https://github.com/billibu-n/Mimo/releases/download/v1.2.0-beta.5/Mimo_1.2.0-beta.5_amd64.deb) | `sudo apt install ./Mimo_1.2.0-beta.5_amd64.deb` |
| **Arch Linux** | [mimo-1.2.0beta.5-1-x86_64.pkg.tar.zst](https://github.com/billibu-n/Mimo/releases/download/v1.2.0-beta.5/mimo-1.2.0beta.5-1-x86_64.pkg.tar.zst) | `sudo pacman -U ./mimo-1.2.0beta.5-1-x86_64.pkg.tar.zst` |
| **Windows 10/11 x64** | [Mimo_1.2.0-beta.5_x64-setup.exe](https://github.com/billibu-n/Mimo/releases/download/v1.2.0-beta.5/Mimo_1.2.0-beta.5_x64-setup.exe) | Doble clic. Se instala por usuario, sin administrador. |

Los paquetes Linux necesitan **WebKitGTK 4.1** y **GTK 3**, y glibc **2.39** o superior. En
Windows, el instalador incluye el bootstrapper de WebView2 y pide conexión si el sistema no lo
tiene.

> **Windows SmartScreen:** el instalador no tiene Authenticode, así que puede aparecer “Windows protegió
> tu PC”. Elige *Más información* → *Ejecutar de todas formas*. Es una beta sin certificado de
> código; puedes comprobar el archivo con `SHA256SUMS`.

La guía completa —requisitos, verificación, desinstalación y problemas comunes— está en
[INSTALACION.md](INSTALACION.md).

## Actualizaciones

Mimo revisa si hay una versión nueva al arrancar, al volver a la ventana y cada 6 horas; también
puedes pulsar **Ajustes → Actualizaciones → Buscar actualizaciones**. Si hay una, crea un respaldo
y la instala en Windows, Fedora/RHEL y Debian/Ubuntu. En Arch, avisa y abre la release: el
actualizador no instala `.pkg.tar.zst` desde la app.

La firma del actualizador es minisign y la valida Mimo. No es la misma que una firma GPG.

## Primer arranque

Mimo abre con el **tutorial ya cargado**: la nota **Bienvenido/a a Mimo** y el proyecto
**Mimo** con tareas de ejemplo. No tienes que importar nada.

- La nota explica qué es Mimo, cómo funcionan los bloques y qué puedes hacer con Markdown.
- El proyecto **Mimo** muestra tareas completadas y pendientes; puedes marcar, editar o borrar
  cualquiera.
- **Ajustes → Datos → Restablecer de fábrica** vuelve a dejar la app como nueva y recarga el
  tutorial en el siguiente arranque.

Si prefieres empezar en blanco, borra las tareas y la nota desde la propia app.

## Qué incluye

- **Calendario** con periodos, semanas, receso, exámenes y agenda.
- **Tareas** con proyectos, subtareas, prioridades y progreso automático.
- **Notas** en Markdown GFM: títulos, tablas, citas, listas de tareas, código, imágenes,
  `<u>`/`<mark>` y fórmulas LaTeX.
- **Malla** por niveles y prerrequisitos, con el título, la universidad y el país de tu carrera.
- **Calificaciones** con categorías, examen y cierre manual.
- **Estudio** con metas semanales, sesiones y un color por ramo.
- **Tiempo** con cronómetro, temporizador, pomodoro y alarmas.
- **Temas** claros y oscuros, español/inglés/chino y atajos de teclado.
- **Colores por ramo** que también tiñen sus eventos en el calendario.
- **Historial** de 60 pasos: `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`; `Ctrl+S` guarda y `Ctrl+R`
  refresca.
- **Sincronización** con carpeta local o una nube compatible, siempre cifrada.

## Datos y privacidad

Los datos viven en el equipo. El archivo manual y la carpeta local no están cifrados; la nube
guarda una copia cifrada. La contraseña de cifrado no se guarda: si se pierde, la copia remota no
se puede leer.

Mimo no tiene una nube propia ni envía información a un servicio del proyecto. Si no configuras
una sincronización, tus datos no salen del equipo.

## Verificar la descarga

Cada release publica `SHA256SUMS`. Descárgalo junto al paquete y comprueba:

```bash
sha256sum -c SHA256SUMS
```

En Windows puedes usar `certutil -hashfile <archivo> SHA256` y comparar con el archivo.

## Desarrollo

La app universal está en `app/`; el caparazón Tauri, en `escritorio/`.

```bash
# app en el navegador
python3 -m http.server 8000 --directory app

# pruebas
python3 pruebas/correr-gates.py

# escritorio Linux (RPM y DEB)
cd escritorio
cargo tauri build --bundles deb,rpm
```

En Windows:

```powershell
cd escritorio
tauri build --bundles nsis
```

El empaquetado de Linux, Windows y Arch está en
[`.github/workflows/empaquetar.yml`](.github/workflows/empaquetar.yml). La matriz de plataformas y
los límites están en [COMPATIBILIDAD.md](COMPATIBILIDAD.md).

## Colaborar

Mimo es libre y no pide cuentas. Puedes ayudar de tres formas:

- [Compartir Mimo](https://github.com/billibu-n/Mimo) con quien lo necesite.
- [Abrir una discusión](https://github.com/billibu-n/Mimo/discussions) para contar qué te falta
  o qué mejorarías.
- [Apoyar el proyecto con una donación](https://buymeacoffee.com/billibu).

También puedes reportar un error o proponer una idea con las plantillas de GitHub, y revisar
[CONTRIBUTING.md](CONTRIBUTING.md) si quieres aportar código. Para temas de seguridad, usa
[SECURITY.md](SECURITY.md).

## Licencia

MIT. Consulta [LICENSE](LICENSE).

Las dependencias conservan sus licencias junto al código: KaTeX (MIT), marked (MIT), DOMPurify
(Apache-2.0/MPL-2.0) y Comfortaa (OFL) en `app/vendor/`. La iconografía deriva de Lucide
(ISC/MIT); los avisos están en [CREDITOS.md](CREDITOS.md).
