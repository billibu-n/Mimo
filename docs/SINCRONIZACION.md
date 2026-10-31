# Sincronización en Mimo — estado, alternativas y plan

**Fecha:** 2026-10-31 · **Ámbito:** observación y planificación. No cambia código.
**Base:** `t/mimo-beta5` desde `main` (`a297b16`), versión `1.2.0-beta.4`.
**Qué se leyó:** `app/js/sync.js` (1.061 líneas), la tarjeta de Ajustes en `app/index.html`, el
puente `http_pedir` en `escritorio/src-tauri/src/main.rs`, los gates `gate-sync.py` y
`gate-webdav.py`, y los entregables de la iteración anterior en la oficina
(`SYNC-SP-REA.md`, `HANDOFF-SYNC-FASE2-2026-10-28.md`, `PENDIENTES.md`).
**Qué se midió:** el Nextcloud real del dueño (Tab Digital), desde fuera y sin credenciales.
**Qué no se hizo:** no se ejecutó la app contra una cuenta real ni se modificó una línea de código.

---

## 0. Resumen para decidir

1. **El motor no es el problema; el recorrido sí.** La sincronización de Mimo funciona: cifra,
   usa ETag, reintenta sin red y no aplica texto claro. Lo que falla es que, para llegar a ella,
   el usuario tiene que construir una URL de WebDAV, crear una contraseña de aplicación en otra
   interfaz, pegarla y **volver a pegarla cada vez que abre la app**.
2. **La alternativa más sencilla no es integrar ninguna nube: es no integrar ninguna.** Dejar que
   Mimo escriba en una carpeta que el cliente oficial de la nube ya sincroniza (Dropbox, Drive,
   OneDrive, iCloud) elimina credenciales, registro de apps y OAuth. Es el camino con menos
   fricción y también el que más cuidado exige (un solo escritor).
3. **Google es más fácil de lo que parece; iCloud no lo es en absoluto.** Con un permiso que solo
   toca los ficheros de la app (`drive.file` o `drive.appdata`), Google **no exige** la verificación
   de permisos restringidos ni la auditoría CASA, y el tope de cien usuarios no aplica. iCloud no
   tiene API pública de iCloud Drive: CloudKit Web Services existe, pero pide cuenta de desarrollador
   de Apple, contenedor propio y sirve solo a usuarios con Apple ID.
4. **Se puede quitar casi toda la fricción de Nextcloud sin tocar el motor.** El servidor del
   dueño acepta el *Login Flow v2*: Mimo abre el navegador, el usuario aprueba y recibe usuario y
   contraseña de aplicación sin escribir nada. Medido hoy contra `noa.it.tabdigital.cloud`.
5. **Antes de añadir proveedores hay que arreglar tres cosas del modelo**, o cada proveedor nuevo
   multiplicará los mismos defectos: guardar la contraseña en el llavero del sistema, hacer el
   cifrado opcional con código de recuperación, y fusionar por campo en vez de elegir entre todo
   local y todo remoto.

**Hecho ya en esta rama:** la señal del pie con la hora del último cambio y de la última
sincronización, el comprobante de cada sincronización, el botón «ver la copia», los mensajes de
error traducidos a acciones y la tarjeta que empieza preguntando dónde guardar. Todo medido con
`gate-senal.py` y los 20 gates en verde.

**Recomendación en una frase:** tres destinos para el usuario —«una carpeta», «tu nube» y «otro
servidor»—, con el motor actual detrás y tres arreglos previos; los proveedores con OAuth entran
después, uno por uno y solo si el flujo se prueba contra una cuenta real.

---

## 1. Lo que hay hoy, medido

### 1.1 Arquitectura

```
localStorage (mimo.shell.v1)  ──snapshot──►  sobre "mimo-sync"  ──cifrado AES-GCM──►  destino
        ▲                                        │                     │
        └──── aplicar si el remoto es más nuevo ─┘                     ├─ WebDAV  (mimo-sync.json.enc)
                                                                       ├─ carpeta (mimo-sync.json)
                                                                       └─ archivo (descarga/carga)
```

- **Un solo fichero con el estado completo** (`estado` = tareas, notas, eventos, cursos, periodos,
  sesiones, prefs…). No hay registro de operaciones ni vectores de reloj.
- **Tres modos** en el desplegable: «Nube privada (cifrada)» (WebDAV), «Carpeta local» y
  «Archivo manual».
- **WebDAV** con Basic auth, `MKCOL` de la carpeta, `If-None-Match: *` al crear y `If-Match` al
  actualizar; si el servidor no da ETag, relee y compara el hash antes de escribir.
- **Cifrado obligatorio** en WebDAV: PBKDF2-SHA-256 (250.000 iteraciones) + AES-GCM-256. La clave
  derivada se guarda en IndexedDB; la contraseña no se guarda. El remoto es `mimo-sync.json.enc`;
  si alguien deja un `mimo-sync.json` en claro, Mimo se niega a aplicarlo.
- **Cola persistente** (`mimo.sync.cola.v1`) con reintento creciente (5 s, 15 s, 1 min, 3 min,
  5 min) y sincronización al volver la red, aunque el modo sea manual.
- **Conflicto**: diálogo local/remoto con fechas y cuentas, «Usar local» o «Usar remoto», respaldo
  en `mimo.sync.backup` antes de aplicar. No hay fusión por campo.
- **CORS**: en navegador, `file://` manda `Origin: null` y el Nextcloud real lo rechaza; en Tauri
  la petición la hace Rust (`http_pedir`, reqwest, 25 s de espera, cuerpo de texto) y el problema
  desaparece. Esto ya está construido y es la razón por la que la beta.4 es una app de escritorio.

### 1.2 El recorrido del usuario, paso a paso

Para sincronizar por primera vez con Nextcloud, hoy:

| # | Qué hace el usuario | Dónde | Fricción |
|---|---|---|---|
| 1 | Elige «Nube privada (cifrada)» | Ajustes | Baja: el nombre no dice Nextcloud |
| 2 | Escribe la **dirección** | Ajustes | **Alta**: debe ser la raíz WebDAV con su usuario dentro (`https://servidor/remote.php/dav/files/USUARIO/`), no la página de inicio. Si se equivoca: `HTTP 404`. |
| 3 | Escribe el **usuario** | Ajustes | Media: en Nextcloud el usuario no es el correo |
| 4 | Va a Nextcloud y **crea una contraseña de aplicación** | Otra interfaz | **Alta**: hay que saber que existe y dónde está |
| 5 | La pega | Ajustes | Media |
| 6 | Escribe la **carpeta remota** | Ajustes | Baja: viene «Mimo» |
| 7 | **Inventa una contraseña de cifrado** | Ajustes | **Alta**: sin recuperación, sin pista, sin comprobación |
| 8 | Pulsa «Guardar clave» | Ajustes | Baja |
| 9 | Pulsa «Probar conexión» | Ajustes | Baja, si acertó en 2–5 |
| 10 | Pulsa «Sincronizar ahora» | Ajustes o cabecera | Baja |
| 11 | **Al reabrir la app, vuelve a escribir la contraseña de aplicación** | Ajustes | **Alta**: la contraseña vive en `sessionStorage` |

