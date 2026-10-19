# CONTRATO DE BLOQUES — Mimo Nuevo

> **Versión 0.2 (prototipo)** · 2026-10-19 · Estado: **propuesta para revisión del dueño**
> Este documento fija **qué tiene que cumplir** un bloque para que la base no se rompa cuando
> llegue el primero escrito por otro. No decide todavía la implementación (WebView, worker o
> iframe): decide el contrato.
>
> **La v0.1 se conserva entera debajo.** Las secciones §1 a §6 **no se han editado**: hay material
> citándolas y reescribirlas borraría el registro de lo que se aprobó. Lo que cambia va en el bloque
> de aquí abajo y en las **cuatro secciones nuevas** (§7 a §10).

## Cambios en v0.2

Resumen de lo que añade esta versión, y por qué. Cada punto dice **dónde se lee**.

1. **Puentes bidireccionales (base↔bloque), con opcionalidad declarada.** En la v0.1 un puente solo
   iba del bloque a la base. Ahora un puente declara **las dos puntas** y si su ausencia **degrada**
   o **impide montar**. Sin eso, quitar un bloque dejaría rótulos huérfanos o la base muda.
   → **§7**
2. **Configuraciones en capas.** El manifiesto declara `configuraciones[]` y cada configuración dice
   **en qué sección se pinta** (`propia`, `calendario`, `tareas`, `sistema`). Un bloque puede aportar
   ajustes a una sección base sin escribir en ella. → **§8**
3. **Naturaleza ampliada: `seccion` · `aporte` · `configuracion` · `tema` · `pack`.** Es lo que
   decide **dónde aparece** cada cosa: la navegación se construye filtrando por aquí, así que un
   aporte nunca aparece como pantalla. → **§9** y **§2** (la lista de la v0.1 gana `pack`)
4. **Packs: un manifiesto que instala otros.** `instala: ["id1", "id2"]`. Un pack no tiene pantalla
   ni zona: es un encargo que trae varios bloques con una sola confirmación. **Academics es un
   pack, no la base.** → **§9**
5. **Catálogo y canales: `bundled` · `local` · `remoto`.** Un bloque no llega de la nada: llega por
   un canal que se declara, con su huella y su fecha. La app **no se actualiza sola**. → **§10**
6. **Dos campos nuevos en el manifiesto**, que no son de la v0.1 y hay que declarar:
   - `consume`: lo que el bloque **lee si está** y sin lo cual **sigue funcionando** (degradado).
     Frente a `necesita`, que es lo que **sin ello no se monta**.
   - `panelContexto`: lo que el bloque **declara** para el panel derecho del shell (una lista de
     etiqueta·valor). Es un puente **declarativo**: el bloque no dibuja el panel, lo describe.
     Un bloque sin `panelContexto` no inventa contexto: el panel dice **«Sin contexto»**.
   Y dos valores nuevos de `zona`, para las naturalezas que no ocupan zona:
   `ninguna` (un pack) y `sistema` (un tema).
7. **Los temas son un bloque** (naturaleza `tema`, con `temas[]`), y **Academics es un bloque
   (pack)**. Quedan como estaban en la v0.1: la base es **Calendario, Tareas y Ajustes**, y nada más.
8. **Sincronización: solo local por ahora** (opción C del dueño). El almacén es local y no hay
   servicio externo; el contrato deja el hueco declarado para un canal futuro, **sin definir su
   formato**: llega cuando se decida, no antes.

**Decisiones que esta versión deja abiertas** (las lleva el prototipo a la revisión del dueño):

