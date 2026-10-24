/* ------------------------------------------------------------- calendario ical
   Exportar/importar el calendario de mimo en formato iCalendar (.ics), el estandar que entienden
   Google Calendar y Apple Calendar. Es el puente "viable" entre mimo y los calendarios reales:
   exportas, el usuario lo importa en Google/Apple en dos clics; o importas un .ics que ya tenga.
   (La sincronizacion bidireccional en vivo no va: exige OAuth y un servidor, imposible en file://.) */

// Descarga un texto como archivo (el .ics). helper generico para no repetir el Blob cada vez.
function descargarTexto(contenido, nombre, tipo){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenido], {type: tipo || 'text/plain'}));
  a.download = nombre || 'archivo.txt';
  a.click();
}

// Pasa una fecha y hora de mimo a la forma de iCal: 20260114T103000 (sin guiones ni dos puntos).
function icalFecha(fecha, hora){
  const d = aFecha(fecha);
  const mes = dos(d.getMonth() + 1), dia = dos(d.getDate());
  const base = String(d.getFullYear()) + mes + dia;
  if (!hora) return base;   // evento de dia completo: solo fecha
  const hh = hora.slice(0, 2), mm = hora.slice(3, 5) || '00';
  return base + 'T' + hh + mm + '00';
}

// Escapa caracteres que rompen el .ics (coma, punto y coma, salto de linea, barra invertida).
function icalTexto(s){
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
    .replace(/,/g, '\\,').replace(/;/g, '\\;');
}

// Construye el texto .ics con todos los eventos del semestre activo.
function exportarIcal(){
  const eventos = todosEventos();
  if (!eventos.length){ mostrarAviso('No hay eventos para exportar'); return; }
  const t = tiposDe();
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mimo//Panel de semestre//ES',
                  'CALSCALE:GREGORIAN'];
  eventos.forEach(e => {
    const titulo = e.texto || 'Evento';
    const detalle = (e.detalle || '');
    const tipoNombre = t[e.tipo] ? ' (' + t[e.tipo] + ')' : '';
    const ramoNombre = e.ramo ? ' — ' + (aliasDe(e.ramo) || e.ramo) : '';
    lineas.push('BEGIN:VEVENT');
    lineas.push('UID:' + e.id + '@mimo');
    lineas.push('DTSTAMP:' + icalFecha(hoy(), '00:00') );   // sin T: es fecha-dia
    // DTSTART: si tiene hora, con hora; si no, de dia completo (VALUE=DATE).
    if (e.hora){
      lineas.push('DTSTART:' + icalFecha(e.fecha, e.hora));
      const dur = Number(e.duracion) > 0 ? Number(e.duracion) : 1;
      lineas.push('DURATION:PT' + Math.round(dur * 60) + 'M');
    } else {
      lineas.push('DTSTART;VALUE=DATE:' + icalFecha(e.fecha, null));
    }
    lineas.push('SUMMARY:' + icalTexto(titulo + tipoNombre + ramoNombre));
    if (detalle) lineas.push('DESCRIPTION:' + icalTexto(detalle));
    lineas.push('END:VEVENT');
  });
  lineas.push('END:VCALENDAR');
  const contenido = lineas.join('\r\n');
  descargarTexto(contenido, 'mimo-calendario.ics', 'text/calendar');
  mostrarAviso('Calendario exportado (.ics): impórtalo en Google o Apple Calendar');
}

// Lee un evento de un bloque VEVENT ya separado por lineas.
function parsearVevent(bloque){
  const e = {texto:'', fecha:null, hora:null, duracion:0, detalle:'', dtstart:null};
  // Desdoblar lineas plegadas: en iCal, una linea que sigue al texto y empieza con ESPACIO o TAB es
  // la continuacion de la anterior. Se unen antes de separar campos.
  const desdoblado = bloque.replace(/\r?\n[ \t]/g, '');
  const lineas = desdoblado.split(/\r?\n/);
  lineas.forEach(l => {
    const i = l.indexOf(':');
    if (i < 0) return;
    const campo = l.slice(0, i).split(';')[0].toUpperCase();
    let val = l.slice(i + 1);
    val = val.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
    if (campo === 'SUMMARY') e.texto = val;
    else if (campo === 'DESCRIPTION') e.detalle = val;
    else if (campo === 'DTSTART') e.dtstart = val;
    else if (campo === 'DTEND') e.dtend = val;
    else if (campo === 'DURATION'){
      const mh = /(\d+)H/.exec(val), mm = /(\d+)M/.exec(val);
      const total = (mh ? Number(mh[1]) * 60 : 0) + (mm ? Number(mm[1]) : 0);
      e.duracion = Math.round(total / 60 * 10) / 10;
    }
  });
  // Resolver DTSTART -> fecha y hora, y duracion (por DURATION o por diferencia con DTEND).
  if (e.dtstart){
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/.exec(e.dtstart.replace(/[^\dT]/g, ''));
    if (m){
      e.fecha = m[1] + '-' + m[2] + '-' + m[3];
      if (m[4]) e.hora = m[4] + ':' + m[5];
    }
  }
  if (!e.duracion && e.dtend && e.dtstart && e.hora){
    const mEnd = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/.exec(e.dtend.replace(/[^\dT]/g, ''));
    if (mEnd && mEnd[4]){
      const ms = (new Date(mEnd[1] + '-' + mEnd[2] + '-' + mEnd[3] + 'T' + mEnd[4] + ':' + mEnd[5] + ':00')) -
                 (new Date(e.fecha + 'T' + e.hora + ':00'));
      if (ms > 0) e.duracion = Math.round(ms / 3600000 * 10) / 10;
    }
  }
  return e.fecha ? e : null;
}

// Importa eventos desde un archivo .ics elegido por el usuario.
function importarIcal(archivo){
  const lector = new FileReader();
  lector.onload = () => {
    const texto = String(lector.result || '');
    const bloques = texto.split('BEGIN:VEVENT').slice(1);
    if (!bloques.length){ mostrarAviso('No se encontraron eventos en ese .ics'); return; }
    let n = 0;
    bloques.forEach(b => {
      const e = parsearVevent(b);
      if (!e) return;
      const id = 'ical' + Date.now() + '' + n;
      est().nuevas.push({id:id, semana:'—', dia:'Lunes', fecha:e.fecha, texto:e.texto || '(sin título)',
                         detalle:e.detalle || '', ramo:null, tipo:'tarea', hora:e.hora, duracion:e.duracion});
      n++;
    });
    guardar('Importados ' + n + ' eventos del calendario');
    renderTodo(); renderSemestre();
    mostrarAviso('Se importaron ' + n + ' eventos del calendario');
  };
  lector.readAsText(archivo);
}
