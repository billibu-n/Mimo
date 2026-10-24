/* =====================================================================
   Barra lateral retractil (marco G1). Tres modos, elegidos en Ajustes.

   Este archivo SOLO maneja la barra: abrir, cerrar, y los tres modos.
   La navegacion entre secciones la hace 06-arranque.js (los botones .nav,
   con el motor G1 .seccion[data-seccion]).

   El modo elegido vive en el estado de la app (E.ajustes.av.barra), que
   Ajustes guarda y restaura; esta barra SOLO lo aplica. No guarda nada
   propio a proposito: un solo lugar decide, asi no se pelean dos valores.
   ===================================================================== */
(function () {
  const marco = document.querySelector('.marco.g1');
  if (!marco) return;
  const boton = document.getElementById('btn-menu');
  const lateral = marco.querySelector('.lateral');
  const caliente = document.getElementById('zona-caliente');
  const RETARDO = 300;   // ms antes de cerrar en automatico
  let temporizador = null;

  function abrir(){ marco.classList.remove('replegada'); marco.classList.add('abierta'); }
  function cerrar(){ marco.classList.add('replegada'); marco.classList.remove('abierta'); }

  if (boton) boton.onclick = () => {
    // Con la barra ARRIBA no se "repliega" (la barra horizontal siempre esta visible);
    // la hamburguesa compacta sus botones. En izquierda/derecha si abre o cierra.
    if (marco.classList.contains('pos-arriba')) marco.classList.toggle('comp');
    else if (marco.classList.contains('replegada')) abrir(); else cerrar();
  };

  // --- modo automatico: zona caliente + retardo ----------------------------
  function programarCierre(){
    clearTimeout(temporizador);
    if (lateral && lateral.contains(document.activeElement)) return; // foco adentro: no cerrar
    temporizador = setTimeout(cerrar, RETARDO);
  }
  function cancelarCierre(){ clearTimeout(temporizador); }
  if (caliente) caliente.onmouseenter = () => { cancelarCierre(); abrir(); };
  if (lateral){
    lateral.onmouseenter = cancelarCierre;
    lateral.onmouseleave = programarCierre;
    lateral.addEventListener('focusin', cancelarCierre);
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !marco.classList.contains('replegada')) cerrar();
  });

  function ponerModo(modo){
    if (!modo) modo = 'manual';
    marco.classList.remove('modo-manual', 'modo-automatico', 'modo-fijo');
    marco.classList.add('modo-' + modo);
    if (modo === 'fijo'){ marco.classList.remove('replegada', 'abierta'); }
    else { marco.classList.add('replegada'); marco.classList.remove('abierta'); }
  }

  // --- posicion (izquierda / derecha / arriba) y estilo del menu -------------
  // La posicion y el estilo son clases del marco, como el modo: el CSS hace el resto. Los tres
  // modos (manual / automatica / fija) siguen valiendo en las tres posiciones.
  const POSICIONES = ['izquierda', 'derecha', 'arriba'];
  const ESTILOS = ['clasica', 'compacta', 'pastillas'];
  function ponerPos(p){
    if (POSICIONES.indexOf(p) === -1) p = 'izquierda';
    marco.classList.remove('pos-izquierda', 'pos-derecha', 'pos-arriba');
    marco.classList.add('pos-' + p);
    // En 'arriba' la barra no se repliega; se arranca sin compactar.
    if (p === 'arriba') marco.classList.remove('comp');
    ajustarModales();
  }

  // Con la barra ARRIBA, los modales (que son position:fixed y no se mueven al hacer
  // scroll) quedaban debajo de la barra horizontal. Se reserva como margen superior la
  // posicion del BORDE INFERIOR de la barra (no su alto: el modal arranca en el borde
  // de la ventana, y la barra empieza debajo de la cabecera). Se recalcula al cambiar
  // de posicion y al redimensionar.
  function ajustarModales(){
    const arriba = marco.classList.contains('pos-arriba');
    const borde = (arriba && lateral) ? Math.round(lateral.getBoundingClientRect().bottom) : 0;
    document.documentElement.style.setProperty('--modal-top', (arriba ? borde + 20 : 40) + 'px');
  }
  window.addEventListener('resize', ajustarModales);
  function ponerEstilo(e2){
    if (ESTILOS.indexOf(e2) === -1) e2 = 'clasica';
    marco.classList.remove('estilo-clasica', 'estilo-compacta', 'estilo-pastillas');
    marco.classList.add('estilo-' + e2);
  }

  // Expone al resto de la app: Ajustes llama a window.mimoBarra.ponerModo / ponerPos / ponerEstilo.
  window.mimoBarra = { ponerModo: ponerModo, ponerPos: ponerPos, ponerEstilo: ponerEstilo };

  // Arranca con lo guardado en el estado de la app (E.ajustes.av.*).
  let guardado = 'manual', gPos = 'izquierda', gEstilo = 'clasica';
  try {
    const a = (typeof av === 'function' && av()) || {};
    guardado = a.barra || 'manual'; gPos = a.barraPos || 'izquierda'; gEstilo = a.barraEstilo || 'clasica';
  } catch(e){}
  ponerModo(guardado); ponerPos(gPos); ponerEstilo(gEstilo);
})();
