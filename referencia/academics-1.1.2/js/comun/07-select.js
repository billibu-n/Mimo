/* ---------------------------------------------------------------- select propio
   Los <select> nativos abren un menu que DIBUJA el navegador: cuadrado, con borde propio y que no
   respeta el tema (en oscuro sale un recuadro feo). Eso NO se puede arreglar con CSS.

   Este componente los reemplaza por un desplegable propio con la estetica del proyecto, manteniendo
   el <select> nativo OCULTO como fuente de verdad: asi todo el codigo que ya existe (los `onchange`,
   el `el.value`, el `renderTodo()`) sigue funcionando sin tocar una linea de logica. El desplegable
   solo es la capa de arriba: al elegir una opcion setea el select oculto y le dispara su 'change'.

   Un solo patron para TODO el proyecto (notas, editor de evento, tiempo, semestre activo, malla).
   Vivir aqui, en un unico archivo, es lo que permite cambiarlo en un lugar y que afecte a todos.
*/

// Convierte un <select> (aun sin tocar) en el desplegable propio. Idempotente: si ya tiene su
// envoltorio .sel-propio, no hace nada.
function estilizarSelect(sel){
  if (sel.dataset.propio === '1') return;          // ya procesado
  if (sel.closest('.sel-propio')) return;
  // Un select MULTIPLE (con size>1) es una lista de seleccion multiple, no un menu desplegable:
  // no se transforma, se deja como esta (p. ej. los prerrequisitos del editor de ramos).
  if (sel.multiple || (sel.size && sel.size > 1)) return;

  // El envoltorio cuelga en el lugar del select; el select original queda oculto dentro.
  const env = document.createElement('div');
  env.className = 'sel-propio';

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'sel-cara';
  if (sel.classList.contains('sel')) boton.classList.add('sel-cabecera');
  boton.innerHTML = '<span class="sel-valor"></span><span class="sel-flecha">&#9662;</span>';
  boton.setAttribute('aria-haspopup', 'listbox');

  const panel = document.createElement('div');
  panel.className = 'sel-panel';
  panel.setAttribute('role', 'listbox');

  env.appendChild(boton);
  env.appendChild(panel);

  // Se mete el env en el sitio del select y el select se esconde DENTRO del env, para que siga
  // siendo hijo del formulario y no pierda ni su posicion ni su semantica.
  sel.parentNode.insertBefore(env, sel);
  sel.style.display = 'none';
  env.insertBefore(sel, panel);

  const valor = () => sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
  const pintarValor = () => { env.querySelector('.sel-valor').textContent = valor(); };
  const pintarOpciones = () => {
    panel.innerHTML = '';
    [...sel.options].forEach((opt, i) => {
      const item = document.createElement('div');
      item.className = 'sel-opcion' + (i === sel.selectedIndex ? ' on' : '');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', i === sel.selectedIndex ? 'true' : 'false');
      item.textContent = opt.text;
      item.addEventListener('click', ev => {
        ev.stopPropagation();
        sel.selectedIndex = i;
        pintarValor();
        cerrar();
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      panel.appendChild(item);
    });
  };

  const abrir = () => {
    cerrarTodos();
    pintarOpciones();
    // Se posiciona el panel con fixed: el .cuerpo-env de las barras tiene overflow:hidden (para
    // animar su alto), y un panel absolute quedaria recortado. Con fixed escapa de eso. Y si no
    // cabe hacia abajo (select cerca del borde inferior), se despliega hacia arriba.
    const r = boton.getBoundingClientRect();
    const altoPanel = Math.min(panel.scrollHeight, 230);
    const espacioAbajo = window.innerHeight - r.bottom;
    const haciaArriba = espacioAbajo < altoPanel && r.top > altoPanel;
    panel.style.position = 'fixed';
    panel.style.left = r.left + 'px';
    panel.style.width = r.width + 'px';
    panel.style.right = 'auto';
    if (haciaArriba) {
      panel.style.top = 'auto';
      panel.style.bottom = (window.innerHeight - r.top + 3) + 'px';
    } else {
      panel.style.top = (r.bottom + 3) + 'px';
      panel.style.bottom = 'auto';
    }
    env.classList.add('abierto');
    boton.setAttribute('aria-expanded', 'true');
  };
  const cerrar = () => {
    env.classList.remove('abierto');
    boton.setAttribute('aria-expanded', 'false');
  };

  boton.addEventListener('click', ev => {
    ev.stopPropagation();
    if (env.classList.contains('abierto')) cerrar(); else abrir();
  });

  // teclado: Enter/Espacio abre, Esc cierra, flechas mueven la seleccion
  boton.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      if (env.classList.contains('abierto')) cerrar(); else abrir();
    } else if (ev.key === 'Escape') {
      cerrar();
      boton.focus();
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!env.classList.contains('abierto')) abrir();
      const dir = ev.key === 'ArrowDown' ? 1 : -1;
      const n = sel.options.length;
      const sig = (sel.selectedIndex + dir + n) % n;
      sel.selectedIndex = sig;
      pintarValor();
      pintarOpciones();
    }
  });

  pintarValor();
  sel.dataset.propio = '1';
  return env;
}

// Cierra todos los desplegables abiertos.
function cerrarTodos(){
  document.querySelectorAll('.sel-propio.abierto').forEach(e => e.classList.remove('abierto'));
}

// Procesa todos los selects que aun no fueron tocados bajo una raiz (o todo el documento).
function estilizarSelects(raiz){
  const raiz0 = raiz || document;
  const esSelect = raiz0.nodeType === 1 && raiz0.tagName === 'SELECT';
  if (esSelect) {
    if (raiz0.dataset.propio !== '1') estilizarSelect(raiz0);
    return;
  }
  raiz0.querySelectorAll('select').forEach(estilizarSelect);
}

// Cierre al hacer clic fuera de cualquier desplegable.
document.addEventListener('click', () => cerrarTodos());
