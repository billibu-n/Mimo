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

Hay dos firmas distintas y no se sustituyen:

1. **minisign de Tauri** para el updater. La clave privada se genera con
   `cargo tauri signer generate -w ~/.config/mimo/updater.key` y **no** se versiona.
   La pública va en `plugins.updater.pubkey`.
2. **GPG** para el RPM. Identidad `Mimo Releases <billibu@billibu-web.cl>`, huella
   `5A25 CB80 9B69 735F 6073 8837 DBAC 7846 2D0B F92A`, caduca el 2028-10-30.
   La pública está en `packaging/rpm/RPM-GPG-KEY-mimo`. Desde beta.5 el CI firma el
   RPM con ella.

Si se pierde la clave minisign, no se pueden publicar actualizaciones para las versiones
instaladas. Si se pierde la GPG, los usuarios tienen que importar una clave nueva. Ambas
van con copia offline; la GPG además con certificado de revocación.

## Orden de firma del RPM

`rpmsign` escribe la firma GPG en `<paquete>.rpm.sig`, el mismo nombre que usa Tauri para
la firma minisign. Por eso el orden no es opcional:

1. `tauri build` genera el `.rpm` y su `.rpm.sig` minisign.
2. Se borra ese `.sig` y `rpmsign --addsign` inserta la firma GPG en la cabecera.
3. `tauri signer sign --app-version <versión>` regenera el `.sig` minisign sobre el RPM
   ya firmado.

Omitir el paso 3 deja un `.sig` que no corresponde al paquete: el updater rechaza la
actualización. Omitir `--app-version` también la rechaza, porque `requireSignedVersion`
compara la versión firmada con la del manifiesto.

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

El job `linux` declara `environment: release`, con revisión obligatoria: los secretos del
entorno solo se exponen después de aprobar el deployment.

Secretos:

- `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (nivel repo).
- `RPM_GPG_PRIVATE_KEY` y `RPM_GPG_PASSPHRASE` (entorno `release`).

El paso de GPG importa la clave en un `GNUPGHOME` temporal, escribe la passphrase en un
archivo con permisos `600` y ejecuta `rpmsign` a través de un envoltorio de `gpg` con
`--pinentry-mode loopback --passphrase-file`. No depende de `gpg-agent`, que en el runner
no recibía la passphrase.

## Verificar

```bash
# Estructura del manifiesto y firmas de los paquetes
python3 pruebas/gate-release.py

# Firma GPG del RPM
rpmkeys --dbpath /tmp/db --import packaging/rpm/RPM-GPG-KEY-mimo
rpm --dbpath /tmp/db --checksig -v Mimo-*.rpm

# Versión dentro de la firma minisign
base64 -d Mimo-*.rpm.sig | head -3
```

Para el usuario:

```bash
sudo rpm --import https://raw.githubusercontent.com/billibu-n/Mimo/main/packaging/rpm/RPM-GPG-KEY-mimo
sudo dnf install ./Mimo-*.rpm
```

## Límites

- Arch no se actualiza in-app: el plugin no instala `.pkg.tar.zst`.
- Windows sin Authenticode puede mostrar SmartScreen.
- El manifiesto no está firmado; la firma minisign del artefacto y
  `requireSignedVersion` impiden que un manifiesto manipulado apunte a una versión
  distinta de la firmada.
