/* cursos.js — entidad compartida de cursos.
   No toca el DOM ni conoce bloques: recibe y devuelve datos. La usan Malla,
   Calificaciones, Estudio, Tiempo y Calendario para no depender de la UI de Malla. */
(function () {
  "use strict";

  function conservar(destino, origen) {
    Object.keys(origen || {}).forEach(function (k) {
      if (!(k in destino)) destino[k] = origen[k];
    });
    return destino;
  }

  function codigo(v) { return String(v || "").trim().toUpperCase(); }

  function emitir(nombre, dato) {
    if (window.MimoEventos && MimoEventos.emitir) MimoEventos.emitir(nombre, dato);
  }

  function normalizar(lista) {
    var vistos = {}, out = [];
    (Array.isArray(lista) ? lista : []).forEach(function (c) {
      if (!c || typeof c !== "object") return;
      var cod = codigo(c.codigo);
      if (!cod || vistos[cod]) return;
      vistos[cod] = 1;
      var reqs = Array.isArray(c.requisitos) ? c.requisitos : [];
      reqs = reqs.map(function (r) { return codigo(r); })
        .filter(function (r) { return r && r !== cod; });
      reqs = reqs.filter(function (r, i) { return reqs.indexOf(r) === i; });
      var grupos = Array.isArray(c.requisitos_o) ? c.requisitos_o : [];
      grupos = grupos.map(function (g) {
        var l = Array.isArray(g) ? g : [g];
        return l.map(function (r) { return codigo(r); })
          .filter(function (r) { return r && r !== cod; });
      }).filter(function (g) { return g.length; });
      var nivel = parseInt(c.nivel, 10);
      if (!nivel || nivel < 1) nivel = String(c.tipo || "") === "cupo" ? 99 : 1;
      if (nivel > 99) nivel = 99;
      var cerrado = c.cerrado !== undefined ? !!c.cerrado : !!c.aprobado;
      var aprobado = !!c.aprobado && cerrado;
      var resultado = cerrado ? String(c.resultado || (aprobado ? "aprobado" : "reprobado")) : "";
      out.push(conservar({
        codigo: cod, nombre: String(c.nombre || cod).trim() || cod,
        creditos: Math.max(0, parseInt(c.creditos, 10) || 0), nivel: nivel,
        requisitos: reqs, requisitos_o: grupos, aprobacion: Number(c.aprobacion) || null,
        tipo: String(c.tipo || ""), enMalla: c.enMalla !== false && c.en_malla !== false,
        cerrado: cerrado, aprobado: aprobado, resultado: resultado,
        notaCierre: c.notaCierre === null || c.notaCierre === undefined ? null : Number(c.notaCierre),
        cerradoEn: String(c.cerradoEn || ""),
        enCurso: !!c.enCurso && !cerrado,
        alias: String(c.alias || ""), color: String(c.color || ""),
        semestre: String(c.semestre || ""), semestreNum: Number(c.semestreNum || 0) || 0,
        desbloquea: Array.isArray(c.desbloquea) ? c.desbloquea.map(String) : [],
        ficha: c.ficha && typeof c.ficha === "object"
          ? { descripcion: String(c.ficha.descripcion || ""), temario: String(c.ficha.temario || "") }
          : null,
        extra: c.extra && typeof c.extra === "object" ? c.extra : {}
      }, c));
    });
    return out;
  }

  function obtener(lista, valor) {
    var cod = codigo(valor);
    if (!cod) return null;
    return (Array.isArray(lista) ? lista : []).filter(function (c) { return c.codigo === cod; })[0] || null;
  }

  function crear(datos) {
    var cod = codigo(datos && datos.codigo);
    var nombre = String((datos && datos.nombre) || "").trim();
    if (!cod || !nombre) return null;
    var nuevo = normalizar([{
      codigo: cod, nombre: nombre,
      creditos: datos.creditos, nivel: datos.nivel,
      requisitos: datos.requisitos, requisitos_o: datos.requisitos_o,
      tipo: datos.tipo, enMalla: datos.enMalla,
      color: datos.color, semestre: datos.semestre
    }])[0];
    if (nuevo) emitir("cursos.creado", nuevo);
    return nuevo || null;
  }

  function actualizar(curso, datos) {
    if (!curso) return null;
    var d = datos || {};
    ["nombre", "creditos", "nivel", "requisitos", "requisitos_o", "tipo", "enMalla",
      "color", "semestre", "alias", "ficha", "extra"].forEach(function (k) {
      if (d[k] !== undefined) curso[k] = d[k];
    });
    var normal = normalizar([curso])[0] || curso;
    Object.keys(normal).forEach(function (k) { curso[k] = normal[k]; });
    emitir("cursos.actualizado", curso);
    return curso;
  }

  function borrar(lista, valor) {
    var cod = codigo(valor);
    var fuera = (Array.isArray(lista) ? lista : []).filter(function (c) { return c.codigo === cod; })[0] || null;
    var out = (Array.isArray(lista) ? lista : []).filter(function (c) { return c.codigo !== cod; });
    if (fuera) emitir("cursos.borrado", fuera);
    return out;
  }

  window.MimoDominioCursos = {
    normalizar: normalizar,
    obtener: obtener,
    crear: crear,
    actualizar: actualizar,
    borrar: borrar,
    codigo: codigo
  };
})();
