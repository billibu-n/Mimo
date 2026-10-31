# Mimo 1.2.0-beta.2

Segunda beta de **Mimo**, un organizador personal de escritorio que funciona sin conexión:
calendario, tareas, notas Markdown, malla, calificaciones, estudio y tiempo. Los datos viven en
tu equipo; la sincronización con una nube es opcional y va cifrada.

## Descargas

| Plataforma | Archivo |
|---|---|
| Fedora / RHEL x86_64 | `Mimo-1.2.0-beta.2-1.x86_64.rpm` |
| Debian / Ubuntu amd64 | `Mimo_1.2.0-beta.2_amd64.deb` |
| Windows 10/11 x64 | `Mimo_1.2.0-beta.2_x64-setup.exe` |
| Arch Linux x86_64 | `mimo-1.2.0beta.2-1-x86_64.pkg.tar.zst` |
| Todas | `tutorial.json`, `LICENSE`, `SHA256SUMS`, `LEEME.md` |

## Instalar

```bash
# Fedora / RHEL
sudo dnf install ./Mimo-1.2.0-beta.2-1.x86_64.rpm

# Debian / Ubuntu 24.04+
sudo apt install ./Mimo_1.2.0-beta.2_amd64.deb

# Arch Linux
sudo pacman -U ./mimo-1.2.0beta.2-1-x86_64.pkg.tar.zst
```

En Windows, ejecuta el `.exe`. Es una instalación por usuario y no pide administrador.

Los paquetes Linux necesitan **WebKitGTK 4.1** y **GTK 3**, y glibc **2.39** o superior:
Fedora 40+, Ubuntu 24.04+ o Debian 13+. En Windows, el instalador incluye el bootstrapper de
WebView2 y pide conexión si el sistema no lo tiene.

## Qué trae

- Calendario con periodos, semanas, receso, exámenes y agenda.
- Tareas con proyectos, subtareas, prioridades y progreso.
- Notas Markdown GFM con tablas, tareas, código, imágenes y fórmulas LaTeX.
- Malla con ficha de carrera (título, universidad y país) y color editable por ramo.
- Calificaciones, estudio y tiempo.
- Temas claros/oscuros, español/inglés/chino y atajos de teclado.
- Historial de 60 pasos: `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`; `Ctrl+S` guarda/sincroniza y
  `Ctrl+R`/`F5` refresca.
- El color de cada ramo tiñe sus eventos en el calendario.
- Respaldo manual, carpeta local y nube cifrada.
- **Colaborar** en Ajustes: compartir Mimo, abrir una discusión o apoyar el proyecto.
- **Guardar tutorial** y **Restablecer de fábrica** en Ajustes → Datos.

## Novedades de esta beta

- **Colaborar** reúne en Ajustes los enlaces para compartir Mimo, abrir una discusión en GitHub
  y apoyar el proyecto con una donación.
- **Color por ramo**: se elige al crear o editar un ramo. Estudio y el calendario usan ese color.
- **Ficha de carrera**: la malla guarda su título, universidad y país, y los conserva al
  exportar e importar.
- **Textos más claros**: se quitaron explicaciones internas y siglas de la interfaz.

## Tutorial

La app abre con el **tutorial ya cargado**: la nota **Bienvenido/a a Mimo** y el proyecto
**Mimo** con tareas de ejemplo. No hay que importar nada. **Ajustes → Datos → Restablecer de
fábrica** vuelve a dejar la app como nueva y recarga el tutorial en el siguiente arranque.

`tutorial.json` queda también como copia importable en la release, por si quieres llevarlo a
otro equipo o editar sus datos desde la app con **Guardar tutorial**.

## Límites de la beta

- **Sin firma**: RPM, DEB y el instalador de Windows no están firmados. Verifica `SHA256SUMS`.
- La sincronización con una cuenta real de Tab Digital todavía no se probó desde el binario.
- macOS, iOS y Android no están preparados.
- Windows usa un instalador por usuario; no hay otro formato.
- El RPM/DEB se construyó en Fedora 44 y exige glibc 2.39. No pretende correr en distribuciones
  más antiguas.

## Verificar

```bash
sha256sum -c SHA256SUMS
```

El código, los gates y las instrucciones de compilación están en el repositorio. Licencia MIT.
