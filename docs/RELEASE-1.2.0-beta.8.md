# Publicar 1.2.0-beta.8

Estado: **publicada** el 2026-11-05: app web en GitHub Pages y pre-release de escritorio para
Fedora/RHEL, Debian/Ubuntu, Arch Linux y Windows.

## Qué se publicó

- La app web (`app/`) en <https://billibu-n.github.io/Mimo/> mediante
  `.github/workflows/paginas.yml` y Pages con `build_type: workflow`.
- El tag `v1.2.0-beta.8` y el workflow `Empaquetar` (run `42139255116`), que construyó:
  - RPM y DEB en Ubuntu 24.04, con firma GPG del RPM y firma minisign del actualizador;
  - instalador NSIS x64 en Windows;
  - paquete `pkg.tar.zst` en Arch Linux.
- La pre-release `v1.2.0-beta.8` con los paquetes, las firmas `.sig`, `beta.json`, `LEEME.md`,
  `LICENSE`, `tutorial.json` y `SHA256SUMS`.
- El manifiesto `beta.json` en la rama `updates`, endpoint del actualizador.
- Versión `1.2.0-beta.8` en app, escritorio, tutorial y pruebas.

## Gates

```bash
cd ~/sede/proyectos/mimo-nuevo
python3 pruebas/correr-gates.py       # 38/38 en verde
python3 pruebas/gate-release.py --dir publicacion/beta.8
python3 pruebas/gate-tauri.py         # sobre el binario Linux release
```

## Verificación de los assets

```bash
gh release download v1.2.0-beta.8 -D /tmp/mimo-beta8
cd /tmp/mimo-beta8
sha256sum -c SHA256SUMS

# Firma GPG del RPM
rpmkeys --dbpath /tmp/mimo-rpmdb --import \
  ~/sede/proyectos/mimo-nuevo/packaging/rpm/RPM-GPG-KEY-mimo
rpm --dbpath /tmp/mimo-rpmdb --checksig -v Mimo-*.rpm

# Firma minisign del actualizador: debe decir la versión beta.8
base64 -d Mimo-*.rpm.sig | head -3
```

## Reproducir

1. `python3 pruebas/correr-gates.py` en verde.
2. Commit de la versión, las notas y el empaquetado; merge a `main`.
3. `git tag -a v1.2.0-beta.8 -m "Mimo 1.2.0-beta.8"` y `git push origin v1.2.0-beta.8`.
4. Aprobar el deployment del entorno `release` en el workflow `Empaquetar`.
5. Descargar los tres artefactos a `publicacion/beta.8/` y generar `beta.json`.
6. Crear la pre-release con las notas de `docs/releases/RELEASE-NOTES-1.2.0-beta.8.md` y subir
   los assets.
7. Copiar `beta.json` a `updates` y empujar.

## Criterio de cierre

- 38 gates web, `gate-release` y `gate-tauri` en verde.
- RPM con firma GPG `OK` y `.sig` minisign con `version:1.2.0-beta.8`.
- Pre-release con los paquetes, firmas, tutorial, licencia, LEEME, `beta.json` y `SHA256SUMS`
  verificado.
- `beta.json` en `updates` apuntando al tag `v1.2.0-beta.8`.

## Resultado

- 38/38 gates web; `gate-tauri` en 0 choques sobre el binario Linux.
- La pre-release tiene **12 assets** (14 con los dos archivos de fuente que agrega GitHub) y
  `SHA256SUMS` verificado tras descargarlos.
- Las tres firmas minisign declaran `version:1.2.0-beta.8`; el RPM conserva la firma GPG
  `5A25 CB80 9B69 735F 6073 8837 DBAC 7846 2D0B F92A`.
- Pages sirve `1.2.0-beta.8` y el manifiesto de `updates` apunta al tag exacto.
