/* ========================================================== Malla · exportar
   Emite la parte de Malla en formato 2 (el que lee el importador). No fusiona con
   otros bloques: el shell hara la fusion en la Iteracion 4e (spec §5). Sin File, sin
   descarga y sin DOM: solo devuelve el objeto o el texto.

   Forma de salida: la de la spec §5, con una clave aditiva declarada:
     estado.activo + estado.sem[<activo>].metas_ramo  -> conserva las NOTAS finales.
   Sin esa concesion, exportar y volver a importar perderia las notas del respaldo,
   porque la forma minima de la spec no tiene donde ponerlas.
   ============================================================================ */
var MimoMallaExportar = (function () {
  'use strict';

  var CLAVE = 'mimo.bloque.malla';
  var ID_ACTIVO = 'malla';   // id sintetico del semestre en curso, solo para el ida y vuelta

  // Copia profunda por JSON: lo exportado no comparte objeto con el almacen en memoria.
  function clonar(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function aFormato2() {
    var d = clonar(MimoMallaMotor.leer());
    var estado = {
      v: 3,
      catalogo: d.catalogo,
      aprobados: d.aprobados,
      importado: d.importado,
      extras: [{ ramos: d.ramos }],
      ajustes: d.ajustes
    };

    // Aditivo: las notas finales viajan dentro de estado.sem, que es de donde las lee
    // el importador (spec §4.5). Solo se agrega si hay alguna.
    var codigosNota = Object.keys(d.notas || {});
    if (codigosNota.length) {
      var metas = {};
      codigosNota.forEach(function (c) {
        metas[c] = { nota: d.notas[c] };
      });
      estado.activo = ID_ACTIVO;
      estado.sem = {};
      estado.sem[ID_ACTIVO] = { metas_ramo: metas };
    }

    return {
      formato: 2,
      estado: estado,
      catalogo: d.catalogo,
      niveles: d.niveles
    };
  }

  function comoTexto() {
    return JSON.stringify(aFormato2(), null, 2);
  }

  function resumen() {
    var d = MimoMallaMotor.leer();
    return {
      cursos: Object.keys(d.catalogo).length,
      aprobados: Object.keys(d.aprobados).length,
      activos: d.ramos.length
    };
  }

  return {
    CLAVE: CLAVE,
    aFormato2: aFormato2,
    comoTexto: comoTexto,
    resumen: resumen
  };
})();

// Unica linea que nombra `window`: la exportacion (spec §1).
if (typeof window !== 'undefined') window.MimoMallaExportar = MimoMallaExportar;
