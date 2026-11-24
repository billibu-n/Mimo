# Mimo 1.2.0-beta.9

Mimo es un organizador personal de escritorio que funciona sin conexión: calendario, tareas,
notas, malla, calificaciones, estudio, tiempo y progreso. No hay cuenta ni registro, y tus
datos viven en tu equipo.

Esta beta publica **solo el paquete de Fedora / RHEL x86_64**. Las demás plataformas siguen
en la beta.8; no se subieron DEB, Arch ni Windows para este corte.

## Qué trae

- **Tareas**: «Hoy y atrasadas» en el tablero, situaciones de fecha separadas y clave por
  ocurrencia (`id@fecha`) para no confundir una serie con una tarea suelta.
- **Progreso**: bloque nuevo con metas, registros, categorías plegables, rachas, anillo y
  gráficos; se alimenta de Estudio sin copiar datos y se vincula a Tareas.
- **Iconos**: paquetes de iconos (`nativo`, `kde` y packs de usuario importados desde una
  carpeta SVG), con atribución visible, saneado, respaldo al nativo y un selector único para
  ramos, metas y categorías.
- **Color de meta**: RGB y paleta predefinida, con vista previa; el color se pinta en la
  tarjeta, el anillo, la barra y el gráfico.
- **Estética**: escala tipográfica con roles, anillo de Tareas que mide lo cumplido, badge
  informativo legible en los diez temas.
- **Barra y ventanas**: Ajustes sale de la barra y se abre con el engranaje del panel superior;
  la mascota deja de navegar; las pestañas se mueven solo al apretarlas.
- **Escritorio**: el paquete instala un alias `mimo.desktop` que coincide con el `app_id` de
  Wayland, para que la barra muestre la mascota y no el icono genérico.

## Descargar e instalar

| Sistema | Archivo |
|---|---|
| Fedora 40+ / RHEL 10+ x86_64 | `Mimo-1.2.0-beta.9-1.x86_64.rpm` |

```bash
sudo dnf install ./Mimo-1.2.0-beta.9-1.x86_64.rpm
mimo
```

## Datos

El formato sigue siendo aditivo: `estado.iconos` y `color` son campos nuevos, y los respaldos
de la beta.8 se abren sin migración. El esquema de exportación no cambia de versión.

## Verificación

```bash
sha256sum Mimo-1.2.0-beta.9-1.x86_64.rpm
```

El RPM lleva la firma del actualizador (`.sig`, minisign) y se construyó con Tauri 2 sobre
Fedora. La app pasó el arnés web de **43 compuertas** (`correr-gates.py`). La firma GPG del
paquete no se aplicó en este corte local; `dnf` puede pedir confirmación al instalar.
