# Preparar 1.2.0-beta.7

Estado: **web publicada en GitHub Pages** el 2026-11-05; instaladores de escritorio pendientes.

## Qué se publicó

- La app web (`app/`) en <https://billibu-n.github.io/Mimo/> mediante
  `.github/workflows/paginas.yml` y Pages con `build_type: workflow`.
- Versión `1.2.0-beta.7` en app, escritorio y pruebas.
- Notas de release en `docs/releases/RELEASE-NOTES-1.2.0-beta.7.md`.

## Gates

```bash
cd ~/sede/proyectos/mimo-nuevo
python3 pruebas/correr-gates.py       # 32/32 en verde
```

`gate-tauri.py` y `gate-release.py` se corren aparte cuando existan los paquetes de escritorio;
en este corte no hay tag ni assets de la beta.7.

## Pendiente para el escritorio

1. Construir los paquetes (`escritorio/`) y firmarlos.
2. Tag `v1.2.0-beta.7`, push y aprobar `Empaquetar`.
3. Generar `publicacion/beta.json` con `scripts/updates/generar-manifiesto.py`.
4. Crear la release pre-release con las notas de beta.7 y subir los assets.
5. Copiar `beta.json` a `updates` y verificar `SHA256SUMS`.

Hasta entonces, los instaladores publicados siguen siendo los de la beta.6.
