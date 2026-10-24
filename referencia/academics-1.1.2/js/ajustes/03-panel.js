/* ------------------------------------------------------------------ ajustes */
function renderAjustes(){
  const s = est();
  renderAvanzado();
  // La configuracion de la malla (ficha y colores de los ramos) se mudo a la pestana Malla.

  // La meta base ya no se edita aqui: se mudo a la pestana Estudio, que es donde se usa.
  document.getElementById('aj-ver-hechas').checked = !!E.ajustes.verHechasPorHacer;

  // Formatos de hora: casillas, y cada una muestra al lado como se ve de verdad.
  const elegidos = E.ajustes.formatos || ['hm'];
  const listaFormatos = document.getElementById('formatos-hora');
  listaFormatos.innerHTML = FORMATOS_HORA.map(f =>
    '<label class="formato"><input type="checkbox" data-formato="' + f[0] + '"' +
      (elegidos.indexOf(f[0]) >= 0 ? ' checked' : '') + '>' +
      '<span class="nom">' + esc(f[1]) + '</span>' +
      '<span class="vale">' + esc(f[2]) + '</span></label>').join('') +
    '<div class="av-fila"><span class="eti">Cómo queda</span>' +
      '<b style="color:var(--fg)">' + esc(fmtHM(150)) + '</b>' +
      '<span class="pista">Así se escriben dos horas y media con lo que tienes encendido.</span></div>';
  // Cómo se abrevian los títulos que no caben.
  const listaTitulos = document.getElementById('titulos-modo');
  if (listaTitulos) {
    const ft = formatoTitulo();
    listaTitulos.innerHTML = FORMATOS_TITULO.map(x =>
      '<label class="formato"><input type="radio" name="titulo-modo" data-titulo="' + x[0] + '"' +
        (ft.modo === x[0] ? ' checked' : '') + '>' +
        '<span class="nom">' + esc(x[1]) + '</span>' +
        '<span class="vale">' + esc(x[2]) + '</span></label>').join('') +
      '<div class="av-fila"><span class="eti">Largo</span>' +
        '<input type="number" id="titulo-largo" min="4" max="40" step="1" value="' + ft.largo + '"' +
        (ft.modo === 'puntos' ? '' : ' disabled') + '>' +
        '<span class="pista">Letras que se ven antes de los puntos. Solo se usa al recortar.</span></div>' +
      '<div class="av-fila"><span class="eti">Cómo queda</span>' +
        '<b style="color:var(--fg)" id="titulo-ejemplo">' +
        esc(resumirTitulo('Mecánica de los Medios Continuos')) + '</b>' +
        '<span class="pista">Un nombre largo, con lo que acabas de elegir.</span></div>';
    listaTitulos.querySelectorAll('[data-titulo]').forEach(el => el.onchange = () => {
      E.ajustes.titulos = Object.assign({}, formatoTitulo(), {modo: el.dataset.titulo});
      guardar();
      renderAjustes();
      renderEstudio();
    });
    const largo = document.getElementById('titulo-largo');
    if (largo) largo.oninput = () => {
      E.ajustes.titulos = Object.assign({}, formatoTitulo(), {largo: Number(largo.value) || 12});
      guardar();
      renderEstudio();
      // La vista previa se refresca sin rehacer la tarjeta, para no perder el foco al escribir.
      const ej = document.getElementById('titulo-ejemplo');
      if (ej) ej.textContent = resumirTitulo('Mecánica de los Medios Continuos');
    };
  }

  listaFormatos.querySelectorAll('[data-formato]').forEach(el => el.onchange = () => {
    const marcas = [].slice.call(listaFormatos.querySelectorAll('[data-formato]'))
      .filter(i => i.checked).map(i => i.dataset.formato);
    // Dejar cero formatos encendidos dejaria las horas en blanco en todo el panel.
    if (!marcas.length) {
      el.checked = true;
      mostrarAviso('Deja al menos una forma de mostrar las horas');
      return;
    }
    E.ajustes.formatos = marcas;
    guardar('Forma de mostrar las horas cambiada'); renderTodo(); renderAjustes();
  });
  const son = document.getElementById('aj-sonido');
  if (son) {
    son.checked = E.ajustes.sonido !== false;
    son.onchange = () => {
      E.ajustes.sonido = son.checked;
      guardar(son.checked ? 'Sonido del temporizador encendido' : 'Sonido del temporizador apagado');
      renderAjustes();
    };
  }
  // Las explicaciones de cada ajuste se recogen en un boton "?".
  convertirPistas();

  document.getElementById('tabla-metas-ramo').innerHTML =
    '<thead><tr><th>Ramo</th><th>Nombre corto</th><th class="num">Horas por semana</th>' +
    '<th class="num">Nota objetivo</th><th>Estado</th></tr></thead><tbody>' +
    ramosBase().map(r => {
      const m = s.metas_ramo[r.codigo] || {horas:5.5, nota:5.0};
      const e = s.estado[r.codigo] || 'curso';
      return '<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:3px;' +
        'background:' + colorDe(r.codigo) + ';margin-right:7px"></i>' + r.codigo + '</td>' +
        '<td><input type="text" data-alias="' + r.codigo + '" value="' + esc(r.alias) + '"></td>' +
        '<td class="num"><input type="number" min="0" max="60" step="0.5" data-meta-h="' + r.codigo + '" value="' + m.horas + '"></td>' +
        '<td class="num"><input type="number" min="1" max="7" step="0.1" data-meta-n="' + r.codigo + '" value="' + m.nota + '"></td>' +
        '<td><select data-estado="' + r.codigo + '">' +
          ['curso','aprobado','congelado'].map(o => '<option value="' + o + '"' + (e === o ? ' selected' : '') + '>' +
            (o === 'curso' ? 'en curso' : o) + '</option>').join('') +
        '</select></td></tr>';
    }).join('') + '</tbody>';
  document.querySelectorAll('[data-alias]').forEach(el => el.onchange = () => {
    cursoDe(el.dataset.alias).alias = el.value; guardar(); renderTodo(); renderAjustes();
  });
  document.querySelectorAll('[data-meta-h]').forEach(el => el.oninput = () => {
    const c = el.dataset.metaH;
    est().metas_ramo[c] = est().metas_ramo[c] || {horas:5.5, nota:5.0};
    est().metas_ramo[c].horas = Number(el.value) || 0;
    guardar(); renderEstudio();
  });
  document.querySelectorAll('[data-meta-n]').forEach(el => {
    el.oninput = () => {
      const c = el.dataset.metaN;
      est().metas_ramo[c] = est().metas_ramo[c] || {horas:5.5, nota:5.0};
      est().metas_ramo[c].nota = normalizarNota(el.value) || 5;
      guardar(); renderLista(); renderDetalle();
    };
    // Al salir del campo se reescribe corregido: "22" queda a la vista como 2,2.
    el.onchange = () => { el.value = ver1(normalizarNota(el.value) || 5); };
  });
  document.querySelectorAll('[data-estado]').forEach(el => el.onchange = () => {
    est().estado[el.dataset.estado] = el.value; guardar(); renderLista(); renderDetalle();
  });

  document.getElementById('lista-semestres').innerHTML = semestres().map(sm => {
    const act = sm.id === E.activo;
    return '<details class="barra-extraible"' + (act ? ' open' : '') + '>' +
      '<summary><span class="izq">' + (act ? '<b>' : '') + esc(sm.nombre) + (act ? '</b>' : '') +
      ' <span class="cuenta">' + sm.semanas.length + ' semanas · ' + ramosDeSem(sm).length + ' ramos</span></span>' +
      '<span class="izq">' +
      (act ? '<span class="pill ok">activo</span>' : '<button class="btn" data-usar="' + sm.id + '">usar</button>') +
      (semestres().length > 1 ? ' <button class="btn peligro" data-borrar-sem="' + sm.id + '">eliminar</button>' : '') +
      '<span class="flecha">&#9654;</span></span></summary>' +
      '<div class="cuerpo">' +
        '<div class="campo"><span>Primer lunes de clases</span><span>' + esc(sm.inicio) + '</span></div>' +
        '<div class="campo"><span>Semanas</span><span>' + sm.semanas.length + '</span></div>' +
        '<div class="campo"><span>Ramos inscritos</span><span>' + ramosDeSem(sm).length + '</span></div>' +
      '</div></details>';
  }).join('');
  document.querySelectorAll('[data-usar]').forEach(el => el.onclick = () => cambiarSemestre(el.dataset.usar));
  document.querySelectorAll('[data-borrar-sem]').forEach(el => el.onclick = async () => {
    // Ventana propia: en la aplicacion de escritorio `confirm()` no se muestra y el borrado
    // seguia adelante sin preguntar.
    if (!await confirmar('Se eliminara este semestre y todo lo que tiene dentro: su calendario, ' +
        'sus notas y sus horas.\n\nEl resto de tus datos (malla, catalogo y ajustes) no se toca.',
        { titulo: 'Eliminar semestre', aceptar: 'Eliminar', peligro: true })) return;
    E.extras = (E.extras || []).filter(s => s.id !== el.dataset.borrarSem);
    delete E.sem[el.dataset.borrarSem];
    if (E.activo === el.dataset.borrarSem) {
      const q = semestres()[0];
      E.activo = q ? q.id : null;       // al borrar el ultimo puede quedar sin ninguno
    }
    guardar('Semestre eliminado'); resetFiltros(); arranque();
  });
  pintarBarraAjustes();
}


