/* ---------------------------------------------------------------------- ayuda
   Cada ajuste trae su explicacion escrita al lado. En vez de dejarla ahi ocupando renglones y
   empujando los controles, se recoge y se muestra en un cuadro al frente con el fondo oscurecido:
   se lee entera, no mueve nada de sitio, y se cierra con un clic o con Esc.

   El ejemplo es la parte que de verdad ayuda: "densidad" no dice nada, "en compacta caben cuatro
   semestres en pantalla" si. */
const AYUDA_EJEMPLOS = {
  'Tema': 'De día, Clásico: fondo blanco y contraste alto. De noche, Medianoche: fondo casi negro ' +
    'con un azul suave, que cansa menos la vista. Negro es el gris de escritorio, mas neutro.',
  'Relleno de los estados': 'En suave, un ramo aprobado es un fondo verde pálido con borde ' +
    'verde. En todo pintado, el recuadro entero va verde y la letra se pone sola en el color que ' +
    'se lee encima.',
  'Colores de los estados': 'El rojo se usa poco a propósito: si todo está marcado, nada llama la ' +
    'atención. Reserva el rojo para el ramo que de verdad se te está complicando.',
  'Tamaño de las tarjetas': 'En compacta caben cuatro o cinco semestres a la vez en pantalla. ' +
    'En amplia, dos, pero se leen sin esfuerzo desde lejos.',
  'Cómo se muestran las horas': 'Elige uno o varios. Se muestran juntos, separados por un punto: ' +
    '"2h 30m · 2:30". Todos dicen lo mismo, así que conviene no encender más de dos.',
  'Meta base (horas por semana)': 'Las horas que quieres estudiar en una semana normal. Vale para ' +
    'todas las semanas. Si una es distinta, ponle la suya en la columna Meta de la tabla: esa manda ' +
    'solo para esa semana. Si te pasas de la meta, el gráfico lo marca en rojo, pero nada te impide ' +
    'estudiarlo.',
  'Cómo se abrevian los títulos': 'En la tabla de horas, un nombre de ramo largo no cabe en su ' +
    'columna. Elige si se reparte hacia abajo y se lee entero, si se recorta con puntos suspensivos, ' +
    'o si se muestran solo las iniciales. El nombre completo está siempre en el globito al pasar ' +
    'el mouse.',
};

function cerrarAyuda(){
  const m = document.getElementById('ayuda');
  if (m) m.classList.remove('on');
}
function abrirAyuda(titulo, texto, clave){
  const m = document.getElementById('ayuda');
  if (!m) return;
  const ejemplo = AYUDA_EJEMPLOS[clave || titulo];
  document.getElementById('ayuda-caja').innerHTML =
    '<h2>' + esc(titulo) + '</h2>' +
    '<button class="cerrar" id="ayuda-cerrar">Cerrar</button>' +
    '<p class="ayuda">' + texto + '</p>' +
    (ejemplo ? '<div class="ayuda-ejemplo"><b>En la práctica.</b> ' + ejemplo + '</div>' : '');
  m.classList.add('on');
  document.getElementById('ayuda-cerrar').onclick = cerrarAyuda;
}

/* Convierte la explicacion de cada ajuste en un boton "?". Corre despues de dibujar Ajustes. */
function convertirPistas(){
  document.querySelectorAll('.av-fila .pista').forEach(function (p) {
    if (p.dataset.listo) return;
    p.dataset.listo = '1';
    const texto = p.innerHTML;
    const eti = p.parentElement.querySelector('.eti');
    const titulo = eti ? eti.textContent.trim() : 'Ayuda';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ayuda-btn';
    b.textContent = '?';
    b.title = 'Qué es esto';
    b.setAttribute('aria-label', 'Ayuda sobre ' + titulo);
    b.onclick = function () { abrirAyuda(titulo, texto); };
    p.innerHTML = '';
    p.appendChild(b);
  });
}
// El cuadro se cierra al hacer clic fuera de la caja o al apretar Esc.
document.addEventListener('click', function (ev) {
  if (ev.target && ev.target.id === 'ayuda') cerrarAyuda();
});
document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape') cerrarAyuda();
});
