# Mimo

[![Empaquetar](https://github.com/billibu-n/mimo-nuevo/actions/workflows/empaquetar.yml/badge.svg)](https://github.com/billibu-n/mimo-nuevo/actions/workflows/empaquetar.yml)

Mimo es un organizador personal de escritorio: calendario, tareas, notas, malla, calificaciones,
estudio y tiempo, con bloques que se instalan o se quitan sin borrar tus datos. Funciona sin
conexión y puede sincronizarse cifrado por WebDAV/Nextcloud.

La app de escritorio usa **Tauri 2** y se distribuye como RPM y DEB para Linux x86_64, un
`PKGBUILD` para Arch y un instalador NSIS para Windows 10/11 x64. La fuente web está en `app/`;
el caparazón de escritorio, en `escritorio/`. El detalle está en
[`COMPATIBILIDAD.md`](COMPATIBILIDAD.md).

## Estado

**1.2.0-beta.1**, en preparación. Es una pre-release: la sincronización con una cuenta real de
Tab Digital y la firma de los paquetes todavía no están cerradas.

## Instalar

### Fedora / RHEL

```bash
sudo dnf install ./publicacion/Mimo-1.2.0-beta.1-1.x86_64.rpm
mimo
```

### Debian / Ubuntu

```bash
sudo apt install ./publicacion/Mimo_1.2.0-beta.1_amd64.deb
mimo
```

### Arch Linux

Cuando el tag `v1.2.0-beta.1` esté publicado y el `PKGBUILD` tenga su checksum:

```bash
cd packaging/arch
makepkg -si
```

### Windows 10/11 x64

Ejecuta `Mimo_1.2.0-beta.1_x64-setup.exe`. Es una instalación por usuario, sin administrador.
El instalador no está firmado: SmartScreen puede avisar.

En Linux, los paquetes instalan `/usr/bin/mimo`, un solo lanzador `Mimo.desktop`, los iconos y
el metadato AppStream. También se puede abrir desde el menú como **Mimo**.

## Primer arranque

Mimo arranca limpio, sin datos de ejemplo. Para cargar el tutorial:

1. Abre **Ajustes → Datos → Respaldo → Importar**.
2. Elige `tutorial.json`.
3. Confirma.

El tutorial trae notas de bienvenida, tareas iniciales y preferencias. Para dejar la app como
nueva: **Ajustes → Datos → Restablecer de fábrica**. Esa acción borra los datos y la
configuración de ese equipo; no borra los archivos que hayas exportado.

El `tutorial.json` se genera desde la propia app con **Ajustes → Datos → Respaldo → Guardar
tutorial**; no se edita a mano.

## Funciones

- **Calendario** con periodos, semanas, receso, exámenes y agenda.
- **Tareas** con proyectos, subtareas, prioridades y progreso.
- **Notas** en Markdown GFM: títulos, tablas, citas, listas, tareas, código, imágenes,
  `<u>`/`<mark>` y fórmulas LaTeX.
- **Malla** por niveles y prerrequisitos.
- **Calificaciones** con categorías, examen y cierre manual.
- **Estudio** con metas semanales y sesiones.
- **Tiempo** con cronómetro, temporizador, pomodoro y alarmas.
- **Ajustes** con diez temas, español/inglés/chino, respaldo y restablecimiento de fábrica.
- **Sincronización** local primero; WebDAV/Nextcloud cifrado con AES-GCM.

## Datos y privacidad

Los datos viven en `localStorage` del equipo. Nada sale del equipo salvo que configures una
sincronización. El archivo manual y la carpeta local guardan JSON en claro; WebDAV sube un archivo
cifrado. La contraseña de cifrado no se guarda: si se pierde, la copia remota no se puede leer.

## Desarrollo

```bash
# app universal en el navegador
python3 -m http.server 8000 --directory app

# pruebas
python3 app/pruebas/correr-gates.py

# escritorio
cd escritorio
sh preparar-frontend.sh
CARGO_TARGET_DIR="$HOME/.cache/mimo-tauri-target" \
  PATH="$HOME/.cargo/bin:$PATH" cargo tauri build --bundles deb,rpm
```

En Windows, desde PowerShell:

```powershell
cd escritorio
python preparar-frontend.py
tauri build --bundles nsis
```

La app universal es `app/index.html`; `escritorio/app/` es una copia generada y no se edita.
Los atajos y el historial están documentados en [`app/ATAJOS.md`](app/ATAJOS.md).
Los gates web están en `app/pruebas/`; `gate-tauri.py` mide el binario real.

## Publicación

`publicacion/` contiene solo lo que se sube a la release: los paquetes, `tutorial.json`,
`LICENSE`, `SHA256SUMS` y `LEEME.md`. No incluye HTML, prototipos ni iteraciones anteriores.

```bash
sh escritorio/preparar-publicacion.sh
cd publicacion && sha256sum -c SHA256SUMS
```

El flujo [`.github/workflows/empaquetar.yml`](.github/workflows/empaquetar.yml) construye DEB,
RPM, NSIS y el paquete Arch. No crea una release ni publica nada: sube los artefactos para que
el dueño los revise y arme la release a mano.

## Licencia

MIT. Consulta [`LICENSE`](LICENSE).

Las dependencias conservan sus licencias junto al código: KaTeX (MIT), marked (MIT), DOMPurify
(Apache-2.0/MPL-2.0) y Comfortaa (OFL) en `app/vendor/`. La interfaz usa iconografía derivada de
Lucide (ISC/MIT); las notas completas están en `CREDITOS.md`.
