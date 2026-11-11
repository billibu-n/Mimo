# Esquema de datos de Mimo

> **Beta.3 (R60):** `cursos` y `sesiones` tienen dominio compartido
> (`app/js/dominio/`) y emiten eventos. Calificaciones ya no borra cursos ni copia
> eventos en `estado.eventos`: los componentes con fecha se derivan en el
> calendario. `evaluaciones` se eliminó y se limpia de los estados viejos. El
> esquema de exportación sigue siendo el mismo.

**Versión:** 1 · **App:** 1.2.0-beta.2 · **Módulo:** `app/js/esquema.js`

La app guarda el estado vivo en `localStorage['mimo.shell.v1']`. Para moverlo entre equipos
hay **tres documentos JSON**, no uno gigante sin contrato:

| Documento | `schema` | Qué lleva | Qué no lleva |
|---|---|---|---|
| Entorno | `mimo.entorno` | prefs, tareas, notas, eventos, periodos, sesiones, tiempo, estudio, bloques instalados | cursos y calificaciones |
| Malla | `mimo.malla` | plan de cursos, calificaciones y metadatos académicos | tareas, notas, eventos |
| Respaldo | `mimo.backup` | los dos anteriores en un solo archivo | nada |

El nombre del archivo es una convención, no el contrato: manda `schema`.

## 1. Regla aditiva

1. Todo documento declara `schema` y `version`. La versión **mayor** puede cambiar el contrato;
   la menor solo agrega campos.
2. Un lector de la misma versión mayor **conserva** las claves que no conoce. No las borra,
   no las reinterpreta y las vuelve a escribir al exportar.
3. Los datos de un bloque nuevo van en una clave propia del entorno o dentro de
   `extensiones`. Nunca dentro de `cursos` o `calificaciones` si no son académicos.
4. Los campos desconocidos de un curso se guardan en el mismo objeto del curso. Los de una
   tarea, nota o evento, igual. Los normalizadores usan `conservar()` para no perderlos.
5. Si un documento trae una versión mayor desconocida, se importan las partes conocidas y se
   conserva el resto en `extensiones`; no se rechaza en bloque ni se borra.
6. Un bloque que se quita de la barra no borra sus datos: quedan en el entorno y vuelven si se
   reinstala.

## 2. Entorno

```json
{
  "schema": "mimo.entorno",
  "version": 1,
  "app": "Mimo",
  "appVersion": "1.2.0-beta.2",
  "exportado": "2026-10-28T23:00:00.000Z",
  "datos": {
    "tema": "clasico",
    "prefs": {"idioma": "es", "inicioSemana": "lunes", "hora": "24", "panelAncho": "320", "fuente": "clasica"},
    "instalados": ["tiempo", "malla", "calificaciones", "estudio"],
    "kits": {"academics": ["malla", "calificaciones", "estudio"]},
    "panel": {"calendario": "contexto"},
    "tareas": [], "notas": [], "eventos": [], "sesiones": [],
    "periodos": [], "periodoActivo": null,
    "estudio": {"metaSemanal": 10, "metasRamo": {}, "metasSemana": {}},
    "tiempoModo": "crono", "tiempoHijos": ["crono", "temporizador", "pomodoro", "alarmas"],
    "alarmas": [],
    "progreso": {"v": 1, "categorias": [], "metas": [], "registros": []}
  },
  "extensiones": {}
}
```

Campos obligatorios del sobre: `schema`, `version`, `datos`. `app`, `appVersion`, `exportado` y
`extensiones` son informativos y aditivos.

### Preferencias de interfaz

- `panelAncho` es el ancho en píxeles del panel derecho, entre **240 y 560**. Se guarda al soltar
  el asa; el panel siempre arranca cerrado, por eso ya no existe `panelAbierto`.
- `fuente` acepta `clasica`, `sistema`, `mono`, `personalizada` o una de las diez familias
  (`cantarell`, `adwaita`, `liberation`, `nimbus`, `carlito`, `caladea`, `liberation-serif`,
  `latin-modern`, `montserrat`, `noto-mono`). `fuenteNombre` solo se usa con `personalizada`.

### Tareas y series

Cada entrada de `datos.tareas` conserva los campos de siempre (`titulo`, `tipo`, `padre_id`,
`prioridad`, `contexto`, `fecha`, `nota`, `orden`). `fecha` es opcional: `""` deja la tarea en
la tira **Sin fecha** del tablero. `nota` es la descripción en Markdown; se pinta con el mismo
motor de Notas.

`estado` es `pendiente` o `hecha`; `hecha` lo refleja y `hechaEn` guarda el día ISO del cierre
para que **Hechas esta semana** cuente por cierre y no por vencimiento. `situacion` es la
variable de fecha: `atrasada` (abierta con fecha anterior a hoy), `en_fecha` (con fecha de hoy
o futura) o `sin_fecha`. Se recalcula en cada normalización y no sustituye a `hecha`. Cada
ocurrencia que pinta el tablero lleva además una clave `id@fecha` (o `id@sin-fecha`), que la
distingue de otra ocurrencia de la misma serie.

