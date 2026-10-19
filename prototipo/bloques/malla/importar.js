/* ========================================================== Malla · importar
   Lectura del respaldo en formato 2 (el que exporta la app Academics) al almacen
   propio del bloque Malla. No toca el DOM, no dibuja y no pinta avisos: devuelve
   un resultado y la UI decide que hacer con el.

   Portado de Academics /tmp/mimo-explore:
     - requisitosDesdeTexto ("MA1001;FI2004|IQ2212") [malla/01-importar.js:139-150, comun/03-catalogo.js:139-150]
     - la limpieza de filas (codigo/nombre/creditos/nivel) [malla/01-importar.js:203-223]
     - cargarMalla: se recuerda que codigos trajo la importacion [malla/01-importar.js:239-270]

   Reglas de extraccion (spec §4), en este orden y sin inventar:
     1 catalogo     = estado.catalogo || obj.catalogo
     2 aprobados    = estado.aprobados, normalizado a {cod:true}
     3 importado    = estado.importado
     4 ramos activos= estado.extras[0].ramos || estado.sem[activo].ramos
                      || obj.semestres[<activo>].ramos || []
     5 notas        = estado.sem[activo].metas_ramo[*].nota
     6 colores      = estado.ajustes.av.colores
     7 niveles      = obj.niveles si es lista con {ramos:[...]}
   Cualquier rechazo (formato, JSON, sin estado, catalogo vacio) NO toca el almacen.
   ============================================================================ */
