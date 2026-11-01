# Preparar 1.2.0-beta.6

Estado: **preparado, sin abrir**. La versión del árbol ya está en `1.2.0-beta.6`; los assets se
arman después de empujar el tag.

## Requisitos

- `main` limpio y sincronizado.
- Secretos `RPM_GPG_PRIVATE_KEY` y `RPM_GPG_PASSPHRASE` en el entorno `release`.
- Remoto en `https://github.com/billibu-n/Mimo.git`.

## Archivos que llevan la versión

- `app/js/version.js`
- `app/js/esquema.js` (fallback)
- `app/index.html` (badge y texto de Ajustes)
- `app/tutorial.json` (`appVersion`)
- `escritorio/src-tauri/tauri.conf.json`
- `escritorio/src-tauri/Cargo.toml` y `Cargo.lock`
- `escritorio/src-tauri/metainfo/cl.mimo.escritorio.metainfo.xml`
- `packaging/arch/PKGBUILD`, `.SRCINFO` y `README.md`
- `escritorio/README.md`
- `pruebas/gate-actualizacion.py`, `gate-correcciones.py`, `gate-release.py`, `gate-respaldo.py`,
  `gate-tauri.py`
- `README.md`, `INSTALACION.md`, `COMPATIBILIDAD.md`, `SECURITY.md`

## Abrir la beta

1. `python3 pruebas/correr-gates.py`: **27 gates web** en verde.
2. `python3 pruebas/gate-tauri.py`: verde sobre el binario release.
3. Commit `Rxx: version 1.2.0-beta.6`.
4. `git tag -a v1.2.0-beta.6 -m "Mimo 1.2.0-beta.6"` y `git push origin v1.2.0-beta.6`.
5. Aprobar el deployment del workflow `Empaquetar`.
6. Descargar los artefactos a `publicacion/` (carpeta de montaje, ignorada por git) y ejecutar
   `python3 scripts/updates/generar-manifiesto.py --version 1.2.0-beta.6 --tag v1.2.0-beta.6`.
7. Crear la release como **pre-release** con las notas de
   `docs/releases/RELEASE-NOTES-1.2.0-beta.6.md` y subir los assets.
8. Copiar `beta.json` a la rama `updates` y empujar.
9. Verificar `rpm --checksig` y `sha256sum -c SHA256SUMS`.

## Criterio de cierre

- 27 gates web y `gate-tauri` en verde.
- RPM con firma GPG `OK` y `.sig` minisign con `version:1.2.0-beta.6`.
- Release pre-release con los 11 assets y `SHA256SUMS` verificado.