Nueve decisiones, dos secretos, uno de ellos creado fuera de la app y otro que no se puede
recuperar. Y un paso 11 que el usuario descubre días después, cuando la sincronización falla sin
que haya cambiado nada.

### 1.3 Lo que ya está bien y no hay que tocar

- **Escritura atómica**: se escribe en temporal y se renombra (carpeta nativa en Rust).
- **Concurrencia optimista**: ETag e `If-Match`; con `412` se relee y se reintenta una vez.
- **Sin red no se pierde nada**: el cambio local manda y la cola reintenta.
- **Anti-downgrade**: un remoto sin cifrar no se aplica nunca.
- **Respaldo antes de pisar**: `mimo.sync.backup` guarda el estado anterior al conflicto.
- **Cobertura**: `gate-webdav` mide 30 casos (sin clave no sube, remoto cifrado, primera escritura
  condicional, segundo equipo, sin red, conflicto, clave mala, remoto corrupto).
- **El puente nativo es genérico**: `http_pedir` acepta cualquier método y cabeceras, así que un
  proveedor REST nuevo no necesita Rust nuevo, solo JS.

### 1.4 Los siete problemas que hay que nombrar

| # | Problema | Síntoma que ve el usuario | Dónde nace |
|---|---|---|---|
| P1 | La dirección es una URL de WebDAV construida a mano | «El servidor rechazó las credenciales (HTTP 401)» o un 404 sin relación | `meta.webdav.url` se usa tal cual |
| P2 | La contraseña de aplicación no se guarda | Después de reiniciar, la sync falla hasta reescribirla | `claveAcceso` en `sessionStorage` |
| P3 | Cifrado obligatorio, sin recuperación | «Contraseña de cifrado incorrecta» y el remoto queda ilegible para siempre | `necesitaClave()` / `derivarClave()` |
| P4 | Conflicto de todo o nada | Dos cambios en campos distintos obligan a tirar uno de los dos lados | `procesarRemoto()` compara hashes globales |
| P5 | Solo hay servidor propio | Quien no tiene Nextcloud no tiene nube | un solo proveedor |
| P6 | Los mensajes son técnicos | «WebDAV respondió HTTP 412 al escribir» | `webdavLeer/Escribir` |
| P7 | Un fichero, todo el estado | Cada cambio sube el dataset completo | formato `mimo-sync` v1 |

P7 hoy no duele: el estado del dueño son unos cientos de KB. Duele el día que haya fotos, adjuntos
o años de historial. Conviene tenerlo escrito antes de que duela.

---

## 2. El mapa de alternativas

### 2.1 Cinco familias, no veinte proveedores

| Familia | Idea | Ejemplos | Quién configura qué |
|---|---|---|---|
| **A. Servidor del usuario** | El usuario ya tiene WebDAV | Nextcloud, ownCloud, Synology, mailbox.org, HiDrive | El usuario: URL y credenciales |
| **B. API de una nube** | Mimo habla la API del proveedor | Google Drive, Dropbox, OneDrive, Box, pCloud | El proyecto registra una app; el usuario solo autoriza |
| **C. La nube sin integrarla** | Mimo escribe en una carpeta que otro programa sincroniza | Dropbox/Drive/OneDrive/iCloud de escritorio, Syncthing, Mega | El usuario: elegir carpeta |
| **D. Servicio propio de Mimo** | Una cuenta de Mimo con servidor detrás | Supabase, PocketBase, servidor propio | El proyecto paga y opera |
| **E. Dispositivo a dispositivo** | Los equipos se hablan sin nube | Syncthing, LAN + QR, relay | El usuario: emparejar una vez |

Las familias no compiten: se suman. La pregunta no es «¿cuál?» sino «¿en qué orden y con qué
motor detrás?».

### 2.2 Criterios con los que se decide

1. **Pasos hasta la primera sincronización correcta.** Es la métrica que el dueño pidió mejorar.
2. **Qué le impone al proyecto**: registrar una app, someterse a verificación, pagar, operar
   servidores, mantener un cliente OAuth.
3. **Dependencia**: qué pasa si el proveedor cambia de política o cierra la API.
4. **Calidad del conflicto**: ¿permite fusionar por campo o solo elegir un lado?
5. **Si sirve para el futuro móvil**: Android y otros escritorios.
6. **Esfuerzo de ingeniería** con el código que ya existe.

### 2.3 Comparación de familias

| Familia | Pasos | Impone al proyecto | Dependencia | Conflicto | Móvil futuro | Esfuerzo |
|---|---|---|---|---|---|---|
| A. Servidor del usuario | 3 si hay login guiado; 9 si es a mano | Nada | Baja (protocolo abierto) | Depende del motor | Sí | Bajo |
| B. API de nube | 1–2 (botón «Autorizar») | Registro de app, a veces verificación | **Alta** | Depende del motor | Sí | Medio-alto |
| C. Carpeta ya sincronizada | 1 (elegir carpeta) | Nada | Ninguna (es una carpeta) | **Pobre**: dos escritores | Sí, con matices | **Muy bajo** |
| D. Servicio propio | 1 (cuenta) | Servidor, coste, soporte, privacidad | Total | **Buena** (se puede fusionar) | Sí | Alto |
| E. Dispositivo a dispositivo | 2 (emparejar) | Nada | Ninguna | Pobre sin semántica | Sí | Medio |

---

## 3. Fichas por proveedor

### 3.1 Nextcloud y WebDAV — lo que ya hay, y cómo volverlo de un clic

**Qué es.** El protocolo que Mimo ya habla. Nextcloud, ownCloud, Synology, HiDrive, mailbox.org y
una parte de los NAS domésticos lo ofrecen. No depende de ninguna empresa que pueda cerrar una API.

**Autenticación.** Usuario y «contraseña de aplicación» por Basic auth. La contraseña de aplicación
se crea en el servidor, es revocable y no es la del usuario: es la decisión correcta y Mimo ya la
pide. El problema nunca fue el protocolo, fue cómo se le pide al usuario.

**Cómo quitarle la fricción (medido).** Nextcloud tiene desde la versión 16 el *Login Flow v2*:

