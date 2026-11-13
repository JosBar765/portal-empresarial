// src/modules/vales/services/fechasEntregaService.js
// Fechas de entrega que el calendario del formulario ofrece: la mínima y los días no disponibles de un rango.
const calendarioService = require('../../../core/calendario/calendarioService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const valeCatalogoService = require('./valeCatalogoService');
const { esUrgente, opcionesFechaEntrega, TIPOS_MODIFICACION_CON_VALE } = require('./valeHelpers');

const MAX_TALLERES = 20;
const MAX_DIAS_RANGO = 93;
const MS_DIA = 24 * 60 * 60 * 1000;

function parsearTalleres(crudo) {
  if (typeof crudo !== 'string' || !crudo.trim()) throw new ErrorDeNegocio('Indica los talleres de la consulta.');
  const partes = crudo.split(',');
  if (partes.length > MAX_TALLERES) throw new ErrorDeNegocio('Demasiados talleres en la consulta.');
  return [...new Set(partes.map(p => idObligatorio(p, 'Taller')))];
}

function parsearFecha(crudo, etiqueta) {
  const m = typeof crudo === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(crudo) : null;
  const ms = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  if (!m || new Date(ms).toISOString().slice(0, 10) !== crudo) throw new ErrorDeNegocio(`${etiqueta} no es una fecha válida (AAAA-MM-DD).`);
  return ms;
}

class FechasEntregaService {
  // Un vale (normal o MOD con modificacion = BASICA, MEDIA o AVANZADA) rige por días hábiles de trabajo desde hoy; «urgente» lo baja a 1.
  // `diasHabiles` ({ normal, urgente }) va en la respuesta para que el formulario explique la regla sin repetir los números.
  async obtenerFechasEntrega(talleresCrudo, desdeCrudo, hastaCrudo, urgenteCrudo, modificacionCrudo, usuario) {
    const talleresIds = parsearTalleres(talleresCrudo);
    const desde = parsearFecha(desdeCrudo, 'La fecha inicial');
    const hasta = parsearFecha(hastaCrudo, 'La fecha final');
    if (hasta < desde) throw new ErrorDeNegocio('La fecha final no puede ser anterior a la inicial.');
    if ((hasta - desde) / MS_DIA >= MAX_DIAS_RANGO) throw new ErrorDeNegocio(`El rango no puede superar ${MAX_DIAS_RANGO} días.`);
    await valeCatalogoService.validarTalleresElegibles(usuario, talleresIds);
    const tipo = String(modificacionCrudo || '').toUpperCase();
    const urgente = esUrgente(urgenteCrudo);
    if (tipo && !TIPOS_MODIFICACION_CON_VALE.includes(tipo)) throw new ErrorDeNegocio('El tipo de modificación no es válido.');
    const paisId = await valeCatalogoService.paisDeLaTienda(usuario);
    const opciones = opcionesFechaEntrega({ urgente, modificacionTipo: tipo || null, paisId });
    const respuesta = await calendarioService.fechasNoDisponibles(talleresIds, desdeCrudo, hastaCrudo, opciones);
    const regla = (conUrgente) => opcionesFechaEntrega({ urgente: conUrgente, modificacionTipo: tipo || null }).diasHabiles;
    return { ...respuesta, diasHabiles: { normal: regla(false), urgente: regla(true) } };
  }
}

module.exports = new FechasEntregaService();
