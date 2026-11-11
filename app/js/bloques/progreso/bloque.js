/* bloque.js — bloque Progreso: metas, registros, gráficos y vínculos.
   El motor vive en dominio/progreso.js; aquí solo hay estado del bloque, vista
   y binding. No llama funciones internas de otro bloque: lee el dominio de
   sesiones y, si existe, el puente de Tareas. */
(function () {
  "use strict";

  var C = null;
  var SIG = null;
  var P = window.MimoProgreso;
  var sel = null;
  var editando = null;
  var catEditando = null;
  var registroPara = null;
  var verArchivadas = false;
  var mostrarTodas = {};
  var dragMeta = null;
  var LIMITE = 6;

  function q(s) { return C ? C.$(s) : null; }
  function qq(s) { return C ? C.$$(s) : []; }
  function L(es, en, zh) { return C ? C.L(es, en, zh) : es; }
  function t(k) { return C ? C.t(k) : k; }
  function esc(v) { return C ? C.esc(v) : String(v == null ? "" : v); }
  function E() { return C ? C.estado : null; }
  function guardar() { if (C) C.guardar(); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn, SIG ? { signal: SIG } : false); }
  function instalado(id) { return !!(E() && (E().instalados || []).indexOf(id) !== -1); }
  function estudioInstalado() { return instalado("estudio"); }

  function metas() { var e = E(); return e && e.progreso ? (e.progreso.metas || []) : []; }
  function categorias() { var e = E(); return e && e.progreso ? (e.progreso.categorias || []) : []; }
  function categoriaPorId(id) {
    return categorias().filter(function (c) { return c.id === id; })[0] || null;
  }
  function siguienteOrden() {
    var max = -1;
    metas().forEach(function (m) { if (isFinite(m.orden) && m.orden > max) max = m.orden; });
    return max + 1;
  }
  function metaPorId(id) {
    return metas().filter(function (m) { return m.id === id; })[0] || null;
  }
  function tareaPorId(id) {
    var e = E();
    return e ? (e.tareas || []).filter(function (x) { return x.id === id; })[0] || null : null;
  }
  function registrosEfectivos(estado) {
    var e = estado || E();
    if (!e || !e.progreso) return [];
    var out = (e.progreso.registros || []).slice();
    if (!(e.instalados || []).some(function (x) { return x === "estudio"; })) return out;
    (e.progreso.metas || []).forEach(function (m) {
      if (m.fuente !== "sesiones" || m.archivada) return;
      (e.sesiones || []).forEach(function (s) {
        if (!s || !s.fecha) return;
        out.push({
          id: "ses-" + s.id,
          metaId: m.id,
          valor: (Number(s.minutos) || 0) / 60,
          cuando: s.fecha + "T" + (s.hora || "12:00"),
          nota: s.ramo || "",
          origen: "sesiones"
        });
      });
    });
    return out;
  }
  function proyecto(m, estado) {
    return P.proyecto(m, registrosEfectivos(estado), P.hoyISO());
  }
  function racha(m, estado) {
    return P.racha(m, registrosEfectivos(estado), P.hoyISO());
  }
  function serieDe(m, n, estado) {
    return P.serie(m, registrosEfectivos(estado), P.hoyISO(), n);
  }
  function serieAcumulada(m, estado) {
    var regs = registrosEfectivos(estado).filter(function (r) { return r.metaId === m.id; })
      .sort(function (a, b) { return String(a.cuando).localeCompare(String(b.cuando)); });
    var acc = 0;
    return regs.map(function (r) {
      acc += (m.tipo === "conteo" ? 1 : r.valor);
      return {
        clave: r.cuando,
        desde: String(r.cuando).slice(0, 10),
        hasta: String(r.cuando).slice(0, 10),
        valor: acc,
        objetivo: m.objetivo,
        cumplido: acc >= m.objetivo,
        actual: false
      };
    });
  }
  function serieTarjeta(m) {
    if (m.periodo === "unica") return serieDe(m, 8);
    if (m.periodo === "anio" && (m.tipo === "suma" || m.tipo === "conteo")) return serieAcumulada(m);
    return serieDe(m, 8);
  }
  function serieDetalle(m) {
    if (m.periodo === "unica") return serieDe(m, 12);
    if (m.periodo === "anio" && (m.tipo === "suma" || m.tipo === "conteo")) return serieAcumulada(m);
    return serieDe(m, 14);
  }

  var MESES = {
    es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    zh: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
  };
  function idiomaCorto() {
    var i = C && C.localeActual ? C.localeActual() : "es-CL";
    return i.indexOf("en") === 0 ? "en" : i.indexOf("zh") === 0 ? "zh" : "es";
  }
  function fmt(v, m) {
    return P.formatoValor(v, m, C && C.localeActual ? C.localeActual() : "es-CL");
  }
  function unidad(m) { return m.unidad ? " " + m.unidad : ""; }
  function fechaCorta(iso) {
    var s = String(iso || "").slice(0, 10);
    if (!s) return "";
    if (s === P.hoyISO()) return L("hoy", "today", "今天");
    var p = s.split("-");
    return p.length === 3 ? (+p[2]) + "/" + (+p[1]) : s;
  }
  function fechaMedia(iso) {
    var p = String(iso || "").slice(0, 10).split("-");
    if (p.length !== 3) return String(iso || "");
    return (+p[2]) + " " + (MESES[idiomaCorto()][+p[1] - 1] || p[1]);
  }
  function etiquetaPeriodo(m) {
    return {
      dia: L("al día", "per day", "每天"),
      semana: L("a la semana", "per week", "每周"),
      mes: L("al mes", "per month", "每月"),
      anio: L("al año", "per year", "每年"),
      unica: L("meta única", "one-off", "一次性")
    }[m.periodo] || m.periodo;
  }
  function etiquetaTipo(m) {
    if (m.tipo === "suma" && m.sentido === "bajar") return L("límite", "limit", "上限");
    if (m.tipo === "suma") return L("acumulada", "cumulative", "累计");
    if (m.tipo === "conteo") return L("conteo", "count", "计数");
    if (m.tipo === "ultimo") return L("último valor", "latest", "最新值");
    return L("mejor marca", "best", "最佳");
  }
  function etiquetaClave(m, clave) {
    if (m.periodo === "unica") return L("única", "one-off", "一次性");
    if (m.periodo === "dia") return fechaCorta(clave);
    if (m.periodo === "semana") {
      var r = P.rangoPeriodo(m, clave);
      return fechaCorta(r.desde) + "–" + fechaCorta(r.hasta);
    }
    if (m.periodo === "mes") {
      var p = String(clave).split("-");
      return (MESES[idiomaCorto()][+p[1] - 1] || p[1]) + " " + p[0];
    }
    return String(clave);
  }
  function esTecho(m) { return m.sentido === "bajar" && m.tipo === "suma"; }
  function tono(m, p) {
    if (esTecho(m) && p.excedido) return "bad";
    if (p.cumplido) return "ok";
    return m.tono;
  }
  function estadoTexto(m, p) {
    if (p.valor === null) return L("Sin registros todavía.", "No entries yet.", "还没有记录。");
    if (esTecho(m)) {
      return p.excedido
        ? L("Te pasaste por ", "Over by ", "超出 ") + fmt(p.exceso, m) + unidad(m)
        : L("Dentro del límite · quedan ", "Within the cap · ", "在上限内 · 剩余 ") + fmt(p.resto, m) + unidad(m);
    }
    if (p.cumplido) return m.periodo === "unica" ? L("Conseguida.", "Reached.", "已达成。") : L("Cumplida.", "Met.", "已完成。");
    if (p.cerrado) return L("El período cerró sin llegar.", "The period closed short.", "周期结束未达成。");
    return L("Faltan ", "Missing ", "还差 ") + fmt(p.resto, m) + unidad(m) + ".";
  }

  var ICONOS = {
    agua: '<path d="M12 3s6 6.3 6 10.2A6 6 0 0 1 6 13.2C6 9.3 12 3 12 3Z"/>',
    libro: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 0 4 23V5.5Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/>',
    pesa: '<path d="M6.5 7.5 4 13l2 2 4-4M17.5 7.5 20 13l-2 2-4-4M9 9h6M8 15h8"/>',
    estudio: '<path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 11.5V17c3 2 7 2 10 0v-5.5"/>',
    peso: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 9a4 4 0 0 1 8 0"/><path d="M12 9v3"/>',
    diana: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
    corazon: '<path d="M12 20s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.6 12 20 12 20Z"/>',
    dinero: '<path d="M12 3v18M16.5 7.5c0-1.4-2-2.5-4.5-2.5S7.5 6.1 7.5 7.5 9.5 10 12 10s4.5 1.1 4.5 2.5S14.5 15 12 15s-4.5-1.1-4.5-2.5"/>',
    otro: '<circle cx="12" cy="12" r="8"/>'
  };
  function iconoMeta(n) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONOS[n] || ICONOS.otro) + "</svg>";
  }

  function anillo(pct, tone) {
    var r = 34, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, pct) / 100);
    return '<svg class="prog-ring" viewBox="0 0 80 80" role="img" aria-label="' + pct + '%">' +
      '<circle class="prog-ring__track" cx="40" cy="40" r="34"></circle>' +
      '<circle class="prog-ring__bar prog-tono--' + tone + '" cx="40" cy="40" r="34" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle>' +
      '<text class="prog-ring__txt" x="40" y="45" text-anchor="middle">' + pct + "%</text></svg>";
  }

  function spark(m, s) {
    var vals = s.slice(-8);
    var max = Math.max.apply(null, vals.map(function (x) { return x.valor || 0; }).concat([m.objetivo, 0.0001]));
    var w = 100, h = 30, bw = w / Math.max(1, vals.length) - 3;
    var out = '<svg class="prog-spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true">';
    var yObj = h - (m.objetivo / max) * (h - 4) - 2;
    out += '<line x1="0" y1="' + yObj.toFixed(1) + '" x2="' + w + '" y2="' + yObj.toFixed(1) + '"></line>';
    vals.forEach(function (x, i) {
      var v = x.valor === null ? 0 : x.valor;
      var bh = Math.max(1, (v / max) * (h - 4));
      var cls = x.actual ? "on" : (x.valor !== null && P.cumple(m, x.valor) ? "ok" : (esTecho(m) && x.valor > m.objetivo ? "bad" : ""));
      out += '<rect class="' + cls + '" x="' + (i * (bw + 3)).toFixed(1) + '" y="' + (h - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="1.5"><title>' + esc(etiquetaClave(m, x.clave)) + ": " + (x.valor === null ? L("sin registro", "no entry", "无记录") : fmt(x.valor, m) + unidad(m)) + "</title></rect>";
    });
    return out + "</svg>";
  }

  function sparkLinea(m, s) {
    var vals = s.slice(-8);
    var vv = vals.map(function (x) { return x.valor; }).filter(function (v) { return v !== null; });
    if (!vv.length) return '<svg class="prog-spark" viewBox="0 0 100 30" aria-hidden="true"></svg>';
    var min = Math.min.apply(null, vv.concat([m.objetivo]));
    var max = Math.max.apply(null, vv.concat([m.objetivo]));
    if (max === min) { max += 0.5; min -= 0.5; }
    var w = 100, h = 30;
    var x = function (i) { return 3 + (i / Math.max(1, vals.length - 1)) * (w - 6); };
    var y = function (v) { return h - 5 - ((v - min) / (max - min)) * (h - 10); };
    var tone = m.tono === "bad" ? "tono-bad" : (m.tono === "ok" ? "tono-ok" : "");
    var out = '<svg class="prog-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">';
    out += '<line x1="0" y1="' + y(m.objetivo).toFixed(1) + '" x2="100" y2="' + y(m.objetivo).toFixed(1) + '"></line>';
    var pts = [];
    vals.forEach(function (p, i) { if (p.valor !== null) pts.push([x(i), y(p.valor), p.valor]); });
    if (pts.length > 1) out += '<path class="linea ' + tone + '" d="M' + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L ") + '"></path>';
    pts.forEach(function (p, i) {
      if (i !== pts.length - 1 && pts.length > 3) return;
      out += '<circle class="punto ' + tone + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (i === pts.length - 1 ? 2.5 : 1.8) + '"></circle>';
    });
    return out + "</svg>";
  }

  function tarjeta(m) {
    var p = proyecto(m), ra = racha(m), tone = tono(m, p), techo = esTecho(m);
    var sinFuente = m.fuente === "sesiones" && !estudioInstalado();
    var pct = p.avancePct === null || sinFuente ? 0 : p.avancePct;
    var valor = (p.valor === null || sinFuente) ? "—" : fmt(p.valor, m);
    var badge = "";
    if (m.archivada) badge = '<span class="prog-badge">' + esc(L("archivada", "archived", "已归档")) + "</span>";
    else if (m.fuente === "sesiones") badge = '<span class="prog-badge prog-badge--q">' + (estudioInstalado() ? esc(L("Desde Estudio", "From Study", "来自学习")) : esc(L("Academics no está", "Academics is off", "未安装 Academics"))) + "</span>";
    else if (techo && p.excedido) badge = '<span class="prog-badge prog-badge--bad">+ ' + fmt(p.exceso, m) + "</span>";
    else if (p.cumplido) badge = '<span class="prog-badge prog-badge--ok">' + esc(m.periodo === "unica" ? L("conseguida", "reached", "已达成") : L("cumplida", "met", "已完成")) + "</span>";
    else if (ra.actual > 1) badge = '<span class="prog-badge">' + esc(L("racha ", "streak ", "连续 ")) + ra.actual + "</span>";

    var pie = "";
    if (m.fuente === "sesiones") {
      pie = estudioInstalado()
        ? '<button class="btn" type="button" data-prog-estudio="' + m.id + '">' + esc(L("Ver Estudio", "Open Study", "打开学习")) + "</button>"
        : '<span class="prog-badge prog-badge--bad">' + esc(L("Sin fuente", "No source", "无来源")) + "</span>";
    } else if (m.tipo === "suma" || m.tipo === "conteo") {
      var paso = m.paso || 1;
      pie = '<button class="btn" type="button" data-prog-add="' + m.id + '" data-valor="' + paso + '">+ ' + fmt(paso, m) + unidad(m) + "</button>";
      if (m.tipo === "suma") pie += '<button class="btn" type="button" data-prog-add="' + m.id + '" data-valor="' + (paso * 2) + '">+ ' + fmt(paso * 2, m) + unidad(m) + "</button>";
    } else {
      pie = '<button class="btn" type="button" data-prog-reg="' + m.id + '">' + esc(m.tipo === "mejor" ? L("Registrar marca", "Log record", "记录成绩") : L("Registrar valor", "Log value", "记录数值")) + "</button>";
    }
    if (m.fuente !== "sesiones") pie += '<button class="btn" type="button" data-prog-reg="' + m.id + '">' + esc(L("Otro…", "Other…", "其他…")) + "</button>";
    pie += '<span class="crece"></span><button class="btn" type="button" data-prog-edit="' + m.id + '" title="' + esc(L("Editar meta", "Edit goal", "编辑目标")) + '" aria-label="' + esc(L("Editar ", "Edit ", "编辑 ")) + esc(m.nombre) + '">⋯</button>';

    var restoCls = (techo && p.excedido) ? "bad" : (p.cumplido ? "ok" : "muted");
    var resto = sinFuente ? esc(L("sin fuente", "no source", "无来源")) : (p.valor === null ? esc(L("sin registros", "no entries", "无记录")) : (techo
      ? (p.excedido ? esc(L("te pasaste por ", "over by ", "超出 ")) + fmt(p.exceso, m) : esc(L("quedan ", "left ", "剩余 ")) + fmt(p.resto, m) + unidad(m))
      : (p.cumplido ? esc(m.periodo === "unica" ? L("conseguida", "reached", "已达成") : L("cumplida", "met", "已完成")) : esc(L("faltan ", "missing ", "还差 ")) + fmt(p.resto, m) + unidad(m))));
    var st = serieTarjeta(m);
    var sp = (m.periodo === "unica" || (m.periodo === "anio" && (m.tipo === "suma" || m.tipo === "conteo"))) ? sparkLinea(m, st) : spark(m, st);

    return '<article class="card prog-card' + (sel === m.id ? " prog-card--sel" : "") + '" data-prog-meta="' + esc(m.id) + '" data-prog-cat="' + esc(m.categoriaId || P.CATEGORIA_DEFECTO) + '" tabindex="0" role="button" aria-label="' + esc(L("Ver detalle de ", "See details of ", "查看详情 ")) + esc(m.nombre) + '">' +
      '<div class="prog-card__cab"><span class="prog-card__ico prog-tono--' + esc(m.tono) + '">' + iconoMeta(m.icono) + "</span>" +
      '<div class="prog-card__t"><h3>' + esc(m.nombre) + "</h3><small>" + esc(etiquetaTipo(m)) + " · " + esc(etiquetaPeriodo(m)) + "</small></div>" + badge +
      '<span class="prog-drag" draggable="true" data-prog-drag="' + esc(m.id) + '" title="' + esc(L("Arrastrar para ordenar", "Drag to reorder", "拖动排序")) + '" aria-hidden="true">⋮⋮</span></div>' +
      '<div class="prog-card__cuerpo">' + (p.avancePct === null ? "" : anillo(pct, tone)) +
      '<div class="prog-num"><b>' + valor + ' <small>/ ' + fmt(m.objetivo, m) + unidad(m) + "</small></b><span class=\"resto resto--" + restoCls + "\">" + resto + "</span></div></div>" +
      sp +
      '<div class="prog-card__pie">' + pie + "</div></article>";
  }

  function grupoHTML(cat, lista) {
    var abierta = !cat.colapsada;
    var limite = mostrarTodas[cat.id] ? lista.length : (window.innerWidth <= 700 ? 3 : LIMITE);
    var vis = lista.slice(0, limite);
    var rest = lista.length - vis.length;
    var cards = vis.map(tarjeta).join("");
    var vacio = lista.length ? "" :
      '<div class="prog-grupo__vacio"><span>' + esc(L("Sin metas en esta categoría.", "No goals in this category.", "此分类还没有目标。")) + '</span>' +
      '<button class="btn btn--chico" type="button" data-prog-cat-nueva="' + esc(cat.id) + '">' + esc(L("+ Meta", "+ Goal", "+ 目标")) + "</button></div>";
    var mas = rest > 0
      ? '<button class="btn prog-grupo__mas" type="button" data-prog-cat-mas="' + esc(cat.id) + '">' + esc(L("Ver ", "Show ", "再看 ")) + rest + esc(L(" más", " more", " 个")) + "</button>"
      : "";
    return '<section class="prog-grupo prog-cat-tono--' + esc(cat.tono) + (cat.colapsada ? " prog-grupo--plegado" : "") + '" data-prog-cat="' + esc(cat.id) + '">' +
      '<div class="prog-grupo__cab">' +
        '<button class="prog-grupo__toggle" type="button" data-prog-cat-toggle="' + esc(cat.id) + '" aria-expanded="' + (abierta ? "true" : "false") + '">' +
          '<span class="prog-grupo__chev" aria-hidden="true">▾</span>' +
          '<span class="prog-grupo__ico prog-tono--' + esc(cat.tono) + '">' + iconoMeta(cat.icono) + "</span>" +
          '<span class="prog-grupo__t"><b>' + esc(cat.nombre) + '</b><small>' + lista.length + " " + esc(lista.length === 1 ? L("meta", "goal", "目标") : L("metas", "goals", "目标")) + '</small></span>' +
        '</button>' +
        '<button class="btn btn--chico" type="button" data-prog-cat-edit="' + esc(cat.id) + '" title="' + esc(L("Editar categoría", "Edit category", "编辑分类")) + '" aria-label="' + esc(L("Editar ", "Edit ", "编辑 ")) + esc(cat.nombre) + '">⋯</button>' +
      '</div>' +
      '<div class="prog-grupo__cuerpo"><div class="prog-grupo__dentro">' +
        '<div class="prog-grid prog-grupo__grid" data-prog-cat-grid="' + esc(cat.id) + '">' + cards + '</div>' + vacio + mas +
      '</div></div></section>';
  }

  function pintar() {
    if (!C) return;
    var e = E();
    if (!e) return;
    if (!e.progreso) e.progreso = { v: 1, metas: [], registros: [] };
    P.normalizarEstado(e);

    var todas = metas();
    var activas = todas.filter(function (m) { return !m.archivada; });
    var visibles = verArchivadas ? todas : activas;
    if (!visibles.length) sel = null;
    else if (!sel || !visibles.some(function (m) { return m.id === sel; })) sel = visibles[0].id;

    var cumplidas = 0, mejorRacha = 0;
    activas.forEach(function (m) {
      var p = proyecto(m);
      if (p.cumplido && (m.sentido === "subir" || p.cerrado)) cumplidas++;
      var r = racha(m);
      if (r.actual > mejorRacha) mejorRacha = r.actual;
    });
    var mes = P.hoyISO().slice(0, 7);
    var delMes = registrosEfectivos().filter(function (r) { return String(r.cuando).slice(0, 7) === mes; }).length;

    var kpis = q("#prog-kpis");
    if (kpis) {
      kpis.innerHTML =
        '<div class="kpi"><b>' + activas.length + '</b><span>' + esc(L("metas activas", "active goals", "活跃目标")) + "</span></div>" +
        '<div class="kpi"><b>' + cumplidas + '</b><span>' + esc(L("cumplidas", "met", "已完成")) + "</span></div>" +
        '<div class="kpi"><b>' + mejorRacha + '</b><span>' + esc(L("racha más larga", "longest streak", "最长连续")) + "</span></div>" +
        '<div class="kpi"><b>' + delMes + '</b><span>' + esc(L("registros este mes", "entries this month", "本月记录")) + "</span></div>";
    }

    var cats = categorias().slice().sort(function (a, b) { return a.orden - b.orden; });
    var grupos = cats.map(function (cat) {
      return {
        cat: cat,
        metas: visibles.filter(function (m) { return m.categoriaId === cat.id; })
          .sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); })
      };
    });
    var cont = q("#prog-grupos");
    if (cont) cont.innerHTML = (visibles.length || verArchivadas)
      ? grupos.map(function (g) { return grupoHTML(g.cat, g.metas); }).join("")
      : "";
    var vacio = q("#prog-vacio");
    if (vacio) vacio.hidden = activas.length > 0 || (verArchivadas && todas.length > 0);

    var arch = q("#prog-archivadas");
    if (arch) {
      var n = todas.filter(function (m) { return m.archivada; }).length;
      arch.textContent = verArchivadas ? L("Ver activas", "See active", "查看活跃") : (L("Archivadas", "Archived", "已归档") + (n ? " (" + n + ")" : ""));
      arch.setAttribute("aria-pressed", verArchivadas ? "true" : "false");
    }
    C.pintarPanel();
  }

  function seleccionar(id) {
    if (!C) return;
    sel = id;
    var e = E();
    if (e && e.panel) e.panel[C.pantalla] = "detalle";
    guardar();
    pintar();
    C.abrirPanel();
  }

  function abrir(id) {
    if (!C) return;
    if (C.pantalla !== "progreso") C.ir("progreso");
    var m = metaPorId(id);
    if (m) {
      var c = categoriaPorId(m.categoriaId);
      if (c && c.colapsada) { c.colapsada = false; guardar(); }
    }
    seleccionar(id);
  }

  function barras(s, m) {
    var w = 340, h = 120, pad = 8, base = h - 18;
    var max = Math.max.apply(null, s.map(function (x) { return x.valor || 0; }).concat([m.objetivo, 0.0001])) * 1.15;
    var bw = (w - pad * 2) / Math.max(1, s.length) - 4;
    var out = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(L("Barras de los últimos períodos", "Bars for recent periods", "最近周期的柱状图")) + '">';
    var yO = base - (m.objetivo / max) * (base - 6);
    out += '<line class="meta-linea" x1="' + pad + '" y1="' + yO.toFixed(1) + '" x2="' + (w - pad) + '" y2="' + yO.toFixed(1) + '"></line>';
    s.forEach(function (x, i) {
      var v = x.valor === null ? 0 : x.valor;
      var bh = Math.max(0, (v / max) * (base - 6));
      var cls = "barra" + (x.actual ? " hoy" : "") + (x.valor !== null && x.cumplido ? " ok" : "") + (esTecho(m) && x.valor > m.objetivo ? " bad" : "");
      var x0 = pad + i * (bw + 4);
      out += '<rect class="' + cls + '" x="' + x0.toFixed(1) + '" y="' + (base - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="2"><title>' + esc(etiquetaClave(m, x.clave)) + ": " + (x.valor === null ? esc(L("sin registro", "no entry", "无记录")) : fmt(x.valor, m) + unidad(m)) + "</title></rect>";
      if (i === 0 || i === s.length - 1 || x.actual) {
        out += '<text x="' + (x0 + bw / 2).toFixed(1) + '" y="' + (h - 4) + '" text-anchor="middle">' + esc(x.actual ? L("hoy", "today", "今天") : etiquetaClave(m, x.clave).split(" ")[0]) + "</text>";
      }
    });
    return out + "</svg>";
  }

  function linea(s, m) {
    var w = 340, h = 130, pad = 12, base = h - 18;
    var vals = s.map(function (x) { return x.valor; }).filter(function (v) { return v !== null; });
    if (!vals.length) return '<p class="muted">' + esc(L("Sin registros todavía.", "No entries yet.", "还没有记录。")) + "</p>";
    var min = Math.min.apply(null, vals.concat([m.objetivo]));
    var max = Math.max.apply(null, vals.concat([m.objetivo]));
    if (max === min) { max += 1; min -= 1; }
    var x = function (i) { return pad + 2 + (i / Math.max(1, s.length - 1)) * (w - pad * 2 - 4); };
    var y = function (v) { return base - 4 - ((v - min) / (max - min)) * (base - 12); };
    var out = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(L("Evolución de los registros", "Entry trend", "记录趋势")) + '">';
    out += '<line class="meta-linea" x1="' + pad + '" y1="' + y(m.objetivo).toFixed(1) + '" x2="' + (w - pad) + '" y2="' + y(m.objetivo).toFixed(1) + '"></line>';
    var pts = [];
    s.forEach(function (p, i) { if (p.valor !== null) pts.push([x(i), y(p.valor), p.valor, p.desde]); });
    if (pts.length > 1) out += '<path class="linea" d="M' + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L ") + '"></path>';
    pts.forEach(function (p, i) {
      var last = i === pts.length - 1;
      out += '<circle class="punto' + (last ? " ok" : "") + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (last ? 4.5 : 3) + '"><title>' + esc(fechaCorta(p[3])) + ": " + fmt(p[2], m) + unidad(m) + "</title></circle>";
    });
    out += '<text x="' + pad + '" y="' + (h - 4) + '">' + esc(fechaCorta(s[0].desde)) + "</text>";
    out += '<text x="' + (w - pad) + '" y="' + (h - 4) + '" text-anchor="end">' + esc(fechaCorta(s[s.length - 1].desde)) + "</text>";
    return out + "</svg>";
  }

  function panel() {
    if (!C || !sel) return '<h2>' + esc(L("Progreso", "Progress", "进度")) + '</h2><p class="panel__nota">' + esc(L("Elige una meta para ver su detalle.", "Pick a goal to see its details.", "选择一个目标查看详情。")) + "</p>";
    var m = metaPorId(sel);
    if (!m) return '<h2>' + esc(L("Progreso", "Progress", "进度")) + '</h2><p class="panel__nota">' + esc(L("Elige una meta para ver su detalle.", "Pick a goal to see its details.", "选择一个目标查看详情。")) + "</p>";
    var p = proyecto(m), ra = racha(m), tone = tono(m, p);
    var sinFuente = m.fuente === "sesiones" && !estudioInstalado();
    var pct = p.avancePct === null || sinFuente ? 0 : p.avancePct;
    var hist = registrosEfectivos().filter(function (r) { return r.metaId === m.id; })
      .sort(function (a, b) { return String(b.cuando).localeCompare(String(a.cuando)); }).slice(0, 4);
    var tarea = m.tareaId ? tareaPorId(m.tareaId) : null;
    var html = "<h2>" + esc(L("Progreso", "Progress", "进度")) + "</h2><h3>" + esc(m.nombre) + "</h3>" +
      '<div class="panel__bloque"><span>' + esc(L("Ahora", "Now", "当前")) + '</span><small>' + ((p.valor === null || sinFuente) ? "—" : fmt(p.valor, m) + unidad(m)) + " / " + fmt(m.objetivo, m) + unidad(m) + "</small></div>" +
      '<div class="prog-barra prog-barra--panel"><i class="' + tone + '" style="width:' + pct + '%"></i></div>' +
      '<p class="panel__nota">' + esc(estadoTexto(m, p)) + "</p>" +
      '<div class="panel__bloque"><span>' + esc(L("Racha", "Streak", "连续")) + '</span><small>' + ra.actual + " · " + esc(L("mejor ", "best ", "最佳 ")) + ra.mejor + "</small></div>" +
      '<div class="prog-chart"><div class="prog-chart__tit"><span>' + esc(m.periodo === "unica" ? L("Intentos", "Attempts", "尝试") : (m.periodo === "anio" ? L("Acumulado del año", "Year to date", "年度累计") : L("Últimos períodos", "Recent periods", "最近周期"))) + '</span><span>' + esc(L("línea = objetivo", "line = target", "线 = 目标")) + '</span></div>' +
      ((m.periodo === "unica" || (m.periodo === "anio" && (m.tipo === "suma" || m.tipo === "conteo"))) ? linea(serieDetalle(m), m) : barras(serieDetalle(m), m)) + '</div>';
    if (m.fuente === "sesiones") {
      html += '<div class="panel__bloque"><span>' + esc(L("Fuente", "Source", "来源")) + '</span><small>' + esc(estudioInstalado() ? L("Sesiones de Estudio", "Study sessions", "学习时段") : L("Academics no está instalado", "Academics is not installed", "未安装 Academics")) + "</small></div>";
    }
    if (tarea) {
      html += '<div class="panel__bloque"><span>' + esc(L("Tarea", "Task", "任务")) + '</span><small>' + esc(tarea.titulo) + "</small></div>";
    }
    if (hist.length) {
      html += "<h2>" + esc(L("Últimos registros", "Recent entries", "最近记录")) + "</h2>" + hist.map(function (r) {
        return '<div class="panel__bloque"><span>' + esc(fechaMedia(r.cuando)) + '</span><small>' + fmt(r.valor, m) + unidad(m) + (r.nota ? " · " + esc(r.nota) : "") + (r.origen === "sesiones" ? " · " + esc(L("Estudio", "Study", "学习")) : "") + "</small></div>";
      }).join("");
    }
    return html;
  }

  function abrirModal(id) {
    var m = q("#" + id);
    if (m) m.hidden = false;
  }
  function cerrarModal(id) {
    var m = q("#" + id);
    if (m) m.hidden = true;
  }
  function cerrarTodos() {
    cerrarModal("prog-modal-meta");
    cerrarModal("prog-modal-reg");
    cerrarModal("prog-modal-cat");
    editando = null;
    catEditando = null;
    registroPara = null;
  }

  function llenarTareas(m) {
    var select = q("#prog-f-tarea");
    if (!select) return;
    var tareas = E().tareas || [];
    select.innerHTML = '<option value="">' + esc(L("Sin vínculo", "No link", "无关联")) + "</option>" + tareas.map(function (x) {
      return '<option value="' + esc(x.id) + '">' + esc(x.titulo) + "</option>";
    }).join("");
    if (m && m.tareaId && !tareas.some(function (x) { return x.id === m.tareaId; })) {
      select.innerHTML += '<option value="' + esc(m.tareaId) + '">' + esc(L("Tarea eliminada", "Deleted task", "已删除任务")) + "</option>";
    }
    select.value = m ? (m.tareaId || "") : "";
  }

  function actualizarAyuda() {
    var el = q("#prog-ayuda");
    if (!el) return;
    var periodo = q("#prog-f-periodo") ? q("#prog-f-periodo").value : "dia";
    var fuente = q("#prog-f-fuente") ? q("#prog-f-fuente").value : "manual";
    if (fuente === "sesiones" && !estudioInstalado()) {
      el.textContent = L("Academics no está instalado: la fuente de sesiones no está disponible. Se guardará como manual.", "Academics is not installed: the session source is unavailable. It will be saved as manual.", "未安装 Academics：学习时段来源不可用，将保存为手动。");
    } else if (fuente === "sesiones") {
      el.textContent = L("La meta se alimenta de las sesiones de Estudio. No se copian: se leen. Si cambias a manual, los registros guardados no se borran.", "The goal reads Study sessions. Nothing is copied. If you switch to manual, saved entries are kept.", "目标读取学习时段，不复制数据。切换为手动时，已保存的记录不会删除。");
    } else if (periodo === "unica") {
      el.textContent = L("Meta única: no se reinicia. Sirve para una marca, un peso o un objetivo que se consigue una vez.", "One-off goal: it does not reset. Useful for a record, a weight or a one-time target.", "一次性目标：不会重置，适合成绩、体重或一次性目标。");
    } else {
      el.textContent = L("El período se reinicia solo. Un registro fuera del período no cuenta para el valor actual, pero queda en el historial.", "The period resets by itself. An entry outside it does not count for the current value, but stays in the history.", "周期会自动重置。周期外的记录不计入当前值，但保留在历史中。");
    }
  }

  function llenarCategorias(m, categoriaId) {
    var select = q("#prog-f-categoria");
    if (!select) return;
    var cats = categorias().slice().sort(function (a, b) { return a.orden - b.orden; });
    select.innerHTML = cats.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.nombre) + "</option>";
    }).join("");
    var val = m ? m.categoriaId : (categoriaId || P.CATEGORIA_DEFECTO);
    if (!cats.some(function (c) { return c.id === val; })) val = P.CATEGORIA_DEFECTO;
    select.value = val;
  }

  function abrirMeta(id, categoriaId) {
    editando = id || null;
    var m = id ? metaPorId(id) : null;
    if (!m && id) return;
    q("#prog-modal-tit").textContent = m ? L("Editar meta", "Edit goal", "编辑目标") : L("Nueva meta", "New goal", "新目标");
    q("#prog-f-nombre").value = m ? m.nombre : "";
    q("#prog-f-unidad").value = m ? m.unidad : "";
    q("#prog-f-objetivo").value = m ? m.objetivo : "";
    q("#prog-f-tipo").value = m ? m.tipo : "suma";
    q("#prog-f-sentido").value = m ? m.sentido : "subir";
    q("#prog-f-periodo").value = m ? m.periodo : "dia";
    q("#prog-f-paso").value = m ? m.paso : 1;
    q("#prog-f-inicio").value = m && m.inicio !== null ? m.inicio : "";
    q("#prog-f-decimales").value = m ? String(m.decimales) : "1";
    q("#prog-f-tono").value = m ? m.tono : "ac";
    q("#prog-f-icono").value = m ? m.icono : "diana";
    var fuente = q("#prog-f-fuente");
    var opSes = fuente ? fuente.querySelector('option[value="sesiones"]') : null;
    if (opSes) opSes.disabled = !estudioInstalado();
    fuente.value = m ? (m.fuente === "sesiones" && estudioInstalado() ? "sesiones" : "manual") : "manual";
    llenarTareas(m);
    llenarCategorias(m, categoriaId);
    q("#prog-eliminar").hidden = !m;
    q("#prog-archivar").hidden = !m;
    q("#prog-duplicar").hidden = !m;
    if (m) q("#prog-archivar").textContent = m.archivada ? L("Restaurar", "Restore", "恢复") : L("Archivar", "Archive", "归档");
    actualizarAyuda();
    abrirModal("prog-modal-meta");
    setTimeout(function () { if (q("#prog-f-nombre")) q("#prog-f-nombre").focus(); }, 30);
  }

  function guardarMeta() {
    var nombre = q("#prog-f-nombre").value.trim();
    var objetivo = Number(q("#prog-f-objetivo").value);
    if (!nombre) { C.aviso(L("Ponle un nombre a la meta.", "Give the goal a name.", "请为目标命名。")); return; }
    if (!isFinite(objetivo) || objetivo <= 0) { C.aviso(L("El objetivo tiene que ser mayor que cero.", "The target must be greater than zero.", "目标必须大于零。")); return; }
    var fuente = q("#prog-f-fuente").value;
    if (fuente === "sesiones" && !estudioInstalado()) fuente = "manual";
    var datos = {
      nombre: nombre,
      unidad: q("#prog-f-unidad").value.trim(),
      objetivo: objetivo,
      tipo: q("#prog-f-tipo").value,
      sentido: q("#prog-f-sentido").value,
      periodo: q("#prog-f-periodo").value,
      paso: Number(q("#prog-f-paso").value) || 1,
      inicio: q("#prog-f-inicio").value === "" ? null : Number(q("#prog-f-inicio").value),
      decimales: Number(q("#prog-f-decimales").value),
      tono: q("#prog-f-tono").value,
      icono: q("#prog-f-icono").value,
      fuente: fuente,
      categoriaId: q("#prog-f-categoria").value || P.CATEGORIA_DEFECTO,
      tareaId: q("#prog-f-tarea").value,
      desde: editando ? metaPorId(editando).desde : P.hoyISO()
    };
    if (editando) {
      var actual = metaPorId(editando);
      if (datos.categoriaId !== actual.categoriaId) datos.orden = siguienteOrden();
      var i = metas().indexOf(actual);
      var n = P.normalizarMeta(Object.assign({}, actual, datos), i);
      E().progreso.metas[i] = n;
      sel = n.id;
    } else {
      datos.id = P.nuevoId("m");
      datos.creada = P.selloLocal();
      datos.orden = siguienteOrden();
      var nueva = P.normalizarMeta(datos, metas().length);
      E().progreso.metas.push(nueva);
      sel = nueva.id;
    }
    guardar();
    cerrarModal("prog-modal-meta");
    pintar();
    C.aviso(editando ? L("Meta actualizada.", "Goal updated.", "目标已更新。") : L("Meta creada.", "Goal created.", "目标已创建。"));
    editando = null;
  }

  function borrarMeta(id) {
    var m = metaPorId(id);
    if (!m) return;
    if (!window.confirm(L("¿Eliminar la meta \"", "Delete the goal \"", "删除目标“") + m.nombre + L("\" y sus registros? Se puede deshacer.", "\" and its entries? You can undo this.", "”及其记录？可以撤销。"))) return;
    var snap = JSON.stringify(E().progreso);
    E().progreso.metas = E().progreso.metas.filter(function (x) { return x.id !== id; });
    E().progreso.registros = E().progreso.registros.filter(function (r) { return r.metaId !== id; });
    if (sel === id) sel = metas().filter(function (x) { return !x.archivada; })[0] ? metas().filter(function (x) { return !x.archivada; })[0].id : null;
    guardar();
    cerrarTodos();
    pintar();
    C.aviso(L("Meta eliminada.", "Goal deleted.", "目标已删除。"), function () {
      if (!E()) return;
      E().progreso = JSON.parse(snap);
      guardar();
      pintar();
      C.aviso(L("Meta restaurada.", "Goal restored.", "目标已恢复。"));
    });
  }

  function archivar(id) {
    var m = metaPorId(id);
    if (!m) return;
    m.archivada = !m.archivada;
    guardar();
    pintar();
    C.aviso(m.archivada ? L("Meta archivada. Los datos siguen ahí.", "Goal archived. Data stays.", "目标已归档，数据仍保留。") : L("Meta restaurada.", "Goal restored.", "目标已恢复。"));
  }

  function duplicar(id) {
    var m = metaPorId(id);
    if (!m) return;
    var copia = P.normalizarMeta(Object.assign({}, m, { id: P.nuevoId("m"), nombre: m.nombre + " (" + L("copia", "copy", "副本") + ")", creada: P.selloLocal(), archivada: false }), metas().length);
    E().progreso.metas.push(copia);
    sel = copia.id;
    guardar();
    pintar();
    C.aviso(L("Meta duplicada.", "Goal duplicated.", "目标已复制。"));
  }

  function abrirRegistro(id) {
    if (!C) return;
    var m = metaPorId(id);
    if (!m) return;
    if (m.fuente === "sesiones") {
      C.aviso(L("Esta meta se alimenta de Estudio. Registra la sesión allí.", "This goal reads from Study. Log the session there.", "此目标来自学习。请在学习中记录。"));
      if (estudioInstalado()) C.ir("estudio");
      return;
    }
    registroPara = id;
    q("#prog-reg-tit").textContent = L("Registrar en ", "Log in ", "记录到 ") + m.nombre;
    q("#prog-reg-sub").textContent = etiquetaTipo(m) + " · " + etiquetaPeriodo(m) + " · " + fmt(m.objetivo, m) + unidad(m);
    q("#prog-r-valor").value = m.tipo === "conteo" ? 1 : (m.paso || 1);
    q("#prog-r-cuando").value = P.selloLocal();
    q("#prog-r-nota").value = "";
    abrirModal("prog-modal-reg");
    setTimeout(function () { if (q("#prog-r-valor")) { q("#prog-r-valor").focus(); q("#prog-r-valor").select(); } }, 30);
  }

  function agregar(id, valor) {
    var m = metaPorId(id);
    if (!m) return;
    E().progreso.registros.push({
      id: P.nuevoId("r"), metaId: id, valor: valor,
      cuando: P.selloLocal(), nota: "", origen: "manual"
    });
    guardar();
    pintar();
    C.aviso(L("Registrado ", "Logged ", "已记录 ") + fmt(valor, m) + unidad(m) + L(" en ", " in ", " 到 ") + m.nombre + ".");
  }

  function registrarDesdeModal() {
    var m = metaPorId(registroPara);
    if (!m) return;
    var valor = Number(q("#prog-r-valor").value);
    if (!isFinite(valor)) { C.aviso(L("Escribe un número.", "Type a number.", "请输入数字。")); return; }
    var cuando = q("#prog-r-cuando").value || P.selloLocal();
    E().progreso.registros.push({
      id: P.nuevoId("r"), metaId: registroPara, valor: valor,
      cuando: cuando, nota: q("#prog-r-nota").value.trim(), origen: "manual"
    });
    guardar();
    cerrarModal("prog-modal-reg");
    pintar();
    C.aviso(L("Registrado ", "Logged ", "已记录 ") + fmt(valor, m) + unidad(m) + L(" en ", " in ", " 到 ") + m.nombre + ".");
  }

  function borrarRegistro(id) {
    var r = E().progreso.registros.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var m = metaPorId(r.metaId);
    var snap = JSON.stringify(E().progreso);
    E().progreso.registros = E().progreso.registros.filter(function (x) { return x.id !== id; });
    guardar();
    pintar();
    C.aviso(L("Registro borrado.", "Entry deleted.", "记录已删除。"), function () {
      if (!E()) return;
      E().progreso = JSON.parse(snap);
      guardar();
      pintar();
      C.aviso(L("Registro restaurado.", "Entry restored.", "记录已恢复。"));
    });
  }

  function cambiarManual(id) {
    var m = metaPorId(id);
    if (!m) return;
    if (!window.confirm(L("Las sesiones dejarán de contar para esta meta. Los registros manuales no se borran. ¿Seguir?", "Sessions will stop counting for this goal. Manual entries are kept. Continue?", "学习时段将不再计入此目标，手动记录会保留。继续？"))) return;
    m.fuente = "manual";
    guardar();
    pintar();
    C.aviso(L("La meta ahora es manual.", "The goal is now manual.", "目标已改为手动。"));
  }

  function abrirCategoria(id) {
    catEditando = id || null;
    var c = id ? categoriaPorId(id) : null;
    q("#prog-cat-tit").textContent = c ? L("Editar categoría", "Edit category", "编辑分类") : L("Nueva categoría", "New category", "新分类");
    q("#prog-cat-nombre").value = c ? c.nombre : "";
    q("#prog-cat-icono").value = c ? c.icono : "diana";
    q("#prog-cat-tono").value = c ? c.tono : "ac";
    q("#prog-cat-eliminar").hidden = !c || c.id === P.CATEGORIA_DEFECTO;
    abrirModal("prog-modal-cat");
    setTimeout(function () { if (q("#prog-cat-nombre")) { q("#prog-cat-nombre").focus(); q("#prog-cat-nombre").select(); } }, 30);
  }

  function guardarCategoria() {
    var nombre = q("#prog-cat-nombre").value.trim();
    if (!nombre) { C.aviso(L("Ponle un nombre a la categoría.", "Give the category a name.", "请为分类命名。")); return; }
    var icono = q("#prog-cat-icono").value;
    var tono = q("#prog-cat-tono").value;
    if (catEditando) {
      var c = categoriaPorId(catEditando);
      if (c) { c.nombre = nombre; c.icono = icono; c.tono = tono; }
    } else {
      var orden = 0;
      categorias().forEach(function (x) { if (x.orden >= orden) orden = x.orden + 1; });
      E().progreso.categorias.push(P.normalizarCategoria({
        id: P.nuevoId("c"), nombre: nombre, icono: icono, tono: tono,
        orden: orden, colapsada: false
      }, categorias().length));
    }
    guardar();
    cerrarModal("prog-modal-cat");
    pintar();
    C.aviso(catEditando ? L("Categoría actualizada.", "Category updated.", "分类已更新。") : L("Categoría creada.", "Category created.", "分类已创建。"));
    catEditando = null;
  }

  function borrarCategoria(id) {
    if (id === P.CATEGORIA_DEFECTO) return;
    var c = categoriaPorId(id);
    if (!c) return;
    var base = categoriaPorId(P.CATEGORIA_DEFECTO);
    var baseNombre = base ? base.nombre : "General";
    if (!window.confirm(L("¿Eliminar la categoría \"", "Delete the category \"", "删除分类“") + c.nombre + L("\"? Sus metas pasan a ", "\"? Its goals move to ", "”？其目标将移到 ") + baseNombre + ".")) return;
    var snap = JSON.stringify(E().progreso);
    E().progreso.metas.forEach(function (m) { if (m.categoriaId === id) m.categoriaId = P.CATEGORIA_DEFECTO; });
    E().progreso.categorias = E().progreso.categorias.filter(function (x) { return x.id !== id; });
    delete mostrarTodas[id];
    guardar();
    cerrarTodos();
    pintar();
    C.aviso(L("Categoría eliminada. Sus metas pasan a ", "Category deleted. Its goals moved to ", "分类已删除，目标已移到 ") + baseNombre + ".", function () {
      if (!E()) return;
      E().progreso = JSON.parse(snap);
      guardar();
      pintar();
      C.aviso(L("Categoría restaurada.", "Category restored.", "分类已恢复。"));
    });
  }

  function limpiarDrop() {
    qq(".prog-card--arrastrando,.prog-card--drop-antes,.prog-card--drop-despues").forEach(function (c) {
      c.classList.remove("prog-card--arrastrando", "prog-card--drop-antes", "prog-card--drop-despues");
    });
    qq(".prog-grupo__grid--drop").forEach(function (g) { g.classList.remove("prog-grupo__grid--drop"); });
  }

  function moverMeta(id, targetId, after, targetCat) {
    if (!id || id === targetId) return;
    var e = E();
    if (!e || !e.progreso) return;
    var lista = e.progreso.metas, idx = -1;
    lista.forEach(function (m, i) { if (m.id === id) idx = i; });
    if (idx < 0) return;
    var m = lista.splice(idx, 1)[0];
    if (targetCat) m.categoriaId = targetCat;
    if (targetId) {
      var t = -1;
      lista.forEach(function (x, i) { if (x.id === targetId) t = i; });
      if (t < 0) lista.push(m);
      else lista.splice(after ? t + 1 : t, 0, m);
    } else {
      lista.push(m);
    }
    lista.forEach(function (x, i) { x.orden = i; });
    guardar();
    pintar();
    C.aviso(L("Orden guardado.", "Order saved.", "顺序已保存。"));
  }

  function moverEnCategoria(id, dir) {
    var m = metaPorId(id);
    if (!m) return;
    var lista = metas().filter(function (x) { return x.categoriaId === m.categoriaId; })
      .sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    var i = lista.indexOf(m), j = i + dir;
    if (i < 0 || j < 0 || j >= lista.length) return;
    var otros = E().progreso.metas;
    var ia = otros.indexOf(lista[i]), ib = otros.indexOf(lista[j]);
    if (ia < 0 || ib < 0) return;
    otros[ia] = lista[j];
    otros[ib] = lista[i];
    otros.forEach(function (x, k) { x.orden = k; });
    guardar();
    pintar();
    C.aviso(L("Orden guardado.", "Order saved.", "顺序已保存。"));
  }

  function bind() {
    on(q("#prog-nueva"), "click", function () { abrirMeta(""); });
    on(q("#prog-vacio-nueva"), "click", function () { abrirMeta(""); });
    on(q("#prog-nueva-cat"), "click", function () { abrirCategoria(""); });
    on(q("#prog-cat-guardar"), "click", guardarCategoria);
    on(q("#prog-cat-eliminar"), "click", function () { if (catEditando) borrarCategoria(catEditando); });
    on(q("#prog-archivadas"), "click", function () { verArchivadas = !verArchivadas; pintar(); });
    on(q("#prog-guardar"), "click", guardarMeta);
    on(q("#prog-eliminar"), "click", function () { if (editando) borrarMeta(editando); });
    on(q("#prog-archivar"), "click", function () { if (editando) { var id = editando; cerrarTodos(); archivar(id); } });
    on(q("#prog-duplicar"), "click", function () { if (editando) { var id = editando; cerrarTodos(); duplicar(id); } });
    on(q("#prog-registrar"), "click", registrarDesdeModal);
    qq("[data-prog-cerrar]").forEach(function (b) {
      on(b, "click", function () { cerrarModal(b.getAttribute("data-prog-cerrar")); });
    });
    qq(".prog-modal").forEach(function (m) {
      on(m, "click", function (e) { if (e.target === m) m.hidden = true; });
    });
    on(document, "keydown", function (e) {
      if (e.key === "Escape") cerrarTodos();
    });
    ["#prog-f-periodo", "#prog-f-fuente", "#prog-f-tipo"].forEach(function (s) {
      on(q(s), "change", actualizarAyuda);
    });

    var grupos = q("#prog-grupos");
    on(grupos, "click", function (e) {
      var toggle = e.target.closest("[data-prog-cat-toggle]");
      if (toggle) {
        var c = categoriaPorId(toggle.getAttribute("data-prog-cat-toggle"));
        if (c) { c.colapsada = !c.colapsada; guardar(); pintar(); }
        return;
      }
      var catEdit = e.target.closest("[data-prog-cat-edit]");
      if (catEdit) { abrirCategoria(catEdit.getAttribute("data-prog-cat-edit")); return; }
      var mas = e.target.closest("[data-prog-cat-mas]");
      if (mas) { mostrarTodas[mas.getAttribute("data-prog-cat-mas")] = true; pintar(); return; }
      var nueva = e.target.closest("[data-prog-cat-nueva]");
      if (nueva) { abrirMeta("", nueva.getAttribute("data-prog-cat-nueva")); return; }
      var card = e.target.closest("[data-prog-meta]");
      if (!card) return;
      var id = card.getAttribute("data-prog-meta");
      var add = e.target.closest("[data-prog-add]");
      if (add) { agregar(add.getAttribute("data-prog-add"), Number(add.getAttribute("data-valor"))); return; }
      var reg = e.target.closest("[data-prog-reg]");
      if (reg) { abrirRegistro(reg.getAttribute("data-prog-reg")); return; }
      var edit = e.target.closest("[data-prog-edit]");
      if (edit) { abrirMeta(edit.getAttribute("data-prog-edit")); return; }
      var est = e.target.closest("[data-prog-estudio]");
      if (est) { C.ir("estudio"); return; }
      seleccionar(id);
    });
    on(grupos, "keydown", function (e) {
      var card = e.target.closest("[data-prog-meta]");
      if (!card) return;
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        moverEnCategoria(card.getAttribute("data-prog-meta"), e.key === "ArrowUp" ? -1 : 1);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        seleccionar(card.getAttribute("data-prog-meta"));
      }
    });
    on(grupos, "dragstart", function (e) {
      var h = e.target.closest("[data-prog-drag]");
      if (!h) return;
      dragMeta = h.getAttribute("data-prog-drag");
      var card = h.closest("[data-prog-meta]");
      if (card) card.classList.add("prog-card--arrastrando");
      try { e.dataTransfer.setData("text/plain", dragMeta); e.dataTransfer.effectAllowed = "move"; } catch (err) {}
    });
    on(grupos, "dragover", function (e) {
      if (!dragMeta) return;
      var card = e.target.closest("[data-prog-meta]");
      if (card) {
        e.preventDefault();
        limpiarDrop();
        var r = card.getBoundingClientRect();
        var after = (e.clientX - r.left) > r.width / 2;
        card.classList.add(after ? "prog-card--drop-despues" : "prog-card--drop-antes");
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        return;
      }
      var grid = e.target.closest("[data-prog-cat-grid]");
      if (grid) {
        e.preventDefault();
        limpiarDrop();
        grid.classList.add("prog-grupo__grid--drop");
      }
    });
    on(grupos, "dragleave", function (e) {
      if (!dragMeta) return;
      if (!grupos.contains(e.relatedTarget)) limpiarDrop();
    });
    on(grupos, "drop", function (e) {
      if (!dragMeta) return;
      var card = e.target.closest("[data-prog-meta]");
      if (card) {
        e.preventDefault();
        var r = card.getBoundingClientRect();
        var after = (e.clientX - r.left) > r.width / 2;
        moverMeta(dragMeta, card.getAttribute("data-prog-meta"), after, card.getAttribute("data-prog-cat"));
      } else {
        var grid = e.target.closest("[data-prog-cat-grid]");
        if (grid) {
          e.preventDefault();
          moverMeta(dragMeta, "", true, grid.getAttribute("data-prog-cat-grid"));
        }
      }
      dragMeta = null;
      limpiarDrop();
    });
    on(grupos, "dragend", function () { dragMeta = null; limpiarDrop(); });
  }

  function montar(api) {
    C = api.ctx;
    SIG = api.signal;
    api.pintar = pintar;
    bind();
    if (C.aplicarIdioma) C.aplicarIdioma();
    pintar();
  }

  function desmontar() {
    C = null;
    SIG = null;
    sel = null;
    editando = null;
    catEditando = null;
    registroPara = null;
    verArchivadas = false;
    mostrarTodas = {};
    dragMeta = null;
  }

  window.MimoBloqueProgreso = {
    normalizarEstado: function (estado) { return P.normalizarEstado(estado); },
    montar: montar,
    desmontar: desmontar,
    pintar: pintar,
    panel: panel,
    abrir: abrir,
    abrirRegistro: function (id) {
      if (!C) return;
      abrir(id);
      abrirRegistro(id);
    },
    resumenTarea: function (estado, tareaId) {
      if (!estado || !estado.progreso) return null;
      var m = (estado.progreso.metas || []).filter(function (x) { return !x.archivada && x.tareaId === tareaId; })[0];
      if (!m) return null;
      return { meta: m, proyecto: P.proyecto(m, registrosEfectivos(estado), P.hoyISO()) };
    },
    resumen: function (estado) {
      if (!estado || !estado.progreso) return { total: 0, activas: 0 };
      var ms = estado.progreso.metas || [];
      return { total: ms.length, activas: ms.filter(function (m) { return !m.archivada; }).length };
    }
  };
})();