1. Mimo hace `POST /index.php/login/v2` y recibe una URL de autorización y un token de sondeo.
2. Mimo abre esa URL en el **navegador del sistema** (no en una ventana incrustada, así funcionan
   el 2FA, el captcha y las políticas del servidor).
3. El usuario pulsa «Conceder acceso».
4. Mimo sondea `POST /login/v2/poll` hasta recibir `200` con `server`, `loginName` y `appPassword`.
5. Mimo consulta `GET /ocs/v2.php/cloud/user` para obtener el **identificador** (que puede no ser el
   nombre de inicio de sesión) y compone `/remote.php/dav/files/<id>/`.

Resultado: **un campo («la dirección de tu Nextcloud»), un botón y el navegador**. Cero URLs DAV,
cero contraseñas de aplicación escritas a mano, y la contraseña resultante es revocable desde el
servidor. El token de sondeo dura 20 minutos y el `200` se entrega una sola vez.

**Lo que se midió el 2026-10-31 contra el servidor del dueño** (`noa.it.tabdigital.cloud`, Nextcloud
34.0.4 detrás de Cloudflare): `status.php` responde `200`; `/.well-known/caldav` redirige a
`/remote.php/dav/`; el DAV responde `401` con `Basic realm="Tab Digital"`; y
`POST /index.php/login/v2` devuelve `200` con el token y la URL de autorización. **La vía está
abierta en el servidor real**, no solo en la documentación.

**Riesgos.** Que un administrador desactive el flujo (poco común), que el servidor esté detrás de un
proxy que rompa el sondeo (mitigable: sondeo con `http_pedir`, sin CORS), y que el usuario elija un
Nextcloud autohospedado sin TLS correcto (mitigable: avisar, no bloquear).

**Veredicto: apto, y primero.** Es la mejora con mejor relación entre lo que cuesta y lo que
arregla, y no compromete a Mimo con nadie.

### 3.2 WebDAV genérico («otro servidor»)

**Qué es.** El mismo conector sin el asistente: URL, usuario, contraseña. Sirve para NAS, servidores
de empresa y proveedores menores.

**Veredicto: apto, pero escondido en «opciones avanzadas».** Es la válvula de escape para la cola
larga; no puede ser la puerta de entrada. Ojo con los ETag decorados por compresión (`-gzip`), que
rompen `If-Match` en Apache: ya hay trabajo hecho en el motor para releer y comparar por hash.

### 3.3 Google Drive

**Qué es.** La nube que la mayoría de los usuarios de Mimo ya tiene. API REST v3, un fichero se
sube y se baja con `files.create` / `files.get`, y hay dos permisos que **no dan acceso al resto del
Drive**: `drive.file` (solo los ficheros que la app crea o que el usuario le abre) y `drive.appdata`
(una carpeta oculta de configuración de la app, invisible en la interfaz de Drive). Con cualquiera
de los dos, la copia de Mimo vive en su propio rincón y Mimo no puede leer los documentos del
usuario.

**Autenticación.** OAuth 2.0 con PKCE desde un cliente de escritorio; la redirección vuelve a
`http://127.0.0.1:<puerto>`, que Google admite para aplicaciones instaladas. Se guarda el token de
refresco, no la contraseña.

**Lo que impone al proyecto, que es menos de lo que se supone.** Los permisos de Drive que ven toda
la unidad (`drive`, `drive.readonly`, `drive.metadata`) son «restringidos»: exigen verificación y
una auditoría de seguridad anual (CASA), con plazos del orden de semanas. **`drive.file` y
`drive.appdata` no son restringidos ni sensibles**: no hay auditoría ni verificación de permisos,
y el tope de cien usuarios que se aplica a las apps no verificadas **no entra en juego**. Como
mucho, una verificación de marca de dos o tres días si se quiere el nombre y el logotipo en la
pantalla de consentimiento, y es opcional.

**Cuotas.** Desde mayo de 2026 los proyectos nuevos tienen un millón de unidades por minuto y
por proyecto, 325.000 por minuto y usuario, y 750 GB de subida diaria. Para un fichero de
sincronización de decenas de kilobytes es holgadísimo. El almacenamiento del usuario son los 15 GB
gratuitos de su cuenta.

**El riesgo real no es el papeleo: es el identificador de cliente.** En una aplicación open source
el `client_id` viaja en el binario y no es un secreto; Google lo asume (las apps instaladas son
clientes públicos y su `client_secret` no es confidencial), pero un fork puede reutilizarlo y
consumir la cuota o manchar la pantalla de consentimiento. Se mitiga con cuotas por proyecto y
vigilancia, no se elimina.

**Veredicto: apto, sin auditoría y con la verificación de marca como opcional.** Es el que más
valor tiene para el usuario. La única razón para no hacerlo primero es que el flujo OAuth se
estrena mejor donde no hay ni pantalla de consentimiento que publicar.

### 3.4 iCloud

**Qué hay.** iCloud Drive es, para una app de terceros, **una carpeta** en macOS y, en Windows, una
carpeta que crea el cliente de iCloud. No existe una API pública de iCloud Drive para leer o
escribir ficheros desde una aplicación que no sea de Apple.

**CloudKit.** Existe CloudKit Web Services (y CloudKit JS, que funciona en un navegador de cualquier
sistema): permitiría guardar registros en un contenedor de la app desde la ventana de Mimo. Los
requisitos son concretos y caros para lo que Mimo necesita: **Apple Developer Program (99 USD al
año)**, un contenedor CloudKit con su token, y el usuario firmando con su **Apple ID** (el token de
sesión dura 30 minutos, o dos semanas con «mantener la sesión»). Y no es un almacén de ficheros: la
referencia de Web Services limita a **1 MB por registro** y **50 MB por recurso**, y no hay
operaciones transaccionales entre registros.

**Tampoco hay atajo por la carpeta.** En macOS, iCloud Drive está en el Finder; en Windows existe el
cliente de iCloud; en **Linux no hay cliente**, solo la web.

**La vía realista.** Para un usuario de iPhone/Mac, «la carpeta de iCloud Drive» funciona hoy sin
escribir una línea: se elige en «Carpeta local». En Windows hace falta el cliente de iCloud; en
Linux no existe.

**Veredicto: no como integración.** Sí como carpeta, y decirlo con claridad en la documentación en
vez de dejar que alguien lo intente.

### 3.5 Dropbox

**Qué es.** La integración más sencilla de todas las de OAuth: API REST v2, aplicación de tipo
**«App folder»** (solo ve una carpeta propia, no el resto del Dropbox) y OAuth con PKCE sin secreto
de cliente.

