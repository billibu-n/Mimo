# Comprobar a mano lo de la ronda 95 (T002, T003, T004, T005)

Guía para el dueño. Cada punto dice **qué hacer** y **qué tiene que pasar**; si pasa otra cosa, es un defecto y se
mide con el instrumento de esa sección antes de tocar nada. Abre la app con `?reset=1` para partir de fábrica
(`armazon-paneles.html?reset=1`); el `?reset=1` se queda en el historial del navegador, no borra datos viejos de
otras claves (los migra, ver punto 2).

## 0. Dónde está el código de esta ronda

```
cd ~/workspace/proyectos/mimo-nuevo
git log --oneline 7542e1d..HEAD          # lo que se hizo hoy, de lo viejo a lo nuevo
git show --stat e0a1c98                  # T005, el último bloque
ls tablero/js/comun/ tablero/js/*.js     # sustrato y motores
ls tablero/medir-*.py                    # los cuatro instrumentos
```

## 1. Tiempo completo (T002)

- Pincha en las horas, minutos o segundos del reloj y escribe otro número: salta a ese valor. En **Temporizador**
  editas lo que queda; en **Cronómetro**, lo acumulado.
- Empezar, **pausar**, parar son tres botones: cada uno se pone gris cuando no toca.
- Gabinete → instala Pomodoro; trabajo 1, corto 1, largo 2, «cada 2», empezar: el descanso arranca solo.
- Alarmas: un recordatorio con día y hora; avisa una vez. El sonido sale del mp3 de la referencia.
- Registro: el censo de siete días cuadra con tus sesiones de la semana en curso.

Se mide con: `python3 tablero/medir-tiempo2.py` → `RESUMEN: 0 choque(s) de 17 medidas`.

## 2. El almacén único (T003) — lo que más se nota y menos se ve

- Abre las herramientas del navegador (F12) → Consola y pega:

```js
JSON.parse(localStorage['mimo.datos.v1'])
```

Tiene que salir un objeto con `{v:1, armazon, tiempo, idioma, catalogo, malla, ajustes, respaldo, migrado}`.
- Si tenías partida de antes, en `migrado.de` aparecen las claves viejas que se recogieron
  (`mimo.armazon.v1`, `mimo.bloque.tiempo`, `mimo.idioma`) y **siguen existiendo** en `localStorage`: la migración
  copia, no borra. Es el seguro: si algo saliera mal, tus datos viejos están intactos.
- Recarga dos veces: no vuelve a migrar (el `cuando` de `migrado` no cambia).

## 3. Malla del semestre (T004)

- Da de alta dos ramos y ponle a uno un requisito del otro. El que depende queda **bloqueado**; aprueba el primero
  y pasa a **disponible** sin recargar.
- Mueve un ramo de nivel desde su editor y **recarga (F5)**: se queda donde lo pusiste (esto lo mide el instrumento
  en las medidas 10 y 11, y hasta hoy dependía de un apaño que retiré).
- Electivos van al final de la rejilla; reordena columnas y el 99 sigue el último.
- Importar/exportar: exporta JSON y CSV, y vuelve a importar el JSON: tiene que devolver el mismo semestre.
- Pegar la foto: pega el texto ya extraído de la malla (4 líneas arman 2 columnas). **El PDF por coordenadas no se
  porta**: la referencia exige `pdf.js` de ~1 MB y el tablero es vanilla. Es HUECO declarado, no defecto.

Se mide con: `python3 tablero/medir-malla.py` → `RESUMEN: 0 choque(s) de 16 medidas`.

## 4. Estudio y Calificaciones (T005)

- Estudio: mete minutos en dos ramos de la semana; mira KPIs y barras. Cambia la meta de un ramo (la propia manda
  sobre la base) y aparecen o desaparecen avisos de dedicación; descartar uno y sumarle 45 min funciona.
- Calificaciones: crea categorías con pesos (por ejemplo Controles 60 %, Tareas 40 %) y notas. Con 6,0 y 4,0 la
  presentación da **5,2 aprobado**. Activa examen al 40 %: con 5,0 la final da **5,12** y «necesito 7,2» para un 6.
  Eximición por presentación ≥ 5: **5,2 eximido**. Mínima 5,5 con examen 2,0: **3,92 reprobado**.
  Sin categorías: la nota es nula y dice «faltan datos» (no inventa un cero).
- Recarga: todo sigue ahí.

Se mide con: `python3 tablero/medir-estudio.py` → `RESUMEN: 0 choque(s) de 18 medidas`.

## 5. Lo de siempre, que no se haya roto

- Botón de idioma: todo cambia en caliente, **incluidos** los rótulos de Pomodoro y Recordatorios (ese fue el
  defecto que se colgó en T002 y se arregló; ahora el diccionario tiene 238 claves y 0 desajustes en los dos idiomas).
- Abre el panel derecho, pliega el riel, pon la ventana estrecha: nada se desborda y la losa mide **544 px** a 1280
  y la sangría **32 px** a 1100.

Se mide con: `python3 tablero/medir-tablero.py --fichero tablero/armazon-paneles.html` → «las tres pieles dentro de
su techo», y `python3 tablero/medir-tiempo2.py | grep losa`.

## 6. Lo que ya se sabe que no está (para no reportarlo como fallo)

| hueco | por qué |
|---|---|
| Recordatorios solo con la pestaña abierta | `file://` no registra service worker |
| Censo y calendario en la semana/mes en curso | no se navega a semanas anteriores todavía (T008 lo cambia) |
| PDF de la malla por coordenadas | necesita `pdf.js`; queda el pegado del texto |
| Importar/exportar Excel-CSV de Estudio | no portado; sí JSON |
| `examen.reemplaza` guarda índice | al reordenar categorías no remapea |
| Apuntes libres | es T012, función **nueva** pedida por el dueño; T006 quedó superada |
| Tareas, Calendario, Ajustes, idioma completo | son T007, T008, T009 y T010: aún no ejecutadas |

## 7. Si algo no cuadra

Apunta tres cosas y con eso lo puedo medir: **qué hiciste**, **qué esperabas** y **qué salió** (y si puedes, el
mensaje de la consola del navegador). El orden de trabajo es: reproducir con el instrumento de esa sección →
comparar con lo que decía la app anterior (`referencia/mimo-app-53cc22d/`) → arreglar con su medida antes y después.
