/* ============================================================================
   contexto.js - EL MENU DEL BOTON DERECHO.

   Un solo menu para toda la aplicacion: clic derecho sobre una tarjeta y sale, en el sitio del
   puntero, lo que se puede hacer con ESA cosa. Sustituye al menu del navegador SOLO cuando el
   objeto tiene acciones; en el resto de la pantalla el boton derecho se comporta como siempre.

   Por que existe: hoy hay un menu suelto en Estudio (menu-suma, para sumar tiempo rapido) y el
   resto de las secciones obliga a abrir la ficha entera para marcar, cambiar la prioridad o
   agregar al semestre. El clic derecho deja esas acciones a un gesto.

   COMO SE ANADE UNA SECCION: se registra su selector y una funcion que devuelve las opciones.
   Nada mas. La seccion no sabe como se pinta el menu, ni el menu sabe de la seccion.
   ============================================================================ */

const MENU_CTX = {};

function cerrarMenuContexto(){
  const m = document.getElementById('menu-ctx');
  if (m) m.remove();
  document.removeEventListener('mousedown', menuCtxFuera, true);
  document.removeEventListener('keydown', menuCtxEsc, true);
  window.removeEventListener('resize', cerrarMenuContexto);
  window.removeEventListener('scroll', cerrarMenuContexto, true);
}
function menuCtxFuera(ev){
  const m = document.getElementById('menu-ctx');
  if (m && !m.contains(ev.target)) cerrarMenuContexto();
}
function menuCtxEsc(ev){ if (ev.key === 'Escape') cerrarMenuContexto(); }

/* Abre el menu junto al puntero. `filas` es una lista de opciones:
     {t:'Texto', al:function}                 -> una accion
     {t:'Texto', al:function, on:true}        -> una accion ACTIVA (ya esta en ese estado)
     {t:'Texto', al:function, peligro:true}   -> una accion que borra (en rojo)
     {sep:true}                               -> una raya de separacion
     {cab:'Texto'}                            -> un encabezado (lo que estas tocando)              */
function abrirMenuContexto(ev, filas){
  cerrarMenuContexto();
  if (!filas || !filas.length) return false;
  const m = document.createElement('div');
  m.id = 'menu-ctx';
  m.className = 'menu-suma';
  m.setAttribute('role', 'menu');
  m.innerHTML = filas.map(f => {
    if (f.cab !== undefined) return '<div class="ms-titulo">' + esc(f.cab) + '</div>';
    if (f.sep) return '<div class="ms-sep"></div>';
    return '<button type="button" class="ms-op' + (f.on ? ' on' : '') + (f.peligro ? ' ms-peligro' : '') +
      '" role="menuitem">' + esc(f.t) + '</button>';
  }).join('');
  document.body.appendChild(m);

  // Junto al cursor, pero sin salirse de la ventana por ningun lado.
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(ev.clientX, window.innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(ev.clientY, window.innerHeight - r.height - 8)) + 'px';

  const acciones = filas.filter(f => f.al);
  m.querySelectorAll('.ms-op').forEach((b, i) => {
    b.onclick = () => { const f = acciones[i]; cerrarMenuContexto(); if (f && f.al) f.al(); };
  });
  document.addEventListener('mousedown', menuCtxFuera, true);
  document.addEventListener('keydown', menuCtxEsc, true);
  window.addEventListener('resize', cerrarMenuContexto);
  window.addEventListener('scroll', cerrarMenuContexto, true);
  return true;
}

/* El manejador UNICO de toda la aplicacion: mira donde se hizo clic derecho y pregunta a cada
   seccion registrada si ese objeto es suyo. La primera que lo reconozca, abre el menu. */
function alMenuContexto(ev){
  for (const sel in MENU_CTX){
    const el = ev.target.closest(sel);
    if (el){ if (abrirMenuContexto(ev, MENU_CTX[sel](el))) ev.preventDefault(); return; }
  }
}
document.addEventListener('contextmenu', alMenuContexto);

