// src/modules/prompts/services/esquemaService.js
// Funciones puras: validan el esquema de un producto y lo que envía el asesor.
const { VARIABLES_AUTOMATICAS, PREFIJO_RECURSO, variableGrupoVacio } = require('../constantes');
const { msg } = require('../mensajes');
const { urlDeRecursoValida } = require('./recursos');
const { obtenerTipo, clavesDeTipos, tipoDe } = require('./tipos');
const { tiene, esObjeto, esTextoNoVacio, nombreDe, etiquetaDe, verValor } = require('./tipos/_utilidades');

const TIPOS = clavesDeTipos();
const CLAVE_RE = /^[a-z][a-z0-9_]{1,59}$/;
const POSICIONES_RECURSO = ['inicio', 'fin'];
const POSICIONES_REGLA = ['inicio', 'fin']; // antes o después de lo que generan los parámetros

function parametrosPlanos(esquema) {
  const grupos = esquema && Array.isArray(esquema.grupos) ? esquema.grupos : [];
  return grupos.flatMap(g => (g && Array.isArray(g.parametros) ? g.parametros : []));
}

function indexarPorClave(parametros) {
  return new Map(parametros.filter(p => p && typeof p.clave === 'string').map(p => [p.clave, p]));
}

// Claves de los grupos con forma válida (de ellas se derivan las variables grupo_<clave>_vacio).
function clavesDeGrupos(esquema) {
  const grupos = esquema && Array.isArray(esquema.grupos) ? esquema.grupos : [];
  return grupos.filter(g => esObjeto(g) && typeof g.clave === 'string').map(g => g.clave);
}

// Recursos fijos del producto (imágenes que siempre acompañan al prompt); los mal formados los reporta validarEsquema.
function recursosDelEsquema(esquema) {
  const lista = esquema && Array.isArray(esquema.recursos) ? esquema.recursos : [];
  return lista.filter(r => esObjeto(r) && typeof r.clave === 'string');
}

// Reglas específicas del producto; las mal formadas las reporta validarEsquema.
function reglasDelEsquema(esquema) {
  const lista = esquema && Array.isArray(esquema.reglas) ? esquema.reglas : [];
  return lista.filter(r => esObjeto(r) && typeof r.clave === 'string');
}

// ---------- Validación del esquema ----------

function validarParametro(p, claves, errores, ajustes) {
  const L = ajustes.limites;
  const parametro = nombreDe(p);
  const err = mensaje => errores.push({ clave: p.clave, mensaje });
  if (!esTextoNoVacio(p.etiqueta)) err(msg('param.etiqueta', { parametro }));
  if (p.requerido !== undefined && typeof p.requerido !== 'boolean') err(msg('param.requerido', { parametro }));
  if (p.ayuda !== undefined && typeof p.ayuda !== 'string') err(msg('param.ayuda', { parametro }));

  if (p.visible_si !== undefined) {
    const v = p.visible_si;
    if (!esObjeto(v) || !tiene(v, 'igual')) err(msg('param.visibleSiForma', { parametro }));
    else if (!claves.has(v.parametro)) err(msg('param.visibleSiNoExiste', { parametro, destino: String(v.parametro) }));
    else if (v.parametro === p.clave) err(msg('param.visibleSiMismo', { parametro }));
  }

  const tipo = obtenerTipo(p.tipo);
  if (!tipo) err(msg('param.tipoInvalido', { parametro, tipo: String(p.tipo), tipos: TIPOS.join(', ') }));
  else tipo.validarEsquema(p, { parametro, claves, ajustes, err, tipoDe });
}

// Un ciclo de «visible_si» dejaría el parámetro oculto para siempre.
function hayCicloVisibilidad(porClave, clave) {
  const vistos = new Set();
  let actual = porClave.get(clave);
  while (actual && actual.visible_si && esObjeto(actual.visible_si)) {
    if (vistos.has(actual.clave)) return true;
    vistos.add(actual.clave);
    actual = porClave.get(actual.visible_si.parametro);
  }
  return false;
}

