/* =====================================================================
   Panel de Semestre -- muestra v3
   Multi-semestre, horas por ramo, notas por categorias con eximicion
   configurable, grafico de puntos y cronometro.
   ===================================================================== */
const D = JSON.parse(document.getElementById('datos').textContent);
const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
// Con que nombre guarda el navegador los datos de este alumno. NO es un detalle cosmetico:
// si cambia, la aplicacion arranca vacia porque busca en un cajon y los datos estan en otro.
// Este es el mismo cajon que usaba la version publicada, para no perder nada de lo ya hecho.
const CLAVE = 'mimo-limpio-v1';
const TIPOS = {control:'CONTROL', entrega:'ENTREGA', ejercicio:'EJERCICIO', terreno:'TERRENO',
               tramite:'TRÁMITE', feriado:'FERIADO', personal:'PERSONAL', aviso:'AVISO', tarea:'TAREA'};
// Los tipos de la lista fija mas los que agregue el usuario. La clave es el codigo que se guarda en
// el evento y el valor la etiqueta que se muestra.
function tiposDe(){
  // En la version limpia no viene ninguno de fabrica: los crea el usuario en Ajustes.
  const base = D.limpio ? {} : TIPOS;
  const t = Object.assign({}, base, E.tipos || {});
  (E.tiposFuera || []).forEach(k => { delete t[k]; });
  return t;
}
// Que categoria del ramo le toca por defecto a cada tipo de evento, para pasar la nota al promedio.
const CAT_POR_TIPO = {control:'Controles', tarea:'Tareas', entrega:'Tareas', ejercicio:'Ejercicios',
                      laboratorio:'Laboratorios', terreno:'Laboratorios'};
