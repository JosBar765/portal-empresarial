// Reglas puras del recibo firmado (sin DOM): rubros disponibles, valores sugeridos, validación espejo del servidor y llave de idempotencia.
import { esIsoValido } from '../../utils/fechas.js';
import { numeroATexto } from '../../utils/numero.js';
import { formatearFecha } from '../../utils/formato.js';
import { montoDeBorrador } from './datos.js';
import { t } from '../../textos.js';

// Mismos largos y valores que el servidor (RECIBOS en src/modules/viaticos/constantes.js); quien decide sigue siendo el servidor.
export const LIMITES_RECIBO = Object.freeze({ RECIBI_DE: 100, CONCEPTO: 200, NUMERO_CHEQUE: 30, NUMERO_CUENTA: 40 });
export const RUBROS_RECIBO = Object.freeze(['alimentacion', 'depreciacion', 'otro']);
export const FORMAS_PAGO = Object.freeze(['efectivo', 'cheque', 'transferencia']);
const RUBROS_UNICOS = ['alimentacion', 'depreciacion'];

export const nombreRubro = (rubro) => t(`recibo.rubro.${rubro}`);
const recortado = (x) => String(x == null ? '' : x).trim();

// { rubro: { disponible, motivo } }: Alimentación y Depreciación solo si se solicitaron y aún no tienen su recibo; «Otro» siempre.
export function disponibilidadRubros(liq) {
  const sugerencias = (liq && liq.sugerenciasRecibo) || {};
  const pendientes = (liq && liq.pendientes) || [];
  const recibos = (liq && liq.recibos) || [];
  const resultado = { otro: { disponible: true, motivo: null } };
  for (const rubro of RUBROS_UNICOS) {
    const pendiente = pendientes.find(p => p.rubroRecibo === rubro);
    const existente = recibos.find(r => r.rubro === rubro);
    const params = { rubro: nombreRubro(rubro) };
    if (!sugerencias[rubro] || !pendiente) resultado[rubro] = { disponible: false, motivo: { clave: 'recibo.rubro.noSolicitado', params } };
    else if (existente) resultado[rubro] = { disponible: false, motivo: { clave: 'recibo.rubro.yaTiene', params: { ...params, numero: existente.numero } } };
    else if (Number(pendiente.liquidados) >= Number(pendiente.solicitados)) resultado[rubro] = { disponible: false, motivo: { clave: 'recibo.rubro.completo', params } };
    else resultado[rubro] = { disponible: true, motivo: null };
  }
  return resultado;
}

export const rubroInicial = (disponibilidad) => RUBROS_RECIBO.find(r => disponibilidad[r] && disponibilidad[r].disponible) || 'otro';

// Monto y concepto que propone el servidor para el rubro; «Otro» no tiene sugerencia.
export function sugerenciaDe(liq, rubro) {
  const s = rubro !== 'otro' && liq && liq.sugerenciasRecibo ? liq.sugerenciasRecibo[rubro] : null;
  return { monto: s ? numeroATexto(s.monto) : '', concepto: s ? recortado(s.concepto) : '' };
}

export function formularioRecibo(liq) {
  const rubro = rubroInicial(disponibilidadRubros(liq));
  const s = sugerenciaDe(liq, rubro);
  const fecha = (liq && liq.sugerenciasRecibo && liq.sugerenciasRecibo.fecha) || '';
  return {
    rubro, fecha, monto: s.monto, recibiDe: '', concepto: s.concepto, formaPago: '', numeroCheque: '', numeroCuenta: '',
    firma: null, firmaN: 0, montoEditado: false, conceptoEditado: false, llave: null, huellaLlave: null
  };
}

// Al cambiar de rubro solo se reemplaza lo que el usuario no editó a mano.
export function cambiarRubro(f, liq, rubro) {
  f.rubro = rubro;
  const s = sugerenciaDe(liq, rubro);
  if (!f.montoEditado) f.monto = s.monto;
  if (!f.conceptoEditado) f.concepto = s.concepto;
  return f;
}