// Un recurso activo exige una URL usable; uno inactivo puede esperar su imagen con la URL vacía.
function validarRecursos(esquema, claves, ajustes, errores) {
  if (esquema.recursos === undefined) return;
  const L = ajustes.limites;
  const falla = mensaje => errores.push({ clave: 'recursos', mensaje });
  if (!Array.isArray(esquema.recursos)) return falla(msg('recurso.lista', { max: L.recursos_max, total: 0 }));
  if (esquema.recursos.length > L.recursos_max) falla(msg('recurso.lista', { max: L.recursos_max, total: esquema.recursos.length }));

  const vistos = new Set();
  esquema.recursos.forEach((r, i) => {
    if (!esObjeto(r)) return falla(msg('recurso.invalido', { numero: i + 1 }));
    if (typeof r.clave !== 'string' || !CLAVE_RE.test(r.clave)) return falla(msg('recurso.claveInvalida', { numero: i + 1 }));
    const recurso = esTextoNoVacio(r.etiqueta) ? r.etiqueta.trim() : r.clave;
    if (VARIABLES_AUTOMATICAS.includes(r.clave)) falla(msg('recurso.claveReservada', { clave: r.clave, recurso }));
    else if (claves.has(r.clave) || vistos.has(r.clave)) falla(msg('recurso.claveRepetida', { clave: r.clave, recurso }));
    vistos.add(r.clave);
    const variable = `${PREFIJO_RECURSO}${r.clave}`;
    if (claves.has(variable)) falla(msg('recurso.choqueVariable', { variable, recurso }));

    if (!esTextoNoVacio(r.etiqueta) || r.etiqueta.trim().length > L.recurso_etiqueta_max) falla(msg('recurso.etiqueta', { recurso, max: L.recurso_etiqueta_max }));
    if (r.descripcion !== undefined && (typeof r.descripcion !== 'string' || r.descripcion.trim().length > L.recurso_descripcion_max)) {
      falla(msg('recurso.descripcion', { recurso, max: L.recurso_descripcion_max }));
    }
    if (!POSICIONES_RECURSO.includes(r.posicion)) falla(msg('recurso.posicion', { recurso, valor: typeof r.posicion === 'string' ? r.posicion : '' }));
    if (typeof r.activo !== 'boolean') falla(msg('recurso.activoTipo', { recurso }));
    if (r.url !== undefined && typeof r.url !== 'string') falla(msg('recurso.urlTipo', { recurso }));
    else if (r.activo === true) {
      const url = typeof r.url === 'string' ? r.url.trim() : '';
      if (!url) falla(msg('recurso.activoSinUrl', { recurso }));
      else if (!urlDeRecursoValida(url)) falla(msg('recurso.activoUrlInvalida', { recurso, url }));
    }
  });
}

// Cada regla tiene clave propia (única entre parámetros, grupos, recursos y reglas) y un texto con la sintaxis de la sección 3.
function validarReglas(esquema, claves, ajustes, errores) {
  if (esquema.reglas === undefined) return;
  const L = ajustes.limites;
  const falla = mensaje => errores.push({ clave: 'reglas', mensaje });
  if (!Array.isArray(esquema.reglas)) return falla(msg('regla.lista', { max: L.reglas_max, total: 0 }));
  if (esquema.reglas.length > L.reglas_max) falla(msg('regla.lista', { max: L.reglas_max, total: esquema.reglas.length }));

  const ocupadas = new Set([...claves.keys(), ...clavesDeGrupos(esquema), ...recursosDelEsquema(esquema).map(r => r.clave)]);
  const vistos = new Set();
  esquema.reglas.forEach((r, i) => {
    if (!esObjeto(r)) return falla(msg('regla.invalida', { numero: i + 1 }));
    if (typeof r.clave !== 'string' || !CLAVE_RE.test(r.clave)) return falla(msg('regla.claveInvalida', { numero: i + 1 }));
    const regla = esTextoNoVacio(r.etiqueta) ? r.etiqueta.trim() : r.clave;
    if (VARIABLES_AUTOMATICAS.includes(r.clave)) falla(msg('regla.claveReservada', { clave: r.clave, regla }));
    else if (ocupadas.has(r.clave) || vistos.has(r.clave)) falla(msg('regla.claveRepetida', { clave: r.clave, regla }));
    vistos.add(r.clave);

    if (!esTextoNoVacio(r.etiqueta) || r.etiqueta.trim().length > L.regla_etiqueta_max) falla(msg('regla.etiqueta', { regla, max: L.regla_etiqueta_max }));
    if (!POSICIONES_REGLA.includes(r.posicion)) falla(msg('regla.posicion', { regla, valor: typeof r.posicion === 'string' ? r.posicion : '' }));
    if (typeof r.activo !== 'boolean') falla(msg('regla.activoTipo', { regla }));
    if (typeof r.texto !== 'string') falla(msg('regla.textoTipo', { regla }));
    else if (r.texto.length > L.regla_texto_max) falla(msg('regla.textoLargo', { regla, max: L.regla_texto_max, largo: r.texto.length }));
    else if (r.activo === true && !r.texto.trim()) falla(msg('regla.textoVacio', { regla }));
  });
}

