# Cambios

## 1.2.0-beta.2 — 2026-10-29

Segunda beta pública. Mantiene todo lo de la beta anterior y añade cambios de uso diario.

### Añadido

- **Colaborar** en Ajustes: compartir Mimo, abrir una discusión en GitHub y apoyar el proyecto
  con una donación.
- **Color por ramo**, editable desde la ficha del ramo. El color se usa en Estudio y tiñe los
  eventos del calendario que llevan ese ramo como contexto.
- **Ficha de la carrera** en Malla: título, universidad y país. Se guarda con la malla y viaja
  en las exportaciones e importaciones.
- Al escribir el contexto de un evento, el calendario sugiere los ramos de la malla.

### Corregido

- Se retiraron explicaciones internas de Ajustes y se reescribieron los textos que hablaban de
  formatos, siglas y detalles de implementación.
- La sección Malla ya no muestra la etiqueta técnica del kit.
- Los textos de sincronización explican qué se cifra y qué no, sin siglas.

### Limitaciones de esta beta

- Los paquetes no están firmados; solo hay `SHA256SUMS`.
- La sincronización con una cuenta real de Tab Digital aún no está probada desde el binario.
- macOS, iOS y Android no están preparados.

## 1.2.0-beta.1 — 2026-10-29

Primera beta pública de Mimo para escritorio.

### Añadido

- Aplicación Tauri 2 para Linux x86_64 y Windows x64.
- Paquetes RPM (Fedora/RHEL), DEB (Debian/Ubuntu) y `PKGBUILD` para Arch Linux.
- Instalador NSIS por usuario para Windows 10/11, con bootstrapper de WebView2.
- Calendario, tareas, notas Markdown, malla, calificaciones, estudio y tiempo.
- Sincronización manual local y WebDAV/Nextcloud cifrada con AES-GCM.
- Temas claros/oscuros, español/inglés/chino y atajos de teclado.
- Historial de 60 pasos con `Ctrl+Z`/`Ctrl+Y`, guardado con `Ctrl+S` y refresco con `Ctrl+R`.
- `tutorial.json` exportable desde la app y **precargado** en el primer arranque y tras
  restablecimiento de fábrica.
- Repositorio e instalación con el nombre **Mimo**; guía de instalación para Fedora, Debian,
  Ubuntu, Arch y Windows.
- Flujo de GitHub Actions que construye Linux, Windows y Arch sin publicar una release.

### Corregido

- El icono nativo de Linux vuelve a mostrarse en el menú y la barra de tareas: un solo
  `Mimo.desktop`, `StartupWMClass=mimo`, sin `enableGTKAppId` y con `_NET_WM_ICON` presente.
- El enlace TLS usa el backend nativo del sistema: OpenSSL en Linux y Schannel en Windows.

### Limitaciones de esta beta

- Los paquetes no están firmados; solo hay `SHA256SUMS`.
- La sincronización con una cuenta real de Tab Digital aún no está probada desde el binario.
- macOS, iOS y Android no están preparados.
- El `tutorial.json` se precarga en la app; en la release queda además como copia importable.
