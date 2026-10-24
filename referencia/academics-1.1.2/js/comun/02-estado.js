/* ---------------------------------------------------------------- estado */
const OTROS = {codigo:'OTROS', alias:'Sin asignar', color:'#CBD5E1', esCupo:true};
// --- datos vacios ---------------------------------------------------------------
// La version limpia arranca sin ningun semestre creado. Estos dos atajos devuelven un
// molde vacio para que las vistas puedan dibujarse igual; nada de ese molde se guarda,
// porque no hay semestre al cual escribirle. Cuando el usuario crea el primero, los
// objetos de verdad toman el relevo.
const SEM_VACIO = {id:null, nombre:'', inicio:null, semanas:[], ramos:[], eventos:[],
                   semanas_estudio:[]};
function semestres(){ return D.semestres.concat(E.extras || []); }
function semActivo(){
  return semestres().find(s => s.id === E.activo) || semestres()[0] || SEM_VACIO;
}
// El estado de trabajo para escrituras. Si hay un semestre activo de verdad, es E.sem[E.activo];
// si no (version limpia o todavia sin crear semestre), es E.personal: un estado persistente para
// que los eventos y datos personales del calendario no se pierdan al no haber semestre.
function est(){
  if (E.activo && E.sem[E.activo]) return E.sem[E.activo];
  E.personal = E.personal || estadoSemestre(SEM_VACIO);
  return E.personal;
}
function haySemestre(){ return semestres().length > 0; }
// Varias cosas (eventos, horas, notas) viven DENTRO de un semestre. Sin ninguno, escribir en el
// estado se hacia sobre un objeto temporal y el dato se perdia sin decir nada. Esto lo evita.
function exigirSemestre(que){
  if (haySemestre()) return true;
  mostrarAviso('Primero crea un semestre con el botón + de arriba a la izquierda. ' + que);
  return false;
}
