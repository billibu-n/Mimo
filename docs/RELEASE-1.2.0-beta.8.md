# Publicar 1.2.0-beta.8

Estado: **en preparación**. La app web sale por GitHub Pages y el escritorio como pre-release
para Fedora/RHEL, Debian/Ubuntu, Arch Linux y Windows.

## Qué se publica

- La app web (`app/`) en <https://billibu-n.github.io/Mimo/> mediante
  `.github/workflows/paginas.yml` y Pages con `build_type: workflow`.
- El tag `v1.2.0-beta.8` y el workflow `Empaquetar`, que construye:
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
