/* ------------------------------------------------------- ajustes/10-colaborar.js
   La ventana "Colaborar" de Ajustes: las formas de ayudar SIN pagar.

   POR QUE EXISTE
   Antes el panel era un boton para invitar un cafe, y nada mas. Ahora hay tres maneras de
   ayudar que NO cuestan dinero (contar un fallo, proponer una idea, compartir la app) y el
   cafe queda aparte y opcional.

   SOLO GITHUB. Vacio de aqui fuera NO se publica: el repositorio se comprobo y ya tiene
   plantillas de incidencia (bug.md, feature-request.md, question.md), la categoria "Ideas" en
   Discussions, y un config.yml que manda las preguntas a Discussions. Por eso el correo del
   autor no aparece en ninguna parte: GitHub filtra el spam y no expone la direccion.

   Lo que SI se rellena solo: la URL lleva ?template=bug.md&title=%5BBug%5D%20&labels=bug, y el
   cuerpo con la version y el equipo. GitHub NO deja rellenar cada casilla de la plantilla por
   separado, asi que los datos del equipo van DENTRO del cuerpo; lo demas lo escribe quien
   reporta. */

const REPO_COLAB = { user: 'billibu-n', repo: 'mimo-app' };

/* Los datos del equipo: version y motor del navegador. Sirven para que el informe sea util
   (que ha fallado, donde y en que version) y NO son datos personales: no sale nada de la
   malla, las notas ni el respaldo. */
function datosDelEquipo() {
  let navegador = navigator.userAgent || '';
  const m = navegador.match(/Edg\/[\d.]+|OPR\/[\d.]+|Chrome\/[\d.]+|Firefox\/[\d.]+|Version\/[\d.]+.*Safari/);
  if (m) navegador = m[0];
  const version = (typeof versionLocal === 'function') ? versionLocal() : '';
  return { version: version, navegador: navegador, sistema: navigator.platform || '' };
}

/* Los enlaces NO se escriben en el HTML: se calculan aqui, con el repositorio en un solo sitio
   y los datos del equipo dentro del cuerpo. */
function enlaceFallo() {
  const d = datosDelEquipo();
  const cuerpo = t('colab.fallo.cuerpo', { version: d.version, navegador: d.navegador, sistema: d.sistema });
  return 'https://github.com/' + REPO_COLAB.user + '/' + REPO_COLAB.repo + '/issues/new' +
    '?template=bug.md&title=%5BBug%5D%20&labels=bug&body=' + encodeURIComponent(cuerpo);
}
function enlaceIdea() {
  return 'https://github.com/' + REPO_COLAB.user + '/' + REPO_COLAB.repo +
    '/discussions/new?category=ideas';
}
function enlaceCafe() {
  return 'https://www.buymeacoffee.com/billibu';
}

/* Un <a href="https://..."> NO abre el navegador dentro de la aplicacion de escritorio: Tauri
   cancela la navegacion fuera de su ventana y el boton queda muerto (lo reporto el dueno con esas
   palabras). Se intercepta el clic y se abre por el comando del sistema. En un navegador de
   verdad, abrirUrl acaba en un window.open, o sea el mismo comportamiento de siempre. */
function enlazarExterno(a, url) {
  if (!a || a.dataset.ext) return;
  a.dataset.ext = '1';
  a.addEventListener('click', function (ev) {
    ev.preventDefault();
    abrirUrl(typeof url === 'function' ? url() : a.href);
  });
}

/* Compartir: en un computador de escritorio casi nunca hay navigator.share, asi que la salida
   de verdad (y la unica honesta) es copiar la direccion del proyecto. */
function compartirColaborar() {
  const url = 'https://github.com/' + REPO_COLAB.user + '/' + REPO_COLAB.repo;
  if (navigator.share) {
    navigator.share({ title: t('colab.compartir.titulo'), url: url }).catch(function () {});
    return;
  }
  const copiado = function () { mostrarAviso(t('colab.copiado')); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(copiado).catch(function () {
      // Sin portapapeles (pasa en file://): se deja el enlace a la vista para copiarlo a mano.
      mostrarAviso(url, 6000);
    });
  } else {
    mostrarAviso(url, 6000);
  }
}

/* La FAQ del panel: se rellena sola desde el diccionario (colab.p1 / colab.r1 ...), para no
   escribir el mismo texto dos veces. */
function pintarPreguntasColaborar() {
  const caja = document.getElementById('colab-preguntas');
  if (!caja) return;
  const total = 5;
  const piezas = [];
  for (let i = 1; i <= total; i++) {
    const p = t('colab.p' + i), r = t('colab.r' + i);
    if (p === 'colab.p' + i) continue;   // diccionario incompleto: no se inventa nada
    piezas.push(
      '<details class="pregunta"><summary>' + p + '</summary><p>' + r + '</p></details>');
  }
  if (!piezas.length) return;
  caja.innerHTML = '<details class="plegable"><summary>' +
    '<svg class="ic"><use href="#PER-06"></use></svg>' +
    '<span class="pl-izq">' + t('colab.faq') +
    '<span class="pl-cuenta">' + t('colab.faq.cuenta') + '</span></span>' +
    '<span class="pl-flecha">▸</span></summary>' +
    '<div class="pl-cuerpo"><div class="preguntas">' + piezas.join('') + '</div></div></details>';
}

function pintarColaborar() {
  pintarPreguntasColaborar();
  const f = document.getElementById('colab-enlace-fallo');
  if (f) { f.href = enlaceFallo(); enlazarExterno(f, enlaceFallo); }
  const i = document.getElementById('colab-enlace-idea');
  if (i) { i.href = enlaceIdea(); enlazarExterno(i, enlaceIdea); }
  const c = document.getElementById('colab-enlace-cafe');
  if (c) { c.href = enlaceCafe(); enlazarExterno(c, enlaceCafe); }
  const b = document.getElementById('colab-compartir');
  if (b && !b.dataset.listo) {
    b.dataset.listo = '1';
    b.addEventListener('click', compartirColaborar);
  }
}

/* Al cambiar de idioma hay que rehacer los enlaces: el cuerpo del informe va traducido. */
document.addEventListener('mimo:idioma', pintarColaborar);
pintarColaborar();
