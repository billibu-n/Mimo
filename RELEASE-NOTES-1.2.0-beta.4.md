# Mimo 1.2.0-beta.4

Cuarta beta pública de Mimo. El foco es la actualización desde la propia app y un respaldo que
no falla en silencio.

## Novedades

- **Actualizador incorporado.** Mimo consulta un manifiesto firmado, avisa cuando hay una
  versión nueva y permite instalarla desde Ajustes. En Windows, Fedora/RHEL y Debian/Ubuntu.
- **Canales beta y estable.** La comprobación es automática al arrancar y cada 6 horas; también
  hay un botón manual.
- **Respaldo antes de actualizar.** Si el respaldo nativo no se puede escribir, la instalación
  no empieza.
- **Respaldo antes de importar** y rechazo de respaldos de una versión más nueva.
- **Aviso de almacenamiento lleno.** Si `localStorage` no puede guardar, Mimo lo dice y ofrece
  exportar o restaurar la copia nativa.
- **Contraseña WebDAV más segura.** Ya no se guarda en `localStorage`; se pide al sincronizar.
- **Linux en Ubuntu.** El enlace de WebKitGTK ya no usa símbolos privados y el CI puede
  compilar en Ubuntu 24.04.

## Descargas

| Plataforma | Archivo |
|---|---|
| Fedora / RHEL x86_64 | `Mimo-1.2.0-beta.4-1.x86_64.rpm` |
| Debian / Ubuntu amd64 | `Mimo_1.2.0-beta.4_amd64.deb` |
| Arch Linux x86_64 | `mimo-1.2.0beta.4-1-x86_64.pkg.tar.zst` |
| Windows 10/11 x64 | `Mimo_1.2.0-beta.4_x64-setup.exe` |
| Todas | `tutorial.json`, `LICENSE`, `LEEME.md`, `SHA256SUMS`, firmas `.sig` |

## Actualización

En Windows, Fedora/RHEL y Debian/Ubuntu, Abre **Ajustes → Actualizaciones** y pulsa
**Buscar actualizaciones**. Si hay una versión nueva, Mimo crea un respaldo y la instala.

En Arch, Mimo avisa y abre la página de la release; instala el paquete con `pacman -U` como
siempre. El plugin de Tauri no puede instalar `.pkg.tar.zst` desde la app.

## Limitaciones

- La actualización in-app de Arch no está soportada.
- El instalador de Windows no tiene Authenticode; SmartScreen puede avisar hasta que el
  certificado y el archivo ganen reputación.
- La sincronización con una cuenta Nextcloud real sigue pendiente de una prueba con las
  credenciales del dueño.
- macOS, iOS y Android no están preparados.

## Verificar

```bash
sha256sum -c SHA256SUMS
```

La firma del actualizador es minisign y la valida Mimo. Los assets no llevan GPG en esta beta;
`SHA256SUMS` es la referencia de integridad manual.
