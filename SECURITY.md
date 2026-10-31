# Seguridad

## Versiones con soporte

Solo la beta publicada más reciente recibe correcciones. `1.2.0-beta.4` es una pre-release.

## Cómo reportar

No abras un issue público con credenciales, datos personales ni una prueba de concepto que
exponga a otras personas. Usa **Security → Report a vulnerability** en GitHub para enviar el
reporte en privado.

Incluye versión, sistema, pasos para reproducir y el impacto. Si el problema está en una
dependencia, indica el paquete y la versión.

## Alcance

- La app guarda los datos en `localStorage`; el archivo manual y la carpeta local quedan en
  claro. WebDAV sube un archivo cifrado con AES-GCM.
- **La contraseña de cifrado no se guarda**; solo su clave derivada (PBKDF2), en IndexedDB. Esa
  misma clave cifra la **contraseña de aplicación** de WebDAV, que sí se guarda en el equipo para
  no pedirla en cada arranque. Quien pueda leer los datos de la app en el disco puede recuperar
  ambas: el cifrado del archivo remoto protege la copia en la nube, no el equipo local.
  «Desconectar» y «Olvidar clave» borran la contraseña de aplicación guardada.
- Los paquetes llevan firma minisign para el actualizador y `SHA256SUMS`. El instalador de Windows no tiene Authenticode; SmartScreen puede avisar. Verifica `SHA256SUMS` antes de instalar.
- El puente HTTP nativo solo acepta `http` y `https`; no hay acceso libre al disco ni shell.
