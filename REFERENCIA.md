# REFERENCIA — de dónde se porta

La app anterior (**Mimo Academics**) está congelada. Este proyecto la sustituye por completo, pero
**no se porta copiando: se analiza y se incorpora** lo que haga falta, con interfaz nueva.

Para que ninguna sesión futura dependa de la red ni de `/tmp`, aquí hay una **copia local de solo
lectura** del repositorio anterior:

```
referencia/mimo-app-53cc22d/      (4,2 MB, 129 ficheros versionados, .git incluido)
commit: 53cc22d2a5b155c6e8513da0452ad3cb0631b180  "Publicar la version web en GitHub Pages"
tag de referencia: 1.1.2-desktop
```

Está en `.gitignore`: **no se versiona aquí** (es material ajeno, y pesa). Se puede leer, buscar y
`git log` dentro de ella. **No se edita**: si hay que cambiar algo, se cambia en este proyecto.

## Cómo se consulta

```
cd referencia/mimo-app-53cc22d
git log --format="%h %ad %s" --date=short -- js/tiempo      # historia de un modulo
wc -l js/*/*.js                                            # tamano por modulo
```

## Mapa del viejo, medido (2026-10-20)

9.743 líneas de JS en un espacio de nombres global; el orden de carga lo manda `js/orden.txt`
y **importa**: todo comparte namespace, así que una función solo puede usar lo cargado antes.

| Módulo | Líneas | Destino en el nuevo |
|---|---|---|
| `js/malla/` (importar 504, editor 529, dibujo 554, pdf 464, simulador 110) | 2.161 | bloque `malla` + extensiones `editor`, `importar-pdf`, `simulador` |
| `js/tiempo/01-tiempo.js` | 726 | bloque `tiempo` |
| `js/notas/` (motor 184 + notas 417) | 601 | bloque `calificaciones` |
| `js/estudio/01-estudio.js` | 411 | bloque `estudio` |
| `js/semestre/` (calendario, editor-evento 262) | ~600 | sección base `calendario` + bloque aporte `evaluaciones` |
| `js/tareas/01-tareas.js` | 206 | sección base `tareas` |
| `js/ajustes/` (9 ficheros) | 1.960 | armazón (ajustes) |
| `js/comun/` (14 ficheros) | 2.592 | armazón (estado, catálogo, almacén, i18n) |
| `css/tema-*.css` | 7 temas | bloque `kit-temas-oscuros` |
| `escritorio/src-tauri/` | Tauri 2 | `escritorio/` del nuevo (rpm primero) |

## Dato clave: el nuevo ya habla el formato del viejo

`bloques/malla/exportar.js` emite **formato 2**, el mismo del respaldo de la app anterior, y
`js/comun/06-arranque.js:318-348` (en la referencia) es el importador que define ese formato. Por eso
la migración de datos del dueño no es un problema aparte: cada bloque exporta su parte en formato 2 y
la fusión entre bloques es la iteración 4e.

## Estado del tiempo en el viejo (para el bloque `tiempo`)

Forma canónica del estado, en `js/comun/03-catalogo.js:290-298`:

```js
tiempo:{ modo:'cronometro',
         crono:{acumulado:0, corriendo:false, inicio:null},
         temp:{objetivoSeg:1500, restante:0, corriendo:false, inicio:null},
         ramo:null, semana:null, dia:null,
         pomodoro:{fase:'trabajo', restante:null, corriendo:false, inicio:null,
                   trabajos:0, racha:0, hoy:null,
                   config:{trabajo:25, corto:5, largo:15, cada:4}},
         recordatorios:[], recSonido:'propia' }
```

En formato 2 viaja como `estado.tiempo` y se importa con fusión profunda y `migrarTiempo(E)`.