**Lo que impone.** Registrar la app (minutos), elegir «App folder», pedir los permisos de
lectura/escritura de contenido. Una app en desarrollo puede enlazar **hasta 500 usuarios**; la
revisión de producción no se pide hasta tener **50 usuarios enlazados**, y desde ahí hay dos semanas
para solicitarla. La propia documentación recomienda PKCE «para aplicaciones de escritorio sin
servidor» y para proyectos open source: encaja con Mimo sin discusión.

**Coste para el usuario.** Plan gratuito de 2 GB; quien ya lo use, ya lo tiene.

**Veredicto: apto, y el mejor banco de pruebas.** Es el sitio natural para construir y medir el flujo
OAuth completo (navegador, redirección local, token en el llavero) con el mínimo papeleo y sin
verificación previa.

### 3.6 Microsoft OneDrive

**Qué es.** Microsoft Graph con el permiso `Files.ReadWrite.AppFolder`: la app solo ve su propia
carpeta dentro de OneDrive.

**Lo que impone.** Registrar la app en Entra ID, declararla cliente público, configurar la
redirección o usar el flujo de código de dispositivo, y pedir `Files.ReadWrite.AppFolder` delegado,
que **no exige consentimiento de administrador** y sirve para cuentas personales. Es el mismo camino
que Super Productivity documenta… y el mismo que provoca que su manual tenga que explicar dos
errores de configuración. La diferencia es que **nosotros registramos la app una vez**, no el
usuario.

**El pero.** `Files.ReadWrite.AppFolder` está **en vista previa**: Microsoft puede cambiarlo o
retirarlo. Además, Graph limita con respuestas `429` y no publica una cuota fija, así que hay que
implementar espera con retroceso desde el primer día.

**Veredicto: apto, pero tercero.** Fácil para nosotros e invisible para el usuario, con el riesgo de
depender de un permiso en vista previa.

### 3.7 S3 y compatibles (R2, B2, MinIO)

**Qué es.** Un depósito de objetos. Muy barato, muy fiable, sin OAuth: claves de acceso y secreto.

**Lo que impone.** Que el usuario cree un depósito, unas claves y una política. Es una opción de
administrador, no de estudiante. Los precios, para situarlos: Cloudflare R2 y Backblaze B2 dan
10 GB gratis; Wasabi cobra por terabyte y exige un mínimo de un terabyte y noventa días.

**Veredicto: solo en «avanzado».** No es una vía de entrada; sí una salida para quien ya tiene
infraestructura, y la base natural si algún día Mimo ofrece un servidor propio.

### 3.8 Servicios con cuenta (Supabase, PocketBase y similares)

**Qué es.** Una base de datos con autenticación y sincronización gestionada. Permitiría «crea una
cuenta en Mimo y listo», con fusión en servidor.

**Lo que impone.** Alguien paga y opera: cuentas, privacidad, soporte, y una promesa de
disponibilidad. Y los planes gratuitos no perdonan: el de Supabase son 500 MB de base, 1 GB de
almacenamiento y **el proyecto se pausa tras una semana de inactividad**; el de Firestore, 1 GiB y
50.000 lecturas diarias. PocketBase no es un servicio: es un binario que alguien tiene que ejecutar.
Un plan que se suspende por inactividad deja a los usuarios sin sincronización sin avisar.

**Veredicto: no ahora.** Es la fase E: solo si el resto no basta.

### 3.9 La carpeta que ya sincroniza tu nube

**Qué es.** Cero integración. El usuario elige, dentro de Mimo, la carpeta donde su cliente de
Dropbox, Drive, OneDrive, iCloud, Mega o Syncthing ya guarda las cosas. Mimo escribe
`mimo-sync-v1.json` con temporal y renombrado; el cliente se encarga del resto.

**Ventajas.** Una acción, sin cuentas nuevas, sin registrar apps, sin tokens que caducan, y funciona
con **todas** las nubes a la vez, incluidas las que no tienen API. Para iCloud es la única vía.

**Un aviso que hay que decir en voz alta:** no todos los clientes existen en todos los sistemas.
Google Drive para escritorio es solo Windows y macOS (no hay cliente oficial para Linux); OneDrive
tampoco lo tiene; Dropbox, MEGA, pCloud y Tresorit sí publican cliente para Linux. Como Mimo se
distribuye primero para Linux, la opción «una carpeta» no cubre a Google en Linux: allí la vía es la
API, no la carpeta.

**Trampas, y son serias.**

- **Dos sincronizadores sobre los mismos bytes.** El cliente de la nube puede subir un fichero a
  medio escribir si Mimo no usa temporal + renombrado (Mimo ya lo hace en la carpeta nativa).
- **Conflictos ajenos.** Dropbox y Nextcloud crean «copias en conflicto» con nombres como
  `mimo-sync-v1 (1).json`; Google Drive usa `_conf(1)`; iCloud, `(2)`. Mimo debe **detectarlas** y
  ofrecer quedarse con la más reciente, no ignorarlas.
- **Latencia de minutos.** El cliente puede tardar en subir; el otro equipo, en bajar.
- **Un solo escritor.** Si dos equipos tienen la misma carpeta sincronizada y Mimo corre en ambos,
  hay que asumir el conflicto y resolverlo, no prevenirlo.

**Veredicto: apto, y es la respuesta a «la más sencilla».** Con nombre propio en la interfaz y tres
avisos claros.

### 3.10 Dispositivo a dispositivo (para el futuro)

**Qué es.** Que dos equipos se hablen sin nube: por la red local (descubrimiento + emparejamiento
por código o QR) o con un relay mínimo.

**Estado.** Syncthing demuestra que funciona, y también que sin semántica de aplicación solo puede
ofrecer «aquí tienes dos ficheros». Para Mimo, hoy, sería otro motor de sync, no otra configuración.

**Veredicto: fuera de beta.5.** Se recoge aquí porque es la respuesta al «vincular con otros
dispositivos» que el dueño mencionó, y porque condiciona el diseño: si algún día hay P2P, el
identificador de dispositivo y el sobre con versión tienen que existir desde ahora.

### 3.11 Tabla de conjunto