| # | pregunta | por qué importa | recomendación |
|---|---|---|---|
| 7 | Un pack que **se desinstala** ¿se lleva los datos de sus bloques? | si se los lleva, un pack se vuelve una trampa; si no, deja datos que el usuario no ve | **no se los lleva**: cada bloque conserva lo suyo y se avisa bloque a bloque |
| 8 | ¿Un bloque puede **aportar a dos secciones** base a la vez? | permite un aporte honesto (una etiqueta de calendario y una de tareas), pero abre la puerta a aportes que se cuelan en toda la app | **sí, declarando cada aporte con su sección**, y solo si el dueño de la sección lo concede |
| 9 | El **canal remoto** ¿exige firma además de huella? | sin firma, quien controle el origen controla lo que se instala en casa | **firma obligatoria** para remoto; `local` y `bundled` con huella basta |
| 10 | Un tema aportado por un bloque, **¿se va al quitarlo?** | si se queda, el usuario ve un tema que ya no puede mantener | **se va**, pero el tema queda en la lista como **«aportado por un bloque que ya no está»** hasta que el usuario elija otro |

---

## 1. Filosofía

**Tres capas, y cada una sabe poco de la de al lado.**

| capa | qué es | de quién es | ¿se puede quitar? |
|---|---|---|---|
| **base fija** | Calendario, Tareas, Ajustes | núcleo del proyecto | **no** (sin ellas no hay app) |
| **shell** | navegación, temas, idioma, almacén, **gestión de bloques** | núcleo del proyecto | no |
| **bloques** | pieza instalable: Estudio, Notas, Malla… | del proyecto o de terceros | sí, siempre |

- **La base es fija y no se negocia.** Un bloque no la edita, no la reordena y no la apaga.
- **Un bloque es una pieza aislada con puertas declaradas.** Lo que no declara, no lo puede hacer.
- **Un puente es un contrato público entre bloques.** No es una llamada interna ni un atajo: es
  una función con nombre, dirección y forma de datos, que se declara **antes** de instalar.
- **El dato es del usuario**, no del bloque ni del perfil. Quitar un bloque no borra por sorpresa.

**Lo que un bloque SÍ puede hacer:** leer y escribir **sus** claves de almacén; usar los puentes
que declara y le han concedido; renderizar **dentro de su zona**; declarar sus ajustes (que se ven
marcados con su nombre); ofrecer puentes a otros.

**Lo que un bloque NO puede hacer:** tocar la base o el shell; leer o escribir el almacén de otro
bloque; usar `window`/`document` globales; añadirse a la navegación sin declarar su naturaleza;
tirar la app si falla; quedarse con datos al desinstalarse sin decirlo.

## 2. Manifiesto de bloque (JSON, esquema simplificado)

```json
{
  "id": "estudio",
  "nombre": "Estudio",
  "version": "1.2.0",
  "autor": "Mimo Labs",
  "licencia": "MIT",
  "naturaleza": "seccion",
  "zona": "main",
  "compatible": ">=0.1.0 <1.0.0",
  "permisos": ["almacen:propio", "puente:calendario.leerEventos"],
  "ofrece": ["sesiones.leer", "sesiones.anadir"],
  "necesita": ["calendario.leerEventos"],
  "datos": { "posee": ["estudio.sesiones", "estudio.ajustes"], "conservarAlQuitar": true },
  "recursos": { "icono": "iconos/estudio.svg", "estilos": ["estudio.css"] }
}
```

- `id`: opaco, único y **no** derivado del nombre visible. Renombrar no rompe nada.
- `naturaleza`: `seccion` (tiene pantalla) · `aporte` (le suma a otro, sin pantalla) ·
  `configuracion` · `tema` · `dentro-de-otro` · **`pack`** (v0.2: instala otros; ver §9).
  **La navegación se construye filtrando por aquí**, así que un aporte nunca aparece como pantalla.
- `zona`: `main` · `sidebar` · `panel` · `widget` · `ajustes` · **`sistema`** (v0.2: temas y
  configuraciones que no ocupan sitio) · **`ninguna`** (v0.2: packs). Dónde se dibuja, no qué es.
- `permisos`: la lista cerrada de lo concedido. Nada por defecto: se pide, se enseña **antes** de
  instalar y se puede retirar.
