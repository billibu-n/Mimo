/* Cara del panel de Idioma: pinta la rejilla desde el motor y conecta los botones.
   Un idioma con diccionario se puede elegir; uno sin diccionario queda apagado y lo dice
   ("en preparación"), en vez de fingir que traduce. */
(function () {
  const ORDEN = ['es', 'en', 'de', 'fr', 'it', 'pt', 'cn', 'tw'];
  const NOTA = { cn: 'idioma.simplificado', tw: 'idioma.tradicional' };

  function pintarIdiomas() {
    if (!window.mimoIdioma) return;
    const disponibles = window.mimoIdioma.disponibles();
    const actual = window.mimoIdioma.actual();
    ORDEN.forEach(function (cod) {
      const b = document.querySelector('#idio-panel .idioma[data-lang="' + cod + '"]');
      if (!b) return;
      const tiene = disponibles.indexOf(cod) !== -1;
      b.disabled = !tiene || cod === actual;
      b.classList.toggle('on', cod === actual);
      const chk = b.querySelector('.chk');
      if (chk) chk.hidden = (cod !== actual);
      const e = b.querySelector('.e');
      if (e) e.textContent = tiene ? '' : window.mimoIdioma.t(NOTA[cod] || 'idioma.preparacion');
    });
  }

  const rej = document.querySelector('#idio-panel .idiomas');
  if (rej) {
    rej.addEventListener('click', function (ev) {
      const b = ev.target.closest('.idioma[data-lang]');
      if (!b || b.disabled) return;
      window.mimoIdioma.cambiar(b.dataset.lang);   // cambiar() ya vuelve a traducir todo
      pintarIdiomas();
    });
  }

  window.mimoIdiomaPanel = { pintar: pintarIdiomas };
  pintarIdiomas();
})();
