# Cambios

## 1.2.0-beta.4 — 2026-10-30

### Actualización

- Actualizador in-app con `tauri-plugin-updater`, manifiesto estático en la rama `updates`,
  firma minisign y `requireSignedVersion`.
- Canales `beta` y `stable`; comprobación al arrancar, al volver a la ventana y cada 6 h,
  además del botón manual.
- En Windows NSIS, Linux DEB y Linux RPM la instalación se ofrece desde la app; Arch recibe
  aviso y enlace porque el plugin no instala `.pkg.tar.zst`.
- Respaldo nativo obligatorio antes de instalar; si el respaldo falla, no se instala.

### Datos

- Espejo nativo atómico del estado; si `localStorage` falla por cuota, aparece un aviso
  persistente y se puede exportar o restaurar la copia nativa.
- Respaldo antes de importar, con retención y SHA-256.
- Un respaldo con versión de esquema futura se rechaza en vez de aplicarse.
- La contraseña de aplicación WebDAV ya no se guarda en `localStorage`; queda en la sesión.

### Corregido

- El enlace Linux ya no depende de símbolos privados de WebKitGTK: se buscan en runtime y, si
  no existen, Mimo conserva el límite de 60 fps sin romper la compilación en Ubuntu.
- `version.js` es la fuente única de la versión visible.

### Pruebas

- 19 gates web: se suman `gate-respaldo` y `gate-actualizacion`.
- `gate-release` valida paquetes, firmas y manifiesto.
- `gate-tauri` mide el espejo nativo, el respaldo, el canal de actualización y la tarjeta.

### Limitaciones

- El paquete Arch no se actualiza in-app.
- Windows sin Authenticode puede mostrar SmartScreen.
- La cuenta real de Nextcloud sigue pendiente de una prueba con credenciales del dueño.

## 1.2.0-beta.3 — 2026-10-30

### Arquitectura

- Los bloques ya tienen carpeta propia: `app/js/bloques/<id>/` con vista, ciclo de
  vida y estilos. `index.html` conserva solo el armazón; Calendario, Tareas, Notas,
  Tiempo, Malla, Calificaciones y Estudio se inyectan desde su bloque.
- `MimoRegistro` expone `montar`/`desmontar`, resuelve dependencias `requiere` y
  permite construir el catálogo desde los manifiestos.
- El dominio de cursos y sesiones emite eventos; las mutaciones de la interfaz pasan
  por esas funciones.
- El catálogo tiene ficha presionable y detalle en `#modal-bloque`.
- Notas es el bloque piloto completo: estado, Markdown, vista y `AbortSignal` viven
  en su carpeta.

### Producto

- **Evaluaciones se elimina y desvincula**: fuera del catálogo, del kit Academics,
  del esquema, de las exportaciones y de los estados guardados. No hay una vista
  pendiente con ese nombre.

### Corregido

- El calendario vuelve a mostrar el rail de «Nuevo evento / Contextos / Calendarios»
  en una columna paralela al calendario en escritorio; en móvil sigue en una columna.
- Tiempo, Estudio y las sugerencias del calendario solo ofrecen cursos en estado
  «en curso». Los cursos cerrados dejan de aparecer en esos selectores y tablas;
  sus datos históricos no se borran y Calificaciones los conserva.
- En Ajustes, la tarjeta de colaboración ya no habla de dinero: dice «Colaborar».

### Pruebas

- `gate-bloques` mide el montaje dinámico, el desmontaje, la reinstalación, los
  eventos de dominio y las dependencias.
- `gate-arquitectura` comprueba que las secciones no vuelvan a `index.html`, que
  cada bloque tenga vista y que `evaluaciones` no reaparezca.
- 17 gates web en verde.

## Sin publicar (beta.2)

- La app se empaqueta directamente desde `app/`. Se eliminó la copia `escritorio/app` y el paso
  `preparar-frontend`; las pruebas viven en `pruebas/` y la documentación técnica en `docs/`.
- Los verificadores pueden correr con `MIMO_HEADLESS=1`: la ventana queda fuera de la pantalla y
  de la barra de tareas.
- En Linux, la app deja de acercarse a 60 fps y sigue la tasa del monitor (medido a 145 fps en
  una pantalla de 144 Hz).

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