- `compatible`: rango semver frente a la versión de la base. Tres estados: **encaja** ·
  **anticuado** (se instala y queda mudo, sin romper) · **incompatible** (no se instala y dice por qué).
- `datos.posee`: claves de almacén que son suyas y de nadie más.
- Lo que pide se ve **antes** de instalar: autor, versión, tamaño, qué guarda y qué se lleva.
- **v0.2 añade** `consume`, `panelContexto`, `configuraciones`, `instala` y `temas`. Se explican en
  §7, §8, §9 y §10: no son adornos, cada uno cambia cómo se monta la pieza.

## 3. Ciclo de vida

1. **Instalar** → validar manifiesto (campos, semver, id único) → comprobar que los puentes que
   `necesita` existen y están concedidos → montar en su `zona`.
2. **Ejecutar** → el bloque abre solo sus claves; los puentes responden; si algo falla, el error se
   atribuye **al bloque o al puente**, nunca a «algo ha fallado».
3. **Quitar** (deja de usarse) y **desinstalar** (borra sus datos) son **dos acciones distintas** y
   se dicen por su nombre. Al desinstalar se avisa **qué** se borra y se ofrece primero la salida
   segura: conservar los datos.
4. **Actualizar** → validar versión → migrar datos **solo añadiendo** → no borra ni desactiva nada
   por su cuenta. Lo que cambie de forma se dice **antes** de aplicar.
5. **Desmontar** → se retira de la zona y **no deja huecos ni rótulos huérfanos**. O está todo lo
   suyo, o no está nada: nunca a medias.
6. Una referencia rota (puente que ya no existe, ajuste huérfano) **se detecta antes de usarla**.

## 4. Puentes

Un puente es una **API pública que un bloque expone a otros**, con nombre, dirección y forma.

| dirección | ejemplo | quién lo concede |
|---|---|---|
| **lee** | `calendario.leerEventos(desde, hasta)` | el bloque que lo expone |
| **escribe** | `calendario.anadirEvento(fecha, evento)` | exige permiso de escritura explícito |
| **avisa** | `tareas.alCrearTarea(fn)` | el que se suscribe pide permiso al instalar |

- Se declaran en el manifiesto: `ofrece` (lo que da) y `necesita` (lo que toma).
- **Si un bloque necesita un puente que no existe, no se monta** — y se dice cuál falta.
- Los puentes son **de solo lectura por defecto**. Escribir en los datos de otro bloque exige un
  permiso escrito aparte y una razón que el usuario vea.
- Un puente es **datos con forma declarada, no código compartido**: el que llama no sabe cómo está
  hecho el otro, y por eso el otro se puede reescribir sin romperlo.

## 5. Aislamiento

- Cada bloque corre en **su propio contexto** (la implementación se decide más tarde: iframe,
  worker o realm separado; el contrato es el mismo en los tres).
- **No tiene `window` ni `document` globales**, ni acceso al almacén de otro bloque. Lo que necesita
  del exterior se lo da el shell por una superficie declarada.
- **Un error de un bloque no tumba la app.** El shell lo encierra, lo marca «no disponible» y sigue.
- **Un bloque básico hace lo suyo solo.** Si no funciona sin otros, no es básico: es media pieza.
- **El básico no dibuja lo que no le han aportado** — ni como hueco vacío ni como rótulo vacío.

## 6. Decisiones abiertas (necesito respuesta del dueño)

