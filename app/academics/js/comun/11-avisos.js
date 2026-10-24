/* ============================================================================================
   Avisos y confirmaciones PROPIOS, en lugar de los dialogos del navegador.
   ============================================================================================

   POR QUE EXISTE ESTE FICHERO (fallo medido, no supuesto)
   ------------------------------------------------------
   La aplicacion usaba `confirm()`, `alert()` y `prompt()`. En el navegador funcionan, pero en la
   aplicacion de ESCRITORIO (webview de Tauri) no hay quien muestre esos dialogos, y se midio lo
   que pasa con WebKitGTK:

       sin manejador de 'script-dialog'  ->  la pagina se QUEDA BLOQUEADA
       con manejador que devuelve False  ->  se emite el aviso, y tambien se bloquea

   El efecto para el usuario es el peor posible en un boton que borra: "Restablecer todo" parece
   no hacer nada (no hay recuadro), pero el borrado YA se ejecuto. El dueno lo reporto con esas
   palabras: "descarga sin consultar y borra sin consultar".

   LA SOLUCION
   -----------
   Una ventana propia, dibujada por la propia aplicacion (el .modal que ya existia), que:
     - funciona IGUAL en navegador, Linux, Windows y macOS (no depende del webview);
     - se puede leer y pulsar con teclado;
     - y responde una promesa, asi que el codigo que llama se lee casi igual que con confirm().

   USO (sustituye a confirm/alert/prompt):
       if (!await confirmar('¿Borrar esto?', {peligro: true})) return;
       await avisar('No se pudo leer el archivo.');
       const n = await pedir('¿Cuanto tiempo sumar?', {valor: '30'});

   `confirmar` devuelve true/false; `avisar` no devuelve nada; `pedir` devuelve el texto o null.
   ============================================================================================ */

(function () {
  let caja = null;

  /* La caja se construye UNA vez y se reutiliza. Se crea dentro del contenedor de modales que
     ya trae la plantilla, para heredar el estilo y el comportamiento del resto. */
  function asegurarCaja() {
    if (caja && document.body.contains(caja)) return caja;
    let raiz = document.getElementById('aviso-app');
    if (!raiz) {
      raiz = document.createElement('div');
      raiz.className = 'modal';
      raiz.id = 'aviso-app';
      raiz.innerHTML = '<div class="modal-caja aviso-caja" role="dialog" aria-modal="true" ' +
                       'aria-labelledby="aviso-titulo"></div>';
      document.body.appendChild(raiz);
    }
    caja = raiz;
    return caja;
  }

  /* Escapa el texto: los mensajes llevan nombres de ramos, de semestres y de archivos, que los
     escribe el usuario. Sin esto, un nombre con < > romperia la ventana. */
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Abre la ventana y devuelve una promesa que se resuelve cuando el usuario decide.
     `tipo`: 'confirmar' | 'avisar' | 'pedir'. */
  function abrir(tipo, mensaje, opciones) {
    const o = Object.assign({ titulo: '', aceptar: 'Aceptar', cancelar: 'Cancelar',
                              peligro: false, valor: '', marcador: '' }, opciones || {});
    const raiz = asegurarCaja();
    const cajaInt = raiz.querySelector('.modal-caja');

    const titulo = o.titulo || (tipo === 'confirmar' ? 'Confirmar' : tipo === 'pedir' ? 'Escribe' : 'Aviso');
    // El mensaje puede traer saltos de linea: se respetan.
    const parrafos = String(mensaje || '').split('\n')
      .map(l => '<p class="aviso-texto">' + esc(l) + '</p>').join('');

    let html = '<h2 id="aviso-titulo">' + esc(titulo) + '</h2>' + parrafos;
    if (tipo === 'pedir') {
      html += '<input type="text" class="entrada aviso-entrada" id="aviso-entrada" ' +
              'value="' + esc(o.valor) + '" placeholder="' + esc(o.marcador) + '">';
    }
    html += '<div class="aviso-botones">';
    if (tipo !== 'avisar') {
      html += '<button class="btn" id="aviso-cancelar">' + esc(o.cancelar) + '</button>';
    }
    html += '<button class="btn acento' + (o.peligro ? ' peligro' : '') +
            '" id="aviso-aceptar">' + esc(o.aceptar) + '</button>';
    html += '</div>';
    cajaInt.innerHTML = html;

    const entrada = cajaInt.querySelector('#aviso-entrada');
    const btnAceptar = cajaInt.querySelector('#aviso-aceptar');
    const btnCancelar = cajaInt.querySelector('#aviso-cancelar');

    raiz.classList.add('on');
    // El foco va al boton que confirma si es una accion normal, y a cancelar si es peligrosa:
    // en un borrado, que la tecla Entrar NO confirme sola.
    const foco = (o.peligro && btnCancelar) ? btnCancelar : (entrada || btnAceptar);
    if (foco) setTimeout(() => { foco.focus(); if (entrada) entrada.select(); }, 30);

    // Marca de peligro: el boton rojo, para que no se pulse por inercia.
    if (o.peligro && btnAceptar) btnAceptar.classList.add('peligro');

    return new Promise(resolve => {
      let cerrado = false;
      function cerrar(valor) {
        if (cerrado) return;
        cerrado = true;
        raiz.classList.remove('on');
        document.removeEventListener('keydown', alTecla, true);
        resolve(valor);
      }
      function aceptar() { cerrar(tipo === 'pedir' ? (entrada ? entrada.value : '') : true); }
      function cancelar() { cerrar(tipo === 'pedir' ? null : (tipo === 'avisar' ? undefined : false)); }

      if (btnAceptar) btnAceptar.onclick = aceptar;
      if (btnCancelar) btnCancelar.onclick = cancelar;

      // Teclado: Esc cancela siempre; Entrar acepta (menos en un aviso sin boton de cancelar,
      // que solo se cierra aceptando). Se captura en fase de captura para que no lo robe el resto.
      function alTecla(ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cancelar(); }
        else if (ev.key === 'Enter' && tipo !== 'avisar') {
          // En una ventana de texto, Entrar acepta. Fuera de ella, tambien.
          ev.preventDefault(); ev.stopPropagation(); aceptar();
        }
      }
      document.addEventListener('keydown', alTecla, true);
    });
  }

  /* ---- las tres funciones que sustituyen a los dialogos del navegador ---- */
  window.confirmar = function (mensaje, opciones) { return abrir('confirmar', mensaje, opciones); };
  window.avisar = function (mensaje, opciones) { return abrir('avisar', mensaje, opciones); };
  window.pedir = function (mensaje, opciones) { return abrir('pedir', mensaje, opciones); };
})();