/* La configuracion de la malla quedo en dos tarjetas: colores de los ramos y secciones de la
   carrera. La ficha del ramo se quito (2026-09-21): no aportaba a la malla y sus campos
   configurables se iban a favor del detalle del ramo, que ya muestra descripcion y equivalente. */



/* Secciones de la carrera: agrupan semestres en categorias (Plan comun, Licenciatura,
   Especialidad...). Vive en Configuracion de la malla. Usa las clases de la casa (.campo,
   .fila, .btn) y los desplegables propios (.sel-propio via 07-select.js), nada suelto. */
function renderSecciones(){
  const caja = document.getElementById('secciones-malla');
  if (!caja) return;
  const secs = SECC();
  const niveles = NIVELES().filter(n => n.nivel !== 99).map(n => Number(n.nivel)).sort((a,b)=>a-b);
  const opNivel = niveles.map(n => '<option value="' + n + '">Semestre ' + n + '</option>').join('');

  const filasSec = secs.length
    ? secs.map((s, i) =>
        '<div class="campo-sec">' +
          '<label class="cs-nombre">Nombre' +
            '<input type="text" class="entrada sec-nombre" value="' + esc(s.nombre) + '" ' +
                   'placeholder="Nombre" title="' + esc(s.nombre) + '"></label>' +
          '<label>Sigla' +
            '<input type="text" class="entrada sec-sigla" value="' + esc(s.sigla) + '" ' +
                   'maxlength="3" title="Sigla (2-3 letras)"></label>' +
          '<label>Color' +
            '<input type="color" class="entrada sec-color" value="' + esc(s.color) + '" ' +
                   'title="Color de la sección"></label>' +
          '<label>Rango' +
            '<span class="sec-rango" title="' + esc(secsRangoTxt(s)) + '">' +
              esc(secsRangoTxt(s)) + '</span></label>' +
          '<button class="btn chico peligro sec-quitar" title="Quitar sección">×</button>' +
        '</div>').join('')
    : '<p class="ayuda" style="margin:0">Todavía no hay secciones. Crea la primera abajo.</p>';

  const asignador = secs.length
    ? '<div class="fila" style="gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center">' +
        '<span style="font-size:.85rem">La sección</span>' +
        '<select id="sec-asignar-idx" style="width:150px">' +
          secs.map((s,i) => '<option value="' + i + '">' + esc(s.sigla + ' · ' + s.nombre) + '</option>').join('') +
        '</select>' +
        '<span style="font-size:.85rem">va del</span>' +
        '<select id="sec-desde" style="width:120px">' + opNivel + '</select>' +
        '<span style="font-size:.85rem">al</span>' +
        '<select id="sec-hasta" style="width:120px">' + opNivel + '</select>' +
        '<button class="btn acento" id="sec-asignar-rango">Aplicar</button>' +
        '<button class="btn chico" id="sec-limpiar-todo" title="Quitar la sección de todos los ramos">Limpiar</button>' +
      '</div>'
    : '<p class="ayuda" style="margin:12px 0 0">Cuando haya secciones, acá eliges qué rango de semestres abarca cada una.</p>';

  caja.innerHTML =
    filasSec +
    '<div class="campo-sec nueva">' +
      '<label class="cs-nombre">Nombre' +
        '<input type="text" id="sec-nueva-nombre" class="entrada" ' +
               'placeholder="Nombre (ej. Plan común)"></label>' +
      '<label>Sigla' +
        '<input type="text" id="sec-nueva-sigla" class="entrada" ' +
               'placeholder="Sigla (ej. PC)" maxlength="3"></label>' +
      '<span></span><span></span>' +
      '<button class="btn acento" id="sec-nueva-agregar">Agregar sección</button>' +
    '</div>' +
    asignador;

  // guardar cambios de sigla / nombre / color en vivo
  caja.querySelectorAll('.campo-sec:not(.nueva)').forEach((fila, i) => {
    const s = secs[i];
    fila.querySelector('.sec-nombre').onchange = ev => { s.nombre = ev.target.value.trim() || s.nombre; guardar('Sección renombrada'); renderSecciones(); renderMalla(); };
    fila.querySelector('.sec-sigla').onchange = ev => { s.sigla = ev.target.value.trim().toUpperCase().slice(0,3); guardar('Sigla de la sección cambiada'); renderSecciones(); renderMalla(); };
    fila.querySelector('.sec-color').onchange = ev => { s.color = ev.target.value; guardar('Color de la sección cambiado'); renderSecciones(); renderMalla(); };
    fila.querySelector('.sec-quitar').onclick = () => {
      Object.keys(CAT()).forEach(cod => { if (seccionDe(cod) === i) { CAT()[cod].seccion = null; delete CAT()[cod].seccion; } });
      E.secciones.splice(i, 1);
      guardar('Sección quitada'); renderSecciones(); renderMalla();
    };
  });

  if (document.getElementById('sec-nueva-agregar')) document.getElementById('sec-nueva-agregar').onclick = () => {
    const nombre = document.getElementById('sec-nueva-nombre').value.trim();
    const sigla = document.getElementById('sec-nueva-sigla').value.trim().toUpperCase();
    if (!nombre) { mostrarAviso('Escribe el nombre de la sección'); return; }
    E.secciones.push({nombre: nombre, sigla: sigla || nombre.replace(/[aeiouáéíóú ]/gi,'').slice(0,2).toUpperCase(), color: '#2563eb'});
    guardar('Sección "' + nombre + '" creada');
    renderSecciones(); renderMalla();
  };

  if (document.getElementById('sec-asignar-rango')) document.getElementById('sec-asignar-rango').onclick = () => {
    const idx = Number(document.getElementById('sec-asignar-idx').value);
    const desde = Number(document.getElementById('sec-desde').value);
    const hasta = Number(document.getElementById('sec-hasta').value);
    if (desde > hasta) { mostrarAviso('El semestre de inicio no puede ser mayor que el final'); return; }
    asignarSeccionPorNiveles(idx, desde, hasta);
    renderSecciones(); renderMalla();
  };

  if (document.getElementById('sec-limpiar-todo')) document.getElementById('sec-limpiar-todo').onclick = () => {
    Object.keys(CAT()).forEach(cod => { const c = CAT()[cod]; if (c.seccion !== undefined) delete c.seccion; });
    guardar('Secciones limpiadas de los ramos'); renderSecciones(); renderMalla();
  };
}

