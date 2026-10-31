// Operaciones puras (sin DOM) sobre el esquema del producto; nunca mutan sus argumentos.
// Los mensajes salen de textos.js (también sin DOM); los límites llegan por parámetro desde /config.
import { t } from '../../textos.js';
import { CLAVE_RE, TIPOS, PREFIJO_RECURSO, PREFIJO_GRUPO, SUFIJO_GRUPO_VACIO } from './reglasEsquema.js';

export const etiquetaDeTipo = (tipo) => (TIPOS.includes(tipo) ? t(`admin.tipos.${tipo}`) : tipo);

export const claveValida = (clave) => CLAVE_RE.test(clave || '');

export const clavesDelEsquema = (esquema) => esquema.grupos.flatMap(g => g.parametros.map(p => p.clave));

export const clavesDeRecursos = (esquema) => (esquema.recursos || []).map(r => r.clave);

export const clavesDeReglas = (esquema) => (esquema.reglas || []).map(r => r.clave);

// Variable que el sistema genera por cada grupo: verdadera cuando el grupo no tiene ningún dato.
export const variableGrupoVacio = (clave) => `${PREFIJO_GRUPO}${clave}${SUFIJO_GRUPO_VACIO}`;

// Nombres que genera el sistema (grupo_<g>_vacio y recurso_<r>): ninguna clave puede ser uno de ellos.
export const claveReservadaPorSistema = (esquema, clave) =>
  esquema.grupos.some(g => variableGrupoVacio(g.clave) === clave) || clavesDeRecursos(esquema).some(r => PREFIJO_RECURSO + r === clave);

// `claveActual` permite conservar la propia clave al editar un parámetro.
// Un parámetro tampoco puede llamarse como un recurso ni como una variable que genera el sistema.
export function claveDisponible(esquema, clave, claveActual = null) {
  if (!claveValida(clave)) return false;
  if (clave === claveActual) return true;
  return !clavesDelEsquema(esquema).includes(clave) && !clavesDeRecursos(esquema).includes(clave) && !clavesDeReglas(esquema).includes(clave) && !claveReservadaPorSistema(esquema, clave);
}

// Un grupo nuevo crearía grupo_<clave>_vacio: no puede chocar con una clave que ya exista.
const variableGrupoOcupada = (esquema, clave) =>
  [...clavesDelEsquema(esquema), ...clavesDeRecursos(esquema), ...clavesDeReglas(esquema)].includes(variableGrupoVacio(clave));

export const claveGrupoDisponible = (esquema, clave) =>
  claveValida(clave) && !esquema.grupos.some(g => g.clave === clave) && !clavesDeReglas(esquema).includes(clave) && !claveReservadaPorSistema(esquema, clave) && !variableGrupoOcupada(esquema, clave);

// Mensaje explicativo de por qué no sirve la clave de un grupo.
export function errorClaveGrupo(esquema, clave) {
  if (claveValida(clave) && claveReservadaPorSistema(esquema, clave)) return t('admin.errores.claveDerivada', { nombre: clave, clave });
  if (claveValida(clave) && variableGrupoOcupada(esquema, clave)) return t('admin.errores.grupoClaveChoque', { clave, variable: variableGrupoVacio(clave) });
  return t('admin.errores.grupoClave', { clave });
}

export const contarParametros = (esquema) => esquema.grupos.reduce((n, g) => n + g.parametros.length, 0);

export const contarRecursos = (esquema) => (esquema.recursos || []).length;

export const contarReglas = (esquema) => (esquema.reglas || []).length;

