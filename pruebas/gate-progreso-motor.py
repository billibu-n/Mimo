#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-progreso-motor.py — el motor de metas y registros, sin UI.

Mide las cuatro decisiones que sostienen el bloque:
  1. normalizar no rompe: tipo, sentido, período, objetivo, inicio y decimales
     caen a un valor válido y los campos desconocidos se conservan;
  2. agregar: suma, último, mejor y conteo dan el valor correcto;
  3. período: día, semana (lunes), mes, año y única tienen clave y rango;
  4. leer: piso/techo, avance, resto, exceso, racha y serie no se confunden.
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402


GUION = r"""
() => {
  const P = window.MimoProgreso;
  const out = {};
  const hoy = "2026-11-11";
  function meta(o) {
    return P.normalizarMeta(Object.assign({
      id: "x", nombre: "X", unidad: "", tipo: "suma", sentido: "subir",
      periodo: "dia", objetivo: 2, desde: "2026-01-01"
    }, o), 0);
  }
  let n = 0;
  function reg(metaId, valor, cuando) {
    return P.normalizarRegistro({ id: "r" + (++n), metaId: metaId, valor: valor, cuando: cuando }, 0);
  }

  const rota = P.normalizarMeta({
    id: "raro", nombre: "", tipo: "no-existe", sentido: "no-existe",
    periodo: "no-existe", objetivo: "2", inicio: "", decimales: 9,
    campoRaro: "se conserva"
  }, 0);
  out.rota = {
    tipo: rota.tipo, sentido: rota.sentido, periodo: rota.periodo,
    objetivo: rota.objetivo, inicio: rota.inicio, decimales: rota.decimales,
    raro: rota.campoRaro
  };

  const agua = meta({ id: "agua", decimales: 2 });
  const rAgua = [
    reg("agua", 0.5, hoy + "T08:00"),
    reg("agua", 0.5, hoy + "T12:00"),
    reg("agua", 0.25, hoy + "T15:00")
  ];
  const pAgua = P.proyecto(agua, rAgua, hoy);
  out.agua = {
    valor: pAgua.valor, pct: pAgua.pct, resto: pAgua.resto,
    cumplido: pAgua.cumplido, exceso: pAgua.exceso
  };

  const kcal = meta({ id: "kcal", tipo: "suma", sentido: "bajar", objetivo: 2000, decimales: 0 });
  const pKcal = P.proyecto(kcal, [reg("kcal", 2100, hoy + "T20:00")], hoy);
  out.kcal = {
    valor: pKcal.valor, exceso: pKcal.exceso, excedido: pKcal.excedido,
    cumplido: pKcal.cumplido, pct: pKcal.pct
  };

  const banca = meta({ id: "banca", tipo: "mejor", periodo: "unica", objetivo: 50, inicio: 30, decimales: 1 });
  const pBanca = P.proyecto(banca, [
    reg("banca", 40, "2026-10-01T10:00"),
    reg("banca", 42.5, "2026-10-20T10:00")
  ], hoy);
  out.banca = { valor: pBanca.valor, avance: pBanca.avance, resto: pBanca.resto };

  const peso = meta({ id: "peso", tipo: "ultimo", sentido: "bajar", periodo: "unica", objetivo: 75, inicio: 90, decimales: 1 });
  const pPeso = P.proyecto(peso, [
    reg("peso", 82, "2026-11-05T08:00"),
    reg("peso", 81.5, "2026-11-10T08:00")
  ], hoy);
  out.peso = { valor: pPeso.valor, avance: pPeso.avance, resto: pPeso.resto };

  const est = meta({ id: "est", periodo: "semana", objetivo: 10, decimales: 2 });
  const pEst = P.proyecto(est, [
    reg("est", 2.5, "2026-11-09T10:00"),
    reg("est", 1.5, "2026-11-10T10:00"),
    reg("est", 2.5, "2026-11-11T10:00"),
    reg("est", 9, "2026-11-04T10:00")
  ], hoy);
  out.semana = {
    valor: pEst.valor, clave: pEst.clave,
    desde: pEst.desde, hasta: pEst.hasta
  };

  out.claves = {
    dia: P.clavePeriodo(meta({ periodo: "dia" }), hoy),
    semana: P.clavePeriodo(meta({ periodo: "semana" }), hoy),
    mes: P.clavePeriodo(meta({ periodo: "mes" }), hoy),
    anio: P.clavePeriodo(meta({ periodo: "anio" }), hoy),
    unica: P.clavePeriodo(meta({ periodo: "unica" }), hoy)
  };
  out.rangoSemana = P.rangoPeriodo(meta({ periodo: "semana" }), "2026-11-09");
  out.periodos = P.periodosDe(meta({ periodo: "dia" }), hoy, 3);

  const rRacha = [];
  ["2026-11-08", "2026-11-09", "2026-11-10"].forEach(d => {
    rRacha.push(reg("aguaR", 2, d + "T10:00"));
  });
  rRacha.push(reg("aguaR", 0.5, hoy + "T10:00"));
  const aguaR = meta({ id: "aguaR", objetivo: 2, decimales: 2 });
  out.rachaPiso = P.racha(aguaR, rRacha, hoy);

  const rTecho = [];
  ["2026-11-08", "2026-11-09", "2026-11-10"].forEach(d => {
    rTecho.push(reg("kcalR", 1800, d + "T10:00"));
  });
  rTecho.push(reg("kcalR", 2100, hoy + "T10:00"));
  const kcalR = meta({ id: "kcalR", tipo: "suma", sentido: "bajar", objetivo: 2000, decimales: 0 });
  out.rachaTecho = P.racha(kcalR, rTecho, hoy);
  out.rachaSinDatos = P.racha(meta({ id: "sinDatos", objetivo: 2 }), [], hoy);

  out.serie = P.serie(aguaR, rRacha, hoy, 4).map(x => [x.clave, x.valor]);

  const sucio = {
    progreso: {
      v: 1,
      metas: [
        { id: "a", nombre: "A", tipo: "suma", periodo: "dia", objetivo: 1 },
        { id: "a", nombre: "Duplicada", tipo: "suma", periodo: "dia", objetivo: 1 },
        { id: "b", nombre: "B", tipo: "conteo", periodo: "unica", objetivo: 3, extra: "queda" }
      ],
      registros: [
        { id: "r1", metaId: "a", valor: 1, cuando: hoy },
        { id: "r1", metaId: "a", valor: 2, cuando: hoy },
        { id: "r2", metaId: "b", valor: 1, cuando: hoy, nota: "uno", extra: "queda" }
      ],
      extra: "bloque"
    }
  };
  P.normalizarEstado(sucio);
  out.normalizado = {
    metas: sucio.progreso.metas.length,
    registros: sucio.progreso.registros.length,
    metaExtra: sucio.progreso.metas.filter(m => m.id === "b")[0].extra,
    regExtra: sucio.progreso.registros.filter(r => r.id === "r2")[0].extra,
    bloqueExtra: sucio.progreso.extra,
    categorias: sucio.progreso.categorias.length,
    catGeneral: sucio.progreso.categorias[0].id,
    catMeta: sucio.progreso.metas[0].categoriaId
  };

  const catRara = P.normalizarCategoria({ id: "x", nombre: "", icono: "nada", tono: "nada", orden: "3" }, 0);
  out.catRara = { nombre: catRara.nombre, icono: catRara.icono, tono: catRara.tono, orden: catRara.orden };
  const huerfana = { progreso: { categorias: [{ id: "salud", nombre: "Salud" }], metas: [{ id: "z", categoriaId: "no-existe" }], registros: [] } };
  P.normalizarEstado(huerfana);
  out.huerfana = huerfana.progreso.metas[0].categoriaId;
  out.catDefecto = P.CATEGORIA_DEFECTO;

  const rConteo = [reg("c", 1, hoy), reg("c", 1, hoy), reg("c", 1, "2026-11-10")];
  const conteo = meta({ id: "c", tipo: "conteo", periodo: "unica", objetivo: 3, decimales: 0 });
  out.conteo = P.proyecto(conteo, rConteo, hoy).valor;
  out.ultimo = P.valorEn(peso, [reg("peso", 82, "2026-11-05T08:00"), reg("peso", 81.5, "2026-11-10T08:00")], "unica");
  out.mejor = P.valorEn(banca, [reg("banca", 40, "2026-10-01T10:00"), reg("banca", 42.5, "2026-10-20T10:00")], "unica");

  const cerrada = meta({ id: "cerrada", tipo: "mejor", periodo: "unica", objetivo: 50, inicio: 30, hasta: "2026-11-01" });
  out.cerrada = P.proyecto(cerrada, [reg("cerrada", 40, "2026-10-20T10:00")], hoy).cerrado;

  return out;
}
"""


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1200, 800)
        try:
            out = page.evaluate(GUION)
            exigir(not errores, f"motor: sin errores de consola — {errores[:2]}", fallas)

            rota = out["rota"]
            exigir(rota["tipo"] == "suma", "normalizar: tipo inválido cae a suma", fallas)
            exigir(rota["sentido"] == "subir", "normalizar: sentido inválido cae a subir", fallas)
            exigir(rota["periodo"] == "dia", "normalizar: período inválido cae a día", fallas)
            exigir(rota["objetivo"] == 2, "normalizar: objetivo de texto se convierte en número", fallas)
            exigir(rota["inicio"] is None, "normalizar: inicio vacío es null", fallas)
            exigir(rota["decimales"] == 3, "normalizar: decimales se recorta a 3", fallas)
            exigir(rota["raro"] == "se conserva", "normalizar: campo desconocido se conserva", fallas)

            agua = out["agua"]
            exigir(agua["valor"] == 1.25, "agua: suma 0,5 + 0,5 + 0,25 = 1,25", fallas)
            exigir(agua["pct"] == 63, "agua: 1,25 de 2 son 63 %", fallas)
            exigir(agua["resto"] == 0.75, "agua: restan 0,75", fallas)
            exigir(agua["cumplido"] is False, "agua: 1,25 no cumple 2", fallas)
            exigir(agua["exceso"] == 0, "agua: un piso no tiene exceso", fallas)

            kcal = out["kcal"]
            exigir(kcal["valor"] == 2100, "kcal: suma 2100", fallas)
            exigir(kcal["exceso"] == 100, "kcal: el techo se pasa por 100", fallas)
            exigir(kcal["excedido"] is True, "kcal: 2100 excede 2000", fallas)
            exigir(kcal["cumplido"] is False, "kcal: pasarse no cumple el techo", fallas)

            banca = out["banca"]
            exigir(banca["valor"] == 42.5, "banca: la mejor marca manda", fallas)
            exigir(banca["avance"] == 0.625, "banca: 42,5 desde 30 a 50 es 62,5 %", fallas)
            exigir(banca["resto"] == 7.5, "banca: faltan 7,5 kg", fallas)

            peso = out["peso"]
            exigir(peso["valor"] == 81.5, "peso: el último valor manda", fallas)
            exigir(abs(peso["avance"] - 0.5667) < 0.001, "peso: 81,5 desde 90 a 75 avanza 56,7 %", fallas)
            exigir(peso["resto"] == 6.5, "peso: faltan 6,5 kg", fallas)

            semana = out["semana"]
            exigir(semana["valor"] == 6.5, "semana: solo suma la semana actual", fallas)
            exigir(semana["clave"] == "2026-11-09", "semana: la clave es el lunes", fallas)
            exigir(semana["desde"] == "2026-11-09" and semana["hasta"] == "2026-11-15",
                   "semana: el rango va de lunes a domingo", fallas)

            claves = out["claves"]
            exigir(claves["dia"] == "2026-11-11", "clave: día", fallas)
            exigir(claves["semana"] == "2026-11-09", "clave: semana", fallas)
            exigir(claves["mes"] == "2026-11", "clave: mes", fallas)
            exigir(claves["anio"] == "2026", "clave: año", fallas)
            exigir(claves["unica"] == "unica", "clave: única", fallas)
            exigir(out["periodos"] == ["2026-11-09", "2026-11-10", "2026-11-11"],
                   "periodos: tres días terminan en hoy", fallas)

            exigir(out["rachaPiso"]["actual"] == 3, "racha: tres días previos cumplidos", fallas)
            exigir(out["rachaPiso"]["mejor"] == 3, "racha: la mejor también es 3", fallas)
            exigir(out["rachaTecho"]["actual"] == 3, "racha: el techo abierto no corta los tres días previos", fallas)
            exigir(out["rachaSinDatos"]["actual"] == 0, "racha: sin datos no regala días", fallas)

            exigir(out["serie"][-1] == ["2026-11-11", 0.5], "serie: el último día vale 0,5", fallas)
            exigir(out["serie"][-2] == ["2026-11-10", 2], "serie: el día anterior vale 2", fallas)

            norm = out["normalizado"]
            exigir(norm["metas"] == 2, "normalizar estado: quita metas duplicadas", fallas)
            exigir(norm["registros"] == 2, "normalizar estado: quita registros duplicados", fallas)
            exigir(norm["metaExtra"] == "queda", "normalizar estado: conserva campos de la meta", fallas)
            exigir(norm["regExtra"] == "queda", "normalizar estado: conserva campos del registro", fallas)
            exigir(norm["bloqueExtra"] == "bloque", "normalizar estado: conserva campos del bloque", fallas)
            exigir(norm["categorias"] == 1 and norm["catGeneral"] == "general",
                   "normalizar estado: crea la categoría General", fallas)
            exigir(norm["catMeta"] == "general", "normalizar estado: una meta sin categoría cae en General", fallas)
            exigir(out["catRara"] == {"nombre": "Categoría", "icono": "diana", "tono": "ac", "orden": 3},
                   "normalizar categoría: nombre/icono/color por defecto", fallas)
            exigir(out["huerfana"] == "general", "normalizar estado: una categoría inexistente cae en General", fallas)
            exigir(out["catDefecto"] == "general", "categoría por defecto: general", fallas)

            exigir(out["conteo"] == 3, "conteo: cuenta los tres registros", fallas)
            exigir(out["ultimo"] == 81.5, "último: devuelve el último valor", fallas)
            exigir(out["mejor"] == 42.5, "mejor: devuelve la mejor marca", fallas)
            exigir(out["cerrada"] is True, "única: una meta con hasta vencido está cerrada", fallas)
        finally:
            ctx.close()
    return salir("gate-progreso-motor", fallas)


if __name__ == "__main__":
    sys.exit(main())
