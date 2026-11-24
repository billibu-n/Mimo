# Paquetes de iconos de Mimo

Mimo no elige iconos de un solo juego. Cada icono es una referencia

```
pack:icono
```

donde `pack` declara **nombre, procedencia y licencia**. La interfaz muestra esos
datos al elegir; este documento los repite y explica cómo añadir un pack sin tocar
el código.

## Los tres orígenes

| Pack | Origen | Licencia | Cómo se carga |
|---|---|---|---|
| `nativo` | Mimo · catálogo de ramos derivado de Lucide | ISC | Viene en la app; es el respaldo. |
| `kde` | KDE Breeze Icons (KDE Plasma), muestra de 8 simbólicos | LGPL-2.0-or-later / LGPL-3.0-or-later | Viene en `app/js/dominio/pack-kde.js`; se elige en el selector. |
| `usuario-…` | Carpeta local que importa el usuario | Uso personal | Botón **Cargar carpeta** del selector. |

El pack nativo conserva los 121 iconos de ramo y los ids antiguos (`diana`, `agua`,
`libro`…): una meta o un ramo que ya existía sigue pintando sin migración.

## Cómo importar una carpeta

1. Abre un selector de icono (identidad de un ramo o una meta de Progreso).
2. Escribe el nombre del pack. Si lo dejas vacío, se llama «Mi pack».
3. Pulsa **Cargar carpeta** y elige una carpeta con archivos `.svg`.
4. El pack aparece en la lista y queda activo. Se guarda en `estado.iconos`
   (`localStorage['mimo.shell.v1']`) y viaja en el respaldo.

Se aceptan hasta 300 SVG por pack, 300 KB por archivo y 3 MB en total. Los archivos
se sanean antes de guardarse: se descartan `<script>`, manejadores `on*`, `href`
externos, animaciones y estilos con `url()` o `expression`. Solo quedan geometría,
transformaciones y pintura (`fill`, `stroke`, opacidades, `currentColor`).

Volver a importar una carpeta con el mismo nombre **conserva los ids**: las metas,
ramos y categorías que ya usaban esos iconos siguen resolviendo.

## Tolerancia a packs futuros

- **Nombres y tamaños desconocidos:** el manifiesto no exige un tamaño fijo. Cada
  icono declara su `viewBox` y se inyecta como `<symbol>`; el CSS lo escala.
- **Icono faltante:** si el pack o el archivo ya no está, el renderizador pinta el
  nativo de respaldo (`i-ramo-estrella`), marca `data-fallback="1"` y **conserva el
  id guardado**. Si el pack vuelve, el icono reaparece solo.
- **Pack añadido después:** el selector se refresca al importar y al volver a abrir.
  No hay que reiniciar la app ni reconfigurar lo ya elegido.

## Formato de un pack

```js
{
  id: "usuario-mi-pack",
  nombre: "Mi pack",
  procedencia: "Carpeta local",
  licencia: "Uso personal",
  origen: "",
  iconos: [
    { id: "corazon", nombre: "Corazon", cat: "general", tags: [],
      viewBox: "0 0 24 24", cuerpo: "<path d=\"...\"/>" }
  ]
}
```

Los packs de código (como `pack-kde.js`) pueden traer `svg` completo en vez de
`cuerpo`; la capa lo sanea al cargar. Los packs de usuario se guardan ya saneados.

## Referencias

- Lucide: <https://lucide.dev> · ISC.
- KDE Breeze Icons: <https://invent.kde.org/frameworks/breeze-icons> ·
  LGPL-2.0-or-later / LGPL-3.0-or-later. Los ocho simbólicos incluidos están en
  `app/js/dominio/pack-kde.js` y su aviso en `CREDITOS.md`.