/* Las acciones de prioridad son las mismas en el calendario y en Tareas: una sola lista. */
function filasPrioridad(id, repintar){
  const s = est(), filas = [{ sep: true }];
  [['alta', 'ctx.alta'], ['media', 'ctx.media'], ['baja', 'ctx.baja']].forEach(p => {
    filas.push({ t: t(p[1]), on: s.prioridades[id] === p[0], al: () => {
      s.prioridades[id] = p[0]; guardar(); repintar();
    }});
  });
  filas.push({ t: t('ctx.sinpri'), on: !s.prioridades[id], al: () => {
    delete s.prioridades[id]; guardar(); repintar();
  }});
  return filas;
}

/* ------------------------------------------------------------------ CALENDARIO
   Sobre un evento del calendario: dejarlo listo (hecho), su prioridad y abrirlo para editar. */
function contextoCalendario(el){
  const id = el.dataset.id;
  const ev = (typeof eventoPorId === 'function') ? eventoPorId(id) : null;
  if (!ev) return [];
  const s = est(), hecha = !!s.hechas[id];
  const repintar = () => renderSemestre();
  const filas = [{ cab: ev.texto || 'Sin título' }];
  filas.push(hecha
    ? { t: t('ctx.desmarcar'), al: () => { delete s.hechas[id]; guardar('Tarea devuelta a pendientes'); repintar(); } }
    : { t: t('ctx.hecha'), al: () => { s.hechas[id] = true; guardar('Tarea marcada como hecha'); repintar(); } });
  filas.push.apply(filas, filasPrioridad(id, repintar));
  filas.push({ sep: true });
  filas.push({ t: t('ctx.editar'), al: () => abrirEditor(id) });
  return filas;
}
MENU_CTX['.chip[data-id]'] = contextoCalendario;

/* ------------------------------------------------------------------ TAREAS
   Lo mismo sobre una tarjeta de tarea (Tareas comparte los eventos del calendario). */
function contextoTareas(el){
  const id = el.dataset.id;
  const ev = (typeof eventoPorId === 'function') ? eventoPorId(id) : null;
  if (!ev) return [];
  const s = est(), hecha = !!s.hechas[id];
  const repintar = () => { renderSemestre(); renderTareas(); };
  const filas = [{ cab: ev.texto || 'Sin título' }];
  filas.push(hecha
    ? { t: t('ctx.desmarcar'), al: () => { delete s.hechas[id]; guardar('Tarea devuelta a pendientes'); repintar(); } }
    : { t: t('ctx.hecha'), al: () => { s.hechas[id] = true; guardar('Tarea marcada como hecha'); repintar(); } });
  filas.push.apply(filas, filasPrioridad(id, repintar));
  filas.push({ sep: true });
  filas.push({ t: t('ctx.editar'), al: () => abrirEditor(id) });
  return filas;
}
MENU_CTX['#p-tareas .tarea[data-id]'] = contextoTareas;

/* ------------------------------------------------------------------ MALLA
   Sobre una tarjeta de ramo: dejar listo lo que hoy obliga a abrir la ficha o a usar el modo
   rapido. Distingue si el ramo va en el semestre (para ofrecer quitarlo) y si esta aprobado. */
function contextoMalla(el){
  const cod = el.dataset.cod;
  const c = (typeof CAT === 'function' ? CAT() : {})[cod];
  if (!c) return [];
  const enSem = (typeof enSemestre === 'function') && enSemestre(cod);
  const aprobado = !!(E.aprobados || {})[cod];
  const filas = [{ cab: (typeof aliasDe === 'function' ? aliasDe(cod) : cod) }];
  if (enSem) filas.push({ t: t('ctx.quitar'), al: () => { quitarRamo(cod); renderMalla(); } });
  else filas.push({ t: t('ctx.agregar'), al: () => { agregarRamo(cod); renderMalla(); } });
  filas.push({ sep: true });
  filas.push(aprobado
    ? { t: t('ctx.noaprobado'), on: true, al: () => alternarAprobado(cod) }
    : { t: t('ctx.aprobado'), al: () => alternarAprobado(cod) });
  filas.push({ sep: true });
  filas.push({ t: t('ctx.ver'), al: () => {
    mallaSel = cod; renderMalla(); renderMallaDetalle();
    const d = document.getElementById('malla-detalle'); if (d) d.scrollIntoView({block:'nearest'});
  }});
  filas.push({ t: t('ctx.editar'), al: () => modalRamo(cod) });
  return filas;
}
MENU_CTX['#malla .nodo[data-cod]'] = contextoMalla;
