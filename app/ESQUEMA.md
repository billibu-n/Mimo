# Esquema de datos de Mimo

**Versión:** 1 · **App:** 1.2.0-beta.1 · **Módulo:** `app/js/esquema.js`

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
  "appVersion": "1.2.0-beta.1",
  "exportado": "2026-10-28T23:00:00.000Z",
  "datos": {
    "tema": "clasico",
    "prefs": {"idioma": "es", "inicioSemana": "lunes", "hora": "24", "panelAncho": "320"},
    "instalados": ["tiempo", "malla", "calificaciones", "estudio"],
    "kits": {"academics": ["malla", "calificaciones", "estudio", "evaluaciones"]},
    "panel": {"calendario": "contexto"},
    "tareas": [], "notas": [], "eventos": [], "sesiones": [],
    "periodos": [], "periodoActivo": null,
    "estudio": {"metaSemanal": 10, "metasRamo": {}, "metasSemana": {}},
    "tiempoModo": "crono", "tiempoHijos": ["crono", "temporizador", "pomodoro", "alarmas"],
    "alarmas": []
  },
  "extensiones": {}
}
```

Campos obligatorios del sobre: `schema`, `version`, `datos`. `app`, `appVersion`, `exportado` y
`extensiones` son informativos y aditivos.

## 3. Malla

```json
{
  "schema": "mimo.malla",
  "version": 1,
  "app": "Mimo",
  "appVersion": "1.2.0-beta.1",
  "exportado": "2026-10-28T23:00:00.000Z",
  "datos": {
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

`app/pruebas/gate-esquema.py` mide: migración del respaldo sintético, catálogo completo,
aprobados con créditos, eventos/tareas, ida y vuelta de los tres documentos y conservación de
campos desconocidos.
