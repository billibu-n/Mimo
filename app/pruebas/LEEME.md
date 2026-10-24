# Arnés de gates de MIMO v2 (M02)

**Esto mide la maqueta congelada, no la app.** La app empieza en M10. Los gates se escribieron
antes para que M10–M12 tengan una línea base y no se declaren verdes por impresión.

## Correr

```bash
python3 app/pruebas/gate-ui.py --demo
python3 app/pruebas/gate-diseno.py --demo
python3 app/pruebas/gate-datos.py --demo
python3 app/pruebas/gate-bloques.py --demo
# o los tres:
python3 app/pruebas/correr-gates.py
```

Cada gate con `--demo` exige **dos** cosas: la maqueta buena sale 0 y el fixture roto sale 1. Un
gate que no discrimina es un gate roto.

## Qué mide cada uno

| Gate | Bueno | Roto |
|---|---|---|
| `gate-ui` | base 4 en orden, panel de 4, 1440/1100/411 sin desborde, 0 consola, split, temas, cajón | `min-width:1600px` fuerza desborde y debe salir 1 |
| `gate-diseno` | 5 tamaños, 8 espacios, 3 radios, 1 duración, 9 temas, contraste AA | `fg = bg` en un tema debe salir 1 |
| `gate-datos` | formato 2 -> v3 conserva 87 cursos, 18 aprobados, 54 sesiones y 3.838 min; ida y vuelta | catálogo no objeto debe rechazarse |
| `gate-bloques` | manifiestos v1.1 sin huérfanos; Tiempo con 4 dentro; quitar un hijo no tumba al padre; kit Academics | manifiesto sin `tiempo` deja `pomodoro` huérfano y debe salir 1 |

## Fixtures

- `fixtures/respaldo-sintetico.json`: **datos inventados** con las mismas cuentas que el respaldo
  real (87/18/54/3.838). Es el que se versiona.
- El respaldo real **no se versiona**: el repo es público y contiene nombres, notas y sesiones del
  dueño. Para probarlo en local:
  `python3 app/pruebas/gate-datos.py --fichero /ruta/al/respaldo-real.json`.
- `fixtures/manifiestos-v1.1.json`: contrato mínimo de bloques, hijos y kit.

## Límites declarados

- La maqueta no persiste la estantería de Tiempo: el gate mide que el padre sigue y la cuenta baja,
  no que el cambio sobreviva a F5.
- El kit de la maqueta quita **todos** sus bloques, incluso los instalados aparte; el contrato real
  (M16) solo quita los que instaló el kit. El gate comprueba que no quedan pestañas huérfanas, no
  la propiedad fina del kit.
- `datos_v3.py` es un **adaptador de referencia** para medir la migración, no el almacén de la app.
  M20 lo sustituye conservando estas medidas.
- No hay capturas nuevas: la evidencia son las salidas de los gates y la maqueta ya capturada en
  T-45.
