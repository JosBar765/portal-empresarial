// src/modules/prompts/services/ajustesEsquema.js
// Funciones puras: la FORMA permitida de cada ajuste global (el contenido vive en la tabla prompt_ajustes).
const { msg } = require('../mensajes');
const { decidirOrigen } = require('./recursos');

const MAX_TEXTO = 2000;
const MAX_TEXTO_CORTO = 300;
const MARCADOR_RE = /\{([a-z_]+)\}/g;

// Marcadores de cada texto: obligatorios y opcionales.
const T = (requeridos = [], opcionales = []) => ({ requeridos, opcionales });
const TEXTOS_PROMPT = Object.freeze({
  imagen_ref: T(['numero']),
  imagen_detalle: T(['detalle']),
  detalle_ubicacion: T(['ubicacion']),
  detalle_union: T(),
  union: T(),
  union_final: T(),
  lista_linea: T(['numero', 'origen', 'descripcion'], ['ubicacion']),
  lista_ubicacion: T(['ubicacion']),
  lista_sin_descripcion: T(),
  total_uno: T(['n']),
  total_varios: T(['n']),
  si: T(),
  no: T(),
  frase_comillas: T(['frase']),
  frases_union: T(),
  numero_unidad: T(['valor', 'unidad']),
  extras_titulo: T(),
  extras_grupo: T(['grupo']),
  extras_linea: T(['etiqueta', 'valor']),
  imagenes_titulo: T(),
  imagenes_intro: T(['total'])
});

const TEXTOS_ASESOR = Object.freeze({
  aviso_pegado: T(),
  aviso_exceso_imagenes: T(['limite', 'total']),
  nota_prompt_nuevo: T(),
  nota_orden_imagenes: T()
});

const LIMITES = Object.freeze([
  'gemini_max_imagenes', 'plantilla_max_largo', 'texto_max_largo_defecto', 'texto_largo_max_largo_defecto', 'max_largo_tope',
  'separador_max', 'imagenes_max_defecto', 'imagenes_max_tope', 'imagenes_mb_defecto', 'imagenes_mb_tope',
  'imagen_nombre_max', 'imagen_descripcion_max', 'lista_max_items', 'ubicacion_max', 'sugerencia_max',
  'producto_nombre_max', 'producto_descripcion_max', 'recurso_max_mb', 'recurso_timeout_ms', 'recursos_max',
  'recurso_etiqueta_max', 'recurso_descripcion_max', 'regla_etiqueta_max', 'regla_texto_max', 'reglas_max', 'recursos_min_publicar'
]); // plantilla_max_largo quedó sin uso (deprecado) pero sigue en la forma hasta que una migración la retire

// Cada «*_defecto» no puede superar su «*_tope».
const PARES_DEFECTO_TOPE = Object.freeze([
  ['texto_max_largo_defecto', 'max_largo_tope'],
  ['texto_largo_max_largo_defecto', 'max_largo_tope'],
  ['imagenes_max_defecto', 'imagenes_max_tope'],
  ['imagenes_mb_defecto', 'imagenes_mb_tope'],
  ['recursos_min_publicar', 'recursos_max']
]);

const CONTACTO = Object.freeze({ nombre: false, correo: false, telefono: true }); // true = puede quedar vacío

// Rangos de la marca de agua: [mínimo, máximo] de cada número.
const MARCA_TEXTO_MAX = 60;
const MARCA_RANGOS = Object.freeze({
  opacidad: [0.05, 0.6],
  angulo: [-90, 90],
  escala: [0.1, 0.8],
  separacion: [0.5, 5]
});
const MARCA_CAMPOS = Object.freeze(['texto', 'logo_url', ...Object.keys(MARCA_RANGOS), 'color']);

const CLAVES = Object.freeze([
  'encabezado_sistema', 'textos_prompt', 'limites', 'formatos_imagen', 'textos_asesor', 'contacto_ejemplo', 'marca_de_agua'
]);

// Migración que siembra cada ajuste (para el mensaje cuando falta).
const MIGRACION_DE = Object.freeze({ marca_de_agua: 'prompts_ajuste_marca_de_agua' });
const migracionDe = clave => MIGRACION_DE[clave] || 'prompts_ajustes';

const esObjeto = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const tiene = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const lista = nombres => nombres.join(', ');
const marcadores = texto => [...texto.matchAll(MARCADOR_RE)].map(m => m[1]);

// ---------- Textos con marcadores ----------

