// src/modules/proyectos/camposPropios.js
// Campos propios de la empresa (A6): validación de sus valores y lectura desde texto (CSV). Funciones puras.
// Los valores viven juntos en `proy_clientes.datos_extra` (JSON): { clave: valor }, con el valor ya tipado
// (texto → string, numero → number, lista → string, si_no → boolean, fecha → 'AAAA-MM-DD').

const TIPOS = ['texto', 'numero', 'lista', 'si_no', 'fecha'];
const ETIQUETA_TIPO = { texto: 'Texto', numero: 'Número', lista: 'Lista', si_no: 'Sí/No', fecha: 'Fecha' };
const MAX_TEXTO = 255;
const MAX_CLAVE = 60;
const MAX_NUMERO = 1e12;

const quitarAcentos = (texto) => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
const vacio = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

// «¿Ya es cliente de Premia?» → «ya_es_cliente_de_premia». Solo a-z, 0-9 y guion bajo (la clave entra a rutas JSON).
function claveDe(etiqueta) {
  let clave = quitarAcentos(etiqueta).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, MAX_CLAVE).replace(/_+$/g, '');
  if (!clave) clave = 'campo';
  if (/^[0-9]/.test(clave)) clave = `c_${clave}`.slice(0, MAX_CLAVE);
  return clave;
}

// Una clave libre a partir de la etiqueta: si ya existe (activa o no, las claves no se reutilizan), agrega _2, _3…
function claveLibre(etiqueta, existentes) {
  const base = claveDe(etiqueta);
  if (!existentes.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const sufijo = `_${n}`;
    const candidata = `${base.slice(0, MAX_CLAVE - sufijo.length)}${sufijo}`;
    if (!existentes.has(candidata)) return candidata;
  }
  throw new Error('No se pudo generar una clave libre.');
}

// ¿Aplica esta definición a una empresa de este nicho? (activa y de todos los nichos o de ese nicho)
const aplica = (def, nichoId) => Boolean(def.activo) && (def.nichoId === null || def.nichoId === undefined || def.nichoId === nichoId);

const SI = new Set(['si', 'sí', 's', 'true', 'verdadero', '1', 'x']);
const NO = new Set(['no', 'n', 'false', 'falso', '0']);

function aFecha(texto) {
  const crudo = String(texto).trim();
  let anio; let mes; let dia;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(crudo);
  if (m) [, anio, mes, dia] = m;
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(crudo))) [, dia, mes, anio] = m;
  else return null;
  const f = new Date(Date.UTC(+anio, +mes - 1, +dia));
  if (f.getUTCFullYear() !== +anio || f.getUTCMonth() !== +mes - 1 || f.getUTCDate() !== +dia) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Valida un valor crudo (de la API o de un CSV) contra la definición. Devuelve { vacio: true }, { valor } o { error }.
function validarValor(def, crudo) {
  if (vacio(crudo)) return { vacio: true };
  switch (def.tipo) {
    case 'texto': {
      const texto = String(crudo).trim();
      return texto.length > MAX_TEXTO ? { error: `Máximo ${MAX_TEXTO} caracteres.` } : { valor: texto };
    }
    case 'numero': {
      const n = typeof crudo === 'number' ? crudo : Number(String(crudo).trim().replace(',', '.'));
      return Number.isFinite(n) && Math.abs(n) < MAX_NUMERO ? { valor: n } : { error: 'Escribe un número.' };
    }
    case 'lista': {
      const buscado = quitarAcentos(String(crudo).trim()).toLowerCase();
      const opcion = (def.opciones || []).find(o => quitarAcentos(o).toLowerCase() === buscado);
      return opcion ? { valor: opcion } : { error: 'Elige una de las opciones.' };
    }
    case 'si_no': {
      if (typeof crudo === 'boolean') return { valor: crudo };
      const t = quitarAcentos(String(crudo).trim()).toLowerCase();
      if (SI.has(t) || SI.has(String(crudo).trim().toLowerCase())) return { valor: true };
      if (NO.has(t)) return { valor: false };
      return { error: 'Elige sí o no.' };
    }
    case 'fecha': {
      const f = aFecha(crudo);
      return f ? { valor: f } : { error: 'Escribe una fecha válida (AAAA-MM-DD o DD/MM/AAAA).' };
    }
    default: return { error: 'Tipo de campo desconocido.' };
  }
}

// Valida los `datos` ({ clave: valor }) de una empresa de ese nicho. `previo` son los datos ya guardados: lo que no viene
// se conserva (también lo de campos desactivados o de otros nichos: desactivar nunca borra datos). Las claves que no
// son de un campo que aplique se ignoran. Devuelve { valores, errores } con los errores por `datosExtra.<clave>`.
function validarDatosExtra(definiciones, datos, nichoId, previo = {}) {
  const valores = { ...previo };
  const errores = {};
  const entrada = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
  for (const def of definiciones.filter(d => aplica(d, nichoId))) {
    if (Object.prototype.hasOwnProperty.call(entrada, def.clave)) {
      const r = validarValor(def, entrada[def.clave]);
      if (r.error) errores[`datosExtra.${def.clave}`] = r.error;
      else if (r.vacio) delete valores[def.clave];
      else valores[def.clave] = r.valor;
    }
    if (def.obligatorio && valores[def.clave] === undefined && !errores[`datosExtra.${def.clave}`]) {
      errores[`datosExtra.${def.clave}`] = def.tipo === 'lista' || def.tipo === 'si_no' ? 'Elige una opción.' : 'Este dato es obligatorio.';
    }
  }
  return { valores, errores };
}

// Cómo se ve un valor guardado en la ficha y en la lista.
function textoDe(def, valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  if (def.tipo === 'si_no') return valor ? 'Sí' : 'No';
  if (def.tipo === 'fecha') { const [a, m, d] = String(valor).split('-'); return d && m ? `${d}/${m}/${a}` : String(valor); }
  return String(valor);
}

module.exports = { textoDe, TIPOS, ETIQUETA_TIPO, MAX_TEXTO, claveDe, claveLibre, aplica, validarValor, validarDatosExtra, vacio };