| # | pregunta | coste de elegir mal | recomendación |
|---|---|---|---|
| 1 | ¿Los bloques se ven como **pestañas**, como **widgets en un tablero**, o como **páginas**? | cambiar esto toca el shell y todas las capturas | **sección en la navegación** si tiene pantalla (`naturaleza: seccion`); widget solo para aportes. Es lo que enseña el prototipo |
| 2 | ¿Pueden **añadir secciones a la navegación principal**? | si no pueden, Estudio no cabe; si pueden sin control, la nav crece sin freno | **sí, con separador «Bloques»** y filtradas por naturaleza |
| 3 | ¿Cuántos bloques **simultáneos**? ¿Hay límite? | sin límite, la barra se vuelve un cajón de sastre | no un número de instalados, sino **7 visibles** en la nav; el resto se pliega en «Más» |
| 4 | ¿Los puentes son **síncronos o asíncronos**? | un puente síncrono obliga a que el otro bloque esté montado: acopla el arranque | **asíncronos** (Promesa), con tiempo máximo y error atribuido |
| 5 | ¿Pueden **depender entre sí**? ¿Cómo se gestiona? | dependencias circulares y desinstalaciones que dejan mudo a otro | **sí, declaradas**: al quitar un bloque se avisa a quién deja mudo, y no se instala nada con dependencia ausente |
| 6 | ¿Un bloque puede **leer datos de una sección base**? | si puede escribir en ellos, la base deja de ser fija | **leer sí por puente, escribir no**; la escritura pasa por la acción del usuario en la base |

*Estas seis siguen abiertas: la revisión del 2026-10-19 no las contestó, y añadió las decisiones
7 a 10 del bloque «Cambios en v0.2».*

---

## 7. Puentes bidireccionales

**Qué cambia.** En la v0.1 el puente iba en una sola dirección: el bloque declaraba lo que
`necesita` de la base y punto. Eso deja un agujero: si el bloque es **opcional** (Evaluaciones lo
es), la base no tiene forma de saber que puede pedirle algo, **ni de qué hacer si no está**. La
v0.2 lo resuelve cambiando la unidad: **el puente declara las dos puntas y su opcionalidad**.

### 7.1 Forma

```json
"puentes": [
  {
    "id": "evaluaciones.etiquetas",
    "de": "evaluaciones",
    "a": "base.calendario",
    "direccion": "bloque→base",
    "forma": {
      "entra": { "desde": "fecha-ISO", "hasta": "fecha-ISO" },
      "sale": [{ "evento": "id", "etiqueta": "texto", "ramo": "texto" }]
    },
    "opcional": true,
    "siFalta": "el calendario no dibuja la etiqueta ni el rótulo «Ramo»: no queda hueco vacío"
  }
]
```

El mismo puente visto desde el otro lado —la base preguntando si hay etiquetas— **es el mismo
puente**, no otro: se declara una vez y se lee de las dos puntas.

### 7.2 Las tres direcciones

| dirección | quién llama a quién | ejemplo | ¿puede faltar? |
|---|---|---|---|
| **base→bloque** | la base avisa al bloque de algo que ya pasó | `calendario.alAnadirEvento(ev)` | sí, si el bloque es `opcional` |
| **bloque→base** | el bloque pregunta o pide a la base | `calendario.leerEventos(d,h)` | **no**: sin la base no hay app |
| **bloque↔bloque** | **no se permite en la v0.2** | — | — |

**Por qué bloque↔bloque no se permite todavía.** Un puente directo entre dos bloques acopla dos
piezas que el usuario instaló por separado, y al quitar una hay que decidir qué pasa con la otra.
En la v0.2 **todo cruce pasa por la base**: la base es el único sitio que sabe qué está instalado.
Es una limitación **declarada**, no un olvido; se levanta cuando exista la regla de dependencias
(decisión 5).

### 7.3 Reglas

1. **Un puente declara las DOS puntas.** `"de"` y `"a"`. Un puente con una sola punta no es un
   puente: es una llamada interna, y no se acepta.
2. **`opcional` decide qué pasa si falta la otra punta.** `true` → se monta igual y **degrada**
   (dice `siFalta`). `false` → **no se monta**, y se dice qué falta. **Nada por defecto**: el campo
   es obligatorio, igual que los permisos.
3. **Un puente opcional no puede dejar hueco.** Si falta, la base **no dibuja el rótulo, ni la
   columna, ni el marco vacío** (AU-24 de la norma de la casa: el básico no dibuja lo que no le han
   aportado). `siFalta` existe para que esa degradación sea una decisión escrita, no un accidente.
