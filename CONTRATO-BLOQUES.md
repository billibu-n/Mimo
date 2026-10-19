# CONTRATO DE BLOQUES — Mimo Nuevo

> **Versión 0.3 (prototipo)** · 2026-10-19 · Estado: **propuesta para revisión del dueño**
> Este documento fija **qué tiene que cumplir** un bloque para que la base no se rompa cuando
> llegue el primero escrito por otro. No decide todavía la implementación (WebView, worker o
> iframe): decide el contrato.
>
> **La v0.1 y la v0.2 se conservan enteras debajo.** Las secciones §1 a §10 **no se han editado**: hay
> material citándolas y reescribirlas borraría el registro de lo que se aprobó. La v0.3 añade **tres
> secciones** (§11, §12 y §13) y **precisa** un punto de §2 sin cambiarlo (§11.2).

## Cambios en v0.3

La v0.2 decidió la forma; la v0.3 la **pone a prueba con el primer bloque real** (Malla) y escribe lo
que solo se ve al construirlo. Cada punto dice **dónde se lee**.

1. **El primer bloque con pantalla de verdad, y la superficie para tenerla.** Hasta ahora el shell
   dibujaba la pantalla de todo bloque («próximamente»), así que un bloque no podía tener la suya sin
   editar el shell. Ahora el bloque expone `montar` · `desmontar` · `panel` · `refrescar` y el shell
   solo sabe **montar** lo que el mapa declara. → **§12**
2. **El panel derecho gana una forma dinámica.** La v0.2 declaraba `panelContexto` como lista de
   etiqueta·valor (resumen fijo). Un detalle que cambia con la selección necesita otra forma: el bloque
   **describe** `{titulo, bloques[{h, items}]}` y el shell lo dibuja. `modo` en el manifiesto dice cuál
   de las dos se usa. → **§12.4**
3. **Una clave de almacén por bloque.** `datos.posee` nombra **colecciones lógicas**; la clave física es
   `mimo.bloque.<id>`. Sin esto, una escritura del bloque tocaba tres claves y podía quedar a medias.
   → **§11.2** (precisa §2; no lo cambia)
4. **Extensiones: piezas declaradas y NO activas.** `extensiones[]` con `porDefecto:false`. Declarar no
   es instalar; el bloque funciona sin todas (AU-21). Malla declara tres (`editor`, `importar-pdf`,
   `simulador`). → **§11.3**
5. **`recursos.scripts` y el porte del cálculo.** Un bloque con lógica declara **qué ficheros** monta y
   en qué orden; y el cálculo se porta de la aplicación anterior **sin** portar su dibujo, comparando
   los estados con el mismo respaldo real. → **§11.1** y **§11.4**
6. **Importar y exportar con dueño.** Un bloque entra y sale **solo con sus colecciones**: seis de las
   doce claves del respaldo son de Malla. La fusión de todos los bloques es de la 4e, y tendrá que
   cumplir AU-14/AU-15/AU-17. → **§13**

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

---

## 11. El bloque Malla: manifiesto, motor y almacén

**Qué estrena la v0.3.** La v0.2 decidió la **forma** de los bloques, pero ninguna entrada del catálogo
tenía pantalla de verdad: todas decían «próximamente». La v0.3 escribe **el primero funcional** y, al
escribirlo, aparecen cuatro cosas que solo se descubren haciendo: **dónde vive lo que un bloque guarda**
(§11.2), **qué es una extensión declarada y no activa** (§11.3), **cómo se porta el cálculo de la
aplicación anterior sin portar su dibujo** (§11.4) y **cómo se comprueba que el porte es fiel** (§11.5).

### 11.1 Forma