// Número para pedir la vista previa en letras, o null si el monto aún no es válido.
export function montoParaLetras(texto) {
  const r = montoDeBorrador(texto);
  return r.error ? null : Number(r.valor);
}

// Errores como { campo: { clave, params } } con los nombres de campo del servidor; vacío si se puede enviar. `hoy` es «AAAA-MM-DD».
export function validarRecibo(f, { hoy = null, disponibilidad = null } = {}) {
  const e = {};
  const error = (campo, clave, params = {}) => { e[campo] = { clave, params }; };
  const texto = (campo, max, claveFalta, etiqueta, { requerido = true } = {}) => {
    const valor = recortado(f[campo]);
    if (!valor) { if (requerido) error(campo, claveFalta, { max }); return; }
    if (valor.length > max) error(campo, 'recibo.error.largo', { campo: t(etiqueta), n: valor.length, max });
  };

  if (!RUBROS_RECIBO.includes(f.rubro)) error('rubro', 'recibo.error.rubro');
  else if (disponibilidad && disponibilidad[f.rubro] && !disponibilidad[f.rubro].disponible) error('rubro', disponibilidad[f.rubro].motivo.clave, disponibilidad[f.rubro].motivo.params);

  if (!esIsoValido(f.fecha)) error('fecha', 'recibo.error.fecha');
  else if (hoy && f.fecha > hoy) error('fecha', 'recibo.error.fechaFutura', { fecha: formatearFecha(f.fecha), hoy: formatearFecha(hoy) });

  const monto = montoDeBorrador(f.monto);
  if (monto.error) error('monto', monto.error.replace('liquidacion.error.', 'recibo.error.'), { monto: recortado(f.monto) });

  texto('recibiDe', LIMITES_RECIBO.RECIBI_DE, 'recibo.error.recibiDe', 'recibo.recibiDe');
  texto('concepto', LIMITES_RECIBO.CONCEPTO, f.rubro === 'otro' ? 'recibo.error.conceptoOtro' : 'recibo.error.concepto', 'recibo.concepto');

  if (!FORMAS_PAGO.includes(f.formaPago)) error('formaPago', 'recibo.error.formaPago');
  else if (f.formaPago === 'cheque') texto('numeroCheque', LIMITES_RECIBO.NUMERO_CHEQUE, 'recibo.error.numeroCheque', 'recibo.numeroCheque');
  else if (f.formaPago === 'transferencia') texto('numeroCuenta', LIMITES_RECIBO.NUMERO_CUENTA, null, 'recibo.numeroCuenta', { requerido: false });

  if (!f.firma) error('firma', 'recibo.error.firma');
  return e;
}

// `datos` del POST (sin la llave): los números de cheque y de cuenta solo van con su forma de pago.
export function datosDeEnvio(f) {
  const monto = montoDeBorrador(f.monto);
  const datos = {
    rubro: f.rubro, fecha: f.fecha, monto: monto.error ? recortado(f.monto) : Number(monto.valor),
    recibiDe: recortado(f.recibiDe), concepto: recortado(f.concepto), formaPago: f.formaPago
  };
  if (f.formaPago === 'cheque') datos.numeroCheque = recortado(f.numeroCheque);
  if (f.formaPago === 'transferencia' && recortado(f.numeroCuenta)) datos.numeroCuenta = recortado(f.numeroCuenta);
  return datos;
}

// Huella de lo que se envía (incluida la versión de la firma): si cambia, el intento es otro recibo y necesita una llave nueva.
export const huellaRecibo = (f) => JSON.stringify([datosDeEnvio(f), f.firma ? f.firmaN : 0]);

export function llaveDeRecibo(f, generar) {
  const huella = huellaRecibo(f);
  if (!f.llave || f.huellaLlave !== huella) { f.llave = generar(); f.huellaLlave = huella; }
  return f.llave;
}

// Hay cambios sin guardar si algo difiere de lo que el modal propuso al abrirse.
export const reciboConCambios = (f, inicial) => huellaRecibo(f) !== huellaRecibo(inicial);