| Destino | Protocolo | Autenticación | Coste para el usuario | Coste para el proyecto | Pasos | Veredicto |
|---|---|---|---|---|---|---|
| Nextcloud (con Login Flow v2) | WebDAV | App password automática | Su cuenta | Ninguno | **3** | **Primero** |
| WebDAV a mano | WebDAV | Basic | Su cuenta | Ninguno | 9 | Avanzado |
| Carpeta ya sincronizada | Sistema de ficheros | Ninguna | Su nube actual | Ninguno | **1** | **Primero** |
| Dropbox | REST v2 | OAuth PKCE | Gratis hasta 2 GB | Registro de app | 2 | Fase B (banco de pruebas) |
| OneDrive | Graph | OAuth PKCE o código de dispositivo | Su cuenta | Registro de app | 2 | Fase B, con permiso en vista previa |
| Google Drive | REST v3 | OAuth PKCE | Gratis hasta 15 GB | Registro; sin auditoría con `drive.file` | 2 | Fase B (el de más valor) |
| iCloud | — | — | — | — | — | Solo como carpeta |
| S3 / R2 / B2 | S3 | Claves | De pago (barato) | Ninguno | 8 | Avanzado |
| Supabase / PocketBase | API propia | Cuenta | Gratis con límites | Servidor y soporte | 2 | Fase E |
| P2P / LAN | Propio | Código o QR | Ninguno | Ninguno | 2 | Fase D |

---

## 4. Cómo lo resuelven otros

### 4.1 Super Productivity, la referencia que puso el dueño

Es el caso más útil porque documenta su arquitectura, sus caídas y sus rectificaciones.

- **Seis destinos**: SuperSync (servidor propio, en beta), Dropbox, OneDrive, Nextcloud, WebDAV
  («experimental») y carpeta local («experimental»). Una configuración de proveedor por
  dispositivo, y **no se sincroniza entre dispositivos**.
- **Una sola configuración para todos**: ajustes → *Sync & Backup* → «Set up sync» → desplegable de
  proveedor → campos → «Save & Enable Sync». Cinco pantallas y credenciales técnicas.
- **OneDrive exige que el usuario registre su propia aplicación en Microsoft Entra** (redirect URI,
  «public client flows», permisos `Files.ReadWrite.AppFolder`). Once o doce pasos con vocabulario de
  administrador. La propia documentación incluye la solución a dos errores concretos
  (`AADSTS9002327`, `AADSTS7000218`): saben que la gente se atasca ahí.
- **Nextcloud pide el *user ID*, no el correo**: si se pone el correo, el inicio de sesión pasa y
  el WebDAV devuelve 404. Es exactamente el tipo de trampa que Mimo hereda si copia el formulario.
- **Por dentro es un registro de operaciones con relojes vectoriales; por fuera, un fichero.** En
  cada subida con operaciones «reconstruye y sube el snapshot actual, los dos niveles de archivo y
  las operaciones retenidas». Su versión 3 existe solo para dejar de reescribir el snapshot entero:
  separa `sync-ops.json` de snapshots inmutables con nombre de generación.
- **Conflictos**: precedencia de archivo/borrado → **fusión de campos disjuntos** → último en
  escribir con desempate por `clientId` → diálogo «Keep local / Keep remote» que **reemplaza el
  dataset completo**. El diálogo es el último recurso, no el primero.
- **Cifrado**: obligatorio en SuperSync, opcional en ficheros. **Los metadatos no se cifran** (IDs,
  fechas) y **los respaldos y exportaciones salen en claro aunque el cifrado esté activo**. Rechaza
  un remoto sin cifrar en vez de desactivar el cifrado solo: anti-downgrade correcto.
- **Lo que les ha dolido**, y que conviene leer como advertencia:
  - `#9095`: con el último-en-escribir por entidad completa, «un renombrado muere cuando otro
    dispositivo marca la tarea como hecha». Pérdida silenciosa y permanente.
  - `#8755`: podar los relojes vectoriales puede **ocultar** conflictos.
  - Febrero de 2026: bucle infinito de rechazos por podar el reloj a 10 entradas.
  - Caída del 20 de julio de 2026: una consulta mal planificada dejó **47 servidores atascados**,
    el más largo 75 minutos.
  - Construyeron un «journal» de valores descartados, lo marcaron para borrar y descubrieron que
    **ya estaba en ocho versiones estables** con filas reales de usuarios. Se revirtió el borrado.
- **Prohíben explícitamente** poner Syncthing, Resilio o un cliente de nube sobre su carpeta local,
  porque «el acceso al sistema de ficheros no puede coordinar escritores concurrentes».

### 4.2 El resto, en una tabla

| App | Cómo elige el usuario el destino | Conflictos | Cifrado |
|---|---|---|---|
| **Joplin** | «Sync target» como driver tipo sistema de ficheros: 7 destinos intercambiables | **Notebook «Conflict» con copia**; el remoto sustituye; fusionar a mano en 10 pasos | Opcional; la clave maestra viaja por el propio destino |
| **Obsidian + Remotely Save** | 12+ destinos; configuración exportable por **QR** | Gratis: «quedarse el más nuevo/el más grande»; PRO: fusión simple. **El auto-sync falla en silencio** | Opcional; **el nombre del vault no se cifra** |
| **Standard Notes** | Cuenta y ya | **Duplica la nota**: si el servidor no puede leer, no puede fusionar | Siempre |
| **Actual Budget** | URL del servidor y cuenta | Sin fusión; «evita el uso simultáneo»; un reinicio de sync deja fuera a los demás | Opcional e irreversible |
| **Notesnook** | Cuenta y ya | **Ventana de 60 s**: si es el mismo humano tecleando, gana el más reciente; si no, grupo «Conflicted» y decide el usuario | Siempre, con clave de recuperación |
| **Anytype** | Identidad de espacio; el proveedor es intercambiable | CRDT sobre DAG cifrado | Siempre |
| **Logseq** | Elegir carpeta (muchos la ponen en iCloud) | **«Conflicting upserts»**: colisión entre nombre y UUID del bloque; pérdida de datos | No |
| **KeePassXC** | Cualquier carpeta sincronizada | Fusión por entrada; **los borrados son el caso duro** | Cifrado del propio fichero |
| **Syncthing** | Emparejar dispositivos | Renombra a `.sync-conflict-<fecha>-<dispositivo>`; gana el `mtime` más viejo | Opcional |

### 4.3 Los seis patrones que importan

1. **El transporte manda sobre el formato.** Con un fichero por destino (WebDAV, Drive, Dropbox),
   cualquier modelo acaba subiendo el estado completo salvo que se separen operaciones y snapshots
   inmutables. Diseñar un registro de operaciones «porque es lo correcto» y meterlo en un fichero
   único es pagar el coste sin cobrar el beneficio.
2. **Último-en-escribir por entidad completa es pérdida de datos, no una política de conflicto.**
   La solución barata es la **fusión de campos disjuntos**: si uno cambió el título y otro el
   estado, no hay conflicto.
