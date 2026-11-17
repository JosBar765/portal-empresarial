// Reglas puras de «Reglas de licencia» (sin DOM): datos por país, validación del cliente y payloads.
import { t } from '../../textos.js';
import { normalizarDecimal } from '../../utils/numero.js';
import { formatearMedida, validarDecimalPositivo } from './modelo.js';

// Mismos topes que LIMITES del servidor (constantes.js).
export const LIMITES_REGLA = Object.freeze({ TONELAJE_MAX: 99999999.99, ENTERO_MAX: 2147483647 });

const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

export const tiposPlacaDe = (tipos, paisId) => tipos.filter(tp => Number(tp.paisId) === Number(paisId));
export const reglasDe = (reglas, paisId) => reglas.filter(r => Number(r.paisId) === Number(paisId));

// El tipo de placa de una regla nueva: del país y activo.
export const tiposPlacaElegibles = (tipos, paisId) => tiposPlacaDe(tipos, paisId).filter(tp => tp.activo);

// País recordado si todavía existe; si no, el primero.
export function paisInicial(paises, guardado) {
  if (!paises.length) return null;
  return paises.some(p => Number(p.id) === Number(guardado)) ? Number(guardado) : paises[0].id;
}

export const claveRegla = (r) => ({ paisId: r.paisId, tipoLicenciaId: r.tipoLicenciaId, tipoPlacaId: r.tipoPlacaId });
export const mismaRegla = (a, b) => a.paisId === b.paisId && a.tipoLicenciaId === b.tipoLicenciaId && a.tipoPlacaId === b.tipoPlacaId;

export const textoTipoLicencia = (r) => `${r.tipoLicenciaCodigo} · ${r.tipoLicenciaNombre}`;
export const textoTipoPlaca = (r) => `${r.tipoPlacaCodigo} · ${r.tipoPlacaNombre}`;
export const nombreRegla = (r) => `${r.tipoLicenciaCodigo} / ${r.tipoPlacaCodigo}`;

// Límite vacío significa «sin límite».
export const textoTonelaje = (valor) => (valor === null || valor === undefined || valor === '' ? t('config.reglas.sinLimite') : t('config.reglas.valorTonelaje', { valor: formatearMedida(valor) }));
export const textoPasajeros = (valor) => (valor === null || valor === undefined || valor === '' ? t('config.reglas.sinLimite') : String(valor));

// Errores del cliente como { campo: mensaje }; en la edición solo cuentan los límites (la clave no cambia).
export function validarRegla({ tipoLicenciaId, tipoPlacaId, tonelajeMax, pasajerosMax }, { enEdicion = false } = {}) {
  const errores = {};
  if (!enEdicion) {
    if (vacio(tipoLicenciaId)) errores.tipoLicenciaId = t('config.error.obligatorioLista', { campo: t('config.reglas.campo.tipoLicenciaId') });
    if (vacio(tipoPlacaId)) errores.tipoPlacaId = t('config.error.obligatorioLista', { campo: t('config.reglas.campo.tipoPlacaId') });
  }
  if (!vacio(tonelajeMax)) {
    const { error } = validarDecimalPositivo(tonelajeMax, { campo: t('config.reglas.campo.tonelajeMax'), max: LIMITES_REGLA.TONELAJE_MAX, ejemplo: '3.5' });
    if (error) errores.tonelajeMax = error;
  }
  if (!vacio(pasajerosMax)) {
    const texto = String(pasajerosMax).trim();
    if (!/^\d+$/.test(texto) || Number(texto) < 1 || Number(texto) > LIMITES_REGLA.ENTERO_MAX) errores.pasajerosMax = t('config.reglas.error.pasajeros');
  }
  return errores;
}

export function armarPayloadRegla({ paisId, tipoLicenciaId, tipoPlacaId, tonelajeMax, pasajerosMax }, { enEdicion = false } = {}) {
  const limites = {
    tonelajeMax: vacio(tonelajeMax) ? null : Number(normalizarDecimal(tonelajeMax)),
    pasajerosMax: vacio(pasajerosMax) ? null : Number(String(pasajerosMax).trim())
  };
  return enEdicion ? limites : { paisId: Number(paisId), tipoLicenciaId: Number(tipoLicenciaId), tipoPlacaId: Number(tipoPlacaId), ...limites };
}
