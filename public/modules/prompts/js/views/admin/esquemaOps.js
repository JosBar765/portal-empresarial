// Operaciones puras (sin DOM) sobre el esquema del producto; nunca mutan sus argumentos.
export const CLAVE_RE = /^[a-z][a-z0-9_]{1,59}$/;
export const FORMATOS = ['png', 'jpg', 'svg', 'webp'];
export const TIPOS = [
  { valor: 'texto', etiqueta: 'Texto corto' },
  { valor: 'texto_largo', etiqueta: 'Texto largo' },
  { valor: 'numero', etiqueta: 'Número' },
  { valor: 'opciones', etiqueta: 'Opciones' },
  { valor: 'si_no', etiqueta: 'Sí / No' },
  { valor: 'imagenes', etiqueta: 'Imágenes' },
  { valor: 'calculado', etiqueta: 'Calculado' }
];
export const VARIABLES_AUTOMATICAS = ['asesor_nombre', 'asesor_telefono', 'asesor_correo', 'logo_marca_agua'];
export const etiquetaDeTipo = (tipo) => (TIPOS.find(t => t.valor === tipo) || { etiqueta: tipo }).etiqueta;

export const claveValida = (clave) => CLAVE_RE.test(clave || '');

export const clavesDelEsquema = (esquema) => esquema.grupos.flatMap(g => g.parametros.map(p => p.clave));

// `claveActual` permite conservar la propia clave al editar un parámetro.
export function claveDisponible(esquema, clave, claveActual = null) {
  if (!claveValida(clave)) return false;
  return clave === claveActual || !clavesDelEsquema(esquema).includes(clave);
}

export const claveGrupoDisponible = (esquema, clave) => claveValida(clave) && !esquema.grupos.some(g => g.clave === clave);

export const contarParametros = (esquema) => esquema.grupos.reduce((n, g) => n + g.parametros.length, 0);

// Sugiere una clave snake_case a partir de la etiqueta.
export function claveDesdeEtiqueta(etiqueta) {
  const base = String(etiqueta || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return (/^[a-z]/.test(base) ? base : base ? `p_${base}` : '').slice(0, 60);
}

function buscarGrupo(esquema, clave) {
  const i = esquema.grupos.findIndex(g => g.clave === clave);
  if (i < 0) throw new Error('El grupo no existe.');
  return i;
}

const conGrupos = (esquema, grupos) => ({ ...esquema, grupos });

function intercambiar(lista, i, delta) {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const copia = lista.slice();
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

export function agregarGrupo(esquema, { clave, etiqueta }) {
  if (!String(etiqueta || '').trim()) throw new Error('La etiqueta del grupo es obligatoria.');
  if (!claveGrupoDisponible(esquema, clave)) throw new Error('La clave del grupo no es válida o ya existe.');
  return conGrupos(esquema, [...esquema.grupos, { clave, etiqueta: etiqueta.trim(), parametros: [] }]);
}

export function renombrarGrupo(esquema, clave, etiqueta) {
  if (!String(etiqueta || '').trim()) throw new Error('La etiqueta del grupo es obligatoria.');
  const i = buscarGrupo(esquema, clave);
  return conGrupos(esquema, esquema.grupos.map((g, k) => (k === i ? { ...g, etiqueta: etiqueta.trim() } : g)));
}

export function eliminarGrupo(esquema, clave) {
  const i = buscarGrupo(esquema, clave);
  if (esquema.grupos[i].parametros.length) throw new Error('Solo se puede eliminar un grupo vacío.');
  return conGrupos(esquema, esquema.grupos.filter((_, k) => k !== i));
}

export function moverGrupo(esquema, clave, delta) {
  return conGrupos(esquema, intercambiar(esquema.grupos, buscarGrupo(esquema, clave), delta));
}

export function agregarParametro(esquema, grupoClave, parametro) {
  const i = buscarGrupo(esquema, grupoClave);
  if (!claveDisponible(esquema, parametro.clave)) throw new Error('La clave no es válida o ya existe.');
  return conGrupos(esquema, esquema.grupos.map((g, k) => (k === i ? { ...g, parametros: [...g.parametros, parametro] } : g)));
}

function ubicar(esquema, clave) {
  for (let gi = 0; gi < esquema.grupos.length; gi++) {
    const pi = esquema.grupos[gi].parametros.findIndex(p => p.clave === clave);
    if (pi >= 0) return { gi, pi };
  }
  throw new Error('El parámetro no existe.');
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
  if (!claveDisponible(esquema, parametro.clave, claveOriginal)) throw new Error('La clave no es válida o ya existe.');
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

// Lista quién usa la clave: otros parámetros y la plantilla.
export function dependientesDe(esquema, plantilla, clave) {
  const lista = [];
  esquema.grupos.forEach(g => g.parametros.forEach(p => {
    if (p.clave === clave) return;
    if (p.visible_si && p.visible_si.parametro === clave) lista.push({ tipo: 'visible_si', clave: p.clave, etiqueta: p.etiqueta });
    if (p.unidad_de === clave) lista.push({ tipo: 'unidad_de', clave: p.clave, etiqueta: p.etiqueta });
    if (p.igual_a === clave) lista.push({ tipo: 'igual_a', clave: p.clave, etiqueta: p.etiqueta });
  }));
  if (claveValida(clave) && regexUso(clave).test(plantilla || '')) lista.push({ tipo: 'plantilla', clave: null, etiqueta: 'Plantilla del prompt' });
  return lista;
}

// Mantiene la plantilla coherente cuando una clave cambia de nombre.
export function renombrarEnPlantilla(plantilla, vieja, nueva) {
  const re = new RegExp(`(\\{\\{\\s*(?:#(?:si|no)\\s+)?)${vieja}(\\s*\\}\\})`, 'g');
  return String(plantilla || '').replace(re, (_, a, b) => `${a}${nueva}${b}`);
}

export function insertarEnPosicion(texto, inicio, fin, fragmento) {
  const t = String(texto || '');
  const a = Math.max(0, Math.min(inicio, t.length));
  const b = Math.max(a, Math.min(fin, t.length));
  return { texto: t.slice(0, a) + fragmento + t.slice(b), cursor: a + fragmento.length };
}

// Campos propios de cada tipo al crearlo o cambiarlo.
export function camposPorDefecto(tipo) {
  switch (tipo) {
    case 'texto': return { max_largo: 150 };
    case 'texto_largo': return { max_largo: 600 };
    case 'opciones': return { opciones: [{ valor: '', etiqueta: '', texto_prompt: '' }] };
    case 'imagenes': return { max: 3, max_mb: 5, formatos: FORMATOS.slice() };
    default: return {};
  }
}

// Parámetros de imágenes en el orden de la lámina (grupos y parámetros).
export function parametrosDeImagenes(esquema) {
  return esquema.grupos.flatMap(g => g.parametros.filter(p => p.tipo === 'imagenes').map(p => ({ grupo: g.etiqueta, parametro: p })));
}