// Los nombres que el sistema deriva (grupo_<g>_vacio y recurso_<r>) no pueden ser la clave de un grupo, parámetro o recurso.
function validarClavesDerivadas(esquema, claves, errores) {
  const vacios = new Map(clavesDeGrupos(esquema).map(g => [variableGrupoVacio(g), msg('esquema.origenGrupoVacio', { grupo: g })]));
  const recursos = new Map(recursosDelEsquema(esquema).map(r => [PREFIJO_RECURSO + r.clave, msg('esquema.origenRecurso', { recurso: r.clave })]));
  const choque = (clave, derivadas) => (typeof clave === 'string' ? derivadas.get(clave) : undefined);
  clavesDeGrupos(esquema).forEach(g => {
    const origen = choque(g, vacios) || choque(g, recursos);
    if (origen) errores.push({ clave: g, mensaje: msg('grupo.claveDerivada', { clave: g, variable: g, origen }) });
  });
  claves.forEach((p, clave) => {
    const origen = choque(clave, vacios);
    if (origen) errores.push({ clave, mensaje: msg('param.claveDerivada', { parametro: nombreDe(p), variable: clave, origen }) });
  });
  recursosDelEsquema(esquema).forEach(r => {
    const origen = choque(r.clave, vacios) || choque(r.clave, recursos);
    if (origen) errores.push({ clave: 'recursos', mensaje: msg('recurso.claveDerivada', { clave: r.clave, recurso: esTextoNoVacio(r.etiqueta) ? r.etiqueta.trim() : r.clave, variable: r.clave, origen }) });
  });
  reglasDelEsquema(esquema).forEach(r => {
    const origen = choque(r.clave, vacios) || choque(r.clave, recursos);
    if (origen) errores.push({ clave: 'reglas', mensaje: msg('regla.claveDerivada', { clave: r.clave, regla: esTextoNoVacio(r.etiqueta) ? r.etiqueta.trim() : r.clave, variable: r.clave, origen }) });
  });
}

/** @returns {{clave?: string, mensaje: string}[]} lista vacía si el esquema es válido */
function validarEsquema(esquema, ajustes) {
  const errores = [];
  if (!esObjeto(esquema)) return [{ mensaje: msg('esquema.noObjeto') }];
  if (esquema.esquema_version !== undefined && esquema.esquema_version !== 1) errores.push({ mensaje: msg('esquema.version', { version: verValor(esquema.esquema_version) }) });
  if (!Array.isArray(esquema.grupos)) return [...errores, { mensaje: msg('esquema.sinGrupos') }];

  const clavesGrupo = new Set();
  const parametros = [];
  esquema.grupos.forEach((g, i) => {
    const numero = i + 1;
    if (!esObjeto(g)) return errores.push({ mensaje: msg('grupo.noValido', { numero }) });
    if (typeof g.clave !== 'string' || !CLAVE_RE.test(g.clave)) errores.push({ clave: g.clave, mensaje: msg('grupo.clave', { numero, valor: verValor(g.clave) }) });
    else if (clavesGrupo.has(g.clave)) errores.push({ clave: g.clave, mensaje: msg('grupo.claveRepetida', { clave: g.clave }) });
    else clavesGrupo.add(g.clave);
    if (!esTextoNoVacio(g.etiqueta)) errores.push({ clave: g.clave, mensaje: msg('grupo.etiqueta', { numero }) });
    if (!Array.isArray(g.parametros)) return errores.push({ clave: g.clave, mensaje: msg('grupo.parametros', { numero }) });
    g.parametros.forEach(p => parametros.push(p));
  });

  const claves = new Map();
  const validos = [];
  parametros.forEach((p, i) => {
    if (!esObjeto(p)) return errores.push({ mensaje: msg('param.noValido', { numero: i + 1 }) });
    if (typeof p.clave !== 'string' || !CLAVE_RE.test(p.clave)) return errores.push({ clave: p.clave, mensaje: msg('param.clave', { numero: i + 1, valor: verValor(p.clave) }) });
    if (VARIABLES_AUTOMATICAS.includes(p.clave)) return errores.push({ clave: p.clave, mensaje: msg('param.reservada', { clave: p.clave, reservadas: VARIABLES_AUTOMATICAS.join(', ') }) });
    if (claves.has(p.clave)) return errores.push({ clave: p.clave, mensaje: msg('param.claveRepetida', { clave: p.clave }) });
    claves.set(p.clave, p);
    validos.push(p);
  });
  validos.forEach(p => {
    validarParametro(p, claves, errores, ajustes);
    if (hayCicloVisibilidad(claves, p.clave)) errores.push({ clave: p.clave, mensaje: msg('param.ciclo', { parametro: nombreDe(p) }) });
  });
  validarRecursos(esquema, claves, ajustes, errores);
  validarReglas(esquema, claves, ajustes, errores);
  validarClavesDerivadas(esquema, claves, errores);
  return errores;
}

