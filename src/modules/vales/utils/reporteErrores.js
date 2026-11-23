// src/modules/vales/utils/reporteErrores.js
// Trazabilidad de errores de Reportes: referencia corta + código estable + una línea de log con el contexto.
const crypto = require('crypto');
const { ErrorDeNegocio, esErrorInterno, responderError } = require('../../../core/utils/erroresHttp');

// Solo estos filtros viajan al log: nunca el cuerpo completo ni datos personales.
const FILTROS_LOGUEABLES = [
  'ventana', 'fecha', 'desde', 'hasta', 'tiendaId', 'tiendaIds', 'tallerId', 'tallerIds',
  'disenadorIds', 'asesorIds', 'asesorDesglose', 'disenadorDesglose', 'disenadorModo', 'tallerDesglose', 'tallerModo', 'tiendaDesglose', 'soloUrgentes', 'desglose',
  'desgloseEstado', 'desgloseUrgentes'
];

// El cliente muestra la referencia y el administrador la busca en el log.
function nuevaReferencia() {
  return `R-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function resumenFiltros(query) {
  const origen = query || {};
  const partes = FILTROS_LOGUEABLES
    .filter(clave => origen[clave] !== undefined && origen[clave] !== '')
    .map(clave => `${clave}=${String(origen[clave]).slice(0, 60)}`);
  return partes.join(',').slice(0, 300);
}

function esErrorDeBd(error) {
  return /^(ER_|ECONN|PROTOCOL_|ETIMEDOUT)/.test(String((error && error.code) || ''));
}

// Código estable por causa, para distinguir de dónde viene el fallo sin leer el stack.
function codigoDe(error, etapa) {
  if (esErrorDeBd(error)) return 'REPORTE_BD';
  if (esErrorInterno(error)) return etapa === 'pdf' ? 'REPORTE_PDF' : 'REPORTE_INTERNO';
  const status = (error && error.status) || 400;
  if (status === 400) return 'REPORTE_FILTRO_INVALIDO';
  if (status === 403) return 'REPORTE_SIN_ACCESO';
  if (status === 404) return 'REPORTE_NO_ENCONTRADO';
  if (status === 429) return 'REPORTE_LIMITE';
  return 'REPORTE_NEGOCIO';
}

// Una sola línea con todo el contexto; sin cookies, tokens ni correos.
function lineaLog({ referencia, reporte, etapa, req, estado, codigo, mensaje }) {
  const usuario = (req.user && req.user.id) ?? '-';
  return `[Reportes] ref=${referencia} reporte=${reporte} etapa=${etapa} usuario=${usuario} estado=${estado} codigo=${codigo} filtros=${resumenFiltros(req.query)} mensaje=${String(mensaje || '').slice(0, 200)}`;
}

function responderErrorReporte(req, res, error, { reporte, etapa }) {
  const referencia = nuevaReferencia();
  const codigo = codigoDe(error, etapa);
  const interno = esErrorInterno(error);
  const estado = interno ? 500 : ((error && error.status) || 400);
  const linea = lineaLog({ referencia, reporte, etapa, req, estado, codigo, mensaje: error && error.message });
  // El stack lo imprime responderError justo después de esta línea.
  if (interno) console.error(linea); else console.warn(linea);
  return responderError(res, error, 400, { codigo, referencia, etapa });
}

// El middleware general de permisos responde 403 sin referencia ni log: aquí el rechazo también queda trazado (etapa «permiso»).
// `base` es el middleware de permisos de la plataforma (se delega en él cuando no hay sesión o sí hay permiso).
function exigirPermisoReporte(codigo, reporte, base) {
  return (req, res, next) => {
    if (!req.user || (req.user.permissions || []).includes(codigo)) return base(req, res, next);
    return responderErrorReporte(req, res, new ErrorDeNegocio('No tienes permiso para consultar este reporte.', 403), { reporte, etapa: 'permiso' });
  };
}

module.exports = { nuevaReferencia, resumenFiltros, codigoDe, lineaLog, responderErrorReporte, exigirPermisoReporte };