var MimoMallaImportar = (function () {
  'use strict';

  var CLAVE = 'mimo.bloque.malla';

  // --- utilidades ----------------------------------------------------------
  function texto(v) { return (v === null || v === undefined) ? '' : String(v); }
  function esObjeto(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function fallo(msg) { return { ok: false, error: msg }; }
  function hoy() { return new Date().toISOString().slice(0, 10); }

  function codigo(v) { return texto(v).trim().toUpperCase(); }

  // portado de comun/03-catalogo.js:139-150 y malla/01-importar.js:139-150.
  // ';' separa requisitos (Y), '|' separa alternativas (O).
  function requisitosDesdeTexto(txt) {
    txt = texto(txt).trim();
    if (!txt) return { requisitos: [], requisitos_o: [] };
    var requisitos = [], requisitos_o = [];
    txt.split(';').forEach(function (grupo) {
      var alts = grupo.split('|').map(function (x) { return x.trim().toUpperCase(); })
        .filter(function (x) { return !!x; });
      if (!alts.length) return;
      if (alts.length === 1) requisitos.push(alts[0]);
      else requisitos_o.push(alts);
    });
    return { requisitos: requisitos, requisitos_o: requisitos_o };
  }

  function listaCodigos(v) {
    if (!Array.isArray(v)) return [];
    var out = [], visto = {};
    v.forEach(function (x) {
      var c = codigo(x);
      if (!c || visto[c]) return;
      visto[c] = true;
      out.push(c);
    });
    return out;
  }

  /* ----------------------------------------- catalogo: texto a listas ------
     Si un curso trae 'requisitos' como texto ("MA1001;FI2004|IQ2212") se parsea con la
     notacion canonica; si ya viene como listas se deja tal cual. Se devuelve un catalogo
     nuevo (clon) para no modificar el objeto que entrego quien llama. */
  function prepararCatalogo(crudo) {
    var out = {}, desdeTexto = 0, reqsOInvalidos = 0;
    Object.keys(crudo).forEach(function (k) {
      var cod = codigo(k);
      if (!cod) return;
      var c = esObjeto(crudo[k]) ? crudo[k] : {};
      var fila = {};
      Object.keys(c).forEach(function (f) { fila[f] = c[f]; });
      fila.nombre = texto(fila.nombre) || cod;
      if (typeof fila.requisitos === 'string') {
        var parsed = requisitosDesdeTexto(fila.requisitos);
        fila.requisitos = parsed.requisitos;
        if (parsed.requisitos_o.length) {
          fila.requisitos_o = (Array.isArray(fila.requisitos_o) ? fila.requisitos_o : [])
            .concat(parsed.requisitos_o);
        }
        desdeTexto++;
      }
      if (!Array.isArray(fila.requisitos)) fila.requisitos = [];
      if (fila.requisitos_o !== undefined && fila.requisitos_o !== null) {
        var okGrupos = Array.isArray(fila.requisitos_o) &&
          fila.requisitos_o.every(function (g) { return Array.isArray(g); });
        if (fila.requisitos_o.length && !okGrupos) {
          fila.requisitos_o = [];
          reqsOInvalidos++;
        }
      }
      out[cod] = fila;
    });
    return { catalogo: out, desdeTexto: desdeTexto, reqsOInvalidos: reqsOInvalidos };
  }

  /* --------------------------------------------- ramos del semestre activo --
     Orden de la spec §4. La ultima fuente (obj.semestres) es una concesion declarada:
     el respaldo real del dueno trae los ramos del semestre en curso DENTRO de
     `semestres[0]` (id 2026-2 = estado.activo) y no en estado.sem[activo], que solo
     guarda metas y notas. Sin este paso la importacion daria 0 ramos activos. */
  function ramosActivosDe(estado, obj) {
    // a) extras con ramos (es el sitio que usa el propio Academics)
    if (Array.isArray(estado.extras)) {
      for (var i = 0; i < estado.extras.length; i++) {
        var ex = estado.extras[i];
        if (esObjeto(ex) && Array.isArray(ex.ramos) && ex.ramos.length) return ex.ramos;
      }
    }
    var activo = (estado.activo === undefined || estado.activo === null) ? null : estado.activo;
    // b) estado.sem[<semestre activo>].ramos
    if (esObjeto(estado.sem)) {
      var clave = (activo !== null && esObjeto(estado.sem[activo])) ? activo : null;
      if (clave === null) {
        var claves = Object.keys(estado.sem);
        for (var j = 0; j < claves.length; j++) {
          if (esObjeto(estado.sem[claves[j]]) && Array.isArray(estado.sem[claves[j]].ramos)) {
            clave = claves[j];
            break;
          }
        }
      }
      if (clave !== null && Array.isArray(estado.sem[clave].ramos)) return estado.sem[clave].ramos;
    }
    // c) obj.semestres[<activo>].ramos (respaldo real del dueno)
    if (Array.isArray(obj.semestres) && obj.semestres.length) {
      var sem = null;
      for (var k = 0; k < obj.semestres.length; k++) {
        var s = obj.semestres[k];
        if (esObjeto(s) && String(s.id) === String(activo)) { sem = s; break; }
      }
      if (!sem) {
        for (var m = 0; m < obj.semestres.length; m++) {
          if (esObjeto(obj.semestres[m]) && Array.isArray(obj.semestres[m].ramos)) {
            sem = obj.semestres[m];
            break;
          }
        }
      }
      if (sem && Array.isArray(sem.ramos)) return sem.ramos;
    }
    return [];
  }

  // Notas finales: estado.sem[activo].metas_ramo[cod].nota (spec §4.5).
  function notasDe(estado) {
    var out = {};
    if (!esObjeto(estado.sem)) return out;
    var activo = (estado.activo === undefined || estado.activo === null) ? null : estado.activo;
    var clave = (activo !== null && esObjeto(estado.sem[activo])) ? activo : null;
    if (clave === null) {
      var claves = Object.keys(estado.sem);
      for (var i = 0; i < claves.length; i++) {
        if (esObjeto(estado.sem[claves[i]]) && esObjeto(estado.sem[claves[i]].metas_ramo)) {
          clave = claves[i];
          break;
        }
      }
    }
    if (clave === null) return out;
    var metas = estado.sem[clave].metas_ramo;
    if (!esObjeto(metas)) return out;
    Object.keys(metas).forEach(function (c) {
      var fila = metas[c];
      if (!esObjeto(fila)) return;
      if (fila.nota === null || fila.nota === undefined || fila.nota === '') return;
      var n = Number(fila.nota);
      if (!isFinite(n)) return;
      var cod = codigo(c);
      if (cod) out[cod] = n;
    });
    return out;
  }

  function ajustesDe(estado) {
    var av = {};
    var origen = esObjeto(estado.ajustes) ? estado.ajustes.av : null;
    if (esObjeto(origen)) {
      Object.keys(origen).forEach(function (k) {
        if (k !== 'colores') av[k] = origen[k];
      });
      var colores = {};
      if (esObjeto(origen.colores)) {
        Object.keys(origen.colores).forEach(function (k) {
          var s = texto(origen.colores[k]).trim();
          if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) colores[String(k).toLowerCase()] = s;
        });
      }
      av.colores = colores;
    }
    return { av: av };
  }

  /* ------------------------------------------------------------ desdeObjeto */
  function desdeObjeto(obj) {
    if (!esObjeto(obj)) {
      return fallo('El archivo no trae un objeto JSON: se esperaba un respaldo de Mimo.');
    }
    if (Number(obj.formato) !== 2) {
      return fallo('Formato no reconocido' +
        (obj.formato === undefined ? '' : ' (' + texto(obj.formato) + ')') +
        ': este bloque lee el respaldo en formato 2.');
    }
    var estado = obj.estado;
    if (!esObjeto(estado)) {
      return fallo('El respaldo no trae un "estado": no puedo sacar de ahi el catalogo ni los aprobados.');
    }

    // 1) catalogo: si vienen los dos, gana el del estado.
    var catalogoCrudo = null;
    if (esObjeto(estado.catalogo)) catalogoCrudo = estado.catalogo;
    else if (esObjeto(obj.catalogo)) catalogoCrudo = obj.catalogo;
    else catalogoCrudo = {};
    if (!Object.keys(catalogoCrudo).length) {
      return fallo('El respaldo no trae cursos: el catalogo esta vacio.');
    }
    var prep = prepararCatalogo(catalogoCrudo);
    if (!Object.keys(prep.catalogo).length) {
      return fallo('El respaldo no trae cursos con codigo: el catalogo esta vacio.');
    }

    // 2) aprobados y 3) importado
    var aprobados = estado.aprobados;
    var importado = esObjeto(estado.importado) ? estado.importado : null;

    // 4) ramos activos (se normalizan con el catalogo dentro del motor)
    var ramos = ramosActivosDe(estado, obj);

    // 5) notas y 6) colores
    var notas = notasDe(estado);
    var ajustes = ajustesDe(estado);

    // 7) niveles: solo si es una lista de columnas con ramos
    var niveles = [];
    if (Array.isArray(obj.niveles)) {
      niveles = obj.niveles.filter(function (n) {
        return esObjeto(n) && Array.isArray(n.ramos);
      });
    }

    // Se reemplazan SOLO las claves que Malla posee; _v vuelve a 1 y lo ajeno se conserva.
    var previos = MimoMallaMotor.leer();
    var finales = {};
    Object.keys(previos).forEach(function (k) { finales[k] = previos[k]; });
    finales._v = 1;
    finales.catalogo = prep.catalogo;
    finales.aprobados = aprobados;
    finales.importado = importado;
    finales.ramos = ramos;
    finales.notas = notas;
    finales.ajustes = ajustes;
    finales.niveles = niveles;

    // Un solo punto de escritura: hasta aqui no se toco el almacen.
    MimoMallaMotor.establecer(finales);

    // Resumen y avisos se leen de lo que de verdad quedo guardado (ya normalizado).
    var d = MimoMallaMotor.leer();
    var avisos = [];

    // Requisitos que apuntan a cursos que no vienen: no se rompe nada, el curso queda
    // bloqueado y se avisa (spec §4).
    var huerfanos = [];
    Object.keys(d.catalogo).forEach(function (cod) {
      var c = d.catalogo[cod];
      var fuentes = c.requisitos.concat([].concat.apply([], c.requisitos_o));
      fuentes.forEach(function (r) {
        if (!d.catalogo[r] && huerfanos.indexOf(r) < 0) huerfanos.push(r);
      });
    });
    if (huerfanos.length) {
      avisos.push('Hay ' + huerfanos.length + ' prerrequisito(s) que apuntan a ramos que no vienen ' +
        'en el archivo (' + huerfanos.slice(0, 6).join(', ') +
        (huerfanos.length > 6 ? '...' : '') + '): esos ramos quedan bloqueados hasta que exista el ' +
        'prerrequisito.');
    }

    // Ramos del semestre activo que no estan en el catalogo (se conservan, pero sin ficha).
    var activosFuera = d.ramos.filter(function (r) { return !d.catalogo[r.codigo]; });
    if (activosFuera.length) {
      avisos.push('Hay ' + activosFuera.length + ' ramo(s) en curso que no estan en el catalogo (' +
        activosFuera.slice(0, 6).map(function (r) { return r.codigo; }).join(', ') +
        (activosFuera.length > 6 ? '...' : '') + ').');
    }

    // Columnas del archivo con ramos que no estan en el catalogo: el motor no los dibuja.
    var nivelesFuera = 0;
    d.niveles.forEach(function (n) {
      n.ramos.forEach(function (c) { if (!d.catalogo[c]) nivelesFuera++; });
    });
    if (nivelesFuera) {
      avisos.push(nivelesFuera + ' ramo(s) de las columnas de la malla no estan en el catalogo y no ' +
        'se dibujan.');
    }
    if (prep.reqsOInvalidos) {
      avisos.push(prep.reqsOInvalidos + ' curso(s) traian "requisitos_o" en un formato que no ' +
        'entiendo; se ignoraron esos grupos.');
    }
    if (!d.ramos.length) {
      avisos.push('El respaldo no traia ramos en curso: la malla se ve, pero no hay semestre activo.');
    }

    return {
      ok: true,
      resumen: {
        cursos: Object.keys(d.catalogo).length,
        aprobados: Object.keys(d.aprobados).length,
        activos: d.ramos.length,
        // contadores, no objetos: la UI solo necesita el numero para el aviso
        importado: d.importado ? d.importado.codigos.length : 0,
        colores: Object.keys((d.ajustes.av && d.ajustes.av.colores) || {}).length
      },
      avisos: avisos
    };
  }

  /* ------------------------------------------------------------- desdeTexto */
  function desdeTexto(textoBruto) {
    var bruto = texto(textoBruto).replace(/^\uFEFF/, '').trim();
    if (!bruto) return fallo('El archivo esta vacio.');
    var j;
    try {
      j = JSON.parse(bruto);
    } catch (e) {
      return fallo('El JSON esta mal escrito: ' + (e && e.message ? e.message : 'no se pudo leer'));
    }
    return desdeObjeto(j);
  }

  /* ----------------------------------------------------------- desdeArchivo */
  // Devuelve siempre una Promise<resultado>: el input de archivo del navegador es asincrono.
  function desdeArchivo(file) {
    return new Promise(function (resolve) {
      if (!file) { resolve(fallo('No se eligio ningun archivo.')); return; }
      // Camino moderno (File.text) y camino clasico (FileReader) para navegadores viejos.
      if (typeof file.text === 'function') {
        file.text().then(function (t) {
          resolve(desdeTexto(t));
        }, function (e) {
          resolve(fallo('No pude leer el archivo: ' + (e && e.message ? e.message : 'error')));
        });
        return;
      }
      if (typeof FileReader === 'undefined') {
        resolve(fallo('Este navegador no puede leer archivos.'));
        return;
      }
      var lector = new FileReader();
      lector.onload = function () { resolve(desdeTexto(String(lector.result || ''))); };
      lector.onerror = function () { resolve(fallo('No pude leer el archivo.')); };
      try {
        lector.readAsText(file, 'UTF-8');
      } catch (e) {
        resolve(fallo('No pude leer el archivo: ' + (e && e.message ? e.message : 'error')));
      }
    });
  }

  return {
    CLAVE: CLAVE,
    desdeObjeto: desdeObjeto,
    desdeTexto: desdeTexto,
    desdeArchivo: desdeArchivo
  };
})();

// Unica linea que nombra `window`: la exportacion (spec §1).
if (typeof window !== 'undefined') window.MimoMallaImportar = MimoMallaImportar;