```json
{
  "id": "malla",
  "nombre": "Malla curricular",
  "version": "1.0.0",
  "autor": "Mimo Labs",
  "licencia": "MIT",
  "naturaleza": "seccion",
  "zona": "main",
  "compatible": ">=0.1.0 <1.0.0",
  "permisos": ["almacen:propio", "puente:calendario.leerEventos"],
  "ofrece": [
    "malla.getCurso(codigo)",
    "malla.getCursosDeSemestre(n)",
    "malla.getEstadoCurso(codigo)",
    "malla.getRamosActivos()"
  ],
  "necesita": [],
  "consume": ["calendario.leerEventos"],
  "configuraciones": [],
  "extensiones": [
    { "id": "editor", "nombre": "Editor de malla", "porDefecto": false },
    { "id": "importar-pdf", "nombre": "Importar PDF de malla", "porDefecto": false },
    { "id": "simulador", "nombre": "Simulador de notas", "porDefecto": false }
  ],
  "datos": {
    "posee": ["malla.cursos", "malla.aprobados", "malla.config"],
    "conservarAlQuitar": true
  },
  "recursos": {
    "icono": "iconos/malla.svg",
    "estilos": ["bloques/malla/estilos.css"],
    "scripts": [
      "bloques/malla/motor.js",
      "bloques/malla/importar.js",
      "bloques/malla/exportar.js",
      "bloques/malla/ui.js"
    ]
  },
  "panelContexto": {
    "modo": "dinamico",
    "puente": "malla.panel",
    "titulo": "Detalle del curso",
    "siFalta": "el panel derecho dice «Sin contexto · sin curso seleccionado»"
  }
}
```

El fichero exacto es `prototipo/bloques/malla/manifiesto.json`, y `datos/bloques.json` lleva la **misma**
entrada más `descripcion` y `lanzamiento` (que son de la ficha del catálogo, no del contrato).

- **Todas las claves de §2 siguen siendo obligatorias** aunque valgan vacío o `null`. `datos/bloques.json`
  ya lo exigía para los ocho manifiestos de la v0.2; Malla no es la excepción.
- **`recursos.scripts` es nuevo en la v0.3.** La v0.2 declaraba los estilos y **no decía cómo llega el
  código**. Un bloque con lógica tiene que decirlo: el shell carga esos ficheros **en el orden
  declarado**, una vez, y en un ámbito propio (§5). Solo aplica a `bundled` y `local`; un bloque `remoto`
  traerá su propio transporte cuando exista (decisión 9, sigue abierta).
- **`ofrece` es el contrato del motor, no una lista de deseos.** Malla ofrece cuatro funciones y la
  pantalla usa exactamente esas cuatro más las de apoyo de §11.4. Si una pantalla futura necesita más,
  se amplía el manifiesto **antes** de usarla.

### 11.2 Dónde vive lo que un bloque guarda

**Regla nueva, y precisa lo que §2 daba a entender.** §2 decía «`datos.posee`: claves de almacén que son
suyas». Eso se leía como una clave física por colección, y con el primer bloque real no cuadra:

> **La clave física es UNA por bloque: `mimo.bloque.<id>`. `datos.posee` nombra las COLECCIONES lógicas
> que son suyas, no los nombres de las claves.**

Por qué se decide así, y qué se gana:

| antes (§2 leído al pie de la letra) | ahora (v0.3) |
|---|---|
| `malla.cursos`, `malla.aprobados`, `malla.config` = tres claves | tres **colecciones** dentro de `mimo.bloque.malla` |
| una escritura del bloque toca tres claves: puede quedar a medias | una escritura es **atómica**: una clave, un `setItem` |
| el shell tiene que abrir tres claves antes de montar | abre **una** y sabe a quién pertenece por el nombre |
| borrar el bloque = `removeItem` de tres claves, y si una falla quedan restos | borrar = **una** operación (§3.3, §5) |

Lo que **no** cambia: `datos.posee` sigue siendo la declaración que el usuario lee **antes** de instalar
(AU-32), y sigue siendo la lista de lo que se borra al desinstalar. Cambia **dónde** está, no **qué** es.

La forma del almacén de Malla (**v1**) — es la que escribe `motor.js` y la que lee todo el bloque:

