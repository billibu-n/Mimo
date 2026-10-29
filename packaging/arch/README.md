# Arch Linux

`PKGBUILD` compila Mimo desde el tarball del tag y lo instala como paquete nativo. No usa el
binario del RPM ni el instalador de otra distribución.

## Probar en local

```bash
cd packaging/arch
makepkg -si
```

## Antes de publicar en AUR

El `sha256sums` está en `SKIP` porque el tag todavía no existe. Cuando se publique
`v1.2.0-beta.1`:

```bash
cd packaging/arch
URL="https://github.com/billibu-n/mimo/archive/refs/tags/v1.2.0-beta.1.tar.gz"
SUMA=$(curl -L "$URL" | sha256sum | cut -d' ' -f1)
sed -i "s/^sha256sums=.*/sha256sums=('$SUMA')/" PKGBUILD
makepkg --printsrcinfo > .SRCINFO
```

Después se puede enviar `PKGBUILD`, `.SRCINFO` y `mimo.install` a AUR. El paquete se llama
`mimo`, no `mimo-bin`: compila desde fuente.

## Dependencias

`webkit2gtk-4.1`, `gtk3`, `libsoup3`, `openssl`, `cairo`, `pango`, `gdk-pixbuf2`,
`at-spi2-atk`, `librsvg` y `hicolor-icon-theme`. Para compilar: `rust`, `cargo`, `python` y
`pkgconf`.
