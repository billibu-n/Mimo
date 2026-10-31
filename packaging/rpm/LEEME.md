# Firma RPM de Mimo

Clave pública para verificar los paquetes `.rpm` de Mimo.

- Huella: `5A25 CB80 9B69 735F 6073 8837 DBAC 7846 2D0B F92A`
- Archivo: `RPM-GPG-KEY-mimo`
- Caduca: 2028-10-30

## Importar

    sudo rpm --import https://raw.githubusercontent.com/billibu-n/Mimo/main/packaging/rpm/RPM-GPG-KEY-mimo

Comprueba la huella contra la publicada en el README del proyecto antes de confiar.

## Verificar un paquete

    rpm --checksig -v Mimo-1.2.0-beta.5-1.x86_64.rpm

Debe responder `OK`. Si responde `NOKEY`, la clave no está importada.