```json
{
  "_v": 1,
  "catalogo": { "MA2001": { "nombre": "Cálculo Integral", "creditos": 6, "nivel": 2,
                "semestre_num": 2, "tipo": "obligatorio", "en_malla": true, "anual": false,
                "requisitos": ["MA1001"], "requisitos_o": [["FI2004","IQ2212"]],
                "desbloquea": ["MA3001"], "aprobacion": "74" } },
  "aprobados": { "MA1001": true },
  "importado": { "codigos": ["MA1001"], "cuando": "2026-09-19" },
  "ramos": [ { "codigo": "MA2002", "nombre": "…", "creditos": 6, "nivel": 4 } ],
  "notas": { "MA2002": 5.8 },
  "ajustes": { "av": { "colores": { "aprobado": "#16a34a", "curso": "#eab308",
                "disponible": "#2563eb", "bloqueado": "#94a3b8" } } },
  "niveles": [ { "nivel": 1, "titulo": "Semestre I", "ramos": ["BT1211"] } ]
}
```

- **`_v` es obligatorio y no se toca al importar.** Es lo que permite migrar **solo añadiendo** (§3.4)
  cuando el formato cambie. Un almacén sin `_v` se trata como vacío, no como «v1 por suerte».
- **`ramos` son los ramos ACTIVOS**, no la malla entera: lo que el usuario está cursando ahora. La malla
  completa es `catalogo` + `niveles`.
- **`notas` es opcional.** Viene del respaldo si existe; Malla **no** es el bloque de calificaciones y no
  inventa notas que no le hayan dado (AU-24).
- **`ajustes.av.colores` son colores del USUARIO**, no del kit. La pantalla los aplica como variables CSS
  en línea, con los tokens del tema como respaldo. En `estilos.css` no aparece ni un literal (§5).
- **Nada duplicado:** el nombre de un curso vive en `catalogo` una vez; `aprobados`, `ramos` y `notas`
  solo llevan códigos y valores. (AU-10, AU-73.)

### 11.3 Extensiones: declaradas, y ninguna activa

**Qué es una extensión.** Una pieza del bloque **que no se monta por defecto**: código y pantalla que
existen en el manifiesto pero no en el arranque. Es distinta de `configuraciones` (§8: valores que el
usuario cambia) y de `instala` (§9: otros bloques que trae un pack). Una extensión **es del bloque** y se
enciende dentro de él.

| extensión | qué añadiría | por qué no está activa en la v0.3 |
|---|---|---|
| `editor` | escribir la malla: crear, editar y borrar ramos y prerrequisitos | el editor de Academics (30 KB, `02-editor-ramos.js`) escribe el catálogo **a mano**; portarlo sin antes decidir qué pasa con las notas y con los aprobados importados deja dos fuentes de verdad |
| `importar-pdf` | leer la malla desde un PDF del plan de estudios | necesita un lector de PDF (21 KB en Academics) y un criterio de confianza: un PDF mal leído **inventa prerrequisitos**, y eso se propaga a todos los estados |
| `simulador` | marcar ramos como «aprobados en simulación» y ver qué se desbloquea | el simulador de Academics ya está parametrizado (`calcularCon(aprob)`), pero su pantalla vive dentro del dibujo de la malla; mostrar dos estados a la vez (real y simulado) es una decisión de diseño, no un porte |

Las cuatro reglas de una extensión:

1. **Declarar no es instalar.** `porDefecto: false` significa «no se monta hasta que el usuario la
   encienda». Ni el shell ni el bloque la dan por hecha.
2. **El bloque funciona sin todas.** Es AU-21 aplicada a la extensión: si Malla necesitara el editor para
   dibujar, el editor no sería una extensión, sería el bloque.
3. **Enciende y apaga sin perder datos.** Una extensión no cambia la forma del almacén de forma
   incompatible; si la cambia, la migración es de solo añadir (§3.4).
4. **Lo que la extensión añade se ve como añadido.** Un ramo inventado por el simulador no se pinta igual
   que uno aprobado de verdad (AU-25, AU-109: no solo por color).

### 11.4 El motor: se porta el cálculo, NO el dibujo

El material de origen es la aplicación anterior, en `/tmp/mimo-explore/` (solo lectura). Lo que se portó:

