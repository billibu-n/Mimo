# AGENTS.md — Mimo

Estas reglas son para cualquier agente que retome el proyecto. La app se llama
**Mimo**, no “mimo-nuevo” ni “MIMO”. La documentación de usuario va en español.

## Antes de tocar código

1. Lee `docs/ARQUITECTURA-BLOQUES.md`; es el informe de arquitectura, decisiones y
   estado. Si el contexto se perdió, empieza por §1, §3.4, §5, §7 y §10.
2. Mira la rama y el estado:
   ```bash
   git status --short --branch
   git log --oneline -5
   ```
3. La rama de beta.3 es `t/mimo-beta3-bloques`; nace de `main` en `c71ebe3` (R47).
   El último commit de código de este corte es `7a68ba0` (R57); el informe se
   actualizó en `ae7e75d` (R58).
4. No toques `main` ni publiques releases/tags sin autorización del dueño.

## Reglas de arquitectura

- **Un solo despliegue, muchos módulos.** Mimo es un monolito modular con
  microkernel; no micro-frontends, iframes ni workers.
- **Núcleo:** registro, estado, historial, eventos, puertos, i18n, shell y layout.
  No conoce el dominio.
- **Dominio:** `app/js/dominio/cursos.js` y `app/js/dominio/sesiones.js`. No tocan
  DOM ni leen el estado global; reciben y devuelven datos.
- **Bloques:** UI y flujo. Se montan/desmontan; no llaman funciones internas de otro
  bloque. Lo que necesitan se declara como capacidad/puerto o se escucha como evento.
- **Registro:** `app/js/nucleo/registro.js` (`MimoRegistro`) es la fuente de
  estructura. `BLOQUES`, `BASE` y `ORDEN` son vistas compatibles derivadas; no
  agregues listas paralelas.
- **Base fija:** Calendario, Tareas, Notas y Ajustes no se quitan. Ajustes es shell;
  los otros tres son bloques base. La independencia se prueba con los opcionales.
- **Opcionales:** Tiempo, Malla, Calificaciones y Estudio. Pueden faltar; la app debe
  seguir funcionando y ninguno debe asumir que otro está.
- **Datos con dueño:** cursos y sesiones son dominio; tareas, notas, eventos y
  calificaciones son de sus bloques. Quitar un bloque no borra sus datos.
- **Sin cascadas:** no borres calificaciones al borrar un curso, ni eventos de otro
  bloque. Si un dato queda huérfano, se conserva y se muestra como tal.
- **Eventos:** notifican; no ordenan acciones. Para una acción explícita usa un
  comando/puerto. No encadenes eventos.
- **Calendario:** acepta fuentes (`registrarFuenteCalendario`). Calificaciones deriva
  sus componentes con fecha; no copia eventos en `estado.eventos`.
- **`evaluaciones` está pendiente:** el dueño indicó que tendrá su propio sistema de
  notas y clasificación. No la elimines, no la fusiones y no le inventes UI.

## Restricciones de beta.3

- Sin React/Vue/Svelte, sin bundler y sin módulos ES. Se usan scripts clásicos y el
  registro; los gates abren `app/index.html` como `file://`.
- No cambies `localStorage['mimo.shell.v1']` ni los documentos `mimo.entorno`,
  `mimo.malla` y `mimo.backup` sin migración y gate.
- Conserva los IDs de sección (`#p-calendario`, `#p-tareas`, `#p-notas`,
  `#p-tiempo`, `#p-malla`, `#p-calificaciones`, `#p-estudio`, `#p-ajustes`) y el
  orden de tabs/`Ctrl+1..9`.
- Conserva `app/tutorial.json` y `publicacion/tutorial.json` idénticos.
- La app debe seguir funcionando offline, sin red y sin cuenta.
- `MIMO_HEADLESS=1` y la ventana fuera de pantalla deben seguir funcionando.

## Verificación

Antes de commitear:

```bash
python3 pruebas/correr-gates.py
```

Son **17 gates web**: 16 de navegador y `gate-arquitectura` estático. Todos deben
quedar en verde. `gate-tauri` se corre aparte, después de compilar el binario.

Si un gate falla, no lo “arregles” cambiando el selector sin entender el cambio de
DOM. Primero revisa si rompiste un invariante.

## Flujo de trabajo

- Commits pequeños y verificables: `Rxx: qué cambia`.
- Un commit por unidad; no mezcles refactor grande con producto.
- `git push origin t/mimo-beta3-bloques` para publicar la rama.
- No hagas `push` a `main` sin autorización.
- No borres ramas remotas viejas sin preguntar; `origin` todavía tiene
  `t/mimo-ronda14`, `t/mimo-sync` y `t/mimo-tauri`, ya fusionadas.
- Si actualizas arquitectura, decisiones, esquema o contrato de bloques, actualiza
  también `docs/ARQUITECTURA-BLOQUES.md`, `docs/BLOQUES.md` o `docs/ESQUEMA.md`
  según corresponda, en el mismo commit.

## Estado y pendientes

Hecho en este corte:

- Registro y manifiestos; base fija; `BLOQUES`/`BASE`/`ORDEN` derivados.
- Host dinámico: el HTML de Calendario, Tareas, Notas, Tiempo, Malla,
  Calificaciones y Estudio vive en `app/js/bloques/<id>/vista.js`; `index.html`
  ya no tiene esas secciones.
- Ciclo de vida `montar`/`desmontar` en el registro, con raíz y `AbortSignal` para
  el bloque piloto Notas.
- Dominio de cursos y sesiones, con eventos `cursos.*` y `sesiones.*`.
- Calificaciones sin Malla; Malla sin Calificaciones; Tiempo sin Estudio; Estudio
  sin Tiempo.
- Calendario por fuentes; sin copia de eventos de Calificaciones.
- Catálogo armado desde el registro, instalación con dependencias, ficha de detalle
  y desmontaje al quitar.
- `evaluaciones` eliminada y desvinculada del catálogo, del kit, del esquema y del
  estado guardado.
- `gate-bloques` y `gate-arquitectura`; 17 gates verdes.

Pendiente para el cierre de beta.3:

- `gate-tauri` (33 medidas) después de compilar.
- `CHANGELOG.md`, notas de release y versión de publicación.
- Medir FPS y confirmar offline/headless sobre el binario.
- Extraer la lógica interna de Malla, Calificaciones y Estudio de `shell.js` a sus
  carpetas. La vista, el CSS y el ciclo de vida ya están separados.

## Archivos clave

- `docs/ARQUITECTURA-BLOQUES.md` — informe completo, decisiones y fases.
- `app/js/nucleo/registro.js` — registro y validación.
- `app/js/dominio/cursos.js` — entidad curso.
- `app/js/dominio/sesiones.js` — entidad sesión.
- `app/js/shell.js` — shell y bloques en transición.
- `pruebas/gate-bloques.py` — independencia de bloques.
- `pruebas/gate-arquitectura.py` — reglas estáticas.
