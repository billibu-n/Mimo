# Mimo 1.2.0-beta.3

Tercera beta de Mimo. El foco de esta entrega es la arquitectura de bloques: cada
bloque tiene su carpeta, su vista y su ciclo de vida; el armazón de la app queda en
el núcleo.

## Descargas

| Plataforma | Archivo |
|---|---|
| Fedora / RHEL x86_64 | `Mimo-1.2.0-beta.3-1.x86_64.rpm` |
| Debian / Ubuntu amd64 | `Mimo_1.2.0-beta.3_amd64.deb` |
| Arch Linux x86_64 | `mimo-1.2.0beta.3-1-x86_64.pkg.tar.zst` |
| Windows 10/11 x64 | `Mimo_1.2.0-beta.3_x64-setup.exe` |
| Todas | `tutorial.json`, `LICENSE`, `LEEME.md`, `SHA256SUMS` |

## Instalar

```bash
# Fedora / RHEL
sudo dnf install ./Mimo-1.2.0-beta.3-1.x86_64.rpm

# Debian / Ubuntu 24.04+
sudo apt install ./Mimo_1.2.0-beta.3_amd64.deb

# Arch Linux
sudo pacman -U ./mimo-1.2.0beta.3-1-x86_64.pkg.tar.zst
```

En Windows, ejecuta el `.exe`. Es una instalación por usuario y no pide administrador.

## Arquitectura

- **Bloques con carpeta propia.** `app/js/bloques/<id>/` reúne vista, ciclo de vida
  y estilos. `index.html` ya no contiene las secciones de Calendario, Tareas, Notas,
  Tiempo, Malla, Calificaciones ni Estudio.
- **Montaje y desmontaje.** El registro expone `montar`/`desmontar`; quitar un bloque
  retira su host y cancela su ciclo de vida. Notas usa un `AbortSignal`.
- **Catálogo desde manifiestos.** Instalar y quitar resuelve dependencias y ya no
  mantiene una lista paralela de bloques.
- **Ficha de bloque.** El catálogo abre un detalle con qué hace, qué datos toca,
  versión y notas.
- **Dominio con eventos.** Cursos y sesiones emiten `cursos.*` y `sesiones.*`; la
  interfaz pasa por esas funciones.

## Producto

- **Evaluaciones se elimina y desvincula.** Ya no está en el catálogo, en el kit
  Academics, en el esquema ni en los estados guardados.
- **Calendario en dos columnas.** El rail de eventos y contextos vuelve a estar al
  lado del calendario en escritorio; en móvil se apila.
- **Solo cursos en curso.** Tiempo, Estudio y las sugerencias del calendario dejan de ofrecer cursos
  cerrados. Los datos históricos se conservan y Calificaciones los mantiene.
- **Colaborar, sin dinero.** La tarjeta de Ajustes usa «Colaborar» y un texto más
  neutro.

## Pruebas

- 17 gates web en verde.
- `gate-bloques` mide montaje, desmontaje, reinstalación, dependencias, eventos y la
  ficha del catálogo.
- `gate-arquitectura` impide que las secciones vuelvan a `index.html` y que
  `evaluaciones` reaparezca.

## Limitaciones

- Los paquetes no están firmados; solo hay `SHA256SUMS`.
- La sincronización con una cuenta real de Tab Digital sigue sin probarse desde el
  binario.
- macOS, iOS y Android no están preparados.