| función portada | de dónde | qué hace |
|---|---|---|
| `calcularCon(aprob)` | `js/malla/03-dibujo.js:22` | estados de todos los ramos con un juego de aprobados dado |
| `aprobadosSet()` | `js/malla/03-dibujo.js:10` | une los aprobados a mano con los marcados en los semestres |
| `requisitosFaltantes(cod)` | `js/malla/03-dibujo.js:52` | qué falta para desbloquear un ramo, con los grupos «basta uno» |
| `cadena(cod, dir)` | `js/malla/03-dibujo.js:62` | la línea completa de prerrequisitos (antes) o de desbloqueos (después) |
| `herederoDe(cod)` | `js/malla/03-dibujo.js:73` | equivalencias: quién hereda el aprobado de quién |
| `esAnual` / `semestresQueOcupa` | `js/malla/03-dibujo.js:82,91` | ramos anuales y cuántos semestres ocupan |
| `aplanar(grupos)` | `js/malla/03-dibujo.js:51` | abre los grupos `requisitos_o` en una lista |
| normalización del catálogo | `js/comun/03-catalogo.js` | campos obligatorios, `semestre_num`, `desbloquea` |
| lectura de la malla (filas/JSON) | `js/malla/01-importar.js` | base del importador, **sin** la UI del modal |

**Lo que NO se portó, y por qué:** `renderMalla`, `nodoHTML`, `dibujarLineas`, `chipCurso`,
`renderMallaDetalle`, `acomodarAnuales` (`03-dibujo.js`), el modal del editor (`02-editor-ramos.js`),
la lectura de PDF (`04-pdf.js`) y el simulador de pantalla (`06-simulador.js`). Todo eso es **dibujo**:
la pantalla nueva se escribe contra los tokens del prototipo y no hereda ni una clase de Academics
(AU-49 dice mirar el material; no dice copiarlo).

**El cálculo no es opinable.** `getEstadoCurso(codigo)` devuelve uno de cuatro valores, con esta
prioridad y en este orden:

1. **`aprobado`** — está en `aprobados`.
2. **`curso`** — está en `ramos` (los activos de ahora).
3. **`disponible`** — no lo está, pero **todos** sus `requisitos` están aprobados **y** **cada** grupo de
   `requisitos_o` tiene **al menos uno** aprobado. (Este segundo requisito es el que faltaba en la
   versión anterior y marcaba `MI3230` como disponible sin tener `FI2004`: el caso está en el comentario
   del origen, `03-dibujo.js:36-38`.)
4. **`bloqueado`** — lo demás.

Un ciclo en el grafo (un ramo que acaba siendo prerrequisito de sí mismo) **no cuelga la recursión**: se
memoiza y se corta con el conjunto «visto», y el ramo que cierra el ciclo queda `bloqueado`.

**Sin `window` ni `document`.** El motor es cálculo puro (§5). Se hace **una** concesión explícita: lee y
escribe su almacén por **una sola puerta** (`leer()` / `escribir()`), que en el navegador es
`localStorage` y en una prueba de Node es un doble en memoria. Ninguna función de cálculo toca el almacén
salvo para pedirlo una vez. La línea de exportación (`window.MimoMallaMotor = …`) es la única que nombra
`window`.

### 11.5 Cómo se comprueba que el porte es fiel

No basta con que la pantalla se vea: **el cálculo se compara con el de la aplicación anterior**, con el
mismo respaldo real del dueño (formato 2, 125 KB, 84 cursos, 18 aprobados a mano). La comprobación que se
corrió, y que cualquiera puede repetir:

1. **Node con `localStorage` falso**, cargando `motor.js` como script: la malla del respaldo da los
   cuatro estados, sin excepción y sin colgarse en ningún ciclo.
2. **Un caso que DEBE fallar** (AU-51): un fichero con `formato: 1` y un JSON roto. El importador los
   rechaza **con mensaje** y **no toca el almacén**: los datos anteriores siguen idénticos.
3. **Ida y vuelta**: importar → exportar → reimportar da los mismos números (cursos, aprobados, activos,
   notas, colores). Si no los da, la exportación está inventando o perdiendo algo.

**Resultado medido** (respaldo real del dueño, `datos/malla-ejemplo.json`, 125 335 B):

