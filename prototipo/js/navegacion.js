/* ============================================================================
   navegacion.js — Mimo Nuevo · prototipo v0.3 (Iteración 3)

   Primera LÓGICA real del prototipo. Hace cinco cosas y ninguna más:

     1. LEE el catálogo de `datos/bloques.json` (fetch) y construye las fichas
        del modal: colapsadas en rejilla de 2, expandibles al pulsarlas.
     2. INSTALA y DESINSTALA de verdad. El estado vive en localStorage
        (`mimo.bloques.instalados`) y sobrevive a la recarga. Un pack instala
        sus bloques (dice cuántos antes de hacerlo).
     3. REPINTA lo que depende del estado: barra lateral (Base · Bloques
        instalados · Aportes), panel derecho, ajustes y las pantallas de los
        bloques que aún no tienen pantalla propia. Los que SÍ la tienen (hoy:
        Malla) se montan y se desmontan aquí, con su sección y su panel.
     4. HABLA el idioma del motor `i18n.js`: todo el texto sale de t(), y un
        cambio de idioma repinta la parte dinámica en vivo.
     5. Sigue haciendo lo de siempre: tema, panel derecho, cajón, modal,
        toasts y atajos.

   Lo que NO hace: lógica interna de ningún bloque (Iteración 4), lectura de
   datos del usuario, ni hablar con ningún servidor.
   ============================================================================ */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var CLAVE_ESTADO = 'mimo.bloques.instalados';
  var CLAVE_TEMA = 'mimo.tema';

  /* ------------------------------------------------ 0. IDIOMA (t) Y ESCAPE */
  function t(clave, params) {
    return (window.MimoI18n && window.MimoI18n.t) ? window.MimoI18n.t(clave, params) : clave;
  }

  function idioma() {
    return (window.MimoI18n && window.MimoI18n.idiomaActual) ? window.MimoI18n.idiomaActual() : 'es';
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ------------------------------------------------ 1. ESTADO PERSISTENTE */
  var instalados = [];
  var catalogo = null;
  var porId = {};
  var abiertas = {};          /* fichas expandidas del modal, por id */
  var filtro = 'todas';
  var busqueda = '';
  var pantallaActiva = 'calendario';
  var plantillaEstudio = null;  /* nodo de la pantalla de Estudio, fuera del DOM si no está instalado */

  /* Bloques con pantalla propia: id de bloque → clave en window.MimoBloques.
     Solo estos NO usan la pantalla genérica «próximamente»: traen su sección,
     su montaje y su panel contextual. Los demás siguen igual que antes. */
  var PANTALLAS_PROPIAS = { malla: 'malla' };

  /* Qué pantallas propias están montadas AHORA (id → true). renderPantallas()
     se ejecuta en cada renderTodo(), así que sin esta marca se llamaría a
     montar() una y otra vez: oyentes duplicados y estado perdido. */
  var montadas = {};

  /* Idioma con el que se montó cada pantalla propia. Si cambia, se le pide al
     bloque que se repinte (refrescar) en vez de remontarlo: remontar tiraría
     la selección que el bloque guarda en memoria y dejaría el panel vacío. */
  var idiomaMontaje = {};

  function leerEstado() {
    try {
      var bruto = window.localStorage.getItem(CLAVE_ESTADO);
      var lista = bruto ? JSON.parse(bruto) : [];
      if (!Array.isArray(lista)) { return []; }
      return lista.filter(function (x) { return typeof x === 'string'; });
    } catch (e) {
      if (window.console) { console.warn('[mimo] estado ilegible, se empieza vacío', e); }
      return [];
    }
  }

  function guardarEstado() {
    try {
      window.localStorage.setItem(CLAVE_ESTADO, JSON.stringify(instalados));
    } catch (e) {
      if (window.console) {
        console.error('[mimo] no se pudo guardar el estado: la instalación NO persiste', e);
      }
    }
  }

  function esInstalado(id) { return instalados.indexOf(id) >= 0; }

  function bloque(id) { return porId[id] || null; }

  function nombre(id) {
    var b = bloque(id);
    var clave = 'bloque.' + id + '.nombre';
    var traducido = t(clave);
    if (traducido !== clave) { return traducido; }
    return b ? b.nombre : id;
  }

  function deNaturaleza(nat) {
    return instalados.map(bloque).filter(function (b) {
      return b && b.naturaleza === nat;
    });
  }

  /* ------------------------------------------------------- 2. TOASTS */
  var cola = [];
  var ocupado = false;
  var cajaToasts = null;

  function encolar(texto, tipo, icono) {
    cola.push({ texto: texto, tipo: tipo || '', icono: icono || 'ic-info' });
    if (!ocupado) { siguiente(); }
  }

  function siguiente() {
    if (ocupado || !cola.length || !cajaToasts) { return; }
    ocupado = true;

    var item = cola.shift();
    var caja = document.createElement('span');
    caja.className = 'toast' + (item.tipo ? ' toast--' + item.tipo : '');

    var ic = document.createElementNS(SVGNS, 'svg');
    ic.setAttribute('class', 'toast__ic');
    ic.setAttribute('aria-hidden', 'true');
    var uso = document.createElementNS(SVGNS, 'use');
    uso.setAttribute('href', '#' + item.icono);
    ic.appendChild(uso);

    var txt = document.createElement('span');
    txt.textContent = item.texto;

    caja.appendChild(ic);
    caja.appendChild(txt);
    while (cajaToasts.firstChild) { cajaToasts.removeChild(cajaToasts.firstChild); }
    cajaToasts.appendChild(caja);

    window.setTimeout(function () {
      caja.style.opacity = '0';
      window.setTimeout(function () {
        if (caja.parentNode) { caja.parentNode.removeChild(caja); }
        ocupado = false;
        siguiente();
      }, 160);
    }, 2600);
  }

  function aviso(texto, tipo, icono) { encolar(texto, tipo, icono); }

  /* gancho para capturar un toast concreto sin esperar la cola (guiones de prueba) */
  window.mimoToast = function (texto, tipo, icono) {
    cola = [{ texto: texto, tipo: tipo || '', icono: icono || 'ic-info' }];
    ocupado = false;
    if (cajaToasts) {
      while (cajaToasts.firstChild) { cajaToasts.removeChild(cajaToasts.firstChild); }
    }
    siguiente();
  };

  /* --------------------------------------------- 3. CATÁLOGO Y NATURALEZA */
  var ICONO_NAT = {
    seccion: 'ic-bloque',
    aporte: 'ic-etiqueta',
    tema: 'ic-luna',
    pack: 'ic-pack'
  };

  /* Un icono propio solo cuando el bloque lo trae en el sprite: si no está en
     este mapa, la sección usa el icono genérico de bloque. */
  var ICONO_BLOQUE = { malla: 'ic-malla' };

  function cargarCatalogo() {
    return fetch('datos/bloques.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      })
      .then(function (datos) {
        catalogo = datos;
        (datos.bloques || []).forEach(function (b) { porId[b.id] = b; });
        return datos;
      })
      .catch(function (err) {
        if (window.console) {
          console.error('[mimo] no se pudo leer el catálogo datos/bloques.json: ' + err.message);
        }
        aviso('Catálogo no disponible: ' + err.message, 'bad', 'ic-herramienta');
        catalogo = { bloques: [], catalogo: { canal: '—' } };
        return catalogo;
      });
  }

  /* -------------------------------------------------- 4. INSTALAR / QUITAR */
  function instalar(id) {
    var b = bloque(id);
    if (!b) { return; }

    if (esInstalado(id)) {
      aviso(t('toast.yaInstalado', { bloque: nombre(id) }), '', 'ic-info');
      return;
    }

    if (b.naturaleza === 'pack') {
      var hijos = (b.instala || []).filter(function (h) { return !esInstalado(h); });
      if (!hijos.length) {
        aviso(t('toast.yaInstalado', { bloque: nombre(id) }), '', 'ic-info');
        return;
      }
      aviso(t(hijos.length === 1 ? 'toast.packUno' : 'toast.pack',
              { bloque: nombre(id), n: hijos.length }), '', 'ic-pack');
      instalados = instalados.concat(hijos);
      guardarEstado();
      renderTodo();
      aviso(t('toast.instalado', { bloque: nombre(id) }), 'ok', 'ic-pack');
      return;
    }

    instalados.push(id);
    guardarEstado();
    renderTodo();

    /* si el bloque tiene pantalla, se va a ella: instalar y no ver nada es
       una acción que promete y no cumple (AU-120) */
    if (b.naturaleza === 'seccion') {
      ir(id);
    }
    aviso(t('toast.instalado', { bloque: nombre(id) }), 'ok', 'ic-bloque');
  }

  function desinstalar(id) {
    var b = bloque(id);
    var fuera = [id];

    /* un pack se lleva los bloques que él instaló, y se dice al hacerlo
       (§9.2: el pack no se lleva los DATOS de esos bloques) */
    if (b && b.naturaleza === 'pack') {
      fuera = fuera.concat(b.instala || []);
    }

    var antes = instalados.length;
    instalados = instalados.filter(function (x) { return fuera.indexOf(x) < 0; });
    if (instalados.length === antes) { return; }

    guardarEstado();

    /* si estabas dentro del bloque que se va, no te quedas mirando un hueco */
    if (fuera.indexOf(pantallaActiva) >= 0) {
      pantallaActiva = 'calendario';
      renderTodo();
      ir('calendario');
    } else {
      renderTodo();
    }

    aviso(t('toast.desinstalado', { bloque: nombre(id) }), '', 'ic-bloque');
  }

  /* ------------------------------------------------------ 5. BARRAS Y LISTAS */

  /* Barra lateral: Base (estática) · Bloques instalados · Aportes.
     Un bloque navega; un aporte NO navega: dice que está montado y de qué
     naturaleza es (AU-22). */
  function renderLateral() {
    var navB = document.getElementById('nav-bloques');
    var vacioB = document.getElementById('vacio-bloques');
    var navA = document.getElementById('nav-aportes');
    var vacioA = document.getElementById('vacio-aportes');

    var secciones = deNaturaleza('seccion');
    var aportes = deNaturaleza('aporte').concat(deNaturaleza('tema'));

    navB.innerHTML = '';
    secciones.forEach(function (b) {
      var boton = document.createElement('button');
      boton.className = 'nav';
      boton.type = 'button';
      boton.setAttribute('data-ir', b.id);
      boton.innerHTML =
        '<svg class="nav__ic" aria-hidden="true"><use href="#' + (ICONO_BLOQUE[b.id] || 'ic-bloque') + '"/></svg>' +
        '<span class="nav__t" data-nombre></span>' +
        '<span class="nav__punto nav__punto--seccion" title="' + esc(t('nat.seccion')) + '"></span>' +
        '<span class="nav__ver" data-version></span>';
      boton.querySelector('[data-nombre]').textContent = nombre(b.id);
      boton.querySelector('[data-version]').textContent = 'v' + b.version;
      boton.setAttribute('aria-label', nombre(b.id) + ' · ' + t('nat.seccion') + ' · v' + b.version);
      navB.appendChild(boton);
    });
    vacioB.hidden = secciones.length > 0;

    navA.innerHTML = '';
    aportes.forEach(function (b) {
      var fila = document.createElement('li');
      fila.className = 'nav nav--aporte';
      fila.innerHTML =
        '<svg class="nav__ic" aria-hidden="true"><use href="#' + (ICONO_NAT[b.naturaleza] || 'ic-etiqueta') + '"/></svg>' +
        '<span class="nav__cuerpo">' +
          '<span class="nav__t" data-nombre></span>' +
          '<span class="pill pill--q pill--mini" data-nat></span>' +
        '</span>';
      fila.querySelector('[data-nombre]').textContent = nombre(b.id);
      fila.querySelector('[data-nat]').textContent = t('nat.' + b.naturaleza);
      navA.appendChild(fila);
    });
    vacioA.hidden = aportes.length > 0;

    /* marcar la activa otra vez (la lista se acaba de reconstruir) */
    marcarActivo();
  }

  function marcarActivo() {
    var naves = document.querySelectorAll('[data-ir]');
    for (var i = 0; i < naves.length; i++) {
      if (!naves[i].classList.contains('nav')) { continue; }
      var activo = naves[i].getAttribute('data-ir') === pantallaActiva;
      naves[i].classList.toggle('on', activo);
      if (activo) {
        naves[i].setAttribute('aria-current', 'page');
      } else {
        naves[i].removeAttribute('aria-current');
      }
    }
  }

  /* Panel derecho: contexto de la sección + bloques que la componen. */
  function renderPanel(nombrePantalla) {
    var lista = document.getElementById('panel-bloques');
    if (!lista) { return; }
    lista.innerHTML = '';

    var base = { calendario: 'nav.calendario', tareas: 'nav.tareas', ajustes: 'nav.ajustes' };
    var items = [];

    if (base[nombrePantalla]) {
      items.push({ nombre: t(base[nombrePantalla]), nat: 'base' });
    } else if (esInstalado(nombrePantalla)) {
      items.push({ nombre: nombre(nombrePantalla), nat: 'seccion' });
      /* los packs montados que contienen este bloque también se nombran */
      deNaturaleza('pack').forEach(function (p) {
        if ((p.instala || []).indexOf(nombrePantalla) >= 0) {
          items.push({ nombre: nombre(p.id), nat: 'pack' });
        }
      });
    }

    /* los aportes solo se nombran donde SUMAN, y con su nombre (AU-25) */
    if (nombrePantalla === 'calendario' && esInstalado('evaluaciones')) {
      items.push({ nombre: nombre('evaluaciones'), nat: 'aporte' });
    }

    items.forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'pitem';
      var pill = it.nat === 'base'
        ? '<span class="pill pill--mini">' + esc(t('panel.baseFija')) + '</span>'
        : '<span class="pill ' + (it.nat === 'aporte' ? 'pill--q' : 'pill--ok') + ' pill--mini">' + esc(t('nat.' + it.nat)) + '</span>';
      li.innerHTML = '<span class="pitem__n"></span>' + pill;
      li.querySelector('.pitem__n').textContent = it.nombre;
      lista.appendChild(li);
    });
  }

  /* Ajustes: bloques instalados, packs y capa aportada. */
  function renderAjustes() {
    var contB = document.getElementById('ajustes-bloques');
    var origenB = document.getElementById('ajustes-bloques-origen');
    var contP = document.getElementById('ajustes-packs');
    var origenP = document.getElementById('ajustes-packs-origen');

    var bloquesInstalados = instalados.map(bloque).filter(Boolean)
      .filter(function (b) { return b.naturaleza !== 'pack'; });
    var aportes = bloquesInstalados.filter(function (b) {
      return b.naturaleza === 'aporte' || b.naturaleza === 'tema';
    });
    var secciones = bloquesInstalados.filter(function (b) { return b.naturaleza === 'seccion'; });

    origenB.textContent = t('ajustes.bloquesOrigen', { n: bloquesInstalados.length, m: aportes.length });

    contB.innerHTML = '';
    if (!bloquesInstalados.length) {
      var vacio = document.createElement('p');
      vacio.className = 'acor__nota';
      vacio.textContent = t('ajustes.bloquesVacio');
      contB.appendChild(vacio);
    } else {
      bloquesInstalados.forEach(function (b) {
        var fila = document.createElement('div');
        fila.className = 'campo';
        fila.innerHTML =
          '<div>' +
            '<span class="campo__l"><span data-nombre></span> · <code>v' + esc(b.version) + '</code> ' +
              '<span class="pill pill--ok pill--mini">' + esc(t('nat.' + b.naturaleza)) + '</span></span>' +
            '<span class="campo__d">' + esc(t('modal.zona')) + ': <code>' + esc(b.zona) + '</code></span>' +
          '</div>';
        fila.querySelector('[data-nombre]').textContent = nombre(b.id);
        contB.appendChild(fila);
      });
    }

    /* packs: estado medido, no supuesto */
    var packs = deNaturaleza('pack');
    contP.innerHTML = '';

    if (!packs.length) {
      var pv = document.createElement('p');
      pv.className = 'acor__nota';
      pv.textContent = t('ajustes.packsNotaHtml').replace(/<[^>]+>/g, '');
      contP.appendChild(pv);
      origenP.textContent = '—';
    } else {
      packs.forEach(function (p) {
        var hijos = p.instala || [];
        var puestos = hijos.filter(function (h) { return esInstalado(h); });
        origenP.textContent = t('ajustes.packsOrigen', { pack: nombre(p.id), n: puestos.length, m: hijos.length });

        var nota = document.createElement('p');
        nota.className = 'acor__nota';
        nota.innerHTML = t('ajustes.packsNotaHtml');

        var campo = document.createElement('div');
        campo.className = 'campo';
        campo.innerHTML =
          '<div>' +
            '<span class="campo__l"><span data-titulo></span> … ' +
              '<span class="pill pill--ok pill--mini">' + esc(t('nat.pack')) + '</span></span>' +
            '<span class="campo__d" data-estado></span>' +
          '</div>' +
          '<span data-acciones></span>';
        campo.querySelector('[data-titulo]').textContent = nombre(p.id);
        campo.querySelector('[data-estado]').textContent =
          t('ajustes.agruparDesc', { n: puestos.length, m: hijos.length });

        var acciones = campo.querySelector('[data-acciones]');
        if (puestos.length < hijos.length) {
          var completar = document.createElement('button');
          completar.className = 'btn btn--chico';
          completar.type = 'button';
          completar.setAttribute('data-instalar', p.id);
          completar.textContent = t('ajustes.completar');
          acciones.appendChild(completar);
        } else {
          var quitar = document.createElement('button');
          quitar.className = 'btn btn--chico btn--peligro';
          quitar.type = 'button';
          quitar.setAttribute('data-desinstalar', p.id);
          quitar.textContent = t('ajustes.desinstalar');
          acciones.appendChild(quitar);
        }

        contP.appendChild(nota);
        contP.appendChild(campo);
      });
    }

    /* capa aportada: sin el bloque no se dibuja (AU-24) */
    var acorAporte = document.getElementById('acor-aporte');
    if (acorAporte) {
      acorAporte.hidden = !esInstalado('evaluaciones');
      var nomEval = nombre('evaluaciones');
      document.getElementById('acor-aporte-origen').textContent =
        t('ajustes.calAporteOrigen', { bloque: nomEval });
      document.getElementById('acor-aporte-nota').innerHTML =
        t('ajustes.calAporteNotaHtml', { bloque: esc(nomEval) });
      document.getElementById('acor-aporte-pill').textContent = nomEval;
    }

    /* almacén: se mide, no se supone */
    var medidor = document.getElementById('ajustes-almacen');
    if (medidor) {
      var bytes = 0;
      try {
        for (var i = 0; i < window.localStorage.length; i++) {
          var k = window.localStorage.key(i);
          if (k && k.indexOf('mimo.') === 0) {
            bytes += k.length + String(window.localStorage.getItem(k)).length;
          }
        }
      } catch (e) { bytes = 0; }
      var kb = (bytes / 1024);
      var texto = kb.toFixed(1).replace('.', idioma() === 'en' ? '.' : ',');
      medidor.textContent = texto + ' KB';
    }
  }

  /* -------------------------- 5-bis. BLOQUES CON PANTALLA PROPIA ---------
     Un bloque con pantalla propia se registra él mismo en window.MimoBloques y
     declara aquí su id. El shell solo hace tres cosas con él: crearle la
     sección, entregarle la superficie (ctx) y pintar el panel que devuelva.
     Todo lo demás —su marcado, sus datos, sus oyentes— es del bloque. */

  function apiBloque(id) {
    var clave = PANTALLAS_PROPIAS[id];
    if (!clave) { return null; }
    var registro = window.MimoBloques;
    var api = registro ? registro[clave] : null;
    if (!api || typeof api.montar !== 'function') { return null; }
    return api;
  }

  /* Superficie que se entrega al bloque (contrato §11). Es la ÚNICA puerta que
     tiene hacia el shell: no toca #panel, ni .marco, ni document.body. */
  function superficie() {
    return {
      t: function (clave, params, respaldo) { return tConRespaldo(clave, params, respaldo); },
      aviso: function (texto, tipo, icono) {
        /* el mismo toast que usa el shell: un solo lenguaje visual para avisar */
        if (typeof window.mimoToast === 'function') { window.mimoToast(texto, tipo, icono); }
        else { encolar(texto, tipo, icono); }
      },
      ir: function (pantalla) { ir(pantalla); },
      pedirPanel: function () { pedirPanel(); }
    };
  }

  /* t() del shell con respaldo en español: el motor devuelve la propia clave
     cuando no la encuentra, y entonces se usa el texto que traiga el bloque. */
  function tConRespaldo(clave, params, respaldo) {
    var texto = t(clave, params);
    if (texto === clave && respaldo !== undefined && respaldo !== null) { return respaldo; }
    return texto;
  }

  /* El bloque pide repintar su contexto (cambió la selección). Se repinta SOLO
     si su pantalla es la activa: una zona oculta no se ve y cuesta. */
  function pedirPanel() {
    if (PANTALLAS_PROPIAS[pantallaActiva]) { pintarPanelCtx(); }
  }

  /* Al desmontar se vacía también la zona del panel: si el bloque se va, el
     detalle del último curso que llegó a pintar no se queda ahí escondido
     (simetría §3.5: o está todo, o no está nada). */
  function limpiarPanelCtx(id) {
    var zona = document.querySelector('[data-ctx="' + id + '"]');
    if (!zona) { return; }
    while (zona.firstChild) { zona.removeChild(zona.firstChild); }
  }

  /* Panel vacío honesto: no se dibuja un detalle con rótulos huérfanos.
     El texto se busca una vez por idioma: si la clave no existe, el motor avisa
     por consola y avisaríamos en cada repintado. */
  var vacioTexto = {};   /* idioma → texto ya resuelto */
  function textoVacio() {
    var lang = idioma();
    if (!vacioTexto[lang]) {
      /* la clave `panel.mallaSinCurso` todavía no está en i18n/: se usa el
         respaldo en español que fija la spec y, cuando exista, se localiza sola */
      vacioTexto[lang] = tConRespaldo('panel.mallaSinCurso', null, 'Sin contexto · sin curso seleccionado');
    }
    return vacioTexto[lang];
  }

  function vacioCtx() {
    var p = document.createElement('p');
    p.className = 'vacio vacio--panel';
    p.innerHTML = '<svg class="vacio__ic" aria-hidden="true"><use href="#ic-info"/></svg>';
    var span = document.createElement('span');
    span.textContent = textoVacio();
    p.appendChild(span);
    return p;
  }

  /* Pinta la zona [data-ctx] del bloque activo con la estructura que devuelve
     su panel(): {titulo, bloques:[{h, items:[{t, meta}]}]}, o null si no hay
     selección. El shell SOLO escribe dentro de esa zona. */
  function pintarPanelCtx() {
    var id = pantallaActiva;
    if (!PANTALLAS_PROPIAS[id]) { return; }   /* las demás zonas son estáticas */
    var zona = document.querySelector('[data-ctx="' + id + '"]');
    if (!zona) { return; }

    var api = apiBloque(id);
    var estructura = null;
    if (api && typeof api.panel === 'function') {
      try { estructura = api.panel(); } catch (e) {
        if (window.console) { console.error('[mimo] panel() de ' + id + ' falló', e); }
        estructura = null;
      }
    }

    while (zona.firstChild) { zona.removeChild(zona.firstChild); }

    if (!estructura || !estructura.bloques || !estructura.bloques.length) {
      zona.appendChild(vacioCtx());
      return;
    }

    if (estructura.titulo) {
      var titulo = document.createElement('h2');
      titulo.className = 'panel__h';
      titulo.textContent = estructura.titulo;
      zona.appendChild(titulo);
    }

    estructura.bloques.forEach(function (bl) {
      if (!bl) { return; }
      if (bl.h) {
        var cab = document.createElement('h2');
        cab.className = 'panel__h';
        cab.textContent = bl.h;
        zona.appendChild(cab);
      }
      var ul = document.createElement('ul');
      ul.className = 'ctx-lista';
      (bl.items || []).forEach(function (it) {
        if (!it) { return; }
        var li = document.createElement('li');
        li.className = 'ctx-item';
        var txt = document.createElement('span');
        txt.className = 'ctx-t';
        txt.textContent = it.t === undefined || it.t === null ? '' : String(it.t);
        li.appendChild(txt);
        if (it.meta !== undefined && it.meta !== null && it.meta !== '') {
          var meta = document.createElement('span');
          meta.className = 'ctx-meta';
          meta.textContent = String(it.meta);
          li.appendChild(meta);
        }
        ul.appendChild(li);
      });
      if (ul.firstChild) { zona.appendChild(ul); }
    });
  }

  /* Pantallas de los bloques que todavía no tienen pantalla propia: se crean y
     se quitan con el bloque, para que instalar/desinstalar sea simétrico. */
  function renderPantallas() {
    var main = document.querySelector('.contenido');
    if (!main) { return; }

    /* La pantalla de Estudio es markup estático, pero NO es base: existe solo
       mientras el bloque está instalado. Se guarda el nodo como plantilla para
       devolverlo tal cual al reinstalar (conserva sus data-i18n y su nav). */
    var estudio = main.querySelector('.pantalla[data-panel="estudio"]');
    if (estudio) {
      plantillaEstudio = estudio;
      if (!esInstalado('estudio')) { estudio.parentNode.removeChild(estudio); }
    } else if (esInstalado('estudio') && plantillaEstudio) {
      main.appendChild(plantillaEstudio);
    }

    /* --- bloques con pantalla propia: o está todo, o no está nada (§3.5) ---
       Sección + montaje + panel entran y salen juntos. Nunca queda una sección
       vacía esperando, ni un nav que apunte a un hueco. */
    Object.keys(PANTALLAS_PROPIAS).forEach(function (id) {
      var api = apiBloque(id);
      var sec = main.querySelector('.pantalla[data-panel="' + id + '"]');

      /* una genérica anterior del mismo id (si el bloque no había cargado) se
         sustituye: dos secciones con el mismo data-panel se encenderían las dos */
      if (sec && sec.getAttribute('data-generica')) {
        sec.parentNode.removeChild(sec);
        sec = null;
      }

      if (!esInstalado(id) || !api) {
        if (sec) {
          if (montadas[id] && api && typeof api.desmontar === 'function') {
            try { api.desmontar(); } catch (e) {
              if (window.console) { console.error('[mimo] desmontar() de ' + id + ' falló', e); }
            }
          }
          sec.parentNode.removeChild(sec);
        }
        delete montadas[id];
        delete idiomaMontaje[id];
        limpiarPanelCtx(id);
        return;
      }

      if (!sec) {
        sec = document.createElement('section');
        sec.className = 'pantalla';
        sec.setAttribute('data-panel', id);
        /* SIN data-generica: no es la pantalla «próximamente», es la suya */
        main.appendChild(sec);   /* al DOM ANTES de montar: montar() recibe la raíz ya dentro */
      }

      if (!montadas[id]) {
        try {
          api.montar(sec, superficie());
          montadas[id] = true;
          idiomaMontaje[id] = idioma();
        } catch (e) {
          if (window.console) { console.error('[mimo] montar() de ' + id + ' falló', e); }
        }
      } else if (idiomaMontaje[id] !== idioma() && typeof api.refrescar === 'function') {
        /* cambió el idioma: se repinta, no se remonta (no se pierde la selección) */
        try {
          api.refrescar();
          idiomaMontaje[id] = idioma();
        } catch (e) {
          if (window.console) { console.error('[mimo] refrescar() de ' + id + ' falló', e); }
        }
      }
    });

    var genericas = deNaturaleza('seccion').filter(function (b) {
      return b.id !== 'estudio' && !apiBloque(b.id);
    });

    /* quitar las que ya no tocan */
    var existentes = main.querySelectorAll('.pantalla[data-generica]');
    for (var i = 0; i < existentes.length; i++) {
      var idSec = existentes[i].getAttribute('data-panel');
      if (!esInstalado(idSec) || idSec === 'estudio' || apiBloque(idSec)) {
        existentes[i].parentNode.removeChild(existentes[i]);
      }
    }

    genericas.forEach(function (b) {
      if (main.querySelector('.pantalla[data-panel="' + b.id + '"]')) { return; }

      var sec = document.createElement('section');
      sec.className = 'pantalla';
      sec.setAttribute('data-panel', b.id);
      sec.setAttribute('data-generica', 'si');

      var permisos = (b.permisos || []).map(function (p) {
        return '<span class="permiso">' + esc(p) + '</span>';
      }).join('');

      sec.innerHTML =
        '<div class="sec-cab">' +
          '<div class="sec-cab__txt">' +
            '<h1 class="sec-cab__tit" data-tit></h1>' +
            '<p class="sec-cab__sub" data-sub></p>' +
          '</div>' +
          '<div class="sec-cab__acc">' +
            '<button class="btn" type="button" data-abrir-bloques>' +
              '<svg class="btn__ic" aria-hidden="true"><use href="#ic-cuadricula"/></svg>' +
              '<span data-ver-manifiesto></span>' +
            '</button>' +
            '<button class="btn btn--peligro" type="button" data-desinstalar="' + esc(b.id) + '">' +
              '<span data-desinstalar-txt></span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="bloque">' +
          '<div class="bloque__cab">' +
            '<span class="bloque__ic" aria-hidden="true"><svg width="17" height="17"><use href="#ic-bloque"/></svg></span>' +
            '<div class="bloque__id">' +
              '<div class="bloque__nom"><span data-tit2></span> ' +
                '<span class="pill pill--ok pill--mini" data-nat></span> ' +
                '<span class="pill pill--mini">v' + esc(b.version) + '</span></div>' +
              '<p class="bloque__man"><code>id ' + esc(b.id) + '</code> · ' + esc(b.autor) + ' · ' +
                esc(b.licencia) + ' · <code>zona ' + esc(b.zona) + '</code></p>' +
            '</div>' +
            '<div class="permisos">' + permisos + '</div>' +
          '</div>' +
          '<div class="tarjeta proximamente">' +
            '<span class="pill pill--ok" data-nat2></span>' +
            '<h2 class="tarjeta__tit" data-prox></h2>' +
            '<p class="tarjeta__sub" data-proxdesc></p>' +
          '</div>' +
          '<p class="aviso-prototipo">' +
            '<svg width="14" height="14" aria-hidden="true"><use href="#ic-info"/></svg>' +
            '<span data-aviso></span>' +
          '</p>' +
        '</div>';

      sec.querySelector('[data-tit]').textContent = nombre(b.id);
      sec.querySelector('[data-sub]').textContent =
        t('generico.sub', { naturaleza: t('nat.' + b.naturaleza) });
      sec.querySelector('[data-ver-manifiesto]').textContent = t('estudio.verManifiesto');
      sec.querySelector('[data-desinstalar-txt]').textContent = t('ajustes.desinstalar');
      sec.querySelector('[data-tit2]').textContent = nombre(b.id);
      sec.querySelector('[data-nat]').textContent = t('nat.' + b.naturaleza);
      sec.querySelector('[data-nat2]').textContent = t('nat.' + b.naturaleza);
      sec.querySelector('[data-prox]').textContent = t('generico.proximamente', { bloque: nombre(b.id) });
      sec.querySelector('[data-proxdesc]').textContent = t('generico.proxDesc');
      sec.querySelector('[data-aviso]').textContent = t('generico.aviso');

      main.appendChild(sec);
    });

    /* El marcado que se reinserta (la pantalla de Estudio) vuelve al DOM con
       el texto que tenía cuando se desmontó, y el motor i18n solo repinta lo
       que está EN el documento. Se le pide que lo pase otra vez por el idioma
       activo justo aquí: después de los dos montajes y ANTES de que
       renderTodo() llame a pintarTema(), que es quien corrige el rótulo del
       botón de tema que aplicar() deja con la clave 'cab.temaOscuro'. */
    if (window.MimoI18n && window.MimoI18n.aplicar) {
      window.MimoI18n.aplicar();
    }
  }

  /* ------------------------------------------------------- 6. EL CATÁLOGO */
  function tarjeta(b) {
    var abierta = abiertas[b.id] === true;
    var instalado = esInstalado(b.id);
    var nat = b.naturaleza;
    var nom = nombre(b.id);
    var claveDesc = 'bloque.' + b.id + '.desc';
    var desc = t(claveDesc);
    if (desc === claveDesc) { desc = b.descripcion || ''; }

    var art = document.createElement('article');
    art.className = 'bcard bcard--' + nat + (abierta ? ' bcard--abierto' : '') + (instalado ? ' bcard--instalado' : '');
    art.setAttribute('data-bloque', b.id);
    /* el id también como data-id: es el ancla estable de la ficha (la usa el
       catálogo, los guiones de prueba y cualquier automatización externa) */
    art.setAttribute('data-id', b.id);

    var pie;
    if (instalado) {
      pie = '<span class="pill pill--ok pill--mini">' + esc(t('modal.instalado')) + '</span>' +
            '<button class="btn btn--chico btn--peligro" type="button" data-desinstalar="' + esc(b.id) + '">' +
            esc(t('modal.desinstalar')) + '</button>';
    } else {
      pie = '<button class="btn btn--chico" type="button" data-instalar="' + esc(b.id) + '">' +
            esc(nat === 'pack' ? t('modal.instalarPack') : t('modal.instalar')) + '</button>';
    }

    art.innerHTML =
      '<button class="bcard__cab" type="button" aria-expanded="' + (abierta ? 'true' : 'false') + '"' +
              ' aria-controls="detalle-' + esc(b.id) + '">' +
        '<span class="bcard__ic bcard__ic--' + esc(nat) + '" aria-hidden="true">' +
          '<svg width="18" height="18"><use href="#' + (ICONO_NAT[nat] || 'ic-bloque') + '"/></svg></span>' +
        '<span class="bcard__id">' +
          '<span class="bcard__nom">' + esc(nom) + ' <span class="pill pill--mini">v' + esc(b.version) + '</span></span>' +
          '<span class="bcard__desc">' + esc(desc) + '</span>' +
        '</span>' +
        '<span class="nat nat--' + esc(nat) + '">' + esc(t('nat.' + nat)) + '</span>' +
        '<svg class="bcard__mas" aria-hidden="true" width="16" height="16"><use href="#ic-abajo"/></svg>' +
      '</button>' +
      /* el detalle NO existe hasta que la ficha se abre: el contenedor vacío
         sostiene aria-controls, pero ni el texto del manifiesto ni la licencia
         están en el DOM de una ficha cerrada */
      '<div class="bcard__detalle" id="detalle-' + esc(b.id) + '"' + (abierta ? '' : ' hidden') + '>' +
        (abierta ? detalle(b) : '') +
      '</div>' +
      /* las acciones van SIEMPRE al final de la ficha: con el detalle abierto
         el botón no se cuela entre la cabecera y el manifiesto */
      '<div class="bcard__pie">' + pie + '</div>';

    return art;
  }

  function detalle(b) {
    var permisos = (b.permisos || []).length
      ? (b.permisos || []).map(function (p) { return '<span class="permiso">' + esc(p) + '</span>'; }).join(' ')
      : esc(t('modal.ninguno'));

    var configs = (b.configuraciones || []).length
      ? (b.configuraciones || []).map(function (c) {
          return '<code>' + esc(c.id) + '</code> → ' + esc(c.seccion) + ' · ' + esc(c.titulo);
        }).join('<br>')
      : esc(t('modal.ninguna'));

    var filas = '';
    filas += fila(t('modal.autor'), esc(b.autor));
    /* el detalle es el MANIFIESTO: los valores declarados van literales, como
       la zona y la versión compatible. La fecha localizada (Intl) es cosa del
       calendario, donde el motor i18n pinta data-fecha-mes. */
    filas += fila(t('modal.lanzamiento'), '<code>' + esc(b.lanzamiento) + '</code>');
    filas += fila(t('modal.licencia'), esc(b.licencia));
    filas += fila(t('modal.zona'), '<code>' + esc(b.zona) + '</code>');
    filas += fila(t('modal.compatible'), '<span class="pill pill--ok pill--mini">' +
                   esc(t('modal.encaja')) + '</span> <code>' + esc(b.compatible) + '</code>');
    filas += fila(t('modal.permisos'), permisos);
    filas += fila(t('modal.configuraciones'), configs);

    if (b.naturaleza === 'pack') {
      var hijos = (b.instala || []).map(function (h) { return esc(nombre(h)); }).join(' · ');
      filas += fila(t('modal.instala'), hijos || esc(t('modal.ninguno')));
    }
    if (b.naturaleza === 'tema') {
      var temas = (b.aporta || []).map(function (x) {
        return '<span class="pill pill--q pill--mini">' + esc(x) + '</span>';
      }).join(' ');
      filas += fila(t('modal.ofrece'), temas || esc(t('modal.ninguna')));
    }
    if ((b.ofrece || []).length) {
      filas += fila(t('modal.ofrece'), (b.ofrece || []).map(function (o) {
        return '<code>' + esc(o) + '</code>';
      }).join(' · '));
    }
    if ((b.necesita || []).length) {
      filas += fila(t('modal.necesita'), (b.necesita || []).map(function (o) {
        return '<code>' + esc(o) + '</code>';
      }).join(' · '));
    }
    if ((b.datos && b.datos.posee || []).length) {
      filas += fila(t('modal.guarda'), (b.datos.posee || []).map(function (d) {
        return '<code>' + esc(d) + '</code>';
      }).join(' · '));
    }

    return '<div class="bcard__img" aria-hidden="true">' +
        '<svg width="22" height="22"><use href="#' + (ICONO_NAT[b.naturaleza] || 'ic-bloque') + '"/></svg>' +
        '<span>' + esc(t('modal.sinImagen')) + '</span>' +
      '</div>' +
      '<dl class="bcard__datos">' + filas + '</dl>';
  }

  function fila(etiqueta, valor) {
    return '<div><dt>' + esc(etiqueta) + '</dt><dd>' + valor + '</dd></div>';
  }

  function pasaFiltro(b) {
    if (filtro !== 'todas' && b.naturaleza !== filtro) { return false; }
    if (!busqueda) { return true; }
    var heno = (nombre(b.id) + ' ' + t('bloque.' + b.id + '.desc') + ' ' + b.id + ' ' + b.autor).toLowerCase();
    return heno.indexOf(busqueda) >= 0;
  }

  function renderCatalogo() {
    var cont = document.getElementById('catalogo');
    if (!cont) { return; }
    cont.innerHTML = '';

    var lista = ((catalogo && catalogo.bloques) || []).filter(pasaFiltro);

    lista.forEach(function (b) { cont.appendChild(tarjeta(b)); });

    var vacio = document.getElementById('catalogo-vacio');
    if (vacio) { vacio.hidden = lista.length > 0; }

    /* cabecera del modal: contadores medidos */
    var sub = document.getElementById('mb-sub');
    if (sub) {
      var total = ((catalogo && catalogo.bloques) || []).length;
      var nAportes = instalados.map(bloque).filter(function (x) {
        return x && (x.naturaleza === 'aporte' || x.naturaleza === 'tema');
      }).length;
      var canal = (catalogo && catalogo.catalogo && catalogo.catalogo.canal) || '—';
      sub.innerHTML = esc(t('modal.sub', { n: instalados.length, m: nAportes, c: total })) +
        ' <span class="pill pill--mini">' + esc(t('modal.canal', { canal: canal })) + '</span>';
    }
  }

  /* ---------------------------------------------------- 7. APORTES Y TEMA */
  function sincronizarAportes() {
    document.body.setAttribute('data-evaluaciones', esInstalado('evaluaciones') ? 'si' : 'no');

    var nota = document.getElementById('panel-nota-aporte');
    if (nota) { nota.hidden = !esInstalado('evaluaciones'); }

    var leyenda = document.getElementById('leyenda-etq');
    if (leyenda) {
      leyenda.textContent = t('cal.leyendaEtq', { bloque: nombre('evaluaciones') });
    }
  }

  function pintarTema(tema) {
    var oscuro = tema === 'oscuro';
    document.body.classList.remove('tema-claro', 'tema-oscuro');
    document.body.classList.add(oscuro ? 'tema-oscuro' : 'tema-claro');

    var boton = document.getElementById('btn-tema');
    if (boton) {
      boton.setAttribute('aria-pressed', oscuro ? 'true' : 'false');
      var ic = boton.querySelector('use');
      if (ic) { ic.setAttribute('href', oscuro ? '#ic-sol' : '#ic-luna'); }
    }
    var texto = document.getElementById('btn-tema-txt');
    if (texto) { texto.textContent = t(oscuro ? 'cab.temaClaro' : 'cab.temaOscuro'); }

    var botones = document.querySelectorAll('[data-tema]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].setAttribute('aria-pressed',
        botones[i].getAttribute('data-tema') === (oscuro ? 'oscuro' : 'claro') ? 'true' : 'false');
    }

    try { window.localStorage.setItem(CLAVE_TEMA, oscuro ? 'oscuro' : 'claro'); } catch (e) { /* sin almacén */ }
  }

  function marcarIdioma() {
    var botones = document.querySelectorAll('[data-idioma]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].setAttribute('aria-pressed',
        botones[i].getAttribute('data-idioma') === idioma() ? 'true' : 'false');
    }
  }

  function marcarFiltro() {
    var botones = document.querySelectorAll('[data-filtro]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].setAttribute('aria-pressed',
        botones[i].getAttribute('data-filtro') === filtro ? 'true' : 'false');
    }
  }

  /* ------------------------------------------------- 8. IR A UNA SECCIÓN */
  function ir(nombrePantalla) {
    if (!nombrePantalla) { return; }
    pantallaActiva = nombrePantalla;

    var pantallas = document.querySelectorAll('.pantalla');
    for (var i = 0; i < pantallas.length; i++) {
      pantallas[i].classList.toggle('on', pantallas[i].getAttribute('data-panel') === nombrePantalla);
    }

    marcarActivo();

    var contexto = document.querySelector('[data-ctx="' + nombrePantalla + '"]') ||
                   document.querySelector('[data-ctx="__vacio"]');
    var zonas = document.querySelectorAll('[data-ctx]');
    for (var j = 0; j < zonas.length; j++) {
      zonas[j].classList.toggle('on', zonas[j] === contexto);
    }
    if (contexto) { contexto.classList.add('on'); }

    renderPanel(nombrePantalla);

    /* contexto dinámico del bloque activo: lo declara su panel() y lo pinta el
       shell aquí, después de encender la zona (pintar una zona oculta no se ve) */
    pintarPanelCtx();

    var cuerpo = document.getElementById('panel-cuerpo');
    if (cuerpo) { cuerpo.scrollTop = 0; }

    cerrarCajon();
  }

  /* ------------------------------------------------- 9. PANEL DERECHO */
  function pintarPanel(abierto) {
    var marco = document.getElementById('marco');
    var panel = document.getElementById('panel');
    var boton = document.getElementById('btn-panel');
    if (!marco || !panel) { return; }
    marco.setAttribute('data-der', abierto ? 'abierto' : 'cerrado');
    panel.classList.toggle('panel--plegado', !abierto);
    if (boton) {
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      boton.setAttribute('aria-label', t(abierto ? 'panel.colapsar' : 'panel.expandir'));
      boton.setAttribute('title', t(abierto ? 'panel.colapsar' : 'panel.expandir'));
    }
  }

  function cerrarCajon() {
    var marco = document.getElementById('marco');
    var boton = document.getElementById('menu');
    if (!marco) { return; }
    marco.classList.remove('cajon');
    if (boton) { boton.setAttribute('aria-expanded', 'false'); }
  }

  /* ----------------------------------------------------- 10. MODAL */
  var focoAntes = null;

  function abrirModal() {
    var modal = document.getElementById('modal-bloques');
    if (!modal) { return; }
    focoAntes = document.activeElement;
    modal.classList.add('on');
    var primero = modal.querySelector('[data-cerrar-bloques]');
    if (primero) { primero.focus(); }
  }

  function cerrarModal() {
    var modal = document.getElementById('modal-bloques');
    if (!modal) { return; }
    modal.classList.remove('on');
    if (focoAntes && focoAntes.focus) { focoAntes.focus(); }
    focoAntes = null;
  }

  function alternarFicha(id) {
    abiertas[id] = !abiertas[id];
    var art = document.querySelector('.bcard[data-bloque="' + id + '"]');
    if (!art) { renderCatalogo(); return; }

    art.classList.toggle('bcard--abierto', abiertas[id]);
    var cab = art.querySelector('.bcard__cab');
    if (cab) { cab.setAttribute('aria-expanded', abiertas[id] ? 'true' : 'false'); }
    var det = art.querySelector('.bcard__detalle');
    if (det) {
      if (abiertas[id] && !det.innerHTML) {
        var b = bloque(id);
        if (b) { det.innerHTML = detalle(b); }
      }
      det.hidden = !abiertas[id];
      /* al cerrar se vacía: una ficha cerrada no lleva el manifiesto encima */
      if (!abiertas[id]) { det.innerHTML = ''; }
    }
  }

  /* ------------------------------------------ 11. UN SOLO GESTO DE PULSAR */
  function alPulsar(ev) {
    var objetivo = ev.target;
    if (!objetivo || !objetivo.closest) { return; }

    /* --- modal --- */
    var abre = objetivo.closest('[data-abrir-bloques]');
    if (abre) { ev.preventDefault(); abrirModal(); return; }

    var cierra = objetivo.closest('[data-cerrar-bloques]');
    if (cierra) { ev.preventDefault(); cerrarModal(); return; }

    /* --- instalación y desinstalación (antes que el resto: son verbos) --- */
    var inst = objetivo.closest('[data-instalar]');
    if (inst) { ev.preventDefault(); instalar(inst.getAttribute('data-instalar')); return; }

    var des = objetivo.closest('[data-desinstalar]');
    if (des) { ev.preventDefault(); desinstalar(des.getAttribute('data-desinstalar')); return; }

    /* --- ficha expandible --- */
    var ficha = objetivo.closest('.bcard__cab');
    if (ficha) {
      var art = ficha.closest('.bcard');
      if (art) { ev.preventDefault(); alternarFicha(art.getAttribute('data-bloque')); }
      return;
    }

    /* --- idioma --- */
    var idi = objetivo.closest('[data-idioma]');
    if (idi) {
      ev.preventDefault();
      var lang = idi.getAttribute('data-idioma');
      if (window.MimoI18n && lang !== idioma()) {
        window.MimoI18n.cargarIdioma(lang).then(function () {
          aviso(t('toast.idioma', { idioma: t('idioma.' + lang) }), '', 'ic-info');
        });
      }
      return;
    }

    /* --- filtro del catálogo --- */
    var fil = objetivo.closest('[data-filtro]');
    if (fil) {
      ev.preventDefault();
      filtro = fil.getAttribute('data-filtro');
      marcarFiltro();
      renderCatalogo();
      return;
    }

    /* --- tema --- */
    var tema = objetivo.closest('[data-tema]');
    if (tema) {
      ev.preventDefault();
      pintarTema(tema.getAttribute('data-tema'));
      aviso(t('toast.tema'), '', 'ic-luna');
      return;
    }

    var botonTema = objetivo.closest('#btn-tema');
    if (botonTema) {
      ev.preventDefault();
      pintarTema(document.body.classList.contains('tema-oscuro') ? 'claro' : 'oscuro');
      aviso(t('toast.tema'), '', 'ic-luna');
      return;
    }

    /* --- navegación --- */
    var enlace = objetivo.closest('[data-ir]');
    if (enlace) { ev.preventDefault(); ir(enlace.getAttribute('data-ir')); return; }

    /* --- panel derecho y cajón --- */
    if (objetivo.closest('#btn-panel')) {
      var marco = document.getElementById('marco');
      pintarPanel(marco.getAttribute('data-der') !== 'abierto');
      return;
    }

    if (objetivo.closest('#menu')) {
      var m = document.getElementById('marco');
      var botonMenu = document.getElementById('menu');
      var abierto = m.classList.toggle('cajon');
      botonMenu.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      return;
    }

    /* --- ajustes: borrar el estado (pide confirmación y dice qué borra) --- */
    if (objetivo.closest('[data-borrar-bloques]')) {
      var cuantos = instalados.length;
      var avisoTexto = t('ajustes.borrar') + ': ' + cuantos + ' · ' + t('ajustes.borrarDesc');
      if (window.confirm(avisoTexto)) {
        instalados = [];
        guardarEstado();
        pantallaActiva = 'calendario';
        renderTodo();
        ir('calendario');
        aviso(t('toast.desinstalado', { bloque: '—' }), '', 'ic-herramienta');
      }
      return;
    }

    /* --- controles que prometen y todavía no hacen: se DICEN (AU-120) --- */
    var boton = objetivo.closest('button');
    if (!boton) { return; }
    if (boton.closest('.pie') || boton.closest('.modal') || boton.closest('.acor') ||
        boton.closest('.bloque__nav')) { return; }
    /* los controles de una pantalla PROPIA son del bloque: ya responden a su
       clic, así que el shell no los anota como «visual» (sería un aviso falso
       encima de una acción que sí hace algo) */
    var pantalla = boton.closest('.pantalla');
    if (pantalla && PANTALLAS_PROPIAS[pantalla.getAttribute('data-panel')]) { return; }
    aviso(t('toast.visual'), '', 'ic-info');
  }

  /* ---------------------------------------------------- 12. TECLADO */
  function alTeclear(ev) {
    var enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName);
    var modal = document.getElementById('modal-bloques');

    if (ev.key === 'Escape') {
      if (modal && modal.classList.contains('on')) {
        cerrarModal();
      } else {
        cerrarCajon();
      }
      return;
    }

    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
      ev.preventDefault();
      aviso(t('toast.buscarNo'), '', 'ic-lupa');
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key === ',') {
      ev.preventDefault();
      ir('ajustes');
      return;
    }
    if (enCampo) { return; }
    if (ev.key === 'F1' || ev.key === '?') {
      ev.preventDefault();
      aviso(t('toast.ayuda'), '', 'ic-ayuda');
    }
  }

  /* ---------------------------------------------- 13. CARGAR Y ARRANCAR */
  function renderTodo() {
    sincronizarAportes();
    renderLateral();
    renderPantallas();
    renderAjustes();
    renderCatalogo();
    renderPanel(pantallaActiva);
    /* el panel dinámico también se repinta en cada renderTodo: un cambio de
       idioma o de almacén tiene que llegar a sus rótulos */
    pintarPanelCtx();
    pintarTema(document.body.classList.contains('tema-oscuro') ? 'oscuro' : 'claro');
    marcarIdioma();
    marcarFiltro();
  }

  function iniciar() {
    cajaToasts = document.getElementById('toasts');

    /* estado guardado */
    instalados = leerEstado();
    /* descartar ids que ya no existen en el catálogo SOLO si el catálogo
       cargó: si la lectura falló, el estado guardado se respeta tal cual
       (un fallo de red no puede vaciar lo que el usuario instaló) */
    if (Object.keys(porId).length) {
      instalados = instalados.filter(function (id) { return !!porId[id]; });
    }

    /* tema guardado */
    try {
      var temaGuardado = window.localStorage.getItem(CLAVE_TEMA);
      if (temaGuardado === 'oscuro' || temaGuardado === 'claro') {
        document.body.classList.remove('tema-claro', 'tema-oscuro');
        document.body.classList.add('tema-' + temaGuardado);
      }
    } catch (e) { /* sin almacén: se queda el del HTML */ }

    /* oyentes */
    document.addEventListener('click', alPulsar);
    document.addEventListener('keydown', alTeclear);

    var buscador = document.getElementById('buscar-bloques');
    if (buscador) {
      buscador.addEventListener('input', function () {
        busqueda = String(buscador.value || '').trim().toLowerCase();
        renderCatalogo();
      });
    }

    var modal = document.getElementById('modal-bloques');
    if (modal) {
      modal.addEventListener('click', function (ev) {
        if (ev.target === modal) { cerrarModal(); }   /* pulsar FUERA cierra */
      });
    }

    /* al cambiar de idioma, se repinta lo dinámico (el motor ya pintó lo estático) */
    if (window.MimoI18n && window.MimoI18n.alCambiar) {
      window.MimoI18n.alCambiar(function () {
        renderTodo();
      });
    }

    /* estado inicial del panel: expandido en pantalla ancha (AU-01) */
    pintarPanel(!window.matchMedia('(max-width:1279px)').matches);

    renderTodo();
    ir(pantallaActiva);
  }

  /* el arranque espera al idioma: sin diccionario no se pinta texto inventado */
  var listo = (window.MimoI18n && window.MimoI18n.listo) ? window.MimoI18n.listo : Promise.resolve();

  listo
    .then(cargarCatalogo)
    .then(iniciar)
    .catch(function (err) {
      if (window.console) { console.error('[mimo] arranque fallido', err); }
    });
}());
