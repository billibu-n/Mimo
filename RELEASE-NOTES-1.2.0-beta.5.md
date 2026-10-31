# Mimo 1.2.0-beta.5

Estado: **borrador**. No publicada. Fecha por definir.

## Firma del RPM

- El RPM se firma con GPG en CI, con la clave `Mimo Releases <billibu@billibu-web.cl>`
  (huella `5A25 CB80 9B69 735F 6073 8837 DBAC 7846 2D0B F92A`, caduca el 2028-10-30).
- Clave pública: `packaging/rpm/RPM-GPG-KEY-mimo`.
- Verificación antes de instalar:

  ```bash
  sudo rpm --import https://raw.githubusercontent.com/billibu-n/Mimo/main/packaging/rpm/RPM-GPG-KEY-mimo
  rpm --checksig -v Mimo-1.2.0-beta.5-1.x86_64.rpm
  ```

- Después de la firma GPG se regenera el `.rpm.sig` de minisign con la versión
  incrustada, para que el actualizador siga aceptando el paquete.
- Beta.4 queda como se publicó: sin firma GPG.

## Sin cambios funcionales

Esta beta no cambia bloques, datos ni esquema. El objetivo es estrenar la cadena de firma
y comprobar la actualización in-app desde beta.4.

## Instalación

| Sistema | Archivo |
|---|---|
| Windows | `Mimo_1.2.0-beta.5_x64-setup.exe` |
| Fedora / openSUSE | `Mimo-1.2.0-beta.5-1.x86_64.rpm` |
| Debian / Ubuntu | `Mimo_1.2.0-beta.5_amd64.deb` |
| Arch | `mimo-1.2.0beta.5-1-x86_64.pkg.tar.zst` |

## Límites

- Arch recibe aviso y enlace; el plugin no instala `.pkg.tar.zst`.
- Windows sin Authenticode puede mostrar SmartScreen.
