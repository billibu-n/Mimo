# Publicación Mimo 1.2.0-beta.1

Esta carpeta es la **única** que se sube a la release de GitHub. No contiene HTML, código
fuente, prototipos, referencias ni iteraciones anteriores.

## Qué se publica

| Archivo | Qué es |
|---|---|
| `Mimo-1.2.0-beta.1-1.x86_64.rpm` | Aplicación de escritorio para Fedora/Linux x86_64 |
| `tutorial.json` | Estado inicial: notas de bienvenida, tareas y preferencias |
| `LICENSE` | Licencia MIT del proyecto |
| `SHA256SUMS` | Huellas del RPM, el tutorial y la licencia |
| `LEEME.md` | Esta guía; se puede subir como nota de la release |

## Cuál es el archivo que se genera

**`publicacion/tutorial.json`** es el original y el que se publica. No hay otra copia y no
hace falta editarlo a mano.

Se genera desde la propia app:

1. Abre Mimo en un perfil limpio. Si ya tiene datos, usa **Ajustes → Datos → Restablecer de fábrica**.
2. Crea las notas y tareas de bienvenida que quieras.
3. Ve a **Ajustes → Datos → Respaldo → Guardar tutorial**.
4. Guarda el archivo como `publicacion/tutorial.json`.
5. Regenera checksums con `sh escritorio/preparar-publicacion.sh`.

El JSON es un respaldo `mimo.backup` normal. Para usarlo en otro equipo:

1. Instala el RPM.
2. Abre **Ajustes → Datos → Respaldo → Importar**.
3. Elige `tutorial.json`.
4. Confirma el reemplazo.

> Hoy el JSON es **importable**, no se carga solo al primer arranque. Si quieres que la app
> arranque ya con este tutorial sin importar a mano, hay que agregar esa carga inicial y
> reconstruir el RPM.

## Icono y nombre en el sistema

El RPM instala `Mimo.desktop` con `Name=Mimo`, `Icon=mimo` y `StartupWMClass=Mimo`, los iconos
`mimo.png` en hicolor y el metadato AppStream `cl.mimo.escritorio.metainfo.xml`. GNOME Software
y el menú de aplicaciones muestran **Mimo** con la mascota, no un icono genérico. El script de
postinstalación refresca las cachés de iconos, lanzadores y AppStream.

## Restablecer de fábrica

**Ajustes → Datos → Restablecer de fábrica** borra de este equipo las notas, tareas, malla,
temas y la configuración de sincronización. No toca los archivos que hayas exportado. Es la
forma de dejar la app limpia antes de generar el tutorial.

## Cómo regenerar la publicación

Cada vez que cambies el tutorial desde la app o reconstruyas el RPM:

```bash
cd ~/sede/proyectos/mimo-nuevo
sh escritorio/preparar-publicacion.sh
```

El script copia el RPM medido, valida el JSON, copia `LICENSE` y reescribe `SHA256SUMS`. No toca
el HTML ni copia carpetas históricas.

## Verificar

```bash
cd publicacion
sha256sum -c SHA256SUMS
```

## Qué no se publica

- `app/` (HTML/CSS/JS fuente).
- `escritorio/app/` (copia generada).
- `escritorio/release/` (build interno; se copia solo el RPM).
- `prototipo/`, `referencia/`, `tablero/`, `mimo-app-53cc22d` y documentos viejos.
- `mimo` binario suelto: el RPM ya lo contiene. Si se quiere portable, se agrega a propósito.

## Firma

El RPM sigue **sin firmar**. La release debe declararlo; no se promete una firma que no existe.
