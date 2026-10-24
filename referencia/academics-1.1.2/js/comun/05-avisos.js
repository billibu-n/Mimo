/* ---------------------------------------------------------------- avisos */
let temporizador = null;
function mostrarAviso(txt, ms){
  const el = document.getElementById('aviso');
  el.textContent = txt;
  el.classList.add('on');
  clearTimeout(temporizador);
  temporizador = setTimeout(() => el.classList.remove('on'), ms || 1800);
}
