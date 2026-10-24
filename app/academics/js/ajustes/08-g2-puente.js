/* ---------------------------------------------------- ajustes-g2-puente.js
   El puente entre la propuesta G2 de Ajustes y el motor de mimo.

   POR QUE HACE FALTA ESTE ARCHIVO
   El exterior cambio (renglones con titulo, pastillas de dos estados, los tres
   modos de la barra a la vista) pero el MOTOR es el mismo y no se toca: el sigue
   buscando sus controles por id (#aj-ver-hechas, #aj-sonido) y guardando en
   E.ajustes. Este archivo es lo unico que los une:

     - la pastilla visible escribe en la casilla real y dispara su 'change', que es
       lo que el motor ya escuchaba: asi no hay dos fuentes de verdad;
     - cuando el motor pinta (renderAjustes), la pastilla se sincroniza desde la
       casilla, para que al recargar muestre el estado guardado y no "No";
     - los tres botones de modo de barra llaman a avSeg('barra', ...) y a
       window.mimoBarra.ponerModo(), que es exactamente lo que hacia el
       desplegable anterior.

   REGLA: si manana se agrega un ajuste nuevo, se agrega al motor y aqui solo se
   sincroniza su cara. Este archivo NO guarda por su cuenta.
   ===================================================================== */
(function () {
  /* ---- una pastilla por cada casilla que el motor maneja ------------------ */
  // [id de la pastilla visible, id de la casilla real]
  const PASTILLAS = [
    // 'aj-hechas' sigue aqui porque FUNCIONA pero se MUDA (Por hacer -> Calendario). Mientras no
    // se mueva, su pastilla esta oculta. Ver PENDIENTES-GENERAL.md.
    ['aj-hechas-pastilla',   'aj-ver-hechas'],
    // El sonido del temporizador YA vive en su seccion (Tiempo), con su propia pastilla visible.
    ['aj-avisos-pastilla',   'aj-sonido'],
    ['aj-recordar-pastilla', 'aj-recordar'],
  ];

  function sincronizar(pastillaId, casillaId) {
    const p = document.getElementById(pastillaId);
    const c = document.getElementById(casillaId);
    if (!p || !c) return;
    // la cara dice el estado de la casilla; el texto es la ultima pastilla
    const on = !!c.checked;
    p.setAttribute('aria-pressed', on ? 'true' : 'false');
    const texto = p.lastElementChild;
    if (texto) texto.textContent = (typeof window.t === 'function') ? window.t(on ? 'ajustes.si' : 'ajustes.no') : (on ? 'Sí' : 'No');
    // un clic en la pastilla mueve la casilla y avisa al motor por su via de siempre
    p.onclick = () => {
      c.checked = !c.checked;
      c.dispatchEvent(new Event('change', { bubbles: true }));
      sincronizar(pastillaId, casillaId);
    };
  }

  function sincronizarTodo() {
    PASTILLAS.forEach(par => sincronizar(par[0], par[1]));
    if (typeof pintarNotificacion === 'function') pintarNotificacion();
    pintarModos();
    pintarTitulos();
    pintarEjemplo();
    pintarFuente();
  }

  /* ---- como se abrevian los titulos -------------------------------------
     La cara visible son tres botones (data-titulo: envuelto/puntos/iniciales).
     El motor guarda en E.ajustes.titulos.modo y lo aplica renderEstudio. Se marca
     el elegido desde formatoTitulo(), con soporte null: si no hay nada guardado,
     queda 'envuelto' (el de fabrica). */
  var bTitulos = document.querySelectorAll('#p-ajustes button[data-titulo]');
  function pintarTitulos() {
    var modo = 'envuelto';
    try { if (typeof formatoTitulo === 'function') modo = formatoTitulo().modo || 'envuelto'; } catch (e) {}
    bTitulos.forEach(function (b) { b.classList.toggle('on', b.dataset.titulo === modo); });
  }
  bTitulos.forEach(function (b) {
    b.onclick = function () {
      // null-safe: si no hay titulos guardados, se parte del de fabrica.
      if (!E.ajustes) E.ajustes = {};
      if (!E.ajustes.titulos) E.ajustes.titulos = { modo: 'envuelto', largo: 12 };
      var base = (typeof formatoTitulo === 'function') ? formatoTitulo() : { modo: 'envuelto', largo: 12 };
      E.ajustes.titulos = Object.assign({}, base, { modo: b.dataset.titulo });
      if (typeof guardar === 'function') guardar();
      if (typeof renderEstudio === 'function') renderEstudio();
      pintarTitulos();
      pintarEjemplo();
    };
  });
  pintarTitulos();

  /* ---- el EJEMPLO del recorte ---------------------------------------------
     Un nombre largo dentro de un recuadro de geometria FIJA; el texto se ajusta a el. Usa la misma
     regla que la app (resumirTitulo), asi que ensena de verdad lo que pasara. */
  var NOMBRE_EJEMPLO = 'Mecánica de los Medios Continuos';
  function pintarEjemplo() {
    var caja = document.getElementById('gen-ejemplo');
    if (!caja) return;
    var modo = 'envuelto';
    try { if (typeof formatoTitulo === 'function') modo = formatoTitulo().modo || 'envuelto'; } catch (e) {}
    if (modo === 'puntos') {
      caja.style.whiteSpace = 'nowrap';
      caja.textContent = (typeof resumirTitulo === 'function') ? resumirTitulo(NOMBRE_EJEMPLO) : NOMBRE_EJEMPLO;
    } else if (modo === 'iniciales') {
      caja.style.whiteSpace = 'nowrap';
      caja.textContent = (typeof resumirTitulo === 'function') ? resumirTitulo(NOMBRE_EJEMPLO) : NOMBRE_EJEMPLO;
    } else {
      // "Hueco": el recuadro no cambia; el nombre se recorta a su ancho con puntos suspensivos.
      caja.style.whiteSpace = 'nowrap';
      caja.textContent = NOMBRE_EJEMPLO;
    }
  }

  /* ---- tamano de la FUENTE ------------------------------------------------
     Global. Se guarda en E.ajustes.av.fuente (motor 02-avanzados.js) y escala la app entera. */
  var bFuente = document.querySelectorAll('#p-ajustes button[data-fuente]');
  function pintarFuente() {
    var actual = 1;
    try {
      var a = (typeof avVista === 'function') ? avVista() : {};
      actual = Number(a.fuente) || 1;
    } catch (e) {}
    bFuente.forEach(function (b) { b.classList.toggle('on', Math.abs(Number(b.dataset.fuente) - actual) < 0.001); });
  }
  bFuente.forEach(function (b) {
    b.onclick = function () {
      // El tamaño de la fuente se guarda AL INSTANTE, como los demas ajustes de General
      // (titulos y formatos). Si fuera por el borrador habria que pulsar "Aceptar y guardar"
      // solo para esto, y en la misma ventana unos ajustes se guardarian y otros no.
      if (!E.ajustes) E.ajustes = {};
      if (!E.ajustes.av) E.ajustes.av = {};
      E.ajustes.av.fuente = Number(b.dataset.fuente) || 1;
      if (typeof avBorrador !== 'undefined' && avBorrador) avBorrador.fuente = E.ajustes.av.fuente;
      if (typeof guardar === 'function') guardar();
      if (typeof aplicarAvanzado === 'function') aplicarAvanzado();
      if (typeof renderTodo === 'function') renderTodo(true);
      if (typeof pintarBarraAjustes === 'function') pintarBarraAjustes();
      pintarFuente();
    };
  });
  pintarFuente();

  /* ---- formato de las horas -----------------------------------------------
     El motor guarda E.ajustes.formatos como LISTA (se pueden marcar varios formatos
     a la vez). La cara visible son tres botones (data-formato: hm/hdec/min); un clic
     alterna ese formato en la lista. Null-safe: sin datos, queda ['hm'] de fabrica. */
  var bFormatos = document.querySelectorAll('#p-ajustes button[data-formato]');
  function pintarFormatos() {
    var elegidos = (E.ajustes && E.ajustes.formatos && E.ajustes.formatos.length)
      ? E.ajustes.formatos : ['hm'];
    bFormatos.forEach(function (b) {
      b.classList.toggle('on', elegidos.indexOf(b.dataset.formato) >= 0);
    });
  }
  bFormatos.forEach(function (b) {
    b.onclick = function () {
      if (!E.ajustes) E.ajustes = {};
      var elegidos = (E.ajustes.formatos && E.ajustes.formatos.length)
        ? E.ajustes.formatos.slice() : ['hm'];
      var k = b.dataset.formato;
      var i = elegidos.indexOf(k);
      if (i >= 0) elegidos.splice(i, 1); else elegidos.push(k);
      // No dejar cero formatos: dejaria las horas en blanco en todo el panel.
      if (!elegidos.length) elegidos = ['hm'];
      E.ajustes.formatos = elegidos;
      if (typeof guardar === 'function') guardar();
      if (typeof renderTodo === 'function') renderTodo();
      pintarFormatos();
    };
  });
  pintarFormatos();

  /* ---- los tres modos de la barra lateral --------------------------------
     El elegido se marca leyendo av().barra, que es la unica fuente de verdad. */
  function pintarModos() {
    let actual = 'manual';
    // avVista() lee el BORRADOR si hay uno abierto, y si no lo guardado: asi el boton recien
    // pulsado se marca al instante (antes se leia av(), que ignora el borrador y quedaba estatico).
    try {
      if (typeof avVista === 'function' && avVista()) actual = avVista().barra || 'manual';
      else if (typeof av === 'function' && av()) actual = av().barra || 'manual';
    } catch (e) {}
    document.querySelectorAll('#p-ajustes .modo[data-barra]').forEach(b => {
      b.classList.toggle('on', b.dataset.barra === actual);
    });
  }

  document.querySelectorAll('#p-ajustes .modo[data-barra]').forEach(b => {
    b.onclick = () => {
      const valor = b.dataset.barra;
      // el mismo camino que el tema: al borrador, aplicar, repintar. avSeg dibuja un
      // segmento y NO guarda; aqui se escribe el borrador directo, que es lo que
      // avSeg('barra') simulaba mal (espera un array, no un string).
      if (typeof abrirBorrador === 'function') abrirBorrador();
      if (avBorrador) avBorrador.barra = valor;
      if (typeof aplicarAvanzado === 'function') aplicarAvanzado();
      if (window.mimoBarra) window.mimoBarra.ponerModo(valor);
      pintarModos();
      if (typeof renderTodo === 'function') renderTodo(true);
      if (typeof pintarBarraAjustes === 'function') pintarBarraAjustes();
    };
  });

  /* ---- posicion y estilo de la barra (P7) --------------------------------
     Mismo camino que el modo: borrador -> aplicar -> repintar. La posicion y el estilo
     son clases del marco; el motor de la barra (08-barra.js) las pone. */
  function leerAv(k, def) {
    try {
      if (typeof avVista === 'function' && avVista()) return avVista()[k] || def;
      if (typeof av === 'function' && av()) return av()[k] || def;
    } catch (e) {}
    return def;
  }
  function pintarBarraPos() {
    const actual = leerAv('barraPos', 'izquierda');
    document.querySelectorAll('#p-ajustes .modo[data-pos]').forEach(b =>
      b.classList.toggle('on', b.dataset.pos === actual));
  }
  function pintarBarraEstilo() {
    const actual = leerAv('barraEstilo', 'clasica');
    document.querySelectorAll('#p-ajustes .modo[data-estilo]').forEach(b =>
      b.classList.toggle('on', b.dataset.estilo === actual));
  }
  // Tras cada clic hay que repintar TAMBIEN la barra de cambios: si no, el aviso de
  // "N cambios sin guardar" se queda con el recuento del clic anterior y parece que la
  // eleccion no se registra (era parte de la queja "queda en blanco").
  function refrescarTrasCambio(){
    if (typeof pintarBarraAjustes === 'function') pintarBarraAjustes();
  }
  document.querySelectorAll('#p-ajustes .modo[data-pos]').forEach(b => {
    b.onclick = () => {
      if (typeof abrirBorrador === 'function') abrirBorrador();
      if (avBorrador) avBorrador.barraPos = b.dataset.pos;
      if (typeof aplicarAvanzado === 'function') aplicarAvanzado();
      pintarBarraPos();
      if (typeof renderTodo === 'function') renderTodo(true);
      refrescarTrasCambio();
    };
  });
  document.querySelectorAll('#p-ajustes .modo[data-estilo]').forEach(b => {
    b.onclick = () => {
      if (typeof abrirBorrador === 'function') abrirBorrador();
      if (avBorrador) avBorrador.barraEstilo = b.dataset.estilo;
      if (typeof aplicarAvanzado === 'function') aplicarAvanzado();
      pintarBarraEstilo();
      if (typeof renderTodo === 'function') renderTodo(true);
      refrescarTrasCambio();
    };
  });
  pintarBarraPos(); pintarBarraEstilo();

  /* ---- la cara de la VERSION ---------------------------------------------
     El motor (06-actualizar.js) escribe el semaforo oculto (#bv-etq) y su caja (#caja-actualizar).
     En General se muestra la version y, al pulsar "Buscar", el resultado bajo el apartado. */
  function sincronizarVersion() {
    const gen = document.getElementById('gen-version');
    if (gen && typeof versionLocal === 'function') gen.textContent = 'v' + versionLocal();
    const caja = document.getElementById('caja-actualizar');
    const visible = document.getElementById('aj-version-aviso');
    if (visible && caja) {
      const t = (caja.textContent || '').trim();
      visible.textContent = t;
      visible.className = caja.className || '';
      visible.style.display = t ? '' : 'none';
    }
  }

  /* ---- el boton visible del semaforo dispara el del motor ------------------
     La propuesta muestra #bv-buscar. mimo escucha #btn-actualizar (que esta
     oculto). Se unen: pulsar la cara visible es pulsar el del motor. */
  const bvBuscar = document.getElementById('bv-buscar');
  const btnActualizar = document.getElementById('btn-actualizar');
  if (bvBuscar && btnActualizar) {
    bvBuscar.onclick = () => btnActualizar.click();
  }

  /* ---- Apariencia: modo de color (paso 1) y temas por naturaleza (paso 2) ----
     El motor guarda en E.ajustes.av: tModo ('claro'/'oscuro'/'sistema'), tema (el ultimo elegido)
     y temaClaro/temaOscuro (los del modo sistema). Aqui se pinta la cara: #av-modo (tres botones)
     y #av-temas (la rejilla que cambia segun el modo). Todo por el BORRADOR, como el resto. */
  // La muestra de cada tema y su DESCRIPCION de una linea, como el boceto aprobado.
  var MUESTRA = {clasico:['#fff','#2563eb'], negro:['#1e1e1e','#3584e4'],
                 medianoche:['#131314','#8ab4f8'], deepsea:['#071a2b','#22d3ee'],
                 bosque:['#eef4ee','#1f7a4d'], sepia:['#f4ecd8','#8a4b2a'],
                 vino:['#fbf3f4','#8e2f43'], pinky:['#ffffff','#b5226b'],
                 'alto-contraste':['#000000','#ffff00']};
  var DESCRIPCION = {clasico:'Claro y azul. El de fábrica.', bosque:'Claro, con verde.',
                     sepia:'Como papel envejecido.', pinky:'Claro, con rosa.',
                     negro:'Oscuro sobrio, con azul.', medianoche:'Casi negro, azul claro.',
                     deepsea:'Oscuro azulado, con cian.', 'alto-contraste':'Negro y amarillo, para ver mejor.',
                     vino:'Granate oscuro, cálido.'};
  function nombreTema(v){
    try { var t = TEMAS.find(function(x){ return x[0] === v; }); return t ? t[1] : v; } catch (e) { return v; }
  }
  function esClaroTema(v){ return (typeof esClaro === 'function') ? esClaro(v) : true; }

  function pintarColorModo() {
    var modo = 'claro';
    try { if (typeof avVista === 'function' && avVista()) modo = avVista().tModo || 'claro'; } catch (e) {}
    document.querySelectorAll('#av-modo button').forEach(function (b) {
      var on = b.dataset.val === modo;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    return modo;
  }
  function tarjetaTema(v) {
    var m = MUESTRA[v] || ['#fff','#2563eb'];
    var ds = DESCRIPCION[v] || '';
    return '<button type="button" class="tema" aria-pressed="false" data-val="' + v + '">' +
      '<span class="tm-muestra" style="background:' + m[0] + ';--tm-ac:' + m[1] + '"></span>' +
      '<span class="tm-nom">' + nombreTema(v) + '</span>' +
      '<span class="tm-ds">' + ds + '</span>' +
      '<span class="tm-marca" aria-hidden="true"></span></button>';
  }
  // Vino NO sale en la vista de Apariencia (el boceto aprobado trae 4 claros y 4 oscuros).
  // Se quita de la VISTA, no del motor: el tema sigue existiendo por si venia guardado.
  function sinVino(lista) { return lista.filter(function (v) { return v !== 'vino'; }); }
  function pintarTemasGrid() {
    var caja = document.getElementById('av-temas');
    if (!caja) return;
    var a = (typeof avVista === 'function' && avVista()) ? avVista() : {};
    var modo = a.tModo || 'claro';
    var tit = document.getElementById('av-paso2-tit');
    var nota = document.getElementById('av-paso2-nota');
    var claros = sinVino((typeof TEMAS_CLAROS !== 'undefined') ? TEMAS_CLAROS : ['clasico','bosque','sepia','pinky']);
    var oscuros = sinVino((typeof TEMAS_OSCUROS !== 'undefined') ? TEMAS_OSCUROS : ['negro','medianoche','deepsea','alto-contraste']);
    if (modo === 'sistema') {
      // "Segun el sistema" NO inventa un paso 2: la app usa el tema claro u OSCURO del sistema.
      // Se muestra solo el grupo que toca AHORA (el que el sistema pide), no los dos: el dueno
      // pidio que ofrezca "lo que ofrece el oscuro o el claro segun el sistema".
      var sisOscuro = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var lista = sisOscuro ? oscuros : claros;
      caja.innerHTML = lista.map(tarjetaTema).join('');
      if (tit) tit.textContent = 'Paso 2 · Tu tema ' + (sisOscuro ? 'oscuro' : 'claro');
      if (nota) nota.textContent = 'La app sigue al sistema: ahora en ' + (sisOscuro ? 'oscuro' : 'claro') +
        '. Elige el tema de cada uno y cambia sola cuando cambie el sistema.';
    } else {
      var lista = (modo === 'oscuro') ? oscuros : claros;
      caja.innerHTML = lista.map(tarjetaTema).join('');
      if (tit) tit.textContent = 'Paso 2 · Tu tema ' + (modo === 'oscuro' ? 'oscuro' : 'claro');
      if (nota) nota.textContent = 'El que elijas sustituye al tema actual.';
    }
    // marcar los elegidos
    var elegidos = [];
    if (modo === 'sistema') {
      var so2 = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      elegidos = [so2 ? (a.temaOscuro || 'negro') : (a.temaClaro || 'clasico')];
    } else { elegidos = [a.tema || 'clasico']; }
    caja.querySelectorAll('.tema[data-val]').forEach(function (t) {
      var on = elegidos.indexOf(t.dataset.val) >= 0;
      t.classList.toggle('on', on);
      t.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  document.querySelectorAll('#av-modo button').forEach(function (b) {
    b.onclick = function () {
      var val = b.dataset.val;
      if (typeof abrirBorrador === 'function') abrirBorrador();
      if (!avBorrador) return;
      avBorrador.tModo = val;
      // Al cambiar de clase, el "tema" de turno tiene que ser de esa clase: si no, elegir "claro"
      // mostraria el oscuro que hubiera antes.
      if (val === 'claro' && !esClaroTema(avBorrador.tema)) avBorrador.tema = avBorrador.temaClaro || 'clasico';
      if (val === 'oscuro' && esClaroTema(avBorrador.tema)) avBorrador.tema = avBorrador.temaOscuro || 'negro';
      if (typeof aplicarAvanzado === 'function') aplicarAvanzado();
      if (typeof renderTodo === 'function') renderTodo(true);
      if (typeof pintarBarraAjustes === 'function') pintarBarraAjustes();
      pintarColorModo(); pintarTemasGrid();
    };
  });
  // delegacion: la rejilla se rehace cada vez, asi que el clic se escucha en el contenedor
  var cajaTemas = document.getElementById('av-temas');
  if (cajaTemas) cajaTemas.addEventListener('click', function (ev) {
    var t = ev.target.closest('.tema[data-val]');
    if (!t) return;
    var val = t.dataset.val;
    if (typeof abrirBorrador === 'function') abrirBorrador();
    if (!avBorrador) return;
    if ((avBorrador.tModo || 'claro') === 'sistema') {
      if (esClaroTema(val)) avBorrador.temaClaro = val; else avBorrador.temaOscuro = val;
    } else {
      avBorrador.tema = val;
    }
    if (typeof aplicarAvanzado === 'function') aplicarAvanzado();
    if (typeof renderTodo === 'function') renderTodo(true);
    if (typeof pintarBarraAjustes === 'function') pintarBarraAjustes();
    pintarColorModo(); pintarTemasGrid();
  });
  pintarColorModo(); pintarTemasGrid();

  /* ---- engancharse a lo que ya corre -------------------------------------- */
  // renderAjustes() pinta la pestana; el semaforo pinta el aviso. En los dos casos
  // hay que volver a sincronizar la cara, o queda mostrando un estado viejo.
  const original = window.renderAjustes;
  if (typeof original === 'function') {
    window.renderAjustes = function () {
      original.apply(this, arguments);
      sincronizarTodo();
      sincronizarVersion();
      pintarColorModo(); pintarTemasGrid();
    };
  }
  // 06-actualizar.js corre al cargar y escribe el aviso cuando termina: se observa la caja.
  const cajaAct = document.getElementById('caja-actualizar');
  if (cajaAct && window.MutationObserver) {
    new MutationObserver(sincronizarVersion)
      .observe(cajaAct, { childList: true, characterData: true, subtree: true });
  }

  /* ---- ATAJOS DE TECLADO (Navegación) -------------------------------------
     La lista se dibuja desde AV_ATAJOS_FABRICA (la fuente), y cada fila lleva el nombre de la
     seccion y un boton con su tecla. El motor de verdad vive en 06-arranque.js (window.mimoAtajos);
     aqui solo se pinta y se guarda lo que el usuario elige. */
  const NOMBRE_SECCION = {calendario:'Calendario', estudio:'Estudio', malla:'Malla', notas:'Notas',
                          tiempo:'Tiempo', tareas:'Tareas', ajustes:'Ajustes'};
  function etiquetaTecla(comb){
    if (!comb) return '—';
    return comb.split('+').map(function (p) {
      if (p === 'ctrl') return 'Ctrl';
      if (p === 'alt') return 'Alt';
      if (p === 'shift') return 'Mayús';
      if (p === 'espacio') return 'Espacio';
      return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' + ');
  }
  function atajosDeVista(){
    try { if (window.mimoAtajos) return window.mimoAtajos.vigentes(); } catch (e) {}
    return {};
  }
  /* Guarda al instante, como los demas apartados de esta ventana (fuente, titulos, formatos). */
  function guardarAtajos(){
    if (!E.ajustes) E.ajustes = {};
    if (!E.ajustes.av) E.ajustes.av = {};
    if (typeof guardar === 'function') guardar();
  }
  function pintarAtajos(){
    const cont = document.getElementById('nav-atajos-lista');
    if (!cont) return;
    const vig = atajosDeVista();
    const orden = (window.mimoAtajos && window.mimoAtajos.fabrica) ? Object.keys(window.mimoAtajos.fabrica) : Object.keys(NOMBRE_SECCION);
    cont.innerHTML = orden.map(function (sec) {
      return '<div class="atajo-fila"><span class="a-nom">' + (NOMBRE_SECCION[sec] || sec) + '</span>' +
             '<button type="button" class="tecla" data-atajo="' + sec + '">' + etiquetaTecla(vig[sec]) + '</button></div>';
    }).join('');
    cont.querySelectorAll('[data-atajo]').forEach(function (b) {
      b.onclick = function () { capturarTecla(b, b.dataset.atajo); };
    });
  }
  /* Apagado del apartado: se marca la cara y se guarda. */
  function pintarAtajosOn(){
    let enc = true;
    try { if (window.mimoAtajos) enc = window.mimoAtajos.encendidos(); } catch (e) {}
    document.querySelectorAll('#p-ajustes [data-atajos-on]').forEach(function (b) {
      b.classList.toggle('on', (b.dataset.atajosOn === 'si') === !!enc);
    });
  }
  /* Captura la proxima combinacion. Las reglas son las MISMAS que las del motor (mimoAtajos). */
  function capturarTecla(boton, sec){
    const antes = boton.textContent;
    boton.classList.add('capturando');
    boton.textContent = 'Pulsa…';
    function terminar(){ document.removeEventListener('keydown', alPulsar, true); boton.classList.remove('capturando'); }
    function alPulsar(ev){
      ev.preventDefault(); ev.stopPropagation();
      if (ev.key === 'Escape') { terminar(); boton.textContent = antes; return; }
      const comb = window.mimoAtajos ? window.mimoAtajos.normalizar(ev) : '';
      if (!comb) return;                                  // solo modificadores: sigue esperando
      if (window.mimoAtajos && window.mimoAtajos.fijos[comb]) {
        terminar();
        if (typeof avisar === 'function') avisar('Esa combinación puede usarla el sistema o el navegador (Ctrl + T, Ctrl + W…). Elige otra.');
        boton.textContent = antes; return;
      }
      const mapa = atajosDeVista();
      for (const otra in mapa) {
        if (otra !== sec && mapa[otra] === comb) {
          terminar();
          if (typeof avisar === 'function') avisar('Esa combinación ya la tiene «' + (NOMBRE_SECCION[otra] || otra) + '». Elige otra.');
          boton.textContent = antes; return;
        }
      }
      E.ajustes.av.atajos[sec] = comb;
      guardarAtajos();
      terminar();
      pintarAtajos();
    }
    document.addEventListener('keydown', alPulsar, true);
  }
  function montarAtajos(){
    const lista = document.getElementById('nav-atajos-lista');
    if (!lista) return;
    pintarAtajos();
    pintarAtajosOn();
    document.querySelectorAll('#p-ajustes [data-atajos-on]').forEach(function (b) {
      b.onclick = function () {
        if (!E.ajustes) E.ajustes = {};
        if (!E.ajustes.av) E.ajustes.av = {};
        E.ajustes.av.atajosOn = (b.dataset.atajosOn === 'si');
        guardarAtajos();
        pintarAtajosOn();
      };
    });
    const reset = document.getElementById('nav-atajos-reset');
    if (reset) reset.onclick = function () {
      if (!E.ajustes) E.ajustes = {};
      if (!E.ajustes.av) E.ajustes.av = {};
      const fab = (window.mimoAtajos && window.mimoAtajos.fabrica) || {};
      E.ajustes.av.atajos = Object.assign({}, fab);
      guardarAtajos();
      pintarAtajos();
    };
  }

  sincronizarTodo();
  sincronizarVersion();
  montarAtajos();
})();
