# Maqueta v2 congelada para gates

Copia de la maqueta de decisión de T-45 (`trabajos/T-45-mimo-referencias/entrega/maqueta/`),
commit `761f19e`. No es la app: no tiene motores, importación, permisos ni i18n.

- `index.html` sha256 `6b0ba5df…2485a`
- `maqueta.css` sha256 `e3500533…e37`
- `temas.css` sha256 `aa42ec3c…923`

Los gates de `app/pruebas/` la usan como **fixture de interfaz**. Cuando exista la app real
(M10–M12), los mismos gates se apuntan con `--fichero` al HTML de la app; la maqueta se queda como
regresión visual congelada.
