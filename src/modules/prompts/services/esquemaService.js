// src/modules/prompts/services/esquemaService.js
// Funciones puras: validan el esquema de un producto y lo que envía el asesor.
const { VARIABLES_AUTOMATICAS, PREFIJO_RECURSO, variableGrupoVacio } = require('../constantes');
const { msg } = require('../mensajes');
const { urlDeRecursoValida } = require('./recursos');

const TIPOS = ['texto', 'texto_largo', 'numero', 'opciones', 'si_no', 'imagenes', 'calculado'];
const CLAVE_RE = /^[a-z][a-z0-9_]{1,59}$/;
const POSICIONES_RECURSO = ['inicio', 'fin'];

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

// «Etiqueta» (clave): así el mensaje nombra el parámetro como lo ve el administrador.
const nombreDe = p => (esTextoNoVacio(p.etiqueta) ? `«${p.etiqueta.trim()}» (${p.clave})` : `«${p.clave}»`);
// El asesor ve solo la etiqueta; la clave no le dice nada.
const etiquetaDe = p => (esTextoNoVacio(p.etiqueta) ? p.etiqueta.trim() : p.clave);
const verValor = valor => (valor === undefined ? 'ninguno' : JSON.stringify(valor)); // el dato recibido, tal cual, para que se vea el error

// ---------- Validación del esquema ----------