| comprobación | resultado |
|---|---|
| importación | 84 cursos · 18 aprobados · 5 ramos activos · 5 notas · 12 niveles · 4 colores |
| estados | 18 aprobado · 5 curso · 15 disponible · 46 bloqueado = **84** |
| fidelidad contra Academics | **84 de 84** estados idénticos uno a uno; ramos activos idénticos; `requisitosFaltantes` idéntico en los 20 bloqueados comparados |
| códigos que sobran del motor viejo | **6** (MI5071, CR240, MI5041, MI4900, CR264, MI5901): solo aparecen como prerrequisito y **no están en el catálogo del dueño**. El motor nuevo **no los inventa** y el importador **avisa**: «7 prerrequisitos apuntan a ramos que no vienen en el archivo» |
| ida y vuelta | exportar → texto → importar = mismos 84 estados, mismas notas, mismos niveles |
| rechazos | formato 1, JSON roto, sin `estado`, catálogo vacío: mensaje claro y almacén **byte a byte intacto** |
| aislamiento | el único `setItem` es `mimo.bloque.malla`; `mimo.idioma` y `mimo.bloques.instalados` intactos |
| navegador | 0 excepciones y 0 errores de consola al montar, importar, seleccionar y desinstalar |

---

## 12. La pantalla de un bloque: la superficie `montar` · `desmontar` · `panel`

### 12.1 Por qué hacía falta

Hasta la v0.2, la pantalla de un bloque **la dibujaba el shell**: `navegacion.js` creaba una sección
genérica con la ficha del manifiesto y un cartel de «próximamente». Así un bloque **no podía tener
pantalla propia sin editar el shell**, que es justo lo que §5 prohíbe. La v0.3 cierra ese agujero con una
superficie mínima: el shell **sabe montar** una pantalla de bloque sin saber qué hay dentro.

### 12.2 Forma

El bloque se registra en `window.MimoBloques` y expone cuatro funciones y un id:

```js
window.MimoBloques = window.MimoBloques || {};
window.MimoBloques.malla = {
  id: 'malla',
  montar: function (raiz, ctx) {},  // la sección .pantalla[data-panel="malla"] ya está en el DOM y vacía
  desmontar: function () {},        // quita oyentes y deja la sección como estaba
  panel: function () {},            // null o la estructura de §12.4
  refrescar: function () {}         // repinta con el almacén actual
};
```

El shell declara qué bloques tienen pantalla propia en **un mapa** (`PANTALLAS_PROPIAS`), y lo hace una
sola vez. Añadir un bloque nuevo con pantalla es **una línea en ese mapa y un manifiesto**: no se toca
ni la navegación ni el panel.

### 12.3 El contexto que el shell entrega

`ctx` es la **superficie declarada** que §5 promete. Es pequeña a propósito:

| miembro | qué es | por qué no más |
|---|---|---|
| `t(clave, params, respaldo)` | el traductor del shell, con respaldo en español | un bloque no debe cargar su propio idioma: el idioma es del sistema (AU-40) |
| `aviso(texto, tipo, icono)` | el toast del shell (`''`, `ok`, `warn`, `bad`) | si cada bloque inventara su aviso, habría cinco formas de decir lo mismo (AU-41) |
| `ir(pantalla)` | navegar a otra sección | hay un solo enrutador |
| `pedirPanel()` | «repinta el panel derecho» | el bloque **no dibuja** el panel: lo describe (§12.4) |

**La UI nunca toca el DOM del shell**: ni `#panel`, ni `.marco`, ni el `<body>`. Solo escribe dentro de
`raiz`. Es la regla de §5 aplicada al dibujo, y es lo que permite que un bloque se caiga sin llevarse la
ventana (AU-29).

### 12.4 `panelContexto` dinámico

La v0.2 declaró `panelContexto` como **lista de etiqueta·valor** (§7.4): sirve para un resumen fijo
(«Tiempo hoy · 50 min»). Para un detalle que **cambia con la selección** —el curso que el usuario acaba de
tocar— una lista estática no vale, y el bloque no puede dibujar el panel sin romper §12.3.

La v0.3 añade la segunda forma, y el manifiesto dice **cuál usa**:

```json
"panelContexto": { "modo": "dinamico", "puente": "malla.panel" }
```

`panel()` devuelve `null` o esta estructura, sin HTML:

