# Actualizaciones de Mimo

El actualizador usa `tauri-plugin-updater` y un manifiesto estático en la rama `updates`.
La política vive en Rust (`escritorio/src-tauri/src/actualizaciones.rs`); el WebView solo
pide el canal `beta` o `stable`.

## Canales

| Canal | URL |
|---|---|
| Beta | `https://raw.githubusercontent.com/billibu-n/Mimo/updates/beta.json` |
| Estable | `https://raw.githubusercontent.com/billibu-n/Mimo/updates/stable.json` |

La rama `updates` se protege. No se usa `releases/latest`: todas las releases de Mimo son
pre-release y GitHub devuelve 404 en ese atajo.

## Claves

Hay dos firmas distintas:

1. **minisign de Tauri** para el updater. La clave privada se genera con
   `cargo tauri signer generate -w ~/.config/mimo/updater.key` y **no** se versiona.
   La pública va en `plugins.updater.pubkey`.
2. **GPG opcional** para los assets y `SHA256SUMS`. Es independiente de la anterior; beta.4 no lo usa.

Si se pierde la clave minisign, no se pueden publicar actualizaciones para las versiones
instaladas. Hay que guardar una copia offline y la contraseña en un gestor.

## Publicar

Con los paquetes y las firmas en `publicacion/`:

```bash
python3 scripts/updates/generar-manifiesto.py \
  --version 1.2.0-beta.4 \
  --tag v1.2.0-beta.4 \
  --dir publicacion \
  --out publicacion/beta.json

git switch updates
cp ../publicacion/beta.json beta.json
git add beta.json
git commit -m "updates: beta 1.2.0-beta.4"
git push origin updates
```

El manifiesto solo incluye `windows-x86_64-nsis`, `linux-x86_64-deb` y
`linux-x86_64-rpm`. **No** se incluye `linux-x86_64` genérico ni Arch: si falta una clave,
es mejor que el updater no encuentre target a que entregue un paquete equivocado.

## Firmar en CI

Secretos necesarios:

- `TAURI_SIGNING_PRIVATE_KEY` (ruta o contenido de la clave minisign)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `GPG_PRIVATE_KEY`, `GPG_PASSPHRASE` (opcional, para los assets)

`tauri build` firma los `.deb`, `.rpm` y `.exe` cuando `createUpdaterArtifacts` está activo.
El workflow sube también los `.sig`.

## Verificar

```bash
# Estructura del manifiesto y firmas de los paquetes
python3 pruebas/gate-release.py

# Firma minisign del paquete (la valida el updater al instalar)
# La comprobación criptográfica real se hace en gate-tauri con un manifiesto local
# y en la prueba manual de una versión anterior.

# Firma GPG opcional de los assets (si existe SHA256SUMS.asc)
gpg --verify SHA256SUMS.asc SHA256SUMS
sha256sum -c SHA256SUMS
```

## Límites

- Arch no se actualiza in-app: el plugin no instala `.pkg.tar.zst`.
- Windows sin Authenticode puede mostrar SmartScreen.
- El manifiesto no está firmado; la firma minisign del artefacto y
  `requireSignedVersion` impiden que un manifiesto manipulado apunte a una versión
  distinta de la firmada.
