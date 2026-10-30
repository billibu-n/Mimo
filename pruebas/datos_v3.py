#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""datos_v3.py — adaptador de referencia formato 2 -> formato 3.

No es el almacén de la app: es la forma mínima que el gate de M02 exige para
poder medir la migración antes de que exista M20. La app conservará `legacy`
y añadirá tareas, notas y eventos; aquí solo se prueban los datos del respaldo.

Contrato:
  importar2(doc)      formato 2 (respaldo real) -> dict v3
  exportar3(doc)      dict v3 -> texto JSON estable
  importar3(texto)    texto JSON -> dict v3 validado
  validar3(doc)       lista de errores (vacía = válido)
"""
from __future__ import annotations

import json
from typing import Any

V3 = 3


class DatosInvalidos(ValueError):
    pass


def _lista(v: Any) -> list:
    return v if isinstance(v, list) else []


def _dict(v: Any) -> dict:
    return v if isinstance(v, dict) else {}


def importar2(doc: dict) -> dict:
    if not isinstance(doc, dict):
        raise DatosInvalidos("el respaldo no es un objeto")
    if doc.get("formato") != 2:
        raise DatosInvalidos(f"formato esperado 2, llegó {doc.get('formato')!r}")
    estado = doc.get("estado")
    if not isinstance(estado, dict):
        raise DatosInvalidos("falta estado o no es un objeto")

    catalogo = estado.get("catalogo")
    if not isinstance(catalogo, dict) or not catalogo:
        raise DatosInvalidos("estado.catalogo vacío o inválido")
    aprobados = estado.get("aprobados")
    if not isinstance(aprobados, dict):
        raise DatosInvalidos("estado.aprobados no es un objeto")

    cursos = []
    for codigo, c in catalogo.items():
        if not isinstance(c, dict):
            raise DatosInvalidos(f"curso {codigo} no es un objeto")
        cursos.append({
            "codigo": str(codigo),
            "nombre": str(c.get("nombre") or codigo),
            "creditos": int(c.get("creditos") or 0),
            "nivel": int(c.get("nivel") or 0),
            "requisitos": [str(x) for x in _lista(c.get("requisitos"))],
            "aprobado": bool(aprobados.get(codigo)),
            "anual": bool(c.get("anual")),
            "tipo": c.get("tipo"),
            "semestre": c.get("semestre"),
            "secciones": _lista(c.get("secciones")),
        })

    semestres = []
    sesiones = []
    for nombre, sem in _dict(estado.get("sem")).items():
        ses = []
        for s in _lista(_dict(sem).get("sesiones")):
            if not isinstance(s, dict):
                continue
            fila = {
                "id": str(s.get("id") or f"{nombre}-{len(ses)}"),
                "semestre": str(nombre),
                "fecha": s.get("fecha"),
                "lunes": s.get("lunes"),
                "ramo": s.get("ramo"),
                "minutos": int(s.get("minutos") or 0),
                "hora": s.get("hora"),
            }
            ses.append(fila)
            sesiones.append(fila)
        semestres.append({"id": str(nombre), "activo": str(nombre) == str(estado.get("activo")),
                          "sesiones": len(ses)})

    v3 = {
        "v": V3,
        "meta": {
            "app": "0.5.0",
            "migrado_desde": "formato2",
            "fecha_origen": "2026-10-10",
            "semestre_activo": estado.get("activo"),
        },
        "shell": {
            "idioma": "es",
            "tema": _dict(_dict(estado.get("ajustes")).get("av")).get("tema") or "clasico",
            "modo": "claro",
            "densidad": _dict(_dict(estado.get("ajustes")).get("av")).get("densidad") or "normal",
        },
        "datos": {
            "cursos": cursos,
            "aprobados": sorted(str(k) for k, v in aprobados.items() if v),
            "semestres": semestres,
            "sesiones": sesiones,
            "tareas": [],
            "notas": [],
            "eventos": [],
            "contextos": [],
        },
        "legacy": {
            "formato": doc.get("formato"),
            "claves": sorted(doc),
            "estado_claves": sorted(estado),
            "catalogo_origen": "estado.catalogo",
            "semestres_origen": len(_dict(estado.get("sem"))),
        },
    }
    errores = validar3(v3)
    if errores:
        raise DatosInvalidos("; ".join(errores))
    return v3


def validar3(doc: dict) -> list[str]:
    errores = []
    if not isinstance(doc, dict):
        return ["v3 no es un objeto"]
    if doc.get("v") != V3:
        errores.append(f"v debe ser 3, es {doc.get('v')!r}")
    if _dict(doc.get("meta")).get("migrado_desde") != "formato2":
        errores.append("meta.migrado_desde debe ser formato2")
    datos = doc.get("datos")
    if not isinstance(datos, dict):
        return errores + ["datos no es un objeto"]
    for clave in ("cursos", "aprobados", "semestres", "sesiones", "tareas", "notas", "eventos"):
        if not isinstance(datos.get(clave), list):
            errores.append(f"datos.{clave} debe ser lista")
    if not _dict(doc.get("legacy")).get("claves"):
        errores.append("legacy.claves vacío")
    return errores


def exportar3(doc: dict) -> str:
    errores = validar3(doc)
    if errores:
        raise DatosInvalidos("; ".join(errores))
    return json.dumps(doc, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def importar3(texto: str) -> dict:
    try:
        doc = json.loads(texto)
    except json.JSONDecodeError as e:
        raise DatosInvalidos(f"JSON inválido: {e}") from e
    errores = validar3(doc)
    if errores:
        raise DatosInvalidos("; ".join(errores))
    return doc
