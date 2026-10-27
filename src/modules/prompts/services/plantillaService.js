// src/modules/prompts/services/plantillaService.js
// Funciones puras: validan las reglas de un producto y arman el prompt completo (encabezado + reglas «inicio» + sección generada + reglas «fin»).
// Todo texto que arma el código viene de `ajustes`.
const { VARIABLES_AUTOMATICAS, PREFIJO_RECURSO, PREFIJO_GRUPO, SUFIJO_GRUPO_VACIO, variableGrupoVacio } = require('../constantes');
const { msg, rellenar } = require('../mensajes');
const { resolverVisibilidad, indexarPorClave, recursosDelEsquema, clavesDeGrupos, reglasDelEsquema } = require('./esquemaService');
const { tipoDe } = require('./tipos');
const { sinControl, aLinea } = require('./tipos/_utilidades');

const ETIQUETA_RE = /\{\{([^{}]*)\}\}/g;
const MARCA_BLOQUE = '\u0001'; // señala dónde hubo una etiqueta de bloque, para eliminar líneas que quedan vacías
const VARIABLE_OTROS = 'otros_parametros'; // la sección de parámetros que genera el sistema
const VARIABLE_LISTA = 'lista_imagenes';
const EJ_VARIABLE = '{{clave}}'; // ejemplos de sintaxis que muestran los mensajes
const EJ_BLOQUE = '{{#si clave}}';

const normalizar = texto => String(texto).replace(/\r\n?/g, '\n');
// ---------- Análisis ----------

const textoApertura = (condicion, clave) => `{{#${condicion} ${clave}}}`;

