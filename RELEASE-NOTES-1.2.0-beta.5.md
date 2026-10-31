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

## Objetivo

El frente de esta beta es la **sincronización en la nube**. Hoy existe la vía Nextcloud,
pero configurarla no es intuitiva ni fácil. Beta.5 debe ofrecer varias alternativas de
sincronización, incluida la más sencilla, y ninguna de ellas puede exigir conocimientos
de servidor para funcionar.

La firma del RPM entra en esta misma beta.

## Sincronización

- **El pie dice cuándo.** Deja de ser un adorno: muestra el destino y la hora —«Local · 12:03»,
  «Nube · 12:04», «Sin subir · 12:05», «Sincronizando…», «Conflicto»— con un punto de color. El
  título del botón da el detalle (último cambio guardado, última sincronización, destino y último
  error) y un clic abre la tarjeta de sincronización.
- **Comprobante de cada sincronización.** Después de sincronizar se ve qué se movió, cuándo, cuánto
  pesa, cuántas cosas lleva y el identificador del equipo. El botón **«Ver la copia»** lee el
  destino y enseña lo que hay allí: es la respuesta a «¿esto se subió de verdad?».
- **La contraseña de aplicación ya no se pierde.** Se guarda en el equipo cifrada con la misma clave
  que protege la copia, para no tener que escribirla en cada arranque. No es un secreto frente a
  quien pueda leer los datos de la app en el disco; «Desconectar» y «Olvidar clave» la borran. La
  contraseña de cifrado sigue sin guardarse.
- **Los errores dicen qué hacer.** Un 401 explica que la contraseña de aplicación no vale y dónde
  crear una; un 404, cómo termina la dirección de Nextcloud; un 405 o un 507, qué revisar.
- **La tarjeta empieza por la pregunta buena:** «¿Dónde guardar tu copia?», con una pista que
  explica que Dropbox, Google Drive, OneDrive e iCloud se usan eligiendo una carpeta, sin cuentas.
- **«En mi Nextcloud» se configura con la dirección del servidor.** Mimo comprueba que hay un
  Nextcloud, pregunta el perfil y arma la ruta WebDAV (`/remote.php/dav/files/<usuario>/`). Ya no
  hay que saber dónde termina la dirección ni pegar rutas a mano.
- **«Autorizar en el navegador».** Con el Login Flow v2 de Nextcloud, Mimo abre tu navegador, espera
  a que concedas el acceso y recibe el usuario y la contraseña de aplicación sin que los escribas.
  Los campos manuales siguen ahí para servidores que no lo admitan.
- **La contraseña de aplicación va al llavero del sistema** (Secret Service, Credential Manager o
  Llavero) cuando está disponible; si no, al respaldo cifrado de siempre.

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
