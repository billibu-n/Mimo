# Seguridad

## Versiones con soporte

Solo la beta publicada más reciente recibe correcciones. `1.2.0-beta.3` es una pre-release.

## Cómo reportar

No abras un issue público con credenciales, datos personales ni una prueba de concepto que
exponga a otras personas. Usa **Security → Report a vulnerability** en GitHub para enviar el
reporte en privado.

Incluye versión, sistema, pasos para reproducir y el impacto. Si el problema está en una
dependencia, indica el paquete y la versión.

## Alcance

- La app guarda los datos en `localStorage`; el archivo manual y la carpeta local quedan en
  claro. WebDAV sube un archivo cifrado y la contraseña no se guarda.
- Los paquetes de esta beta no están firmados. Verifica `SHA256SUMS` antes de instalar.
- El puente HTTP nativo solo acepta `http` y `https`; no hay acceso libre al disco ni shell.