/** @returns {{ nodos: object[], errores: {mensaje: string}[] }} nodos: texto | variable | bloque */
function analizar(plantilla, clavesValidas, clavesRecursos = [], clavesGrupos = []) {
  const errores = [];
  const raiz = [];
  let actual = raiz;
  let abierto = null;
  const texto = normalizar(plantilla);
  let ultimo = 0;

  const agregarTexto = fragmento => {
    if (!fragmento) return;
    if (/\{\{|\}\}/.test(fragmento)) errores.push({ mensaje: msg('plantilla.llaveSuelta', { abre: '{{', cierra: '}}', ejemplo: EJ_VARIABLE }) });
    actual.push({ tipo: 'texto', valor: fragmento });
  };
  const exigirClave = clave => {
    if (clavesValidas.has(clave)) return;
    let mensaje;
    if (clave.startsWith(PREFIJO_RECURSO)) {
      mensaje = msg('plantilla.recursoDesconocido', {
        variable: clave,
        clave: clave.slice(PREFIJO_RECURSO.length),
        disponibles: clavesRecursos.length ? clavesRecursos.map(c => PREFIJO_RECURSO + c).join(', ') : 'ninguno'
      });
    } else if (clave.startsWith(PREFIJO_GRUPO) && clave.endsWith(SUFIJO_GRUPO_VACIO) && clave.length > PREFIJO_GRUPO.length + SUFIJO_GRUPO_VACIO.length) {
      mensaje = msg('plantilla.grupoDesconocido', {
        variable: clave,
        grupo: clave.slice(PREFIJO_GRUPO.length, -SUFIJO_GRUPO_VACIO.length),
        disponibles: clavesGrupos.length ? clavesGrupos.join(', ') : 'ninguno'
      });
    } else {
      mensaje = msg('plantilla.variableNoExiste', { variable: clave, sistema: VARIABLES_AUTOMATICAS.join(', ') });
    }
    errores.push({ mensaje });
  };

  for (const m of texto.matchAll(ETIQUETA_RE)) {
    agregarTexto(texto.slice(ultimo, m.index));
    ultimo = m.index + m[0].length;
    const interior = m[1].trim();
    const apertura = interior.match(/^#(si|no)\s+([a-z][a-z0-9_]*)$/);
    const cierre = interior.match(/^\/(si|no)$/);
    if (apertura) {
      exigirClave(apertura[2]);
      if (abierto) { errores.push({ mensaje: msg('plantilla.anidado', { interno: textoApertura(apertura[1], apertura[2]), externo: textoApertura(abierto.condicion, abierto.clave) }) }); continue; }
      abierto = { tipo: 'bloque', condicion: apertura[1], clave: apertura[2], hijos: [] };
      actual.push(abierto);
      actual = abierto.hijos;
    } else if (cierre) {
      if (!abierto) errores.push({ mensaje: msg('plantilla.cierreSinApertura', { cierre: `{{/${cierre[1]}}}`, ejemplo: EJ_BLOQUE }) });
      else if (abierto.condicion !== cierre[1]) errores.push({ mensaje: msg('plantilla.cierreDistinto', { apertura: textoApertura(abierto.condicion, abierto.clave), cierre: `{{/${cierre[1]}}}`, esperado: `{{/${abierto.condicion}}}` }) });
      if (abierto) { abierto = null; actual = raiz; }
    } else if (/^[a-z][a-z0-9_]*$/.test(interior)) {
      exigirClave(interior);
      actual.push({ tipo: 'variable', clave: interior });
    } else {
      errores.push({ mensaje: msg('plantilla.etiquetaInvalida', { etiqueta: `{{${interior}}}`, ejVariable: EJ_VARIABLE, ejBloque: EJ_BLOQUE, ejCierre: '{{/si}}' }) });
    }
  }
  agregarTexto(texto.slice(ultimo));
  if (abierto) errores.push({ mensaje: msg('plantilla.bloqueSinCerrar', { apertura: textoApertura(abierto.condicion, abierto.clave), cierre: `{{/${abierto.condicion}}}` }) });
  return { nodos: raiz, errores };
}

const clavesDeRecursos = esquema => recursosDelEsquema(esquema).map(r => r.clave);

function clavesDelEsquema(esquema) {
  const parametros = indexarPorClave(resolverVisibilidad(esquema).parametros);
  return new Set([...parametros.keys(), ...VARIABLES_AUTOMATICAS, ...clavesDeRecursos(esquema).map(c => PREFIJO_RECURSO + c), ...clavesDeGrupos(esquema).map(variableGrupoVacio)]);
}

/** Sintaxis del texto de cada regla con texto (variables existentes, bloques sin anidar). @returns {{clave: string, mensaje: string}[]} */
function validarTextosDeReglas(esquema) {
  const claves = clavesDelEsquema(esquema);
  const errores = [];
  reglasDelEsquema(esquema).filter(r => typeof r.texto === 'string' && r.texto.trim()).forEach(r => {
    const regla = typeof r.etiqueta === 'string' && r.etiqueta.trim() ? r.etiqueta.trim() : r.clave;
    const unicos = new Set(analizar(r.texto, claves, clavesDeRecursos(esquema), clavesDeGrupos(esquema)).errores.map(e => e.mensaje));
    unicos.forEach(detalle => errores.push({ clave: 'reglas', mensaje: msg('regla.sintaxis', { regla, detalle }) }));
  });
  return errores;
}

// ---------- Parámetros referenciados ----------

// Referenciado = aparece como {{clave}}, {{#si clave}} o {{#no clave}}; sus destinos «unidad_de» e «igual_a» también cuentan.
function clavesReferenciadas(plantilla, esquema) {
  const usadas = new Set();
  const recorrer = nodos => nodos.forEach(n => {
    if (n.tipo === 'variable') usadas.add(n.clave);
    if (n.tipo === 'bloque') { usadas.add(n.clave); recorrer(n.hijos); }
  });
  if (typeof plantilla === 'string') recorrer(analizar(plantilla, new Set()).nodos);
  const porClave = indexarPorClave(resolverVisibilidad(esquema).parametros);
  [...usadas].forEach(clave => {
    const p = porClave.get(clave);
    if (p) tipoDe(p).referencias(p).forEach(destino => usadas.add(destino));
  });
  return usadas;
}

// ---------- Formato de valores ----------

function crearContexto({ esquema, valores, imagenes, contacto, referenciadas, ajustes, urlRecurso }) {
  const { visibles, crudos, parametros } = resolverVisibilidad(esquema, valores, imagenes);
  const porClave = indexarPorClave(parametros);
  const grupos = esquema && Array.isArray(esquema.grupos) ? esquema.grupos : [];
  const T = ajustes.textos_prompt;
  const t = (clave, params) => rellenar(T[clave], params);

  // Se une con «e» (y no «y») cuando la siguiente palabra empieza con «i»; el conector lo define el ajuste «union_final».
  const unir = partes => (partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(T.union)}${T.union_final}${partes[partes.length - 1]}`);

  // Imágenes numeradas: recursos «inicio», imágenes del asesor (parámetros visibles en orden del esquema y de envío) y recursos «fin».
  const items = [];
  const activos = recursosDelEsquema(esquema).filter(r => r.activo === true);
  const recursoPorVariable = new Map();
  const agregarRecursos = posicion => activos.filter(r => r.posicion === posicion).forEach(r => {
    const item = {
      numero: items.length + 1,
      origen: 'recurso',
      clave: r.clave,
      etiqueta: aLinea(r.etiqueta || r.clave),
      descripcion: typeof r.descripcion === 'string' ? aLinea(r.descripcion) : '',
      url: urlRecurso(r)
    };
    items.push(item);
    recursoPorVariable.set(PREFIJO_RECURSO + r.clave, item);
  });

  agregarRecursos('inicio');
  const itemsPorParametro = new Map();
  grupos.forEach(g => (Array.isArray(g.parametros) ? g.parametros : []).forEach(p => {
    const tipo = tipoDe(p);
    if (!p || tipo.destino !== 'imagenes' || !visibles.get(p.clave)) return;
    const propios = tipo.adjuntos(p, crudos.get(p.clave)).map(i => {
      const item = { numero: items.length + 1, origen: 'asesor', parametro: p.clave, grupo: g.etiqueta, ...i };
      items.push(item);
      return item;
    });
    itemsPorParametro.set(p.clave, propios);
  }));
  agregarRecursos('fin');
  const datos = contacto || {};

  const referenciaDeImagen = item => {
    const detalle = [item.descripcion, item.ubicacion && t('detalle_ubicacion', { ubicacion: item.ubicacion })].filter(Boolean).join(T.detalle_union);
    return t('imagen_ref', { numero: item.numero }) + (detalle ? t('imagen_detalle', { detalle }) : '');
  };

  const lineaDeLista = i => t('lista_linea', {
    numero: i.numero,
    origen: i.origen === 'recurso' ? i.etiqueta : aLinea(i.grupo),
    descripcion: i.descripcion || T.lista_sin_descripcion,
    ubicacion: i.ubicacion ? t('lista_ubicacion', { ubicacion: i.ubicacion }) : ''
  });

  // Lo que las definiciones de tipo pueden usar al formatear.
  const contextoTipos = {
    T,
    t,
    unir,
    referenciaDeImagen,
    parametro: clave => porClave.get(clave),
    crudoDe: clave => crudos.get(clave),
    adjuntosDe: clave => itemsPorParametro.get(clave) || [],
    formatear: (clave, profundidad) => formatear(clave, profundidad),
    tieneValor: (clave, profundidad) => tieneValor(clave, profundidad)
  };

  // Sin imágenes ni recursos activos, la lista y el total quedan vacíos para que la plantilla los oculte.
  const automaticas = {
    asesor_nombre: () => datos.nombre,
    asesor_telefono: () => datos.telefono,
    asesor_correo: () => datos.email,
    total_imagenes: () => (items.length ? t(items.length === 1 ? 'total_uno' : 'total_varios', { n: items.length }) : ''),
    lista_imagenes: () => items.map(lineaDeLista).join('\n'),
    [VARIABLE_OTROS]: () => otrosParametros()
  };

  // grupo_<clave>_vacio: verdadera si ningún parámetro visible con dato del grupo tiene valor (se resuelve al usarla).
  const gruposVacios = new Map(grupos.filter(g => g && typeof g.clave === 'string').map(g => [variableGrupoVacio(g.clave),
    () => !(Array.isArray(g.parametros) ? g.parametros : []).some(p => p && tipoDe(p).cuentaParaGrupoVacio && tieneValor(p.clave))]));

  // Valor formateado de un parámetro ('' si está oculto o sin valor).
  function formatear(clave, profundidad = 0) {
    if (gruposVacios.has(clave)) return gruposVacios.get(clave)() ? T.si : T.no;
    if (Object.prototype.hasOwnProperty.call(automaticas, clave)) {
      const valor = automaticas[clave]();
      return sinControl(valor == null ? '' : String(valor)).trim();
    }
    if (recursoPorVariable.has(clave)) return t('imagen_ref', { numero: recursoPorVariable.get(clave).numero });
    const p = porClave.get(clave);
    if (!p || !visibles.get(clave)) return '';
    return tipoDe(p).formatear(p, crudos.get(clave), contextoTipos, profundidad);
  }

  // «Tiene valor»: lo decide el tipo del parámetro (si_no solo cuando es verdadero); lo demás, que su texto no sea vacío.
  function tieneValor(clave, profundidad = 0) {
    if (gruposVacios.has(clave)) return gruposVacios.get(clave)();
    const p = porClave.get(clave);
    if (p && visibles.get(clave)) return tipoDe(p).tieneValor(p, crudos.get(clave), contextoTipos, profundidad);
    return formatear(clave, profundidad) !== '';
  }

  // Lo que el administrador agregó al esquema pero la plantilla no nombra, para que nunca se pierda.
  function otrosParametros() {
    const secciones = grupos.map(g => {
      const lineas = (Array.isArray(g.parametros) ? g.parametros : [])
        .filter(p => p && tipoDe(p).enOtrosParametros && !referenciadas.has(p.clave) && tieneValor(p.clave))
        .map(p => t('extras_linea', { etiqueta: aLinea(p.etiqueta), valor: formatear(p.clave) }));
      return lineas.length ? `${t('extras_grupo', { grupo: aLinea(g.etiqueta) })}\n${lineas.join('\n')}` : '';
    }).filter(Boolean);
    return secciones.length ? `${T.extras_titulo}\n${secciones.join('\n')}` : '';
  }

  // Bloque generado de imágenes: título, introducción y lista numerada; vacío si no hay ninguna imagen.
  const seccionImagenes = () => (items.length
    ? [T.imagenes_titulo, t('imagenes_intro', { total: formatear('total_imagenes') }), formatear(VARIABLE_LISTA)].join('\n')
    : '');

  return { formatear, tieneValor, items, seccionImagenes };
}

// ---------- Render ----------

function renderizarNodos(nodos, ctx) {
  return nodos.map(n => {
    if (n.tipo === 'texto') return n.valor;
    if (n.tipo === 'variable') return ctx.formatear(n.clave);
    const mostrar = ctx.tieneValor(n.clave) === (n.condicion === 'si');
    return MARCA_BLOQUE + (mostrar ? renderizarNodos(n.hijos, ctx) : '') + MARCA_BLOQUE;
  }).join('');
}

function limpiarLineas(texto) {
  return texto.split('\n')
    .filter(linea => !(linea.includes(MARCA_BLOQUE) && linea.split(MARCA_BLOQUE).join('').trim() === ''))
    .map(linea => linea.split(MARCA_BLOQUE).join(''))
    .join('\n');
}

// Parámetros que la sección generada no repite: los que alguna regla nombra y las unidades que ya acompañan a un número.
function clavesNombradas(esquema, reglas) {
  const nombradas = new Set();
  reglas.forEach(r => clavesReferenciadas(r.texto, esquema).forEach(c => nombradas.add(c)));
  resolverVisibilidad(esquema).parametros.forEach(p => { if (p) tipoDe(p).acompanantes(p).forEach(c => nombradas.add(c)); });
  return nombradas;
}

/**
 * Único camino del prompt: encabezado + reglas activas «inicio» + sección generada (imágenes y parámetros) + reglas activas «fin».
 * Cada regla se renderiza con las reglas de render de la sección 3 del contrato; los valores se insertan en una sola pasada.
 * Una regla que nombre {{lista_imagenes}} o {{otros_parametros}} reemplaza esa parte de la sección generada.
 * `urlRecurso(recurso)` decide la URL que ve el cliente (por defecto, la guardada).
 * @returns {{ prompt: string, imagenes: object[], totalImagenes: number, reglas: {clave: string, etiqueta: string, posicion: string, activo: boolean, incluida: boolean}[] }}
 */
function renderizar({ esquema, valores = {}, imagenes = {}, contacto = {}, ajustes, urlRecurso = r => r.url }) {
  const todas = reglasDelEsquema(esquema);
  const activas = todas.filter(r => r.activo === true && typeof r.texto === 'string' && r.texto.trim());
  const nombradas = clavesNombradas(esquema, activas);
  const ctx = crearContexto({ esquema, valores, imagenes, contacto, referenciadas: nombradas, ajustes, urlRecurso });
  const claves = clavesDelEsquema(esquema);
  const renderRegla = r => limpiarLineas(renderizarNodos(analizar(r.texto, claves, clavesDeRecursos(esquema), clavesDeGrupos(esquema)).nodos, ctx)).replace(/\n{3,}/g, '\n\n').trim();
  const renderizadas = new Map(activas.map(r => [r.clave, renderRegla(r)]));
  const deRegla = posicion => activas.filter(r => r.posicion === posicion).map(r => renderizadas.get(r.clave));

  const generada = [
    nombradas.has(VARIABLE_LISTA) ? '' : ctx.seccionImagenes(),
    nombradas.has(VARIABLE_OTROS) ? '' : ctx.formatear(VARIABLE_OTROS)
  ].filter(Boolean).join('\n\n');

  const prompt = [ajustes.encabezado_sistema, ...deRegla('inicio'), generada, ...deRegla('fin')].filter(Boolean).join('\n\n');
  return {
    prompt,
    imagenes: ctx.items,
    totalImagenes: ctx.items.length,
    reglas: todas.map(r => ({ clave: r.clave, etiqueta: typeof r.etiqueta === 'string' ? r.etiqueta.trim() : r.clave, posicion: r.posicion, activo: r.activo === true, incluida: Boolean(renderizadas.get(r.clave)) }))
  };
}

module.exports = { validarTextosDeReglas, renderizar };