function validarTextoConMarcadores(clave, subclave, texto, forma, errores) {
  const validos = [...forma.requeridos, ...forma.opcionales];
  const textoValidos = validos.length ? validos.map(m => `{${m}}`).join(', ') : 'ninguno';
  const usados = new Set(marcadores(texto));
  usados.forEach(m => {
    if (!validos.includes(m)) errores.push(msg('ajuste.marcadorDesconocido', { subclave, marcador: `{${m}}`, validos: textoValidos }));
  });
  forma.requeridos.forEach(m => {
    if (!usados.has(m)) errores.push(msg('ajuste.marcadorFalta', { subclave, marcador: `{${m}}` }));
  });
  const resto = texto.replace(MARCADOR_RE, '');
  if (/[{}]/.test(resto)) errores.push(msg('ajuste.llaveSuelta', { subclave, validos: textoValidos }));
}

// Objeto de textos con claves exactas (todas obligatorias, ninguna de más).
function validarObjetoDeTextos(clave, valor, formas) {
  const errores = [];
  const validas = Object.keys(formas);
  if (!esObjeto(valor)) return [msg('ajuste.objeto', { clave, claves: lista(validas) })];
  Object.keys(valor).forEach(k => {
    if (!tiene(formas, k)) errores.push(msg('ajuste.subtextoDesconocido', { clave, subclave: k, validas: lista(validas) }));
  });
  validas.forEach(k => {
    if (!tiene(valor, k)) return errores.push(msg('ajuste.subtextoFalta', { clave, subclave: k }));
    const texto = valor[k];
    if (typeof texto !== 'string' || !texto.length || texto.length > MAX_TEXTO_CORTO) {
      return errores.push(msg('ajuste.subtextoTipo', { clave, subclave: k, max: MAX_TEXTO_CORTO }));
    }
    validarTextoConMarcadores(clave, k, texto, formas[k], errores);
  });
  return errores;
}

// ---------- Límites ----------

function validarLimites(valor) {
  const errores = [];
  if (!esObjeto(valor)) return [msg('ajuste.objeto', { clave: 'limites', claves: lista(LIMITES) })];
  Object.keys(valor).forEach(k => {
    if (!LIMITES.includes(k)) errores.push(msg('ajuste.limiteDesconocido', { subclave: k, validas: lista(LIMITES) }));
  });
  const enteros = [];
  LIMITES.forEach(k => {
    if (!tiene(valor, k)) return errores.push(msg('ajuste.limiteFalta', { subclave: k }));
    if (!Number.isInteger(valor[k]) || valor[k] < 1) return errores.push(msg('ajuste.limiteEntero', { subclave: k, valor: JSON.stringify(valor[k]) }));
    enteros.push(k);
  });
  const ok = k => enteros.includes(k);
  PARES_DEFECTO_TOPE.forEach(([defecto, tope]) => {
    if (ok(defecto) && ok(tope) && valor[defecto] > valor[tope]) {
      errores.push(msg('ajuste.limiteTope', { defecto, valorDefecto: valor[defecto], tope, valorTope: valor[tope] }));
    }
  });
  const maximo = (k, tope, motivo) => {
    if (ok(k) && valor[k] > tope) errores.push(msg('ajuste.limiteMaximo', { subclave: k, valor: valor[k], maximo: tope, motivo }));
  };
  maximo('producto_nombre_max', 100, 'la columna «nombre» de la base de datos tiene 100 caracteres');
  maximo('producto_descripcion_max', 255, 'la columna «descripcion» de la base de datos tiene 255 caracteres');
  maximo('imagenes_mb_tope', 20, 'el servidor no acepta archivos más grandes');
  if (ok('recurso_timeout_ms') && (valor.recurso_timeout_ms < 1000 || valor.recurso_timeout_ms > 60000)) {
    errores.push(msg('ajuste.limiteRango', { subclave: 'recurso_timeout_ms', min: 1000, max: 60000, valor: valor.recurso_timeout_ms }));
  }
  return errores;
}

// ---------- Formatos de imagen ----------

function validarFormatos(valor) {
  if (!esObjeto(valor) || !Object.keys(valor).length) return [msg('ajuste.formatosVacio')];
  const errores = [];
  Object.entries(valor).forEach(([formato, def]) => {
    if (!/^[a-z0-9]{2,10}$/.test(formato)) errores.push(msg('ajuste.formatoClave', { formato }));
    const ext = esObjeto(def) ? def.extensiones : undefined;
    if (!Array.isArray(ext) || !ext.length || !ext.every(e => typeof e === 'string' && /^[a-z0-9]+$/.test(e))) {
      errores.push(msg('ajuste.formatoExtensiones', { formato }));
    }
    const mime = esObjeto(def) ? def.mime : undefined;
    if (typeof mime !== 'string' || !/^image\/[a-z0-9.+-]+$/.test(mime)) {
      errores.push(msg('ajuste.formatoMime', { formato, valor: typeof mime === 'string' ? mime : '' }));
    }
  });
  return errores;
}

// ---------- Contacto de ejemplo ----------

