/* recurrencia.js — motor de repetición de tareas.
   Una tarea que se repite no se copia ni se materializa: es una serie con una
   regla, y cada fecha de la serie es una ocurrencia. Aquí viven las cuentas de
   fechas; el shell solo pregunta `ocurre`, `proxima` y `ocurrenciasEntre`.
   No toca el DOM ni el estado global. */
(function () {
  "use strict";

  var MS = 86400000;
  var FRECUENCIAS = ["diaria", "semanal", "mensual", "anual"];

  function pad(n) { return String(n).padStart(2, "0"); }
  function isoDe(f) {
    return f.getUTCFullYear() + "-" + pad(f.getUTCMonth() + 1) + "-" + pad(f.getUTCDate());
  }
  function aFecha(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var f = new Date(Date.UTC(y, mo - 1, d));
    return f.getUTCFullYear() === y && f.getUTCMonth() === mo - 1 && f.getUTCDate() === d ? f : null;
  }
  function valida(iso) { return !!aFecha(iso); }
  function sumaDias(f, n) { return new Date(f.getTime() + n * MS); }
  function lunes(f) { return sumaDias(f, -((f.getUTCDay() + 6) % 7)); }
  function diasEnMes(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  function entero(v, min, max, def) {
    var n = parseInt(v, 10);
    if (!isFinite(n)) n = def;
    return Math.max(min, Math.min(max, n));
  }

  /* Una regla normalizada siempre trae estos campos; `hechas` guarda solo las
     ocurrencias cumplidas (ISO -> true), no copias de la tarea. */
  function normalizar(r) {
    if (!r || typeof r !== "object") return null;
    var frec = FRECUENCIAS.indexOf(String(r.frecuencia)) !== -1 ? String(r.frecuencia) : "";
    if (!frec) return null;
    var desde = valida(r.desde) ? String(r.desde) : "";
    var dias = [];
    (Array.isArray(r.dias) ? r.dias : []).forEach(function (d) {
      var n = parseInt(d, 10);
      if (n >= 0 && n <= 6 && dias.indexOf(n) === -1) dias.push(n);
    });
    dias.sort();
    var fin = ["nunca", "fecha", "cuenta"].indexOf(String(r.fin)) !== -1 ? String(r.fin) : "nunca";
    var hasta = valida(r.hasta) ? String(r.hasta) : "";
    if (fin === "fecha" && !hasta) fin = "nunca";
    var hechas = {};
    if (r.hechas && typeof r.hechas === "object") {
      Object.keys(r.hechas).forEach(function (k) {
        if (r.hechas[k] && valida(k)) hechas[k] = true;
      });
    }
    return {
      frecuencia: frec,
      intervalo: entero(r.intervalo, 1, 99, 1),
      dias: dias,
      desde: desde,
      fin: fin,
      hasta: fin === "fecha" ? hasta : "",
      veces: entero(r.veces, 1, 999, 10),
      hechas: hechas
    };
  }

  /* ¿La regla cae en esta fecha? Sin mirar el fin por número de veces: eso lo
     resuelve `ocurre` para no repetir la cuenta. */
  function base(rec, f) {
    var ini = aFecha(rec.desde);
    if (!ini || f < ini) return false;
    if (rec.frecuencia === "diaria") {
      if (Math.round((f - ini) / MS) % rec.intervalo !== 0) return false;
      return !rec.dias.length || rec.dias.indexOf(f.getUTCDay()) >= 0;
    }
    if (rec.frecuencia === "semanal") {
      if (Math.round((lunes(f) - lunes(ini)) / (7 * MS)) % rec.intervalo !== 0) return false;
      var dias = rec.dias.length ? rec.dias : [ini.getUTCDay()];
      return dias.indexOf(f.getUTCDay()) >= 0;
    }
    if (rec.frecuencia === "mensual") {
      var meses = (f.getUTCFullYear() - ini.getUTCFullYear()) * 12 + (f.getUTCMonth() - ini.getUTCMonth());
      if (meses < 0 || meses % rec.intervalo !== 0) return false;
      return f.getUTCDate() === Math.min(ini.getUTCDate(), diasEnMes(f.getUTCFullYear(), f.getUTCMonth()));
    }
    if (rec.frecuencia === "anual") {
      var anos = f.getUTCFullYear() - ini.getUTCFullYear();
      if (anos < 0 || anos % rec.intervalo !== 0) return false;
      return f.getUTCMonth() === ini.getUTCMonth() &&
        f.getUTCDate() === Math.min(ini.getUTCDate(), diasEnMes(f.getUTCFullYear(), f.getUTCMonth()));
    }
    return false;
  }

  /* Cuántas ocurrencias hubo desde el inicio hasta `iso`, ambas incluidas. */
  function indice(rec, iso) {
    var ini = aFecha(rec.desde), fin = aFecha(iso);
    if (!ini || !fin || fin < ini) return 0;
    var n = 0, f = ini, guarda = 0;
    while (f <= fin && guarda++ < 40000) {
      if (base(rec, f)) n++;
      f = sumaDias(f, 1);
    }
    return n;
  }

  function ocurre(rec, iso) {
    if (!rec || !valida(rec.desde) || !valida(iso)) return false;
    var f = aFecha(iso);
    if (!base(rec, f)) return false;
    if (rec.fin === "fecha" && rec.hasta && isoDe(f) > rec.hasta) return false;
    if (rec.fin === "cuenta") return indice(rec, isoDe(f)) <= rec.veces;
    return true;
  }

  function proxima(rec, desdeIso) {
    if (!rec || !valida(rec.desde)) return null;
    var ini = aFecha(rec.desde), desde = valida(desdeIso) ? aFecha(desdeIso) : ini;
    var f = desde > ini ? desde : ini;
    var hasta = rec.fin === "fecha" && valida(rec.hasta) ? aFecha(rec.hasta) : null;
    var cuenta = rec.fin === "cuenta" ? indice(rec, isoDe(sumaDias(f, -1))) : 0;
    for (var i = 0; i < 40000; i++) {
      if (hasta && f > hasta) return null;
      if (base(rec, f)) {
        if (rec.fin === "cuenta" && cuenta + 1 > rec.veces) return null;
        return isoDe(f);
      }
      f = sumaDias(f, 1);
    }
    return null;
  }


  /* La próxima ocurrencia que aún no está cumplida. Es la que ofrece la tarea
     como «siguiente» y la que marca el check del árbol. */
  function proximaPendiente(rec, desdeIso) {
    if (!rec) return null;
    var iso = valida(desdeIso) ? desdeIso : (rec.desde || "");
    for (var i = 0; i < 400; i++) {
      var p = proxima(rec, iso);
      if (!p) return null;
      if (!rec.hechas || !rec.hechas[p]) return p;
      iso = isoDe(sumaDias(aFecha(p), 1));
    }
    return null;
  }

  function ocurrenciasEntre(rec, desdeIso, hastaIso) {
    if (!rec || !valida(rec.desde)) return [];
    var ini = aFecha(rec.desde);
    var desde = valida(desdeIso) ? aFecha(desdeIso) : ini;
    var hasta = valida(hastaIso) ? aFecha(hastaIso) : null;
    if (!desde || !hasta || hasta < desde) return [];
    if (desde < ini) desde = ini;
    if (rec.fin === "fecha" && valida(rec.hasta)) {
      var h = aFecha(rec.hasta);
      if (h < hasta) hasta = h;
    }
    var out = [], cuenta = rec.fin === "cuenta" ? indice(rec, isoDe(sumaDias(desde, -1))) : 0;
    var f = desde, guarda = 0;
    while (f <= hasta && guarda++ < 40000) {
      if (base(rec, f)) {
        if (rec.fin === "cuenta" && cuenta + 1 > rec.veces) break;
        out.push(isoDe(f));
        cuenta++;
      }
      f = sumaDias(f, 1);
    }
    return out;
  }

  function marcar(rec, iso, valor) {
    if (!rec || !valida(iso)) return rec;
    rec.hechas = rec.hechas || {};
    if (valor) rec.hechas[iso] = true;
    else delete rec.hechas[iso];
    return rec;
  }

  function cumplidas(rec) {
    if (!rec || !rec.hechas) return 0;
    return Object.keys(rec.hechas).filter(function (k) { return valida(k) && (!rec.desde || k >= rec.desde); }).length;
  }

  /* Una serie está hecha cuando llegó a su fin y todas sus ocurrencias están
     cumplidas. Una serie sin fin nunca se cierra sola. */
  function serieCompleta(rec) {
    if (!rec || rec.fin === "nunca" || !valida(rec.desde)) return false;
    var f = aFecha(rec.desde), n = 0, guarda = 0;
    while (guarda++ < 40000) {
      if (rec.fin === "fecha" && rec.hasta && isoDe(f) > rec.hasta) return n > 0;
      if (base(rec, f)) {
        n++;
        if (!rec.hechas[isoDe(f)]) return false;
        if (rec.fin === "cuenta" && n >= rec.veces) return true;
      }
      f = sumaDias(f, 1);
    }
    return false;
  }

  window.MimoRecurrencia = {
    normalizar: normalizar,
    valida: valida,
    ocurre: ocurre,
    proxima: proxima,
    proximaPendiente: proximaPendiente,
    ocurrenciasEntre: ocurrenciasEntre,
    marcar: marcar,
    cumplidas: cumplidas,
    serieCompleta: serieCompleta
  };
})();