3. **El reloj no es la verdad.** Los portátiles se suspenden, las horas se ajustan a mano y los
   husos se aplican mal. Hace falta un contador causal (reloj vectorial pequeño o híbrido) y un
   desempate determinista por identificador de cliente. Y si el desfase es grande, **decirlo con
   un mensaje accionable** (Actual tardó meses en pasar de «problem syncing» a explicarlo).
4. **Cifrar cambia quién puede fusionar.** Si el servidor no lee, no fusiona; y si no fusiona, o
   duplica (Standard Notes) o para la sincronización. El cifrado no es una capa que se añade al
   final sin consecuencias.
5. **Una carpeta compartida con otro sincronizador es un solo escritor, o corrupción.** Lo prohíben
   SP, lo sufre Logseq y lo mitiga Syncthing renombrando.
6. **Enrolar un segundo dispositivo debe ser una acción.** Los mejores patrones vistos: token que se
   pega una vez, QR de configuración, y clave de cifrado **por un canal distinto** del resto.

### 4.4 Lo que la gente dice del dolor

- «Me dijo que había un problema al sincronizar y no daba ninguna información sobre cuál era.»
  (Actual Budget, arreglado con un mensaje que dice qué revisar.)
- «No sé cómo reproducirlo… esto me preocupa, quiero usar la app para un trabajo importante.»
  (Logseq, perdiendo el contenido de una pizarra.)
- La ayuda de Joplin explica cómo fusionar dos notas **con diffchecker.com en diez pasos**.
- La de Remotely Save empieza en mayúsculas: «ALWAYS, ALWAYS, backup your vault».
- La de Super Productivity marca WebDAV como experimental «porque las implementaciones difieren
  mucho entre proveedores».

Ninguna de esas frases es de un usuario torpe. Son el resultado de pedirle a alguien que resuelva
un problema de ingeniería con un formulario.

---

## 5. Los problemas que hay que resolver de verdad

No son «añadir proveedores». Son ocho problemas, y cada proveedor nuevo los hereda si no se
arreglan antes.

| # | Problema | Por qué ocurre | Mitigación propuesta | Coste |
|---|---|---|---|---|
| 1 | **No sé si se aplicó** | La app dice «Sincronizado» pero no muestra pruebas | Comprobante tras cada sync: hora, tamaño del remoto, cuentas, identificador de la otra copia, y un botón «ver qué hay en la nube» que relee y muestra el remoto | Bajo |
| 2 | **Credenciales que se pierden** | La contraseña de aplicación vive en `sessionStorage` | Guardar en el llavero del sistema (`keyring`: Secret Service, Credential Manager, Keychain) | Bajo |
| 3 | **Direcciones que se escriben mal** | La URL de WebDAV se construye a mano | Asistente que descubre la raíz (`/.well-known/`, `/status.php`, OCS) y la deriva | Medio |
| 4 | **Dos contraseñas y ninguna recuperable** | Cifrado obligatorio con frase inventada | Cifrado opcional + **frase de recuperación de 12 palabras** generada (es la misma clave, sin cambiar el formato) + verificación de que se copió | Bajo |
| 5 | **Conflictos de todo o nada** | Se comparan hashes globales | Por fases: primero **ventana de gracia** y «guardar copia descartada»; después fusión por campo con marca de tiempo por entidad | Medio-alto |
| 6 | **Mensajes técnicos** | Los errores HTTP se muestran crudos | Traducir a acciones: «esa dirección no parece un Nextcloud», «la contraseña de aplicación ya no vale, vuelve a conectar», «el reloj de tu equipo va desfasado» | Bajo |
| 7 | **Un solo fichero con todo** | Formato v1 | Dejar el formato listo para separar `ops` de `snapshot` cuando el estado crezca | Medio |
| 8 | **Nada de segundo dispositivo** | No hay identidad de dispositivo ni enrolamiento | Identificador de equipo con nombre, código de un solo uso para vincular, y lista de dispositivos | Medio |

Los problemas 1, 2, 4 y 6 son los que el dueño siente hoy. Los 5, 7 y 8 son los que aparecerán
cuando haya dos equipos.

---

## 6. Plan propuesto

### 6.1 La idea: tres preguntas en vez de un formulario

La tarjeta de sincronización debería empezar por la única pregunta que el usuario sabe responder:

> **¿Dónde quieres guardar tu copia?**
> · En una carpeta de este equipo (o de mi nube)  · En mi Nextcloud  · Otro servidor  · Un archivo

Debajo, en cada caso, lo mínimo: elegir carpeta, o la dirección del servidor, o nada. Todo lo demás
—usuario, contraseña de aplicación, ruta DAV, carpeta remota— lo rellena la app o lo deja en
«Opciones avanzadas».

Por dentro no se tira nada: los tres modos actuales siguen existiendo, con el mismo motor de
snapshot, la misma cola y el mismo cifrado.

### 6.2 Fase A — beta.5: que Nextcloud sea de un clic

| Paso | Qué | Tamaño | Criterio de cierre |
|---|---|---|---|
| A1 | Tarjeta con las cuatro opciones y los campos técnicos plegados | Pequeño | Un usuario nuevo llega a «Conectar» sin leer una URL |
| A2 | Conector Nextcloud con **Login Flow v2**: dirección del servidor → navegador → usuario y contraseña de aplicación automáticos → raíz DAV derivada (OCS `/cloud/user` para el identificador) | Medio | Con una cuenta real: 3 acciones, cero campos técnicos |
| A3 | Credenciales en el **llavero del sistema** | Pequeño | Cerrar y abrir la app: sigue sincronizando sin reescribir nada |
| A4 | **Cifrado opcional** con frase de recuperación de 12 palabras, mostrada una vez y verificada | Medio | Sin frase no se activa; con frase se recupera en otro equipo |
| A5 | **Comprobante** tras sincronizar y botón «ver qué hay en la nube» | Pequeño | El usuario puede responder «sí, está subido» sin dudar |
| A6 | Errores traducidos a acciones | Pequeño | Ningún mensaje con «HTTP» en la ruta normal |
| A7 | Gate nuevo con un **Nextcloud falso** que implemente login flow, OCS y WebDAV | Medio | El flujo completo se mide en CI, sin cuenta real |

**A8 — la señal en el pie (pedida por el dueño).** El pie no decía nada útil. Ahora muestra
destino y hora —«Local · 12:03», «Nube · 12:04», «Sin subir · 12:05», «Sincronizando…»,
«Conflicto»— con un punto de color, y el detalle completo en el título: último cambio guardado,
última sincronización, destino y error pendiente. Un clic abre la tarjeta de sincronización.
Se mide con `gate-senal.py` (17 comprobaciones).