// ---------- Valores efectivos y visibilidad ----------

function valorCrudo(p, valores, imagenes) {
  const tipo = tipoDe(p);
  if (tipo.destino === 'imagenes') return tiene(imagenes, p.clave) ? imagenes[p.clave] : tipo.valorAusente(p);
  if (tiene(valores, p.clave)) return valores[p.clave];
  if (p.defecto !== undefined) return p.defecto;
  return tipo.valorAusente(p);
}

/**
 * Qué parámetros están visibles y su valor efectivo (el enviado o su defecto), sin validar.
 * @returns {{ visibles: Map<string, boolean>, crudos: Map<string, any>, parametros: object[] }}
 */
function resolverVisibilidad(esquema, valores = {}, imagenes = {}) {
  const parametros = parametrosPlanos(esquema);
  const porClave = indexarPorClave(parametros);
  const vals = esObjeto(valores) ? valores : {};
  const imgs = esObjeto(imagenes) ? imagenes : {};
  const crudos = new Map(parametros.map(p => [p.clave, valorCrudo(p, vals, imgs)]));
  const cache = new Map();

  function visible(clave, ruta) {
    if (cache.has(clave)) return cache.get(clave);
    const p = porClave.get(clave);
    let resultado = true;
    if (p && esObjeto(p.visible_si)) {
      const ref = p.visible_si.parametro;
      resultado = !ruta.has(clave) && porClave.has(ref) && visible(ref, new Set(ruta).add(clave)) && crudos.get(ref) === p.visible_si.igual;
    }
    cache.set(clave, resultado);
    return resultado;
  }
  const visibles = new Map(parametros.map(p => [p.clave, visible(p.clave, new Set())]));
  return { visibles, crudos, parametros };
}

// Parámetros `imagenes` visibles, en el orden del esquema.
function listarImagenesVisibles(esquema, valores = {}, imagenes = {}) {
  const { visibles, parametros } = resolverVisibilidad(esquema, valores, imagenes);
  return parametros.filter(p => tipoDe(p).destino === 'imagenes' && visibles.get(p.clave));
}

// ---------- Validación de lo que envía el asesor ----------

/**
 * Valida lo que envía el asesor contra el esquema publicado.
 * @returns {{ errores: Object<string,string>, valores: object, imagenes: object }} valores e imágenes limpios (solo parámetros visibles)
 */
function validarValores(esquema, valores, imagenes, ajustes) {
  const errores = {};
  const vals = valores === undefined || valores === null ? {} : valores;
  const imgs = imagenes === undefined || imagenes === null ? {} : imagenes;
  if (!esObjeto(vals)) errores.valores = msg('valor.valoresObjeto');
  if (!esObjeto(imgs)) errores.imagenes = msg('valor.imagenesObjeto');
  if (Object.keys(errores).length) return { errores, valores: {}, imagenes: {} };

  const { visibles, crudos, parametros } = resolverVisibilidad(esquema, vals, imgs);
  const porClave = indexarPorClave(parametros);

  Object.keys(vals).forEach(k => {
    const p = porClave.get(k);
    if (!p) errores[k] = msg('valor.desconocido', { clave: k });
    else if (tipoDe(p).destino === 'imagenes') errores[k] = msg('valor.imagenesEnValores', { etiqueta: etiquetaDe(p) });
  });
  Object.keys(imgs).forEach(k => {
    const p = porClave.get(k);
    if (!p || tipoDe(p).destino !== 'imagenes') errores[k] = msg('valor.imagenesDesconocido', { clave: k });
  });

  const limpios = {};
  const limpiasImagenes = {};
  parametros.forEach(p => {
    const tipo = tipoDe(p);
    if (!visibles.get(p.clave) || tipo.destino === 'ninguno') return;
    if (errores[p.clave]) return;
    const { valor, error } = tipo.validarValor(p, crudos.get(p.clave), { ajustes });
    if (error) errores[p.clave] = error;
    else if (valor !== undefined) (tipo.destino === 'imagenes' ? limpiasImagenes : limpios)[p.clave] = valor;
  });
  return { errores, valores: limpios, imagenes: limpiasImagenes };
}

module.exports = {
  TIPOS,
  POSICIONES_RECURSO,
  POSICIONES_REGLA,
  validarEsquema,
  validarValores,
  resolverVisibilidad,
  listarImagenesVisibles,
  parametrosPlanos,
  clavesDeGrupos,
  recursosDelEsquema,
  reglasDelEsquema,
  indexarPorClave
};
