/* El icono de Mimo de la esquina (la marca) es un boton. Al pulsarlo cambia, al azar, entre los
   iconos de 64 px y el original. Y hay algo escondido: si se pulsa 10 veces seguidas, en menos de
   20 segundos, sale el icono de "indiferente" y se queda 10 segundos. Si se vuelve a pulsar
   mientras esta, el tiempo empieza de nuevo. Al acabarse, vuelve al icono original.

   Por que un archivo aparte y no dentro de otro motor: esto no es parte de la aplicacion; es un
   guino. Aislado, si algun dia se quiere quitar, se borra este archivo y su linea en js/orden.txt.

   Los nombres NO se inventan: son los que hay en iconos/. Ver el listado de la carpeta. */
(function () {
  const RUTA = 'iconos/';
  const ORIGINAL = 'icon-64.png';
  // El "indiferente" esta APARTE a proposito: es el que NO sale al azar, solo con el juego.
  const RARO = 'indifferent_64.png';
  const AZAR = ['icon-64.png', 'happy_64.png', 'happy2_64.png', 'mimo2_64.png'];

  const CLICS = 10;            // clics necesarios
  const VENTANA_MS = 20000;    // y todos dentro de estos segundos
  const RARO_MS = 10000;       // cuanto dura el icono raro

  const boton = document.getElementById('btn-mimo');
  const img = document.getElementById('mimo-ic');
  if (!boton || !img) return;

  let marcas = [];      // cuando se pulso, para contar los de la ventana
  let tVuelta = null;   // el temporizador que devuelve al original
  let enRaro = false;

  function poner(nombre){ img.src = RUTA + nombre; }

  // Un icono al azar de los de 64, pero NUNCA el que ya se ve: si no, pulsar podria no cambiar
  // nada y pareceria que el boton no funciona.
  // La comparacion es por NOMBRE de fichero, no por el texto del atributo: al hacer
  // `img.src = '...'` el navegador resuelve la ruta y el atributo pasa a ser una URL absoluta,
  // asi que comparar con la ruta relativa habria dejado de reconocer el icono actual.
  function alAzar(){
    const actual = img.src.split('/').pop();
    const otros = AZAR.filter(function (n) { return n !== actual; });
    return otros[Math.floor(Math.random() * otros.length)];
  }

  function volverAlOriginal(){
    enRaro = false;
    boton.classList.remove('jugando');
    poner(ORIGINAL);
  }

  function mostrarRaro(){
    enRaro = true;
    poner(RARO);
    boton.classList.add('jugando');
    clearTimeout(tVuelta);
    tVuelta = setTimeout(volverAlOriginal, RARO_MS);
  }

  boton.addEventListener('click', function () {
    // Ya salio el raro: pulsar solo reinicia su tiempo desde cero.
    if (enRaro){
      clearTimeout(tVuelta);
      tVuelta = setTimeout(volverAlOriginal, RARO_MS);
      return;
    }
    const ahora = Date.now();
    marcas.push(ahora);
    marcas = marcas.filter(function (t) { return ahora - t < VENTANA_MS; });
    if (marcas.length >= CLICS){ marcas = []; mostrarRaro(); return; }
    poner(alAzar());
  });

  function ponerTitulo(){
    const texto = (typeof t === 'function') ? t('marca.titulo') : 'Mimo Academics';
    boton.title = texto;
    boton.setAttribute('aria-label', texto);
  }
  document.addEventListener('mimo:idioma', ponerTitulo);
  ponerTitulo();
  poner(ORIGINAL);
})();