4. **El sentido de escritura exige permiso aparte.** `bloque→base` de lectura no pide nada extra;
   escribir en la base pide un permiso con nombre (`calendario:anadirEvento`) que el usuario ve
   **antes** de instalar.
5. **`necesita` ≠ `consume`.** `necesita`: sin esto **no se monta**. `consume`: lo lee **si está**,
   y sin ello funciona degradado. Confundirlos es lo que hace que un bloque opcional bloquee la
   instalación de la app entera.
6. **Un puente es datos, no código.** El que llama no sabe cómo está hecho el otro; por eso el otro
   se puede reescribir sin romper el puente.
7. **El fallo se atribuye al puente**, con su `id`, y no a «algo ha fallado» (AU-30).

### 7.4 El puente declarativo: `panelContexto`

Hay un caso que no es una llamada: **el panel derecho**. El shell dibuja el panel, pero **lo que se
escribe dentro de él en una sección de un bloque lo declara el bloque**. Eso se resuelve con un
puente **declarativo**: no hay función, hay datos.

```json
"panelContexto": {
  "titulo": "Sesión de hoy",
  "campos": [
    { "etiqueta": "Tiempo hoy", "valor": "50 min" },
    { "etiqueta": "Racha",     "valor": "3 días" },
    { "etiqueta": "Sesiones",  "valor": "2 de 4" }
  ]
}
```

- **Sin `panelContexto`**, el panel dice **«Sin contexto»**: no se deja vacío ni se rellena con
  datos de la base (eso sería contaminación: AU-46).
- El shell **pinta** esos campos; el bloque **no toca el DOM del panel**. Igual que un puente, el
  bloque no sabe con qué está hecho el panel.
- Las secciones **base** (Calendario, Tareas) tienen su contexto **escrito por la base**, no por un
  bloque: es información suya y no pide permiso a nadie.

## 8. Configuraciones en capas

**Qué cambia.** En la v0.1 los ajustes eran «del sistema» o «del bloque». La v0.2 añade el caso que
rompe ese esquema: **un bloque quiere poner un ajuste DENTRO de una sección base** —Evaluaciones
quiere «Mostrar etiquetas por ramo» dentro de Calendario— sin escribir en Calendario ni duplicar la
pantalla de ajustes.

### 8.1 Forma

El manifiesto declara `configuraciones[]`, y **cada una dice en qué sección se pinta**:

```json
"configuraciones": [
  {
    "id": "evaluaciones.calendario",
    "seccion": "calendario",
    "titulo": "Mostrar etiquetas por ramo",
    "campos": [
      { "tipo": "checkbox", "id": "activo", "default": true }
    ]
  }
]
```

| campo | qué es |
|---|---|
| `id` | opaco y único, con el bloque como prefijo (`<bloque>.<nombre>`). Es la clave de almacén. |
| `seccion` | **dónde se PINTA**: `propia` · `calendario` · `tareas` · `sistema` · `ajustes` |
| `titulo` | el rótulo que ve el usuario. Dice qué hace, no cómo está hecho. |
| `campos[]` | los controles: `{tipo, id, default, opciones?}` |

- **`seccion` no dice de quién es el ajuste: dice dónde se ve.** El dueño se sabe por el `id`, y
  **se escribe en el sitio donde se ve** (AU-25): «Mostrar etiquetas por ramo — *Evaluaciones*».
- **Tipos cerrados en la v0.2**: `checkbox` · `number` · `text` · `select` (con `opciones[]`) ·
  `rango` (con `min` y `max`). Un tipo nuevo se añade al contrato antes de usarlo.
- **Un `id` de campo es único dentro de su configuración**, y la configuración entera es suya: nadie
  más escribe en `evaluaciones.calendario.activo`.

### 8.2 Las cuatro capas

