# Preparar 1.2.0-beta.5

Estado: **preparado, sin abrir**. La versión del árbol sigue en `1.2.0-beta.4` a
propósito: subirla antes de tener los assets deja `gate-release.py` en rojo.

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
- `pruebas/gate-actualizacion.py`, `gate-correcciones.py`, `gate-release.py`,
  `gate-respaldo.py`, `gate-tauri.py`
- `README.md`, `INSTALACION.md`, `COMPATIBILIDAD.md`, `SECURITY.md`

## Abrir la beta

1. Reemplazar `1.2.0-beta.4` por `1.2.0-beta.5` en los archivos anteriores.
2. `python3 pruebas/correr-gates.py` y `python3 pruebas/gate-tauri.py`.
3. Commit `Rxx: version 1.2.0-beta.5`.
4. `git tag -a v1.2.0-beta.5 -m "Mimo 1.2.0-beta.5"` y `git push origin v1.2.0-beta.5`.
5. Aprobar el deployment del workflow.
6. Descargar los artefactos a `publicacion/` y ejecutar
   `python3 scripts/updates/generar-manifiesto.py --version 1.2.0-beta.5 --tag v1.2.0-beta.5`.
7. Crear la release como **pre-release** y subir los assets.
8. Copiar `beta.json` a la rama `updates` y empujar.
9. Verificar `rpm --checksig` y `sha256sum -c SHA256SUMS`.

## Criterio de cierre

- 19 gates web y `gate-tauri` en verde.
- RPM con firma GPG `OK` y `.sig` minisign con `version:1.2.0-beta.5`.
- Release pre-release con 11 assets y `SHA256SUMS` verificado.
