/* sesiones.js — entidad compartida de sesiones de estudio.
   Tiempo y Estudio escriben y leen el mismo registro; ninguno es dueño del otro.
   No toca el DOM. */
(function () {
  "use strict";

  function hoy() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function normalizar(lista) {
    var vistos = {}, out = [];
    (Array.isArray(lista) ? lista : []).forEach(function (s, i) {
      if (!s || typeof s !== "object") return;
      var id = String(s.id || ("s" + i));
      while (vistos[id]) id += "-" + i;
      vistos[id] = 1;
      out.push({
        id: id,
        fecha: String(s.fecha || hoy()),
        minutos: Math.max(0, Number(s.minutos) || 0),
        ramo: String(s.ramo || "").trim().toUpperCase(),
        vinculo: String(s.vinculo || ""),
        hora: String(s.hora || ""),
        tipo: String(s.tipo || "")
      });
    });
    return out;
  }

  function obtener(lista, id) {
    return (Array.isArray(lista) ? lista : []).filter(function (s) { return s.id === id; })[0] || null;
  }

  function crear(datos) {
    var d = datos || {};
    var ahora = new Date();
    return {
      id: String(d.id || ("s" + ahora.getTime() + "-" + Math.floor(Math.random() * 1000))),
      fecha: String(d.fecha || hoy()),
      minutos: Math.max(0, Number(d.minutos) || 0),
      ramo: String(d.ramo || "").trim().toUpperCase(),
      vinculo: String(d.vinculo || ""),
      hora: String(d.hora || ""),
      tipo: String(d.tipo || "crono")
    };
  }

  function actualizar(sesion, datos) {
    if (!sesion) return null;
    var d = datos || {};
    if (d.fecha !== undefined) sesion.fecha = String(d.fecha || "");
    if (d.minutos !== undefined) sesion.minutos = Math.max(0, Number(d.minutos) || 0);
    if (d.ramo !== undefined) sesion.ramo = String(d.ramo || "").trim().toUpperCase();
    if (d.vinculo !== undefined) sesion.vinculo = String(d.vinculo || "");
    if (d.hora !== undefined) sesion.hora = String(d.hora || "");
    if (d.tipo !== undefined) sesion.tipo = String(d.tipo || "");
    return sesion;
  }

  function borrar(lista, id) {
    return (Array.isArray(lista) ? lista : []).filter(function (s) { return s.id !== id; });
  }

  window.MimoDominioSesiones = {
    normalizar: normalizar,
    obtener: obtener,
    crear: crear,
    actualizar: actualizar,
    borrar: borrar
  };
})();
