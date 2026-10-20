/* ========================================================= Tiempo · exportar
   Emite la parte de Tiempo en formato 2 (el que exporta la app anterior y el que lee el
   importador). No fusiona con otros bloques: la fusion de todos es la Iteracion 4e. Sin File,
   sin descarga y sin DOM: solo devuelve el objeto o el texto.

   Forma de salida: la canonica de comun/03-catalogo.js:290-298, dentro de `estado.tiempo`, MAS
   `estado.tiempo.registro`. El viejo guardaba las sesiones por semestre, fuera de `tiempo`; aqui
   el bloque es dueno de su registro (`datos.posee: ["tiempo.registro"]`) y viajan dentro, para que
   exportar y volver a importar no pierda el historial. Es una clave ADITIVA declarada: el
   importador de la app anterior la ignora y el de este bloque la entiende.
   ============================================================================ */
var MimoTiempoExportar = (function () {
  'use strict';

  var CLAVE = 'mimo.bloque.tiempo';
  var V = 3;   // version del esquema de estado de la app anterior (E.v)

  // Copia profunda por JSON: lo exportado no comparte objeto con el almacen en memoria.
  function clonar(v) {
    return JSON.parse(JSON.stringify(v));
  }

  // El objeto `tiempo` tal cual, listo para viajar dentro de `estado.tiempo`.
  function soloTiempo() {
    return clonar(MimoTiempoMotor.leer());
  }

  function aFormato2() {
    return {
      formato: 2,
      estado: {
        v: V,
        tiempo: soloTiempo()
      }
    };
  }

  function comoTexto() {
    return JSON.stringify(aFormato2(), null, 2);
  }

  // Cifras de la ficha, sin texto de interfaz: la UI decide como se nombran.
  function resumen() {
    var t = MimoTiempoMotor.leer();
    var ag = MimoTiempoMotor.agregados();
    return {
      sesiones: t.registro.length,
      minutos: ag.total,
      dias: Object.keys(ag.porDia).length,
      semanas: Object.keys(ag.porSemana).length,
      ramos: Object.keys(ag.porRamo).length
    };
  }

  return {
    CLAVE: CLAVE,
    soloTiempo: soloTiempo,
    aFormato2: aFormato2,
    comoTexto: comoTexto,
    resumen: resumen
  };
})();

// Unica linea que nombra `window`: la exportacion (spec §1).
if (typeof window !== 'undefined') window.MimoTiempoExportar = MimoTiempoExportar;
