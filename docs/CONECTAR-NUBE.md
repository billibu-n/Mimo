# Conectar una nube con OAuth (Dropbox y Google Drive)

**Estado:** infraestructura hecha; conectores pendientes de las credenciales.
Fecha: 2026-10-31 · Rama `t/mimo-beta5`.

Mimo ya tiene la mitad que no depende de nadie: una escucha local para recibir la
redirección de OAuth, PKCE en la página y el llavero del sistema para los tokens. Lo que falta
es el **identificador de cliente** de cada proveedor, que solo puede crear el dueño de la cuenta,
y el conector que sube y baja el archivo.

## 1. Qué hay hecho

- **Escucha local** (`oauth_escucha` y `oauth_espera`, en Rust): abre `127.0.0.1:53682`,
  espera una sola petición, saca el `code` de la redirección y contesta una página de «listo».
  Se cierra sola.
- **Puerto fijo 53682**: Dropbox compara la redirección carácter por carácter, así que el puerto
  no puede ser efímero. Los dos proveedores comparten el mismo puerto; no se usan a la vez.
- **Llavero por cuenta**: `llavero_guardar(cuenta, clave)` ya acepta un nombre de cuenta, para
  guardar el token de refresco de cada proveedor junto a la contraseña de WebDAV.

Con eso, el flujo de autorización queda en tres llamadas: pedir puerto, abrir el navegador,
esperar el código. El intercambio del código por tokens es una petición HTTPS normal por el
puente que ya existe.

## 2. Registrar la aplicación en Dropbox (unos 10 minutos)

1. Entrar en <https://www.dropbox.com/developers/apps> y **Create app**.
2. Elegir **Scoped access** y **App folder** (Mimo solo verá su carpeta, no el resto del Dropbox).
3. Poner un nombre, por ejemplo `Mimo`.
4. En **Permissions**, marcar `files.content.read` y `files.content.write`, y guardar.
5. En **OAuth 2 → Redirect URIs**, añadir exactamente:

   ```
   http://127.0.0.1:53682/callback
   ```

6. Copiar el **App key**. No hace falta el App secret: Mimo es un cliente público y usa PKCE.

## 3. Registrar la aplicación en Google (unos 15 minutos)

1. Entrar en <https://console.cloud.google.com/> y crear un proyecto (por ejemplo `Mimo`).
2. **APIs y servicios → Biblioteca**, buscar **Google Drive API** y habilitarla.
3. **Pantalla de consentimiento OAuth**: tipo **External**, nombre de la app, correo de soporte.
   Añadirse como **usuario de prueba**. Queda en estado «Prueba», que es suficiente mientras no
   se publique.
4. **Credenciales → Crear credenciales → ID de cliente OAuth**, tipo **Aplicación de escritorio**.
5. En la credencial, añadir como URI de redirección:

   ```
   http://127.0.0.1:53682/callback
   ```

6. Copiar el **ID de cliente**. El secreto no se usa.

**Sobre la verificación:** Mimo pedirá el permiso `drive.appdata`, que solo da acceso a la carpeta
oculta de la propia aplicación. Ese permiso **no es restringido**: no exige auditoría de seguridad
ni la verificación de permisos. Con la pantalla de consentimiento en «Prueba» funciona para las
cuentas de prueba; para abrirlo a cualquiera habría que publicar la pantalla (trámite de marca,
opcional).

## 4. Dónde van las credenciales

En `app/js/clientes.js`:

```js
window.MimoClientes = {
  dropbox: "",   // App key de Dropbox
  drive: ""      // ID de cliente de Google
};
```

Son valores públicos: viajan en el binario y no son un secreto. No se guardan tokens ni secretos
en el repositorio.

## 5. Qué falta en el código

1. **Conector Dropbox**: bajar y subir `mimo-sync.json.enc` con la revisión (`rev`) para no pisar
   una copia ajena; el resto del motor no cambia.
2. **Conector Google Drive**: buscar o crear el archivo en `appDataFolder` y actualizarlo con
   `If-Match`.
3. **Paneles**: una tarjeta por proveedor con un botón de autorización, como la de Nextcloud.
4. **Medida**: un proveedor falso en `pruebas/` que imite la autorización y el almacenamiento, para
   que el flujo completo se mida en CI sin cuentas reales.

## 6. Lo que no cambia

- El archivo sigue **cifrado en el equipo** con AES-GCM antes de salir: la nube guarda
  `mimo-sync.json.enc`, no los datos.
- El motor de sincronización (snapshot, cola, conflicto) es el mismo; solo cambia el transporte.
- Las credenciales van al **llavero del sistema** y se borran al desconectar.

## 7. Riesgos conocidos

- **Puerto ocupado**: si otro programa usa el 53682, la autorización falla con un mensaje claro;
  basta cerrar lo que lo ocupa.
- **Dropbox en desarrollo**: hasta 500 usuarios; la revisión no se pide hasta tener 50.
- **Google en prueba**: solo las cuentas añadidas como usuarios de prueba pueden autorizar.
- **Identificador público**: en un proyecto open source el `client_id` se puede reutilizar; se
  vigila la cuota, no se puede impedir.