A1, A2, A3, A5 y A6 son el corazón: sin ellos el frente no cambia. A4 toca una decisión de la beta
anterior —el cifrado dejó de ser opcional en la fase 2— y necesita el visto bueno del dueño antes de
escribirse. A7 es lo que permite seguir tocando esto sin cuentas ni credenciales en el repositorio.

**Por qué el Login Flow v2 y no otra cosa:** está en el servidor del dueño, funciona hoy (medido),
quita los dos campos más difíciles y no exige registrar nada ni pedir permisos a nadie. Es la
mejora de intuición más grande por el menor coste de todo el informe.

**Lo que la fase A no hace:** no añade proveedores nuevos, no cambia el formato y no promete fusión
por campo. Quien tenga Google Drive seguirá usando «carpeta local» apuntando a su carpeta de Drive,
que es exactamente lo que la fase C quiere hacer explícito.

### 6.3 Fase B — una nube con OAuth (beta.6)

Solo si la fase A deja el motor sano. El trabajo difícil es **una vez**: abrir el navegador del
sistema (`tauri-plugin-opener`, hoy no está), escuchar la redirección en `127.0.0.1` (un comando
Rust pequeño), guardar el token de refresco en el llavero y saber revocarlo al desconectar. A
partir de ahí, cada proveedor es un conector más.

1. **Dropbox** (`app_folder`): registro inmediato, 500 usuarios de margen en desarrollo, PKCE
   recomendado por su propia documentación. **Es el banco de pruebas del flujo**, no el destino
   final.
2. **Google Drive** (`drive.appdata`): el que más valor tiene y, con un permiso que solo toca los
   ficheros de la app, **sin auditoría ni verificación de permisos**. La verificación de marca es
   opcional y cosmética.
3. **OneDrive** (`Files.ReadWrite.AppFolder`): mismo flujo, pero el permiso está en vista previa.
   Entra el último y con una salida preparada si Microsoft lo retira.

Criterio de cierre de cada uno: conectar con una cuenta real, cerrar y abrir la app, comprobar que
sigue sincronizando sin volver a autorizar, y que «desconectar» revoca el acceso en el proveedor.

### 6.4 Fase C — la vía sin OAuth, que además es la más sencilla

Hacer de «carpeta local» una opción de primera clase, con nombre propio: **«la carpeta que ya
sincroniza tu nube»**. Cubre Dropbox, Google Drive, OneDrive, iCloud, Mega, pCloud y Syncthing sin
una línea de integración.

Lo que hay que añadir para que no corrompa datos:

- Detectar si el fichero cambió por fuera y **no sobrescribir** (avisar).
- Escribir con temporal + renombrado (ya se hace en la carpeta nativa).
- Avisar en la interfaz: «esta carpeta no debe ser la misma que sincroniza otro programa a la vez».
- Decir en la propia opción qué clientes existen en cada sistema: Drive y OneDrive no tienen cliente
  oficial para Linux, así que en Linux esa opción no sustituye a la API.
- Nombre de fichero con versión (`mimo-sync-v1.json`) para poder migrar sin pisar.

### 6.5 Fase D — dos dispositivos de verdad (beta.7)

- Identificador de equipo con nombre visible y fecha de última sincronización.
- Vincular el segundo equipo con un **código de un solo uso** (o QR): transporta destino y
  credenciales; la frase de cifrado va aparte.
- Fusión por campo: marca de tiempo por entidad (reloj híbrido, no hora del sistema a secas) y
  lápidas para los borrados.
- Ventana de gracia de un minuto antes de declarar conflicto, y copia de lo descartado.

### 6.6 Fase E — servidor propio, si alguna vez

No ahora. Pero el contrato de conector (leer, escribir, conectar) deja la puerta abierta sin
reescribir el motor, igual que Super Productivity usa el mismo registro de operaciones sobre un
fichero y sobre su servidor.

### 6.7 Lo que no hay que hacer

- **No implementar ocho proveedores.** Tres caminos bien hechos valen más que seis a medias; los
  demás caben en «otro servidor» o en «una carpeta».
- **No prometer convergencia sin fusión por campo.** Mejor decir «elige un lado» que elegirlo por
  el usuario y perder el renombrado.
- **No dar por hecho que el permiso de Google seguirá siendo no restringido.** Hoy no exige
  auditoría; eso es política externa y puede cambiar. Por eso el conector se escribe como uno más,
  no como el único.
- **No cifrar los respaldos en silencio.** O se cifran y se dice, o no se cifran y se avisa: es la
  fuga que Super Productivity documenta y que aquí sería más grave.
- **No llamar «nube» a la carpeta local sin decirlo.** Es una carpeta; si el cliente de la nube está
  cerrado, no sube nada.

### 6.8 Qué se puede probar antes de escribir código

1. **Login Flow v2 contra Tab Digital**, sin credenciales: ya medido (ver anexo). Con la cuenta del
   dueño, una sola vez, para ver la ida y vuelta completa.
2. **La app desde la beta.4 con la cuenta real**, para responder a la duda concreta del dueño («creo
   que sincronicé, no sé si se aplicó»). Tres comprobaciones, dos minutos:
   - En la web de Nextcloud: **Archivos → Mimo** debe existir `mimo-sync.json.enc` con fecha de
     modificación reciente. Si la carpeta está vacía, la subida nunca llegó.
   - En Nextcloud: **Ajustes personales → Seguridad → Dispositivos y sesiones** debe aparecer una
     contraseña de aplicación con el nombre de Mimo. Si no está, la app usó otra credencial.
   - En Mimo: Ajustes → Sincronización muestra la última sincronización; y el sobre remoto lleva un
     `clientId` que debe coincidir con el de este equipo si fue este el que subió.
3. **La carpeta de Drive/Dropbox como destino**, hoy mismo, sin tocar código: elegir «carpeta local»
   dentro de la carpeta que ya sincroniza el cliente oficial.

---

## 7. Riesgos y decisiones que quedan abiertas

| Riesgo | Probabilidad | Impacto | Qué hacer |
|---|---|---|---|
| Un fork reutiliza el `client_id` público y agota la cuota | Media | Medio | Cuotas por proyecto, seguimiento y un identificador propio por canal |
| Microsoft retira `Files.ReadWrite.AppFolder` (vista previa) | Media | Medio | OneDrive al final y detrás del mismo contrato de conector |
| El cliente de nube no existe en Linux (Drive, OneDrive) | **Alta** | Medio | La vía de Linux es la API; la carpeta se ofrece como lo que es |
| iCloud resulta imposible fuera de Apple | **Alta** | Medio: se puede sustituir por «carpeta de iCloud Drive» | Decirlo claro en la documentación |
| El llavero no está disponible en Linux mínimo (sin Secret Service) | Media | Medio | Respaldo cifrado con la frase de recuperación |
| La fusión por campo llega tarde | Alta | Medio | Ventana de gracia y copia descartada primero |
| Un cliente de nube pisa el fichero | Media | **Alto** | Detección de escritor externo y aviso |
| El estado crece y el fichero único se vuelve lento | Baja hoy | Medio | Formato preparado para separar operaciones |
| Se pierde la frase de cifrado | Media | Alto para ese usuario | Frase de 12 palabras + verificación + copia local intacta |

