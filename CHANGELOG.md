# Cambios

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
- `tutorial.json` exportable desde la app y restablecimiento de fábrica.
- Flujo de GitHub Actions que construye Linux, Windows y Arch sin publicar una release.

### Corregido

- El icono nativo de Linux vuelve a mostrarse en el menú y la barra de tareas: un solo
  `Mimo.desktop`, `StartupWMClass=mimo`, sin `enableGTKAppId` y con `_NET_WM_ICON` presente.
- El enlace TLS usa el backend nativo del sistema: OpenSSL en Linux y Schannel en Windows.

### Limitaciones de esta beta

- Los paquetes no están firmados; solo hay `SHA256SUMS`.
- La sincronización con una cuenta real de Tab Digital aún no está probada desde el binario.
- macOS, iOS y Android no están preparados.
- El `tutorial.json` publicado es una semilla importable; no se carga solo al primer arranque.