function validarContacto(valor) {
  const campos = Object.keys(CONTACTO);
  if (!esObjeto(valor)) return [msg('ajuste.objeto', { clave: 'contacto_ejemplo', claves: lista(campos) })];
  const errores = [];
  Object.keys(valor).forEach(k => {
    if (!tiene(CONTACTO, k)) errores.push(msg('ajuste.subtextoDesconocido', { clave: 'contacto_ejemplo', subclave: k, validas: lista(campos) }));
  });
  campos.forEach(k => {
    const puedeVacio = CONTACTO[k];
    const v = valor[k];
    if (typeof v !== 'string' || v.length > MAX_TEXTO_CORTO || (!puedeVacio && !v.trim())) {
      errores.push(msg(puedeVacio ? 'ajuste.subtextoTipoVacio' : 'ajuste.subtextoTipo', { clave: 'contacto_ejemplo', subclave: k, max: MAX_TEXTO_CORTO }));
    }
  });
  return errores;
}

// ---------- Marca de agua ----------

// El logo sigue la regla de los recursos: ruta /assets/ o https del host de SUPABASE_URL.
function validarLogo(url, urlSupabase) {
  if (typeof url === 'string' && decidirOrigen(url, urlSupabase).tipo !== 'rechazada') return [];
  let host = '';
  try { host = new URL(urlSupabase).host; } catch { host = ''; }
  return [msg(host ? 'ajuste.marcaLogo' : 'ajuste.marcaLogoSinAlmacenamiento', { valor: typeof url === 'string' ? url : '', host })];
}

function validarMarca(valor, urlSupabase) {
  if (!esObjeto(valor)) return [msg('ajuste.objeto', { clave: 'marca_de_agua', claves: lista(MARCA_CAMPOS) })];
  const errores = [];
  Object.keys(valor).forEach(k => {
    if (!MARCA_CAMPOS.includes(k)) errores.push(msg('ajuste.subtextoDesconocido', { clave: 'marca_de_agua', subclave: k, validas: lista(MARCA_CAMPOS) }));
  });
  MARCA_CAMPOS.filter(k => !tiene(valor, k)).forEach(k => errores.push(msg('ajuste.subtextoFalta', { clave: 'marca_de_agua', subclave: k })));
  if (tiene(valor, 'texto') && (typeof valor.texto !== 'string' || !valor.texto.trim() || valor.texto.length > MARCA_TEXTO_MAX)) {
    errores.push(msg('ajuste.subtextoTipo', { clave: 'marca_de_agua', subclave: 'texto', max: MARCA_TEXTO_MAX }));
  }
  if (tiene(valor, 'logo_url')) errores.push(...validarLogo(valor.logo_url, urlSupabase));
  Object.entries(MARCA_RANGOS).forEach(([k, [min, max]]) => {
    if (!tiene(valor, k)) return;
    const v = valor[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      errores.push(msg('ajuste.marcaRango', { subclave: k, min, max, valor: JSON.stringify(v) }));
    }
  });
  if (tiene(valor, 'color') && (typeof valor.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(valor.color))) {
    errores.push(msg('ajuste.marcaColor', { valor: JSON.stringify(valor.color) }));
  }
  return errores;
}

// ---------- API ----------

/**
 * @param {{urlSupabase?: string}} [contexto] host permitido para el logo de la marca de agua
 * @returns {string[]} mensajes explicativos; lista vacía si el valor tiene la forma correcta
 */
function validarAjuste(clave, valor, contexto = {}) {
  switch (clave) {
    case 'encabezado_sistema':
      return typeof valor === 'string' && valor.trim() && valor.length <= MAX_TEXTO ? [] : [msg('ajuste.texto', { clave, max: MAX_TEXTO })];
    case 'textos_prompt': return validarObjetoDeTextos(clave, valor, TEXTOS_PROMPT);
    case 'textos_asesor': return validarObjetoDeTextos(clave, valor, TEXTOS_ASESOR);
    case 'limites': return validarLimites(valor);
    case 'formatos_imagen': return validarFormatos(valor);
    case 'contacto_ejemplo': return validarContacto(valor);
    case 'marca_de_agua': return validarMarca(valor, contexto.urlSupabase);
    default: return [msg('ajuste.noExiste', { clave, disponibles: lista(CLAVES) })];
  }
}

/** Valida el conjunto completo ya leído de la tabla: {clave: valor}. */
function validarConjunto(ajustes, contexto = {}) {
  return CLAVES.flatMap(clave => (ajustes && tiene(ajustes, clave)
    ? validarAjuste(clave, ajustes[clave], contexto)
    : [msg('ajuste.faltante', { clave, migracion: migracionDe(clave) })]));
}

module.exports = { CLAVES, TEXTOS_PROMPT, TEXTOS_ASESOR, LIMITES, MARCA_RANGOS, migracionDe, validarAjuste, validarConjunto };
