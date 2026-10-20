/* ============================================================================
   utilidades.js — Mimo Nuevo · sustrato comun · fechas, copia y escape
   (bloque T003, portado de `referencia/mimo-app-53cc22d/js/comun/01-utilidades.js`)

   QUE SE PORTA Y POR QUE
   Los cuatro bloques que vienen (Malla, Calendario, Calificaciones, Apuntes)
   necesitan las mismas fechas y el mismo escape que ya usaba la app anterior.
   Portarlas aqui, una vez, evita que cada bloque invente su `dos()` y su
   aritmetica de dias: en la app anterior convivian cuatro copias.

   QUE NO SE PORTA (y por que)
   - El inflector singular/plural (`tabla()`, `singular()`, `plural()`,
     `mayusInicial`, `normalizar`, `VOCAB_CRUDO`): maquinaria de las etiquetas
     de ramo de la app anterior, que este tablero no tiene. Cuando T004 traiga
     el editor de ramos, se porta con el, no antes.
   - `formatoTitulo()` y `esc` de titulos: dependen del ajuste de formato de
     titulos, que es de Ajustes (T009). Aqui va el `esc` pelado.

   EL REDONDEO DE NOTAS (T005). Se porta de
   `referencia/mimo-app-53cc22d/js/comun/01-utilidades.js:211-214` tal cual,
   porque las notas de la app anterior se leian asi: media decima hacia arriba
   con `dec1(aCent(x))`. Cambiar el redondeo aqui cambiaria las notas ya
   guardadas, que es justo lo que el contrato de paridad prohibe.

   LA FECHA ES LOCAL, NO UTC. `aISO` compone con getFullYear/getMonth/getDate.
   Antes usaba toISOString(), que es UTC: en Chile eso descuadraba la fecha y
   una sesion de "ayer" aparecia como de hoy segun la hora. El fallo se pago
   en la app anterior; no se vuelve a pagar aqui.

   API (todo cuelga de window.MimoComun, un solo espacio de nombres):
     MimoComun.MESES                     ['ene' ... 'dic']
     MimoComun.dos(n)                    2 -> '02'
     MimoComun.aFecha(iso)               '2026-10-20' -> Date a las 12:00 local
     MimoComun.aISO(date)                Date -> '2026-10-20' (hora local)
     MimoComun.hoy()                     '2026-10-20'
     MimoComun.sumaDias(iso, n)          '2026-10-20', 6 -> '2026-10-26'
     MimoComun.rangoSemana(lunes)        '20–26 oct' o '27 sep – 3 oct'
     MimoComun.copia(x)                  copia profunda por JSON
     MimoComun.esc(s)                    & < > " ' escapados
     MimoComun.aCent(x)                  nota -> centesimas (entero)
     MimoComun.dec1(c)                   centesimas -> decimas, media arriba
     MimoComun.ver1(x)                   nota a un decimal; null -> '—'
     MimoComun.ver2(x)                   nota a dos decimales; null -> '—'
   ============================================================================ */
var MimoComun = window.MimoComun = window.MimoComun || {};
(function (Mimo) {
  'use strict';

  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
               'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function dos(n) { return (n < 10 ? '0' : '') + n; }

  // Mediodia local y no medianoche: con 00:00, un cambio de horario de verano
  // puede devolver el dia anterior al sumar dias.
  function aFecha(iso) { return new Date(iso + 'T12:00:00'); }

  function aISO(d) {
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }

  function hoy() { return aISO(new Date()); }

  function sumaDias(iso, n) {
    var d = aFecha(iso);
    d.setDate(d.getDate() + n);
    return aISO(d);
  }

  // '20–26 oct' si los dos extremos caen en el mismo mes; si no, los dos meses.
  function rangoSemana(lunes) {
    var l = aFecha(lunes);
    var d = aFecha(sumaDias(lunes, 6));
    var a = dos(l.getDate());
    var b = dos(d.getDate());
    if (l.getMonth() === d.getMonth()) {
      return a + '–' + b + ' ' + MESES[l.getMonth()];
    }
    return a + ' ' + MESES[l.getMonth()] + ' – ' + b + ' ' + MESES[d.getMonth()];
  }

  function copia(x) { return JSON.parse(JSON.stringify(x)); }

  // Los mensajes llevan nombres de ramos, de semestres y de ficheros, que los
  // escribe el usuario: sin escapar, un nombre con < > rompe la ventana.
  function esc(t) {
    return String(t === null || t === undefined ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  Mimo.MESES = MESES;
  Mimo.dos = dos;
  Mimo.aFecha = aFecha;
  Mimo.aISO = aISO;
  Mimo.hoy = hoy;
  Mimo.sumaDias = sumaDias;
  Mimo.rangoSemana = rangoSemana;
  // Redondeo del usuario: un decimal, media hacia arriba, con enteros en
  // centesimas. `aCent` lleva la nota a centesimas y `dec1` la baja a decimas
  // sin el error de coma flotante de toFixed (0.35 -> 0.4, no 0.3).
  function aCent(x) { return Math.round(Number(x) * 100); }
  function dec1(c) { return Math.floor((c + 5) / 10) / 10; }
  function ver1(x) {
    return (x === null || x === undefined) ? '—' : dec1(aCent(x)).toFixed(1);
  }
  function ver2(x) {
    return (x === null || x === undefined) ? '—' : (aCent(x) / 100).toFixed(2);
  }

  Mimo.copia = copia;
  Mimo.esc = esc;
  Mimo.aCent = aCent;
  Mimo.dec1 = dec1;
  Mimo.ver1 = ver1;
  Mimo.ver2 = ver2;
})(MimoComun);