```js
{
  titulo: 'Detalle del curso',
  bloques: [
    { h: 'MA2001 · Cálculo Integral', items: [ { t: 'Estado', meta: 'disponible' } ] },
    { h: 'Prerrequisitos', items: [ { t: 'MA1001', meta: 'aprobado' } ] },
    { h: 'Desbloquea', items: [ { t: 'MA3001', meta: '' } ] }
  ]
}
```

Y el **shell** la traduce a su forma: `<h2 class="panel__h">` + `<ul class="ctx-lista">` +
`<li class="ctx-item">`. El bloque describe; el shell dibuja.

- **`null` no es un error: es «no hay selección».** El panel dice «Sin contexto · sin curso seleccionado»
  y **no** dibuja un detalle vacío (§7.4: un bloque sin `panelContexto` no inventa contexto; y AU-91: un
  hueco no se dibuja).
- **`modo` es obligatorio** cuando hay `panelContexto`. Sin `modo`, se lee como la forma estática de la
  v0.2 (compatibilidad: los manifiestos de la v0.2 no cambian).
- **El panel no es un sitio para operar.** Lo que se pulsa se pulsa en la pantalla; el panel informa
  (§12.1 y AU-01: el panel es lo primero que se repliega).

### 12.5 Reglas

1. **Montar es idempotente.** Llamar `montar` dos veces sobre la misma sección no duplica nada; y
   `desmontar` deja la sección **vacía**, no a medias.
2. **Simetría estricta** (§3.5): instalar → sección, nav y panel; desinstalar → no queda ni la sección,
   ni el botón de la barra, ni la zona de panel con restos.
3. **El bloque no pide red para montar.** Malla se monta con lo que hay en su almacén, que puede estar
   vacío: en ese caso dibuja **el vacío con su acción** —«trae tus datos»—, no una rejilla de cero
   cursos (AU-122).
4. **Un error del bloque se atribuye al bloque** (§5, AU-30): el shell lo encierra, marca la sección
   «no disponible» y sigue.
5. **Accesible por teclado, y el estado no se distingue solo por color** (AU-109, AU-125): cada tarjeta de
   curso lleva su código, y su estado se lee en texto además del color.
6. **Responsive declarado**: la rejilla de semestres se reordena a 1440, 1200 y 960 **sin scroll
   horizontal** del contenido. El panel derecho es lo primero que se repliega (AU-01), y lo decide el
   shell, no el bloque.

### 12.6 Lo que esta sección deja abierto

- **Quién enciende una extensión** y dónde se ve: el manifiesto la declara, pero la pantalla que las
  enciende no existe todavía. Decisión abierta (la 11, al final).
- **Si un bloque puede pedir que el panel se abra solo** al seleccionar un curso, o si abrir el panel es
  siempre una acción del usuario.
- **El texto de la pantalla**: hoy va en español en el propio bloque, con respaldo de `t()` cuando la
  clave existe. Si el prototipo se queda bilingüe, hay que decidir si los textos de un bloque viven en
  los ficheros de idioma del shell o en un paquete de idioma del propio bloque.

---

## 13. Importar y exportar: el formato 2 y la fusión

**Qué resuelve.** El usuario tiene datos vivos en la aplicación anterior. Un bloque nuevo que empieza
vacío no es un bloque nuevo: es una pérdida. La v0.3 fija **cómo entra** un respaldo y **cómo sale** una
parte, sin que la fusión de todos los bloques se improvise después (eso es la Iteración 4e).

### 13.1 Quién es dueño de qué

El respaldo real (formato 2) es **un solo fichero con las cosas de todos los bloques**: catálogo,
aprobados, ramos activos, notas, colores, y también horario, evaluaciones y marcas de tiempo. La regla es
la de §5 y §11.2:

> **Un bloque importa y exporta SOLO sus colecciones. Lo que no es suyo no lo mira, no lo copia y no lo
> borra.**

De las 12 claves de `estado` del respaldo del dueño, Malla toma **seis**: `catalogo`, `aprobados`,
`importado`, `extras[0].ramos` (o los ramos del semestre activo), `metas_ramo[*].nota` y
`ajustes.av.colores`. Las demás (`tiempo`, `ficha`, `sem`, `agregados`, `fuera`, `v`, `activo`) son de
otros bloques o del estado del sistema.