// Sugiere una clave snake_case a partir de la etiqueta.
export function claveDesdeEtiqueta(etiqueta) {
  const base = String(etiqueta || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return (/^[a-z]/.test(base) ? base : base ? `p_${base}` : '').slice(0, 60);
}

const errorClaveParametro = (esquema, clave) => (claveValida(clave) && claveReservadaPorSistema(esquema, clave)
  ? t('admin.errores.claveDerivada', { nombre: clave, clave })
  : t('admin.errores.parametroClaveNoDisponible', { clave }));

function buscarGrupo(esquema, clave) {
  const i = esquema.grupos.findIndex(g => g.clave === clave);
  if (i < 0) throw new Error(t('admin.errores.grupoNoExiste', { clave }));
  return i;
}

const conGrupos = (esquema, grupos) => ({ ...esquema, grupos });

export function intercambiar(lista, i, delta) {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const copia = lista.slice();
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

export function agregarGrupo(esquema, { clave, etiqueta }) {
  if (!String(etiqueta || '').trim()) throw new Error(t('admin.errores.grupoEtiquetaVacia'));
  if (!claveGrupoDisponible(esquema, clave)) throw new Error(errorClaveGrupo(esquema, clave));
  return conGrupos(esquema, [...esquema.grupos, { clave, etiqueta: etiqueta.trim(), parametros: [] }]);
}

export function renombrarGrupo(esquema, clave, etiqueta) {
  if (!String(etiqueta || '').trim()) throw new Error(t('admin.errores.grupoEtiquetaVacia'));
  const i = buscarGrupo(esquema, clave);
  return conGrupos(esquema, esquema.grupos.map((g, k) => (k === i ? { ...g, etiqueta: etiqueta.trim() } : g)));
}

export function eliminarGrupo(esquema, clave) {
  const i = buscarGrupo(esquema, clave);
  const grupo = esquema.grupos[i];
  if (grupo.parametros.length) throw new Error(t('admin.errores.grupoNoVacio', { etiqueta: grupo.etiqueta, n: grupo.parametros.length }));
  return conGrupos(esquema, esquema.grupos.filter((_, k) => k !== i));
}

export function moverGrupo(esquema, clave, delta) {
  return conGrupos(esquema, intercambiar(esquema.grupos, buscarGrupo(esquema, clave), delta));
}

export function agregarParametro(esquema, grupoClave, parametro) {
  const i = buscarGrupo(esquema, grupoClave);
  if (!claveDisponible(esquema, parametro.clave)) throw new Error(errorClaveParametro(esquema, parametro.clave));
  return conGrupos(esquema, esquema.grupos.map((g, k) => (k === i ? { ...g, parametros: [...g.parametros, parametro] } : g)));
}

function ubicar(esquema, clave) {
  for (let gi = 0; gi < esquema.grupos.length; gi++) {
    const pi = esquema.grupos[gi].parametros.findIndex(p => p.clave === clave);
    if (pi >= 0) return { gi, pi };
  }
  throw new Error(t('admin.errores.parametroNoExiste', { clave }));
}

// Si la clave cambia, actualiza las referencias de los demás parámetros.
function reapuntar(p, vieja, nueva) {
  const copia = { ...p };
  if (p.visible_si && p.visible_si.parametro === vieja) copia.visible_si = { ...p.visible_si, parametro: nueva };
  if (p.unidad_de === vieja) copia.unidad_de = nueva;
  if (p.igual_a === vieja) copia.igual_a = nueva;
  return copia;
}

// grupoDestino opcional: mueve el parámetro (al final) si es otro grupo.
export function actualizarParametro(esquema, claveOriginal, parametro, grupoDestino = null) {
  const { gi, pi } = ubicar(esquema, claveOriginal);
  if (!claveDisponible(esquema, parametro.clave, claveOriginal)) throw new Error(errorClaveParametro(esquema, parametro.clave));
  const destino = grupoDestino ? buscarGrupo(esquema, grupoDestino) : gi;
  const renombrada = parametro.clave !== claveOriginal;
  const grupos = esquema.grupos.map((g, k) => {
    let parametros = g.parametros.map(p => (renombrada ? reapuntar(p, claveOriginal, parametro.clave) : p));
    if (k === gi && gi === destino) parametros = parametros.map((p, j) => (j === pi ? parametro : p));
    else if (k === gi) parametros = parametros.filter((_, j) => j !== pi);
    else if (k === destino) parametros = [...parametros, parametro];
    return { ...g, parametros };
  });
  return conGrupos(esquema, grupos);
}

export function eliminarParametro(esquema, clave) {
  const { gi, pi } = ubicar(esquema, clave);
  return conGrupos(esquema, esquema.grupos.map((g, k) => (k === gi ? { ...g, parametros: g.parametros.filter((_, j) => j !== pi) } : g)));
}

export function moverParametro(esquema, clave, delta) {
  const { gi, pi } = ubicar(esquema, clave);
  return conGrupos(esquema, esquema.grupos.map((g, k) => (k === gi ? { ...g, parametros: intercambiar(g.parametros, pi, delta) } : g)));
}

const regexUso = (clave) => new RegExp(`\\{\\{\\s*(?:#(?:si|no)\\s+)?${clave}\\s*\\}\\}`);

// Lista quién usa la clave: otros parámetros y el texto de las reglas.
export function dependientesDe(esquema, clave) {
  const lista = [];
  esquema.grupos.forEach(g => g.parametros.forEach(p => {
    if (p.clave === clave) return;
    if (p.visible_si && p.visible_si.parametro === clave) lista.push({ tipo: 'visible_si', clave: p.clave, etiqueta: p.etiqueta });
    if (p.unidad_de === clave) lista.push({ tipo: 'unidad_de', clave: p.clave, etiqueta: p.etiqueta });
    if (p.igual_a === clave) lista.push({ tipo: 'igual_a', clave: p.clave, etiqueta: p.etiqueta });
  }));
  if (claveValida(clave)) (esquema.reglas || []).filter(r => regexUso(clave).test(r.texto || '')).forEach(r => lista.push({ tipo: 'regla', clave: r.clave, etiqueta: r.etiqueta }));
  return lista;
}

// Mantiene el texto de las reglas coherente cuando una clave cambia de nombre.
export function renombrarEnReglas(esquema, vieja, nueva) {
  const re = new RegExp(`(\\{\\{\\s*(?:#(?:si|no)\\s+)?)${vieja}(\\s*\\}\\})`, 'g');
  if (!esquema.reglas) return esquema;
  return { ...esquema, reglas: esquema.reglas.map(r => ({ ...r, texto: String(r.texto || '').replace(re, (_, a, b) => `${a}${nueva}${b}`) })) };
}

export function insertarEnPosicion(texto, inicio, fin, fragmento) {
  const base = String(texto || '');
  const a = Math.max(0, Math.min(inicio, base.length));
  const b = Math.max(a, Math.min(fin, base.length));
  return { texto: base.slice(0, a) + fragmento + base.slice(b), cursor: a + fragmento.length };
}

// Campos propios de cada tipo al crearlo o cambiarlo; los valores iniciales vienen de /config.
export function camposPorDefecto(tipo, { limites, formatosImagen }) {
  switch (tipo) {
    case 'texto': return { max_largo: limites.texto_max_largo_defecto };
    case 'texto_largo': return { max_largo: limites.texto_largo_max_largo_defecto };
    case 'opciones': return { opciones: [{ valor: '', etiqueta: '', texto_prompt: '' }] };
    case 'imagenes': return { max: limites.imagenes_max_defecto, max_mb: limites.imagenes_mb_defecto, formatos: Object.keys(formatosImagen), descripcion_requerida: false };
    default: return {};
  }
}

// Límites de las listas opcionales de un parámetro de imágenes (`campo`: ubicaciones o sugerencias).
export const limitesLista = (limites, campo) => ({
  maxItems: limites.lista_max_items,
  maxLargo: campo === 'ubicaciones' ? limites.ubicacion_max : limites.sugerencia_max,
  nombre: t(`admin.parametro.${campo}`)
});

// Texto de un recuadro (una por línea) a lista: recorta, quita vacías y repetidas y valida los límites.
export function listaDesdeTexto(texto, { maxItems, maxLargo, nombre = '' }) {
  const lista = [...new Set(String(texto || '').split('\n').map(l => l.trim()).filter(Boolean))];
  const errores = [];
  if (lista.length > maxItems) errores.push(t('admin.errores.listaExceso', { nombre, n: lista.length, max: maxItems }));
  const larga = lista.find(l => l.length > maxLargo);
  if (larga) errores.push(t('admin.errores.listaLarga', { nombre, linea: larga.slice(0, 20), largo: larga.length, max: maxLargo }));
  return { lista, errores };
}

export const textoDesdeLista = (lista) => (Array.isArray(lista) ? lista.join('\n') : '');

// Una imagen de ejemplo por parámetro de imágenes; el servidor descarta las de parámetros ocultos.
export function imagenesDeEjemplo(esquema) {
  const out = {};
  let n = 0;
  esquema.grupos.forEach(g => g.parametros.filter(p => p.tipo === 'imagenes').forEach(p => {
    const imagen = { nombre: `ejemplo-${++n}.png`, descripcion: (p.sugerencias || [])[0] || t('admin.vistaPrevia.imagenEjemplo') };
    if ((p.ubicaciones || []).length) imagen.ubicacion = p.ubicaciones[0];
    out[p.clave] = [imagen];
  }));
  return out;
}

// Un valor por parámetro con dato (los de imágenes y calculados no van en `valores`); el servidor ignora los ocultos por «visible_si».
export function valoresDeEjemplo(esquema) {
  const out = {};
  esquema.grupos.forEach(g => g.parametros.forEach(p => {
    switch (p.tipo) {
      case 'texto':
      case 'texto_largo': {
        const marcador = t('admin.vistaPrevia.valorEjemplo', { etiqueta: p.etiqueta || p.clave });
        out[p.clave] = p.max_largo ? marcador.slice(0, p.max_largo) : marcador;
        break;
      }
      case 'numero': {
        // Sin defecto ni mínimo se usa 1, ajustado al rango del parámetro.
        const base = Number.isFinite(p.defecto) ? p.defecto : (Number.isFinite(p.min) ? p.min : 1);
        const piso = Number.isFinite(p.min) ? Math.max(base, p.min) : base;
        out[p.clave] = Number.isFinite(p.max) ? Math.min(piso, p.max) : piso;
        break;
      }
      case 'opciones':
        out[p.clave] = p.defecto !== undefined && p.defecto !== null && p.defecto !== '' ? p.defecto : ((p.opciones || [])[0] || {}).valor;
        break;
      case 'si_no':
        out[p.clave] = typeof p.defecto === 'boolean' ? p.defecto : false;
        break;
      default:
    }
  }));
  return out;
}
