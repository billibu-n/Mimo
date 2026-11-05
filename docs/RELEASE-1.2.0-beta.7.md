# Publicar 1.2.0-beta.7

Estado: **publicada** el 2026-11-05: app web en GitHub Pages y pre-release de escritorio para
Fedora/RHEL, Debian/Ubuntu, Arch Linux y Windows.

## Qué se publicó

- La app web (`app/`) en <https://billibu-n.github.io/Mimo/> mediante
  `.github/workflows/paginas.yml` y Pages con `build_type: workflow`.
- El tag `v1.2.0-beta.7` y el workflow `Empaquetar` (run `42070731708`), que construyó:
  - RPM y DEB en Ubuntu 24.04, con firma GPG del RPM y firma minisign del actualizador;
  - instalador NSIS x64 en Windows;
  - paquete `pkg.tar.zst` en Arch Linux.
- La pre-release `v1.2.0-beta.7` con los paquetes, las firmas `.sig`, `beta.json`, `LEEME.md`,
  `LICENSE`, `tutorial.json` y `SHA256SUMS`.
- El manifiesto `beta.json` en la rama `updates`, que es el endpoint del actualizador.
- Versión `1.2.0-beta.7` en app, escritorio, tutorial y pruebas.

## Gates

```bash
cd ~/sede/proyectos/mimo-nuevo
python3 pruebas/correr-gates.py       # 32/32 en verde
python3 pruebas/gate-release.py --dir publicacion/beta.7
python3 pruebas/gate-tauri.py         # sobre el binario Linux release
```

## Verificación de los assets

```bash
gh release download v1.2.0-beta.7 -D /tmp/mimo-beta7
cd /tmp/mimo-beta7
sha256sum -c SHA256SUMS

# Firma GPG del RPM
rpmkeys --dbpath /tmp/mimo-rpmdb --import \
  ~/sede/proyectos/mimo-nuevo/packaging/rpm/RPM-GPG-KEY-mimo
rpm --dbpath /tmp/mimo-rpmdb --checksig -v Mimo-*.rpm

# Firma minisign del actualizador: debe decir la versión beta.7
base64 -d Mimo-*.rpm.sig | head -3
```

## Reproducir

1. `python3 pruebas/correr-gates.py` en verde.
2. Commit de la versión y del empaquetado.
3. `git tag -a v1.2.0-beta.7 -m "Mimo 1.2.0-beta.7"` y `git push origin v1.2.0-beta.7`.
4. Aprobar el deployment del entorno `release` en el workflow `Empaquetar`.
5. Descargar los tres artefactos a `publicacion/beta.7/` y generar `beta.json`.
6. Crear la pre-release con las notas de `docs/releases/RELEASE-NOTES-1.2.0-beta.7.md` y subir
   los assets.
7. Copiar `beta.json` a `updates` y empujar.

## Criterio de cierre

- 32 gates web, `gate-release` y `gate-tauri` en verde.
- RPM con firma GPG `OK` y `.sig` minisign con `version:1.2.0-beta.7`.
- Pre-release con los 12 assets y `SHA256SUMS` verificado.
- `beta.json` en `updates` apuntando al tag `v1.2.0-beta.7`.