Decisiones que necesitan al dueño, no al ingeniero:

1. ¿Se acepta que la copia en la nube sea **opcionalmente cifrada** y no obligatoriamente?
2. ¿La primera nube con OAuth es Dropbox (rápida) o Google Drive (la que la gente tiene)?
3. ¿Se ofrece «carpeta de tu nube» como opción recomendada, con el aviso de un solo escritor?

---

## 8. Anexo: lo que se midió y de dónde sale

### 8.1 El Nextcloud del dueño, medido sin credenciales (2026-10-31, 03:03 UTC)

| Comprobación | Resultado |
|---|---|
| `GET /status.php` | `200`, `{"installed":true,"version":"34.0.4.1","productname":"Nextcloud"}` |
| `GET /.well-known/caldav` | `301` → `https://noa.it.tabdigital.cloud/remote.php/dav/` |
| `PROPFIND /remote.php/dav/` sin credenciales | `401`, `WWW-Authenticate: Basic realm="Tab Digital"` |
| `POST /index.php/login/v2` | `200` con `poll.token`, `poll.endpoint` y `login` |
| `POST /login/v2/poll` antes de aprobar | `404` (lo que dice la especificación) |

Conclusión: **el Login Flow v2 está disponible en el servidor real**. Mimo puede pedir solo la
dirección del servidor y recibir de vuelta `server`, `loginName` y `appPassword`. La raíz WebDAV se
deriva de ahí (`/remote.php/dav/files/<id>/`, con el `id` de la OCS `/ocs/v2.php/cloud/user`),
que es justo el campo donde hoy se equivoca la gente.

### 8.2 Lo que se leyó del código

- `app/js/sync.js`: modos, sobre `mimo-sync`, cifrado PBKDF2/AES-GCM, ETag, cola, conflicto,
  `sessionStorage` para la contraseña de aplicación, IndexedDB para la clave derivada.
- `app/index.html` (tarjeta de Ajustes): cuatro campos, dos contraseñas, casilla «solo cuando yo lo
  pida» activada por defecto.
- `escritorio/src-tauri/src/main.rs`: `http_pedir` con reqwest (25 s, cuerpo de texto, redirecciones
  limitadas a 5), carpeta nativa con temporal + renombrado.
- `pruebas/gate-webdav.py`: 30 comprobaciones sobre un servidor local con ETag y CORS.

### 8.3 Lo que no se pudo verificar

- El detalle interno del cifrado y de los conflictos de **Obsidian Sync** (su ayuda es una aplicación
  web y no devuelve contenido).
- El **onboarding** exacto de Anytype y las etiquetas del diálogo de fusión de KeePassXC.
- Ningún dato público del **tamaño real** de un `sync-data.json` de Super Productivity: lo que se
  afirma sobre el coste por sincronización es inferencia del formato, no medición.
- Los límites de **CloudKit** citados vienen de la referencia archivada de Web Services (2016): no
  se comprobó si Apple amplió el tamaño por recurso.
- **OneDrive**: no se encontró un proceso formal de revisión equivalente al de Google o Dropbox para
  permisos delegados; la afirmación «no lo hay» es una ausencia de evidencia, no una prueba.
- El **límite de usuarios en modo prueba** de Google y el precio de una auditoría CASA no están
  cuantificados (el precio lo fija el auditor, Google no publica tarifa).

### 8.4 Fuentes principales

- Nextcloud, *Login Flow* (incluye Login Flow v2 y el aviso de que el nombre de inicio de sesión
  puede no ser el identificador de la ruta WebDAV):
  <https://docs.nextcloud.com/server/latest/developer_manual/client_apis/LoginFlow/index.html>
- Nextcloud, *WebDAV*: <https://docs.nextcloud.com/server/latest/developer_manual/client_apis/WebDAV/index.html>
- Super Productivity, wiki de sincronización (2.08, 2.09, 3.08) y `docs/sync-and-op-log/`:
  <https://github.com/super-productivity/super-productivity/tree/master/docs>
- Joplin, *Sync* y *Conflict*: <https://joplinapp.org/help/apps/sync/> ·
  <https://joplinapp.org/help/apps/conflict/>
- Standard Notes, *How do I clear duplicates?*: <https://standardnotes.com/help/33/how-do-i-clear-duplicates>
- Notesnook, *How sync works*: <https://notesnook.com/help/sync/how-sync-works>
- Actual Budget, *Sync*: <https://actualbudget.org/docs/getting-started/sync/> · desfase de reloj:
  <https://github.com/actualbudget/actual/issues/3786>
- Syncthing, *Understanding Synchronization*: <https://docs.syncthing.net/users/syncing.html>
- Remotely Save, algoritmo de sincronización: <https://github.com/remotely-save/remotely-save>
- Logseq, «Conflicting upserts»: <https://github.com/logseq/logseq/issues/11708>
- Google Drive, permisos y su clasificación:
  <https://developers.google.com/workspace/drive/api/guides/api-specific-auth> · verificación de la
  app: <https://support.google.com/cloud/answer/13464321> · auditoría CASA:
  <https://support.google.com/cloud/answer/13465431> · OAuth para apps nativas:
  <https://developers.google.com/identity/protocols/oauth2/native-app> · cuotas:
  <https://developers.google.com/workspace/drive/api/guides/limits>
- Dropbox, guía de OAuth y del desarrollador: <https://docs.dropboxapi.com/dropbox-api/docs/oauth> ·
  <https://docs.dropboxapi.com/dropbox-api/docs/developer-resources/developer-guide>
- Microsoft Graph, registro de apps y permisos:
  <https://learn.microsoft.com/graph/auth-register-app-v2> ·
  <https://learn.microsoft.com/graph/permissions-reference>
- CloudKit Web Services (token y límites):
  <https://developer.apple.com/documentation/cloudkit/obtaining-an-api-token-for-an-icloud-container> ·
  <https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/PropertyMetrics.html>
- Precios: Cloudflare R2 <https://developers.cloudflare.com/r2/pricing/> · Backblaze B2
  <https://www.backblaze.com/cloud-storage/pricing> · Supabase <https://supabase.com/pricing> ·
  Firebase <https://firebase.google.com/pricing>
