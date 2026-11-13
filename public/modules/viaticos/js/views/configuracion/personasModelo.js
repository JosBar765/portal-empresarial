// Reglas puras de la subpestaña «Personas» (sin DOM): filtros, texto de la fila, validación del cliente y payload.
// El servidor vuelve a validar todo; aquí solo se evita un viaje de ida y vuelta con un mensaje explicativo.
import { t } from '../../textos.js';
import { esIsoValido } from '../../utils/fechas.js';
import { filtrarFilas } from './modelo.js';

export const FILTROS_PERSONA = Object.freeze({ TODAS: 'todas', CON_LICENCIA: 'con_licencia', SIN_LICENCIA: 'sin_licencia', SIN_PAISES: 'sin_paises' });

export const LARGO_NUMERO_LICENCIA = 50;

const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

const cumpleFiltro = (persona, filtro) => {
  if (filtro === FILTROS_PERSONA.CON_LICENCIA) return Boolean(persona.licencia);
  if (filtro === FILTROS_PERSONA.SIN_LICENCIA) return !persona.licencia;
  if (filtro === FILTROS_PERSONA.SIN_PAISES) return !(persona.paises && persona.paises.length);
  return true;
};

// Filtro rápido y buscador (nombre, correo, rol) se combinan.
export function filtrarPersonas(personas, { filtro = FILTROS_PERSONA.TODAS, busqueda = '' } = {}) {
  return filtrarFilas(personas.filter(p => cumpleFiltro(p, filtro)), busqueda, (p) => [p.nombre, p.email, p.rol]);
}

export const contarPorFiltro = (personas, filtro) => personas.filter(p => cumpleFiltro(p, filtro)).length;

export const textoPaises = (paises) => (paises || []).map(p => p.nombre).join(', ');

// «A · 1234567»; sin licencia, vacío.
export const textoLicencia = (licencia) => (licencia ? `${licencia.tipoLicenciaCodigo} · ${licencia.numero}` : '');

// Errores del cliente como { campo: mensaje }, con los mismos nombres que usa el servidor (`licencia.numero`, `paisIds`…).
// La licencia es todo o nada; los países pueden quedar vacíos (el servidor lo permite), pero la persona no podrá solicitar viáticos.
export function validarPersona({ tipoLicenciaId, numero, venceEl }) {
  const errores = {};
  const llenos = [tipoLicenciaId, numero, venceEl].filter(v => !vacio(v)).length;
  if (llenos === 0) return errores;
  if (llenos < 3) {
    if (vacio(tipoLicenciaId)) errores['licencia.tipoLicenciaId'] = t('config.personas.error.tipoFalta');
    if (vacio(numero)) errores['licencia.numero'] = t('config.personas.error.numeroFalta');
    if (vacio(venceEl)) errores['licencia.venceEl'] = t('config.personas.error.venceFalta');
    return errores;
  }
  const texto = String(numero).trim();
  if (texto.length > LARGO_NUMERO_LICENCIA) errores['licencia.numero'] = t('config.personas.error.numeroLargo', { largo: texto.length, max: LARGO_NUMERO_LICENCIA });
  if (!esIsoValido(String(venceEl))) errores['licencia.venceEl'] = t('config.personas.error.venceInvalida');
  return errores;
}

// `licencia` queda en null (se quita) si los tres datos están vacíos; `paisIds` siempre viaja, aunque sea vacío.
export function armarPayloadPersona({ tipoLicenciaId, numero, venceEl, paisIds }) {
  const sinLicencia = vacio(tipoLicenciaId) && vacio(numero) && vacio(venceEl);
  return {
    licencia: sinLicencia ? null : { tipoLicenciaId: Number(tipoLicenciaId), numero: String(numero).trim(), venceEl: String(venceEl) },
    paisIds: [...new Set((paisIds || []).map(Number))]
  };
}

// Quitar la licencia conserva los países ya guardados de la persona.
export const armarPayloadQuitarLicencia = (persona) => ({ licencia: null, paisIds: (persona.paises || []).map(p => p.id) });