Una tarea que se repite añade `recurrencia` (o `null`):

```json
"recurrencia": {
  "frecuencia": "diaria",
  "intervalo": 1,
  "dias": [1, 2, 3, 4, 5],
  "desde": "2026-11-05",
  "fin": "nunca",
  "hasta": "",
  "veces": 10,
  "hechas": {"2026-11-05": true}
}
```

- `frecuencia`: `diaria`, `semanal`, `mensual` o `anual`.
- `intervalo`: cada cuántas unidades (1 = todos).
- `dias`: días ISO 0 (domingo) a 6 (sábado) para diaria y semanal. Vacío en diaria = todos;
  vacío en semanal = el día de `desde`. El caso «lunes a viernes» es `[1,2,3,4,5]`.
- `desde`: ancla de la serie. Si la tarea no tenía fecha al crearla, es el día de alta.
- `fin`: `nunca`, `fecha` (con `hasta`) o `cuenta` (con `veces`).
- `hechas`: ocurrencias cumplidas, por fecha ISO. No se duplica la tarea por ocurrencia: la
  serie se calcula al pintar y solo se guarda lo cumplido. Completar una fecha no pone
  `hecha` en la tarea; `hecha` sigue describiendo una tarea suelta.

### Progreso

`datos.progreso` es el bloque instalable del mismo nombre. No se guarda el progreso: se
calcula con `app/js/dominio/progreso.js` a partir de dos listas.

```json
"progreso": {
  "v": 1,
  "categorias": [
    {"id":"general","nombre":"General","icono":"diana","tono":"ac","orden":0,"colapsada":false},
    {"id":"salud","nombre":"Salud","icono":"corazon","tono":"ok","orden":1,"colapsada":false}
  ],
  "metas": [
    {"id":"m1","nombre":"Agua","unidad":"L","tipo":"suma","sentido":"subir",
     "periodo":"dia","objetivo":2,"inicio":null,"desde":"2026-10-01","hasta":"",
     "paso":0.25,"decimales":2,"tono":"ac","icono":"agua","fuente":"manual",
     "categoriaId":"salud","orden":0,"tareaId":"t1","notaId":"","archivada":false,
     "creada":"2026-11-11T14:00"}
  ],
  "registros": [
    {"id":"r1","metaId":"m1","valor":0.5,"cuando":"2026-11-11T08:10",
     "nota":"","tareaId":"","notaId":"","origen":"manual"}
  ]
}
```

- `tipo`: `suma` (acumula), `ultimo` (último valor), `mejor` (mejor marca) o `conteo`.
- `sentido`: `subir` (mínimo) o `bajar` (máximo o techo). No es lo mismo un piso que un techo:
  un techo no se “cumple” a las 0 unidades; se evalúa al cerrar el período.
- `periodo`: `dia`, `semana`, `mes`, `anio` o `unica`. La semana empieza el lunes. `unica`
  no se reinicia.
- `objetivo` e `inicio`: `inicio` es opcional y solo sirve para medir el avance de una meta
  de trayecto (30 → 50 kg, 90 → 75 kg). Sin `inicio`, no se inventa un porcentaje: se muestra
  la distancia.
- `fuente`: `manual` o `sesiones`. `sesiones` no copia datos: lee `datos.sesiones` y suma
  `minutos / 60` en el período. Si Estudio no está instalado, la meta se muestra sin fuente
  y no se borra.
- `tareaId` y `notaId`: vínculos opcionales. La tarea es la única que manda sobre su estado;
  completarla no cambia el registro. El vínculo se guarda en la meta, no en la tarea.
- `archivada`: oculta la meta de la lista activa sin borrar sus registros.
- `categoriaId`: categoría a la que pertenece la meta. Si falta o apunta a una categoría
  inexistente, cae en `general`. `orden` es el orden elegido por el usuario; al arrastrar una
  ficha se actualizan `categoriaId` y `orden`.

Cada categoría es una ficha plegable con `id`, `nombre`, `icono`, `tono`, `orden` y
`colapsada`. `general` siempre existe, se puede renombrar y cambiar de icono/color, pero no
se elimina. Eliminar otra categoría mueve sus metas a `general`; no borra ninguna meta.

Cuando una categoría supera **6 metas** (3 en ventana angosta), la sección muestra ese
límite y un botón «Ver N más»; el resto no se pinta hasta pedirlo. Las categorías se pliegan y el estado `colapsada` se guarda.
El orden dentro de una categoría se cambia arrastrando el asa `⋮⋮` de la ficha o con
`Alt+↑/↓` sobre una ficha enfocada.

Cada ocurrencia de una meta periódica se identifica con `metaId@período` (por ejemplo,
`m1@2026-11-11` o `m1@2026-11`); el período de una meta `unica` es `metaId@unica`. Un vínculo
o una nota que necesite apuntar a una ocurrencia concreta usa esa clave, no solo `metaId`.
Las claves de período son: día ISO, lunes de la semana, `AAAA-MM`, `AAAA` o `unica`.