/* Texto corto del rango de una seccion para mostrarlo en su fila. */
function secsRangoTxt(s){
  const ns = s.niveles || [];
  if (!ns.length) return 'sin rango';
  const ordenados = ns.slice().sort((a,b)=>a-b);
  if (ordenados.length === 1) return 'semestre ' + ordenados[0];
  return 'semestres ' + ordenados[0] + '–' + ordenados[ordenados.length-1];
}

/* Colores de los ramos (vive en la pestana Malla). Antes estaba en Ajustes; se mudo junto con
   la ficha porque ambos son configuracion de la malla, no del panel. */
function renderColoresMalla(){
  const caja = document.getElementById('colores');
  if (!caja) return;
  caja.innerHTML = ramosBase().map(r => {
    const hex = colorDe(r.codigo), hsl = hex2hsl(hex);
    const presets = ['#FF0000','#C00000','#EA580C','#A16207','#16A34A','#0E7490','#1D4ED8','#7C3AED','#0F172A']
      .map(p => '<button data-ramo="' + r.codigo + '" data-color="' + p + '" style="background:' + p + '"></button>').join('');
    return '<div class="color-fila">' +
      '<span class="nm"><i class="pt" style="background:' + hex + '"></i>' + esc(r.alias) + '</span>' +
      '<input class="tono" type="range" min="0" max="360" step="1" value="' + hsl.h + '" data-ramo="' + r.codigo + '">' +
      '<input class="muestra-color" type="color" value="' + hex + '" data-ramo="' + r.codigo + '">' +
      '<span class="atajos">' + presets + '</span></div>';
  }).join('');
  caja.querySelectorAll('.tono').forEach(el => {
    el.oninput = () => {
      abrirBorrador();
      coloresBorrador[el.dataset.ramo] = hsl2hex(Number(el.value), 72, 45);
      renderTodo(true);
      const m = caja.querySelector('.muestra-color[data-ramo="' + el.dataset.ramo + '"]');
      if (m) m.value = coloresBorrador[el.dataset.ramo];
    };
    el.onchange = () => { renderColoresMalla(); pintarBarraAjustes(); };
  });
  caja.querySelectorAll('.muestra-color').forEach(el => {
    el.oninput = () => {
      abrirBorrador(); coloresBorrador[el.dataset.ramo] = el.value; renderTodo(true);
    };
    el.onchange = () => { renderColoresMalla(); pintarBarraAjustes(); };
  });
  caja.querySelectorAll('.atajos button').forEach(el => el.onclick = () => {
    abrirBorrador();
    coloresBorrador[el.dataset.ramo] = el.dataset.color;
    renderColoresMalla(); renderTodo(true); pintarBarraAjustes();
  });
}
