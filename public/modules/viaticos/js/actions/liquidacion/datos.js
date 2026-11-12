// Reglas puras de la liquidación del solicitante (sin DOM): avance, cupos por rubro, validación de borradores y llaves de idempotencia.
import { LIMITES_SOLICITUD } from '../../config/constantes.js';
import { normalizarDecimal } from '../../utils/numero.js';
import { formatearTamano } from '../../utils/formato.js';

// Mismo tope que el servidor (monto máximo 99,999,999.99); quien decide sigue siendo el servidor.
export const MONTO_MAXIMO = 99999999.99;

const ETIQUETA_TIPO = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WEBP', 'application/pdf': 'PDF' };
const etiquetaTipo = (tipo) => ETIQUETA_TIPO[tipo] || String(tipo);

// Porcentaje entero de avance (liquidado / solicitado) acotado a 0-100: liquidar de más no pasa de 100 y sin nada solicitado es 0.
export function porcentajeAvance(liquidado, solicitado) {
  const l = Number(liquidado);
  const s = Number(solicitado);
  if (!Number.isFinite(l) || !Number.isFinite(s) || s <= 0 || l <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((l / s) * 100)));
}

// Comprobantes que aún se pueden cargar de un rubro, descontando los borradores que ya lo eligieron (menos `excluir`, el que pregunta).
export function cupoRestante(pendiente, borradores = [], excluir = null) {
  const reservados = borradores.filter(b => b !== excluir && Number(b.tipoGastoId) === Number(pendiente.tipoGastoId)).length;
  return Math.max(0, Number(pendiente.solicitados) - Number(pendiente.liquidados) - reservados);
}

// Solo los rubros con cupo, cada uno con lo que le queda.
export function rubrosConCupo(pendientes = [], borradores = [], excluir = null) {
  return pendientes
    .map(p => ({ tipoGastoId: p.tipoGastoId, nombre: p.nombre, esOtros: !!p.esOtros, restantes: cupoRestante(p, borradores, excluir) }))
    .filter(r => r.restantes > 0);
}

// Clave de texto y parámetros de «2 de 3 noches» / «1 de 2 comprobantes»; `rubroNoches` es el nombre del rubro que se cuenta por noches.
export function textoProgreso(pendiente, rubroNoches) {
  const noches = pendiente.nombre === rubroNoches;
  const uno = Number(pendiente.solicitados) === 1;
  const clave = noches ? (uno ? 'liquidacion.progreso.nocheUna' : 'liquidacion.progreso.noches') : (uno ? 'liquidacion.progreso.comprobanteUno' : 'liquidacion.progreso.comprobantes');
  return { clave, params: { liquidados: pendiente.liquidados, solicitados: pendiente.solicitados } };
}

export const pendienteCompleto = (pendiente) => Number(pendiente.liquidados) >= Number(pendiente.solicitados);

// Valor del atributo `accept` de los selectores de archivo: los tipos permitidos de los ajustes o, sin ellos, imágenes y PDF.
export function aceptarArchivos(ajustes) {
  const tipos = Array.isArray(ajustes && ajustes.tiposArchivoPermitidos) ? ajustes.tiposArchivoPermitidos.filter(x => /^image\//.test(x) || x === 'application/pdf') : [];
  return tipos.length ? tipos.join(',') : 'image/*,application/pdf';
}

// null si el archivo sirve; si no, { clave, params } del texto explicativo. Un comprobante es una imagen o un PDF.
export function validarArchivoComprobante(archivo, ajustes) {
  const nombre = (archivo && archivo.name) || '';
  if (!archivo || !archivo.size) return { clave: 'liquidacion.archivo.vacio', params: { nombre } };
  const tipo = archivo.type || '';
  if (!/^image\//.test(tipo) && tipo !== 'application/pdf') return { clave: 'liquidacion.archivo.tipoInvalido', params: { nombre, tipo: tipo || 'desconocido' } };
  const permitidos = Array.isArray(ajustes && ajustes.tiposArchivoPermitidos) ? ajustes.tiposArchivoPermitidos : [];
  if (permitidos.length && !permitidos.includes(tipo)) {
    return { clave: 'liquidacion.archivo.tipoNoPermitido', params: { nombre, tipo: etiquetaTipo(tipo), permitidos: permitidos.map(etiquetaTipo).join(', ') } };
  }
  const maxMb = Number(ajustes && ajustes.maxArchivoMb);
  if (Number.isFinite(maxMb) && maxMb > 0 && archivo.size > maxMb * 1024 * 1024) {
    return { clave: 'liquidacion.archivo.demasiadoGrande', params: { nombre, tamano: formatearTamano(archivo.size), max: maxMb } };
  }
  return null;
}

let contador = 0;
export function borradorNuevo() {
  contador += 1;
  return { n: contador, tipoGastoId: '', monto: '', descripcion: '', archivo: null, errores: {}, aviso: null, llave: null, huellaLlave: null, enviando: false };
}

// Monto canónico («350.5» -> «350.5»), o { error } con la clave del texto que lo explica.
export function montoDeBorrador(texto) {
  const canonico = normalizarDecimal(texto);
  if (canonico === '') return { error: 'liquidacion.error.montoVacio' };
  if (canonico === null) return { error: 'liquidacion.error.montoInvalido' };
  if (/\.\d{3,}/.test(canonico)) return { error: 'liquidacion.error.montoDecimales' };
  const n = Number(canonico);
  if (!(n > 0)) return { error: 'liquidacion.error.montoCero' };
  if (n > MONTO_MAXIMO) return { error: 'liquidacion.error.montoMaximo' };
  return { valor: canonico };
}

// Errores del borrador como { campo: { clave, params } } con los nombres de campo del servidor; vacío si se puede enviar.
export function validarBorrador(b, { esOtros = false } = {}) {
  const errores = {};
  if (b.tipoGastoId === '' || b.tipoGastoId === null || b.tipoGastoId === undefined) errores.tipoGastoId = { clave: 'liquidacion.error.rubro', params: {} };
  const monto = montoDeBorrador(b.monto);
  if (monto.error) errores.monto = { clave: monto.error, params: { monto: String(b.monto).trim() } };
  if (esOtros && String(b.descripcion || '').trim() === '') errores.descripcion = { clave: 'liquidacion.error.descripcion', params: { max: LIMITES_SOLICITUD.DESCRIPCION } };
  if (!b.archivo) errores.archivo = { clave: 'liquidacion.error.archivo', params: {} };
  return errores;
}

// Huella de lo que se envía: si cambia, el intento es otro comprobante y necesita una llave nueva.
export function huellaBorrador(b) {
  const a = b.archivo;
  return JSON.stringify([b.tipoGastoId, String(b.monto).trim(), String(b.descripcion || '').trim(), a ? [a.name, a.size, a.lastModified || 0] : null]);
}

// La misma llave en el reintento del mismo comprobante (el servidor devuelve lo ya guardado) y una nueva si el contenido cambió.
export function llaveDeIntento(b, generar) {
  const huella = huellaBorrador(b);
  if (!b.llave || b.huellaLlave !== huella) { b.llave = generar(); b.huellaLlave = huella; }
  return b.llave;
}