| capa | quién la declara | dónde se ve | ejemplo |
|---|---|---|---|
| **sistema** | el shell | Ajustes → General | tema, idioma, escala de texto |
| **sección (base)** | la base | Ajustes → esa sección | vista por defecto del calendario |
| **bloque** | el bloque, `seccion: "propia"` | Ajustes → Bloques instalados | `estudio.pomodoro.duracion` |
| **pack** | el pack, `seccion: "sistema"` | Ajustes → Packs | `academics.grupo.activo` |

**Y una capa transversal, que es la novedad**: un bloque con `seccion: "calendario"` **pinta dentro
de la sección Calendario**, en el bloque de «Configuraciones de bloques». No crea sección propia.

### 8.3 Reglas

1. **Un ajuste se declara UNA vez y se ve en UN sitio** (AU-37). Si aparece en dos, uno de los dos
   miente y el usuario no sabe cuál manda.
2. **El valor se guarda por el `id` de la configuración, no por el sitio donde se pinta.** Mover un
   ajuste de sitio no pierde valores; duplicar la declaración sí.
3. **Al desinstalar el bloque, sus ajustes se van con él** (son suyos). Al **quitar** el bloque (sin
   desinstalar), los ajustes **se quedan guardados** pero **dejan de pintarse**: no hay controles
   huérfanos en una pantalla de una sección base.
4. **Si el ajuste no puede pintarse** porque su bloque no está, la sección base **no dibuja el grupo
   «Configuraciones de bloques»** (ni un título vacío): es el mismo principio del puente opcional.
5. **El ajuste conserva el valor descartado.** Si dos capas dan valores distintos al mismo concepto,
   gana la **más específica** y la otra **no se borra**: queda como «valor de fábrica» visible
   (AU-14: la fusión no pierde cambios). «Gana la última escritura» está prohibido.
6. **Cambiar de forma un ajuste exige migración de solo añadir** (§3). Si un campo desaparece, el
   valor guardado queda huérfano, **se detecta** y se avisa antes de tocarlo (AU-36).
7. **Un ajuste no cambia el significado de una acción de la base.** El idioma y la escala de texto
   son del sistema y **ningún bloque se entera** (AU-40).

### 8.4 Ejemplos de las cuatro capas

```json
"configuraciones": [
  { "id": "estudio.pomodoro", "seccion": "propia", "titulo": "Pomodoro",
    "campos": [ { "tipo": "number", "id": "duracion", "default": 25 } ] }
]
```

```json
"configuraciones": [
  { "id": "academics.grupo", "seccion": "sistema", "titulo": "Agrupar sus bloques bajo «Academics»",
    "campos": [ { "tipo": "checkbox", "id": "activo", "default": true } ] }
]
```

## 9. Packs

**Qué es un pack.** Un manifiesto que **no trae pantalla**: trae una lista de bloques que se
instalan juntos. Es la respuesta a «Academics no es la base»: Academics es **un encargo** que
instala Estudio, Notas, Malla y Tiempo.

### 9.1 Forma

```json
{
  "id": "academics",
  "nombre": "Academics",
  "version": "1.0.0",
  "autor": "Mimo Labs",
  "licencia": "MIT",
  "naturaleza": "pack",
  "zona": "ninguna",
  "compatible": ">=0.1.0 <1.0.0",
  "instala": ["estudio", "notas", "malla", "tiempo"],
  "permisos": [],
  "ofrece": [],
  "necesita": [],
  "consume": [],
  "configuraciones": [],
  "datos": { "posee": [], "conservarAlQuitar": true },
  "recursos": { "icono": "iconos/academics.svg", "estilos": [] }
}
```

- **`instala[]` es una lista de `id` de bloque**, no de nombres visibles (§2: la identidad no se
  deriva del nombre). Un pack que instala por nombre se rompe el día que alguien renombra.
- **`zona: "ninguna"`** porque un pack no ocupa sitio. No es un hueco: es una pieza que solo actúa
  en el momento de instalar.
- **Un pack no aporta puentes propios.** Los puentes son de los bloques.
- **Puede aportar `configuraciones` de grupo** con `seccion: "sistema"` (el «Agrupar sus bloques» de
  arriba). Son suyas y se van con él.