### 13.2 Importar

```js
MimoMallaImportar.desdeArchivo(file)   // -> Promise<{ ok, resumen, avisos } | { ok:false, error }>
MimoMallaImportar.desdeObjeto(obj)     // idem, sin fichero
```

Reglas:

1. **Se valida ANTES de escribir** (§3.6, AU-36). Si el fichero no es formato 2, no es JSON o no trae
   `estado`, **se rechaza con un mensaje que dice qué pasó** y el almacén **no se toca**. Es el caso que
   se prueba a propósito (§11.5.2).
2. **El catálogo se normaliza, no se copia a ciegas.** Todo curso acaba con `requisitos: []`,
   `requisitos_o: []`, `desbloquea: []`, `semestre_num` y `nivel` numéricos.
3. **Una referencia rota no rompe la importación**: un prerrequisito que apunta a un código que no está en
   el catálogo deja ese curso `bloqueado` y **se avisa**; no se inventa el curso que falta.
4. **Reemplaza solo lo de Malla.** Las seis colecciones se sustituyen; `_v` se conserva. No se escribe
   en `mimo.bloques.instalados`, ni en `mimo.idioma`, ni en la clave de ningún otro bloque.
5. **Importar dos veces no acumula basura**: la segunda importación deja lo mismo que la primera (es la
   prueba de ida y vuelta de §11.5.3).

### 13.3 Exportar

```js
MimoMallaExportar.aFormato2()   // -> objeto formato 2, solo con lo de Malla
MimoMallaExportar.comoTexto()   // -> JSON legible
MimoMallaExportar.resumen()     // -> { cursos, aprobados, activos }
```

La salida tiene **la forma del formato 2** (`estado.catalogo`, `estado.aprobados`, `estado.importado`,
`estado.extras[0].ramos`, `estado.ajustes.av.colores`, `niveles`), para que el fichero completo que
genere el shell en la 4e sea **un solo JSON** y no un injerto.

- **Aquí no se fusiona nada.** La exportación de Malla emite **su parte**; juntar las partes de todos los
  bloques en un fichero es del shell (Iteración 4e), y esa fusión tendrá que cumplir AU-14, AU-15 (nada de
  «gana el último») y AU-17 (determinista).
- **El botón de la v0.3 es honesto y no miente**: dice que la exportación completa llega en la 4e y
  enseña el resumen real de lo que hay (AU-120: un cartel que promete, o hace, o explica por qué no).

### 13.4 Lo que esta sección deja abierto

- **El nombre y el destino del fichero exportado** (descarga, carpeta, diálogo del sistema).
- **La fusión de bloques** y qué pasa cuando dos bloques guardan la misma colección: la 4e lo decide.
- **Los ficheros de otros bloques**: Malla sabe leer su parte de un respaldo ajeno, pero no hay todavía
  una regla general de «quién importa qué» cuando hay cinco bloques con datos en el mismo fichero.

---

## Lo que la v0.3 NO decide

Sigue abierto, y no se ha inventado en esta iteración:

| # | pregunta | por qué importa |
|---|---|---|
| 7 | Un pack que se desinstala, ¿se lleva los datos de sus bloques? | ya en la v0.2; sigue sin respuesta |
| 8 | ¿Un bloque puede aportar a dos secciones base a la vez? | idem |
| 9 | El canal remoto, ¿exige firma además de huella? | idem; la v0.3 no lo toca |
| 10 | Un tema aportado por un bloque, ¿se va al quitarlo? | idem |
| 11 | ¿Quién enciende una extensión, y dónde se ve? | el manifiesto ya las declara (§11.3), pero no hay pantalla que las encienda |
| 12 | ¿El panel derecho se abre solo al seleccionar, o siempre lo abre el usuario? | toca `ir()` y la sensación de que la app «responde» |
| 13 | Los textos de un bloque, ¿en los idiomas del shell o en un paquete del bloque? | decide si un bloque de terceros puede estar traducido sin tocar la app |
| 14 | ¿La malla se edita dentro de Malla o el editor es una extensión que se instala aparte? | si es extensión, la malla básica es de solo lectura; si no, `editor` sobra del manifiesto |
