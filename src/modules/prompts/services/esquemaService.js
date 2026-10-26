// src/modules/prompts/services/esquemaService.js
// Funciones puras: validan el esquema de un producto y lo que envía el asesor.
const { VARIABLES_AUTOMATICAS } = require('../constantes');

const TIPOS = ['texto', 'texto_largo', 'numero', 'opciones', 'si_no', 'imagenes', 'calculado'];
const FORMATOS = ['png', 'jpg', 'svg', 'webp'];
const CLAVE_RE = /^[a-z][a-z0-9_]{1,59}$/;
const MAX_LARGO_TEXTO = 150;
const MAX_LARGO_TEXTO_LARGO = 600;
const MAX_LARGO_NOMBRE_IMAGEN = 150;
const MAX_IMAGENES_DEFECTO = 10;

const tiene = (objeto, clave) => Object.prototype.hasOwnProperty.call(objeto, clave);
const esObjeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const esTextoNoVacio = valor => typeof valor === 'string' && valor.trim() !== '';
const esNumero = valor => typeof valor === 'number' && Number.isFinite(valor);

function parametrosPlanos(esquema) {
  const grupos = esquema && Array.isArray(esquema.grupos) ? esquema.grupos : [];
  return grupos.flatMap(g => (g && Array.isArray(g.parametros) ? g.parametros : []));
}

function indexarPorClave(parametros) {
  return new Map(parametros.filter(p => p && typeof p.clave === 'string').map(p => [p.clave, p]));
}

// ---------- Validación del esquema ----------

