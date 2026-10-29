# Publicación Mimo 1.2.0-beta.1

Esta carpeta es la **única** que se sube a la release de GitHub. No contiene HTML, código
fuente, prototipos, referencias ni iteraciones anteriores.

## Qué se publica

| Archivo | Qué es |
|---|---|
| `Mimo-1.2.0-beta.1-1.x86_64.rpm` | Aplicación de escritorio para Fedora/Linux x86_64 |
| `mimo-inicial.json` | Respaldo inicial editable: notas de bienvenida, tareas y preferencias |
| `SHA256SUMS` | Huellas del RPM y del JSON |
| `LEEME.md` | Esta guía; se puede subir como nota de la release |

## Cuál es el archivo que se edita

**`publicacion/mimo-inicial.json`** es el original y el que se publica. No hay otra copia.
Si editas otro JSON, ese no se sube.

El JSON es un respaldo `mimo.backup` normal. Se importa una vez:

1. Instala el RPM.
2. Abre **Ajustes → Datos → Respaldo → Importar**.
3. Elige `mimo-inicial.json`.
4. Confirma el reemplazo.

Las notas y tareas de bienvenida aparecen en la app. Después puedes editar la semilla y volver
a importarla en un equipo limpio.

> Hoy el JSON es **importable**, no se carga solo al primer arranque. Si quieres que la app
> arranque ya con esta semilla sin importar a mano, hay que agregar esa carga inicial y
> reconstruir el RPM.

## Cómo regenerar la publicación

Cada vez que edites `mimo-inicial.json` o reconstruyas el RPM:

```bash
cd ~/sede/proyectos/mimo-nuevo
sh escritorio/preparar-publicacion.sh
```

El script copia el RPM medido, valida el JSON y reescribe `SHA256SUMS`. No toca el HTML ni
copia carpetas históricas.

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