### 9.2 Reglas

1. **Instalar un pack es UNA confirmación que dice TODO**: autor, versión, los bloques que trae, el
   tamaño sumado, **la suma de los permisos** de sus bloques y qué guarda cada uno. No se enseña un
   permiso por bloque en un modal que hay que scrollear: se enseña la lista entera.
2. **La compatibilidad del pack es la del más exigente.** Si un bloque del pack es incompatible, el
   pack **no se instala** y se dice **cuál** falla y por qué. No se instala «lo que se pueda».
3. **Quitar un pack quita sus bloques**, y **no toca** los que ya estaban instalados por separado
   antes del pack. El pack recuerda qué instaló él.
4. **Un pack no puede contener otro pack** en la v0.2. Anidar packs es anidar sorpresas.
5. **Un pack no tiene pantalla.** No aparece en la navegación; aparece en **Ajustes → Packs** y en
   la **Gestión de bloques**.
6. **Los bloques de un pack siguen siendo bloques**: se pueden quitar por separado, y el pack dice
   que está incompleto («3 de 4»), **sin desinstalar nada por su cuenta**.

## 10. Catálogo y canales

**Qué es el catálogo.** El índice de lo que se puede instalar, y **de dónde viene cada cosa**. Un
bloque no aparece de la nada: o viene con la app, o está en una carpeta del usuario, o se descarga.

### 10.1 Forma

```json
"catalogo": {
  "canal": "bundled",
  "origen": "datos/bloques.json",
  "actualizado": "2026-10-19",
  "huella": null,
  "firma": null
}
```

Y cada entrada del catálogo es **el manifiesto completo** de §2: el catálogo es un **índice de
manifiestos**, no un formato distinto que haya que traducir.

### 10.2 Los tres canales

| canal | de dónde llega | red | verificación | qué se puede instalar |
|---|---|---|---|---|
| **`bundled`** | viene dentro de la app | **no** | huella en el propio paquete | lo que la app trae, y solo eso |
| **`local`** | una carpeta del usuario | **no** | huella declarada en el manifiesto | cualquier bloque con manifiesto válido |
| **`remoto`** | una URL | **sí** | **huella + firma** | solo si la firma valida |

- **`bundled` es el canal de fábrica** y el que usa este prototipo. No pide red: se puede auditar el
  fichero.
- **`local` es el canal de quien escribe su propio bloque.** Una carpeta, un manifiesto, sus ficheros.
  Es el camino que se documenta primero porque **no necesita infraestructura**.
- **`remoto` no está implementado en la v0.2.** Se declara el hueco (canal, huella, firma) para que
  el día que se implemente **no cambie la forma del manifiesto**. Su formato de transporte y de firma
  **no se define aquí**: se decide cuando exista (decisión 9).

### 10.3 Reglas

1. **El catálogo es una lista, no una verdad.** Instalar es validar el manifiesto **de la entrada**
   y montarla; el catálogo no puede instalar nada por sí solo.
2. **Sin huella no hay instalación en `local` ni en `remoto`.** En `bundled` la huella la pone el
   paquete: si no cuadra, el bloque está roto y se avisa.
3. **La app NO se actualiza sola** (AU-35). Un catálogo nuevo **no cambia nada instalado** hasta que
   el usuario lo decida, y la decisión dice **qué** cambiará.
4. **Se puede usar sin red.** `bundled` y `local` funcionan con el equipo desconectado; el almacén es
   local (AU-13) y el catálogo también.
5. **Un catálogo que no se puede verificar no se usa** (y se dice por qué: huella que no cuadra,
   fichero que no está, manifiesto inválido). Es el mismo criterio que un puente roto: **se detecta
   antes de usarse** (§3.6).
6. **El canal se enseña antes de instalar.** El usuario sabe si lo que va a instalar vino con la app,
   de una carpeta suya o de internet.