Quitar el bloque no borra `progreso`. Eliminar una meta sí borra sus registros, con deshacer.
La exportación de `mimo.entorno` y el respaldo llevan la clave tal cual: es aditiva y no
cambia la versión del documento.

## 3. Malla

```json
{
  "schema": "mimo.malla",
  "version": 1,
  "app": "Mimo",
  "appVersion": "1.2.0-beta.2",
  "exportado": "2026-10-28T23:00:00.000Z",
  "datos": {
    "carrera": {"titulo": "Ingeniería Civil", "universidad": "Universidad de Chile", "pais": "Chile"},
    "cursos": [{
      "codigo": "MA1001", "nombre": "Introducción al Cálculo", "creditos": 6, "nivel": 1,
      "requisitos": [], "requisitos_o": [], "aprobacion": 74, "tipo": "obligatorio",
      "enMalla": true, "cerrado": false, "aprobado": false, "enCurso": false,
      "alias": "", "color": "", "semestre": "I", "desbloquea": ["MA1002"]
    }],
    "calificaciones": {
      "MA1001": {
        "categorias": [{"nombre": "Controles", "peso": 100}],
        "componentes": [{"nombre": "Control 1", "categoria": "Controles", "nota": 5.5, "fecha": "", "peso": 1}],
        "examen": {"activo": true, "peso": 40, "nota": null, "reemplaza": null},
        "eximicion": {"activa": false, "modo": "todas", "condiciones": []},
        "notaMin": 4, "meta": 5
      }
    }
  },
  "extensiones": {}
}
```

- `carrera` guarda el título, la universidad y el país de la malla. Viaja con ella y no se
  mezcla con el entorno.
- `cursos` es el **plan** (lo que se dibuja en Malla). Un curso con `enMalla:false` existe para
  calificaciones o historial, pero no se dibuja.
- `calificaciones` solo lleva los ramos con datos. Un ramo sin entrada se calcula al abrirlo.
- Los pesos de categorías se guardan en escala 0–100. La migración vieja convierte 0,1 / 0,75 /
  0,15 a 10 / 75 / 15.
- Los campos desconocidos de un curso o de una calificación se conservan.

## 4. Respaldo

```json
{
  "schema": "mimo.backup",
  "version": 1,
  "entorno": { "...": "datos del entorno" },
  "malla": { "cursos": [], "calificaciones": {} },
  "extensiones": {}
}
```

## 5. Formato 2 de Mimo Academics

`formato: 2` con `estado` se migra completo:

| Origen | Destino |
|---|---|
| `estado.catalogo` (87) | `malla.cursos` con nombre, créditos, nivel, requisitos, tipo, aprobación |
| `estado.agregados[*]`, `extras[*].ramos`, `estado.aprobados` | cursos activos/aprobados y `enCurso` |
| `estado.sem[activo].cats/components/examen/exim` | `malla.calificaciones` (solo ramos con datos) |
| `extras[*].eventos` | `entorno.eventos` (con hora y nota de la ficha) |
| `estado.sem[activo].nuevas` + `personal.nuevas` | `entorno.tareas` (con `tipoLegacy`, hora y nota) |
| `estado.sem[*].sesiones` | `entorno.sesiones` |
| `extras[*].semanas` | `entorno.periodos` |
| `estado.sem[activo].metas_ramo`, `metas.semanal` | `entorno.estudio` |
| `estado.sem[activo].minutos`, `extras[*].semanas_estudio` | `entorno.estudio.minutosSemana` y `semanasEstudio` (histórico conservado) |
| `estado.ajustes.av` | `entorno.tema` y `entorno.prefs` |
| `estado.tiempo` | `entorno.tiempoModo`, `tempMin`, `pomo` |
| `estado.asistencia`, `estado.tipos` | `entorno.asistencia`, `entorno.tiposLegacy` |

Los IDs viejos se prefijan (`ev`, `ti`, `tp`, `si`) para no chocar con los nuevos. Las fichas
(`descripcion` y `temario`) se guardan como `nota` de la tarea o del evento.

## 6. Compatibilidad

| Archivo | Se importa | Efecto |
|---|---|---|
| `mimo.backup` | sí | reemplaza entorno y malla |
| `mimo.entorno` | sí | reemplaza lo general; conserva la malla actual |
| `mimo.malla` | sí | reemplaza cursos/calificaciones; conserva lo general |
| `formato:2` | sí | migra ambos |
| `{v:1, tipo:"mimo-malla"}` | sí | importa solo la malla |
| estado crudo (`tareas`, `cursos`, `prefs`…) | sí | se normaliza y reemplaza todo |
| cualquier otra cosa | no | aviso, sin tocar el estado |

## 7. Prueba

`pruebas/gate-esquema.py` mide: migración del respaldo sintético, catálogo completo,
aprobados con créditos, eventos/tareas, ida y vuelta de los tres documentos y conservación de
campos desconocidos.