function validarParametro(p, claves, errores) {
  const err = mensaje => errores.push({ clave: p.clave, mensaje });
  if (!esTextoNoVacio(p.etiqueta)) err('La etiqueta es obligatoria.');
  if (p.requerido !== undefined && typeof p.requerido !== 'boolean') err('«requerido» debe ser verdadero o falso.');
  if (p.ayuda !== undefined && typeof p.ayuda !== 'string') err('La ayuda debe ser texto.');

  if (p.visible_si !== undefined) {
    const v = p.visible_si;
    if (!esObjeto(v) || !tiene(v, 'igual')) err('«visible_si» debe tener «parametro» e «igual».');
    else if (!claves.has(v.parametro)) err(`«visible_si» apunta a «${v.parametro}», que no existe.`);
    else if (v.parametro === p.clave) err('«visible_si» no puede apuntar al mismo parámetro.');
  }

  switch (p.tipo) {
    case 'texto':
    case 'texto_largo':
      if (p.max_largo !== undefined && !(Number.isInteger(p.max_largo) && p.max_largo >= 1 && p.max_largo <= 5000)) err('«max_largo» debe ser un entero entre 1 y 5000.');
      if (p.separador !== undefined && !(typeof p.separador === 'string' && p.separador.length >= 1 && p.separador.length <= 5)) err('«separador» debe ser un texto de 1 a 5 caracteres.');
      break;
    case 'numero': {
      if (p.min !== undefined && !esNumero(p.min)) err('«min» debe ser un número.');
      if (p.max !== undefined && !esNumero(p.max)) err('«max» debe ser un número.');
      if (esNumero(p.min) && esNumero(p.max) && p.min > p.max) err('«min» no puede ser mayor que «max».');
      if (p.defecto !== undefined) {
        if (!esNumero(p.defecto)) err('«defecto» debe ser un número.');
        else if ((esNumero(p.min) && p.defecto < p.min) || (esNumero(p.max) && p.defecto > p.max)) err('«defecto» está fuera de «min» y «max».');
      }
      if (p.unidad_de !== undefined) {
        const unidad = claves.get(p.unidad_de);
        if (!unidad) err(`«unidad_de» apunta a «${p.unidad_de}», que no existe.`);
        else if (p.unidad_de === p.clave) err('«unidad_de» no puede apuntar al mismo parámetro.');
        else if (unidad.tipo !== 'opciones') err('«unidad_de» debe apuntar a un parámetro de tipo «opciones».');
      }
      break;
    }
    case 'opciones': {
      const opciones = Array.isArray(p.opciones) ? p.opciones : [];
      if (!opciones.length) { err('Debe tener al menos una opción.'); break; }
      const vistos = new Set();
      opciones.forEach(o => {
        if (!esObjeto(o) || !esTextoNoVacio(o.valor)) return err('Cada opción necesita un «valor».');
        if (vistos.has(o.valor)) err(`El valor «${o.valor}» de las opciones está repetido.`);
        vistos.add(o.valor);
        if (!esTextoNoVacio(o.etiqueta)) err(`La opción «${o.valor}» necesita una etiqueta.`);
        if (!esTextoNoVacio(o.texto_prompt)) err(`La opción «${o.valor}» necesita «texto_prompt».`);
      });
      if (p.defecto !== undefined && !vistos.has(p.defecto)) err('«defecto» debe ser el valor de una opción.');
      break;
    }
    case 'si_no':
      if (p.defecto !== undefined && typeof p.defecto !== 'boolean') err('«defecto» debe ser verdadero o falso.');
      break;
    case 'imagenes':
      if (p.max !== undefined && !(Number.isInteger(p.max) && p.max >= 1 && p.max <= 20)) err('«max» debe ser un entero entre 1 y 20.');
      if (p.max_mb !== undefined && !(esNumero(p.max_mb) && p.max_mb >= 1 && p.max_mb <= 10)) err('«max_mb» debe estar entre 1 y 10.');
      if (p.formatos !== undefined && !(Array.isArray(p.formatos) && p.formatos.length && p.formatos.every(f => FORMATOS.includes(f)))) {
        err(`«formatos» debe ser una lista con valores de: ${FORMATOS.join(', ')}.`);
      }
      break;
    case 'calculado':
      if (!claves.has(p.igual_a)) err(`«igual_a» apunta a «${p.igual_a}», que no existe.`);
      else if (p.igual_a === p.clave) err('«igual_a» no puede apuntar al mismo parámetro.');
      break;
    default:
      err(`Tipo «${p.tipo}» no válido. Tipos: ${TIPOS.join(', ')}.`);
  }
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

/** @returns {{clave?: string, mensaje: string}[]} lista vacía si el esquema es válido */
function validarEsquema(esquema) {
  const errores = [];
  if (!esObjeto(esquema)) return [{ mensaje: 'El esquema debe ser un objeto.' }];
  if (esquema.esquema_version !== undefined && esquema.esquema_version !== 1) errores.push({ mensaje: 'Versión de esquema no soportada.' });
  if (!Array.isArray(esquema.grupos)) return [...errores, { mensaje: 'El esquema debe tener una lista de grupos.' }];

  const clavesGrupo = new Set();
  const parametros = [];
  esquema.grupos.forEach((g, i) => {
    if (!esObjeto(g)) return errores.push({ mensaje: `El grupo ${i + 1} no es válido.` });
    if (typeof g.clave !== 'string' || !CLAVE_RE.test(g.clave)) errores.push({ clave: g.clave, mensaje: `La clave del grupo ${i + 1} no es válida (minúsculas, números y guion bajo).` });
    else if (clavesGrupo.has(g.clave)) errores.push({ clave: g.clave, mensaje: `La clave de grupo «${g.clave}» está repetida.` });
    else clavesGrupo.add(g.clave);
    if (!esTextoNoVacio(g.etiqueta)) errores.push({ clave: g.clave, mensaje: `El grupo ${i + 1} necesita una etiqueta.` });
    if (!Array.isArray(g.parametros)) return errores.push({ clave: g.clave, mensaje: `El grupo ${i + 1} necesita una lista de parámetros.` });
    g.parametros.forEach(p => parametros.push(p));
  });

  const claves = new Map();
  const validos = [];
  parametros.forEach((p, i) => {
    if (!esObjeto(p)) return errores.push({ mensaje: `El parámetro ${i + 1} no es válido.` });
    if (typeof p.clave !== 'string' || !CLAVE_RE.test(p.clave)) return errores.push({ clave: p.clave, mensaje: `La clave del parámetro ${i + 1} no es válida (minúsculas, números y guion bajo; 2 a 60 caracteres).` });
    if (VARIABLES_AUTOMATICAS.includes(p.clave)) return errores.push({ clave: p.clave, mensaje: `«${p.clave}» es una variable reservada del sistema.` });
    if (claves.has(p.clave)) return errores.push({ clave: p.clave, mensaje: `La clave «${p.clave}» está repetida.` });
    claves.set(p.clave, p);
    validos.push(p);
  });
  validos.forEach(p => {
    validarParametro(p, claves, errores);
    if (hayCicloVisibilidad(claves, p.clave)) errores.push({ clave: p.clave, mensaje: 'Las condiciones «visible_si» forman un ciclo.' });
  });
  return errores;
}

// ---------- Valores efectivos y visibilidad ----------

function valorCrudo(p, valores, imagenes) {
  if (p.tipo === 'imagenes') return tiene(imagenes, p.clave) ? imagenes[p.clave] : [];
  if (tiene(valores, p.clave)) return valores[p.clave];
  if (p.defecto !== undefined) return p.defecto;
  return p.tipo === 'si_no' ? false : undefined;
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
  return parametros.filter(p => p.tipo === 'imagenes' && visibles.get(p.clave));
}

// ---------- Validación de lo que envía el asesor ----------

function validarImagenes(p, lista, errores) {
  if (!Array.isArray(lista)) { errores[p.clave] = 'Debe ser una lista de nombres de archivo.'; return []; }
  const max = p.max || MAX_IMAGENES_DEFECTO;
  const formatos = p.formatos || FORMATOS;
  if (lista.length > max) { errores[p.clave] = `Máximo ${max} imágenes.`; return []; }
  const limpias = [];
  for (const nombre of lista) {
    const limpio = typeof nombre === 'string' ? nombre.trim() : '';
    if (!limpio || limpio.length > MAX_LARGO_NOMBRE_IMAGEN) { errores[p.clave] = `Cada nombre de imagen debe tener entre 1 y ${MAX_LARGO_NOMBRE_IMAGEN} caracteres.`; return []; }
    const extension = limpio.includes('.') ? limpio.split('.').pop().toLowerCase() : '';
    if (!formatos.includes(extension)) { errores[p.clave] = `Formato no permitido (${formatos.join(', ')}).`; return []; }
    limpias.push(limpio);
  }
  return limpias;
}

function validarValorSimple(p, crudo, errores) {
  const falta = () => { if (p.requerido) errores[p.clave] = 'Este dato es obligatorio.'; };
  switch (p.tipo) {
    case 'texto':
    case 'texto_largo': {
      if (crudo === undefined || crudo === null) return falta();
      if (typeof crudo !== 'string') { errores[p.clave] = 'Debe ser texto.'; return undefined; }
      const texto = crudo.trim();
      if (!texto) return falta();
      const max = p.max_largo || (p.tipo === 'texto' ? MAX_LARGO_TEXTO : MAX_LARGO_TEXTO_LARGO);
      if (texto.length > max) { errores[p.clave] = `No puede superar ${max} caracteres.`; return undefined; }
      return texto;
    }
    case 'numero':
      if (crudo === undefined || crudo === null) return falta();
      if (!esNumero(crudo)) { errores[p.clave] = 'Debe ser un número.'; return undefined; }
      if ((esNumero(p.min) && crudo < p.min) || (esNumero(p.max) && crudo > p.max)) {
        errores[p.clave] = `Debe estar entre ${p.min ?? '-∞'} y ${p.max ?? '∞'}.`;
        return undefined;
      }
      return crudo;
    case 'opciones':
      if (crudo === undefined || crudo === null || crudo === '') return falta();
      if (!(p.opciones || []).some(o => o.valor === crudo)) { errores[p.clave] = 'Opción no válida.'; return undefined; }
      return crudo;
    case 'si_no':
      if (typeof crudo !== 'boolean') { errores[p.clave] = 'Debe ser sí o no.'; return undefined; }
      return crudo;
    default:
      return undefined;
  }
}

/**
 * Valida lo que envía el asesor contra el esquema publicado.
 * @returns {{ errores: Object<string,string>, valores: object, imagenes: object }} valores e imágenes limpios (solo parámetros visibles)
 */
function validarValores(esquema, valores, imagenes) {
  const errores = {};
  const vals = valores === undefined || valores === null ? {} : valores;
  const imgs = imagenes === undefined || imagenes === null ? {} : imagenes;
  if (!esObjeto(vals)) errores.valores = 'Los valores deben ser un objeto.';
  if (!esObjeto(imgs)) errores.imagenes = 'Las imágenes deben ser un objeto.';
  if (Object.keys(errores).length) return { errores, valores: {}, imagenes: {} };

  const { visibles, crudos, parametros } = resolverVisibilidad(esquema, vals, imgs);
  const porClave = indexarPorClave(parametros);

  Object.keys(vals).forEach(k => {
    const p = porClave.get(k);
    if (!p) errores[k] = 'Parámetro desconocido.';
    else if (p.tipo === 'imagenes') errores[k] = 'Las imágenes van en «imagenes», no en «valores».';
  });
  Object.keys(imgs).forEach(k => {
    const p = porClave.get(k);
    if (!p || p.tipo !== 'imagenes') errores[k] = 'Parámetro de imágenes desconocido.';
  });

  const limpios = {};
  const limpiasImagenes = {};
  parametros.forEach(p => {
    if (!visibles.get(p.clave) || p.tipo === 'calculado') return;
    if (errores[p.clave]) return;
    const crudo = crudos.get(p.clave);
    if (p.tipo === 'imagenes') {
      const lista = validarImagenes(p, crudo, errores);
      if (lista.length) limpiasImagenes[p.clave] = lista;
      else if (p.requerido && !errores[p.clave]) errores[p.clave] = 'Agrega al menos una imagen.';
      return;
    }
    const valor = validarValorSimple(p, crudo, errores);
    if (valor !== undefined) limpios[p.clave] = valor;
  });
  return { errores, valores: limpios, imagenes: limpiasImagenes };
}

module.exports = {
  TIPOS,
  FORMATOS,
  validarEsquema,
  validarValores,
  resolverVisibilidad,
  listarImagenesVisibles,
  parametrosPlanos,
  indexarPorClave
};