// Lista opcional de textos cortos y únicos (ubicaciones, sugerencias).
function validarListaTextos(p, campo, maxLargo, err, maxItems) {
  const lista = p[campo];
  if (lista === undefined) return;
  const parametro = nombreDe(p);
  if (!Array.isArray(lista) || lista.length > maxItems) return err(msg('param.lista', { parametro, campo, max: maxItems }));
  const vistos = new Set();
  for (const texto of lista) {
    if (!esTextoNoVacio(texto) || texto.trim().length > maxLargo) return err(msg('param.listaElemento', { parametro, campo, max: maxLargo }));
    if (vistos.has(texto.trim())) return err(msg('param.listaRepetido', { parametro, campo, texto: texto.trim() }));
    vistos.add(texto.trim());
  }
}

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

  switch (p.tipo) {
    case 'texto':
    case 'texto_largo':
      if (p.max_largo !== undefined && !(Number.isInteger(p.max_largo) && p.max_largo >= 1 && p.max_largo <= L.max_largo_tope)) {
        err(msg('param.maxLargo', { parametro, tope: L.max_largo_tope, valor: JSON.stringify(p.max_largo) }));
      }
      if (p.separador !== undefined && !(typeof p.separador === 'string' && p.separador.length >= 1 && p.separador.length <= L.separador_max)) {
        err(msg('param.separador', { parametro, max: L.separador_max }));
      }
      break;
    case 'numero': {
      if (p.min !== undefined && !esNumero(p.min)) err(msg('param.minTipo', { parametro }));
      if (p.max !== undefined && !esNumero(p.max)) err(msg('param.maxTipo', { parametro }));
      if (esNumero(p.min) && esNumero(p.max) && p.min > p.max) err(msg('param.minMayorQueMax', { parametro, min: p.min, max: p.max }));
      if (p.defecto !== undefined) {
        if (!esNumero(p.defecto)) err(msg('param.defectoNumero', { parametro }));
        else if ((esNumero(p.min) && p.defecto < p.min) || (esNumero(p.max) && p.defecto > p.max)) err(msg('param.defectoFueraDeRango', { parametro, defecto: p.defecto }));
      }
      if (p.unidad_de !== undefined) {
        const unidad = claves.get(p.unidad_de);
        if (!unidad) err(msg('param.unidadNoExiste', { parametro, destino: String(p.unidad_de) }));
        else if (p.unidad_de === p.clave) err(msg('param.unidadMismo', { parametro }));
        else if (unidad.tipo !== 'opciones') err(msg('param.unidadTipo', { parametro, destino: p.unidad_de, tipo: String(unidad.tipo) }));
      }
      break;
    }
    case 'opciones': {
      const opciones = Array.isArray(p.opciones) ? p.opciones : [];
      if (!opciones.length) { err(msg('param.opcionesVacio', { parametro })); break; }
      const vistos = new Set();
      opciones.forEach(o => {
        if (!esObjeto(o) || !esTextoNoVacio(o.valor)) return err(msg('param.opcionValor', { parametro }));
        if (vistos.has(o.valor)) err(msg('param.opcionRepetida', { parametro, valor: o.valor }));
        vistos.add(o.valor);
        if (!esTextoNoVacio(o.etiqueta)) err(msg('param.opcionEtiqueta', { parametro, valor: o.valor }));
        if (!esTextoNoVacio(o.texto_prompt)) err(msg('param.opcionTexto', { parametro, valor: o.valor }));
      });
      if (p.defecto !== undefined && !vistos.has(p.defecto)) err(msg('param.defectoOpcion', { parametro }));
      break;
    }
    case 'si_no':
      if (p.defecto !== undefined && typeof p.defecto !== 'boolean') err(msg('param.defectoBooleano', { parametro }));
      break;
    case 'imagenes':
      if (p.max !== undefined && !(Number.isInteger(p.max) && p.max >= 1 && p.max <= L.imagenes_max_tope)) err(msg('param.imagenesMax', { parametro, tope: L.imagenes_max_tope }));
      if (p.max_mb !== undefined && !(esNumero(p.max_mb) && p.max_mb >= 1 && p.max_mb <= L.imagenes_mb_tope)) err(msg('param.imagenesMb', { parametro, tope: L.imagenes_mb_tope }));
      if (p.formatos !== undefined && !(Array.isArray(p.formatos) && p.formatos.length && p.formatos.every(f => tiene(ajustes.formatos_imagen, f)))) {
        err(msg('param.formatos', { parametro, validos: Object.keys(ajustes.formatos_imagen).join(', ') }));
      }
      validarListaTextos(p, 'ubicaciones', L.ubicacion_max, err, L.lista_max_items);
      validarListaTextos(p, 'sugerencias', L.sugerencia_max, err, L.lista_max_items);
      break;
    case 'calculado':
      if (!claves.has(p.igual_a)) err(msg('param.igualANoExiste', { parametro, destino: String(p.igual_a) }));
      else if (p.igual_a === p.clave) err(msg('param.igualAMismo', { parametro }));
      break;
    default:
      err(msg('param.tipoInvalido', { parametro, tipo: String(p.tipo), tipos: TIPOS.join(', ') }));
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
  validarClavesDerivadas(esquema, claves, errores);
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

// Cada imagen es { nombre, descripcion?, ubicacion? }; un texto suelto se toma como el nombre.
function validarImagenes(p, lista, errores, ajustes) {
  const L = ajustes.limites;
  const etiqueta = etiquetaDe(p);
  if (!Array.isArray(lista)) { errores[p.clave] = msg('valor.imagenesLista', { etiqueta }); return []; }
  const max = p.max || L.imagenes_max_defecto;
  const formatos = p.formatos || Object.keys(ajustes.formatos_imagen);
  const extensiones = formatos.flatMap(f => (ajustes.formatos_imagen[f] ? ajustes.formatos_imagen[f].extensiones : []));
  const ubicaciones = Array.isArray(p.ubicaciones) ? p.ubicaciones : [];
  if (lista.length > max) { errores[p.clave] = msg('valor.imagenesMax', { etiqueta, max, total: lista.length, sobran: lista.length - max }); return []; }
  const falla = mensaje => { errores[p.clave] = mensaje; return []; };
  const limpias = [];
  for (const crudo of lista) {
    const item = typeof crudo === 'string' ? { nombre: crudo } : crudo;
    if (!esObjeto(item)) return falla(msg('valor.imagenForma', { etiqueta }));
    const nombre = typeof item.nombre === 'string' ? item.nombre.trim() : '';
    if (!nombre || nombre.length > L.imagen_nombre_max) return falla(msg('valor.imagenNombre', { etiqueta, max: L.imagen_nombre_max }));
    const extension = nombre.includes('.') ? nombre.split('.').pop().toLowerCase() : '';
    if (!extensiones.includes(extension)) return falla(msg('valor.imagenFormato', { nombre, etiqueta, permitidas: extensiones.join(', ') }));

    const limpia = { nombre };
    if (item.descripcion !== undefined && item.descripcion !== null) {
      const descripcion = typeof item.descripcion === 'string' ? item.descripcion.trim() : null;
      if (descripcion === null) return falla(msg('valor.imagenDescripcionTipo', { nombre }));
      if (descripcion.length > L.imagen_descripcion_max) return falla(msg('valor.imagenDescripcion', { nombre, max: L.imagen_descripcion_max, largo: descripcion.length }));
      if (descripcion) limpia.descripcion = descripcion;
    }
    if (item.ubicacion !== undefined && item.ubicacion !== null && ubicaciones.length) {
      const ubicacion = typeof item.ubicacion === 'string' ? item.ubicacion.trim() : null;
      if (ubicacion === null || (ubicacion && !ubicaciones.includes(ubicacion))) {
        return falla(msg('valor.imagenUbicacion', { nombre, etiqueta, valor: verValor(item.ubicacion), permitidas: ubicaciones.join(', ') }));
      }
      if (ubicacion) limpia.ubicacion = ubicacion;
    }
    limpias.push(limpia);
  }
  return limpias;
}

function validarValorSimple(p, crudo, errores, ajustes) {
  const etiqueta = etiquetaDe(p);
  const falta = () => { if (p.requerido) errores[p.clave] = msg('valor.obligatorio', { etiqueta }); };
  switch (p.tipo) {
    case 'texto':
    case 'texto_largo': {
      if (crudo === undefined || crudo === null) return falta();
      if (typeof crudo !== 'string') { errores[p.clave] = msg('valor.texto', { etiqueta }); return undefined; }
      const texto = crudo.trim();
      if (!texto) return falta();
      const max = p.max_largo || (p.tipo === 'texto' ? ajustes.limites.texto_max_largo_defecto : ajustes.limites.texto_largo_max_largo_defecto);
      if (texto.length > max) { errores[p.clave] = msg('valor.textoLargo', { etiqueta, max, largo: texto.length }); return undefined; }
      return texto;
    }
    case 'numero':
      if (crudo === undefined || crudo === null) return falta();
      if (!esNumero(crudo)) { errores[p.clave] = msg('valor.numero', { etiqueta }); return undefined; }
      if ((esNumero(p.min) && crudo < p.min) || (esNumero(p.max) && crudo > p.max)) {
        const clave = esNumero(p.min) && esNumero(p.max) ? 'valor.rangoEntre' : (esNumero(p.min) ? 'valor.rangoMinimo' : 'valor.rangoMaximo');
        errores[p.clave] = msg(clave, { etiqueta, min: p.min, max: p.max, valor: crudo });
        return undefined;
      }
      return crudo;
    case 'opciones': {
      if (crudo === undefined || crudo === null || crudo === '') return falta();
      const permitidas = (p.opciones || []).map(o => o.valor);
      if (!permitidas.includes(crudo)) { errores[p.clave] = msg('valor.opcion', { etiqueta, valor: verValor(crudo), permitidas: permitidas.join(', ') }); return undefined; }
      return crudo;
    }
    case 'si_no':
      if (typeof crudo !== 'boolean') { errores[p.clave] = msg('valor.siNo', { etiqueta }); return undefined; }
      return crudo;
    default:
      return undefined;
  }
}

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
    else if (p.tipo === 'imagenes') errores[k] = msg('valor.imagenesEnValores', { etiqueta: etiquetaDe(p) });
  });
  Object.keys(imgs).forEach(k => {
    const p = porClave.get(k);
    if (!p || p.tipo !== 'imagenes') errores[k] = msg('valor.imagenesDesconocido', { clave: k });
  });

  const limpios = {};
  const limpiasImagenes = {};
  parametros.forEach(p => {
    if (!visibles.get(p.clave) || p.tipo === 'calculado') return;
    if (errores[p.clave]) return;
    const crudo = crudos.get(p.clave);
    if (p.tipo === 'imagenes') {
      const lista = validarImagenes(p, crudo, errores, ajustes);
      if (lista.length) limpiasImagenes[p.clave] = lista;
      else if (p.requerido && !errores[p.clave]) errores[p.clave] = msg('valor.imagenesObligatorio', { etiqueta: etiquetaDe(p) });
      return;
    }
    const valor = validarValorSimple(p, crudo, errores, ajustes);
    if (valor !== undefined) limpios[p.clave] = valor;
  });
  return { errores, valores: limpios, imagenes: limpiasImagenes };
}

module.exports = {
  TIPOS,
  POSICIONES_RECURSO,
  validarEsquema,
  validarValores,
  resolverVisibilidad,
  listarImagenesVisibles,
  parametrosPlanos,
  clavesDeGrupos,
  recursosDelEsquema,
  indexarPorClave
};
