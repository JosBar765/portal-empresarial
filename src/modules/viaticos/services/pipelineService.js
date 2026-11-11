// src/modules/viaticos/services/pipelineService.js
// Estado visible de una solicitud: se deriva del estado guardado y de las fechas; nada de esto se guarda.
const { ESTADOS, MODALIDADES, FASES, PASOS, ESTADOS_PASO, ACCIONES, MESES_ABREVIADOS } = require('../constantes');
const { msg } = require('../mensajes');

// Las fechas pueden venir como «AAAA-MM-DD» o «AAAA-MM-DD HH:mm:ss»; el pipeline solo compara días.
const soloDia = valor => String(valor).slice(0, 10);

// «2026-11-02» -> «02 nov 2026», sin depender del idioma del servidor.
function formatearFecha(valor) {
  const [anio, mes, dia] = soloDia(valor).split('-');
  return `${dia} ${MESES_ABREVIADOS[Number(mes) - 1]} ${anio}`;
}

function faseDe({ estado, modalidad, fechaSalida, fechaRegreso, hoy }) {
  const dia = soloDia(hoy);
  if (estado === ESTADOS.RECHAZADA) return FASES.RECHAZADA;
  if (estado === ESTADOS.ESPERANDO_AUTORIZACION) return soloDia(fechaSalida) < dia ? FASES.VENCIDA : FASES.ESPERANDO;
  if (estado === ESTADOS.LIQUIDADA) return FASES.LIQUIDADA;
  if (estado !== ESTADOS.AUTORIZADA) throw new Error(`Estado de solicitud desconocido: «${estado}».`);
  if (modalidad !== MODALIDADES.MAS_DE_UN_DIA) return FASES.AUTORIZADA;
  if (dia < soloDia(fechaSalida)) return FASES.AUTORIZADA;
  return dia <= soloDia(fechaRegreso) ? FASES.EN_CURSO : FASES.TERMINADA;
}

const { PENDIENTE, ACTUAL, COMPLETADO, RECHAZADO } = ESTADOS_PASO;

// Estado de cada paso por fase, en el orden Esperando autorización, Autorizado, En curso/Terminado, Liquidado.
const PASOS_POR_FASE = Object.freeze({
  [FASES.ESPERANDO]: [ACTUAL, PENDIENTE, PENDIENTE, PENDIENTE],
  [FASES.VENCIDA]: [ACTUAL, PENDIENTE, PENDIENTE, PENDIENTE],
  [FASES.RECHAZADA]: [RECHAZADO, PENDIENTE, PENDIENTE, PENDIENTE],
  [FASES.AUTORIZADA]: [COMPLETADO, ACTUAL, PENDIENTE, PENDIENTE],
  [FASES.EN_CURSO]: [COMPLETADO, COMPLETADO, ACTUAL, PENDIENTE],
  [FASES.TERMINADA]: [COMPLETADO, COMPLETADO, COMPLETADO, ACTUAL],
  [FASES.LIQUIDADA]: [COMPLETADO, COMPLETADO, COMPLETADO, COMPLETADO]
});

// El viaje corto solo tiene los dos primeros pasos y termina autorizado.
const PASOS_CORTO_POR_FASE = Object.freeze({
  [FASES.ESPERANDO]: [ACTUAL, PENDIENTE],
  [FASES.VENCIDA]: [ACTUAL, PENDIENTE],
  [FASES.RECHAZADA]: [RECHAZADO, PENDIENTE],
  [FASES.AUTORIZADA]: [COMPLETADO, COMPLETADO]
});

function armarPasos(fase, esLargo) {
  // Un viaje corto no se liquida: si llegara marcado así, se muestra como autorizado.
  const estados = esLargo ? PASOS_POR_FASE[fase] : (PASOS_CORTO_POR_FASE[fase] || PASOS_CORTO_POR_FASE[FASES.AUTORIZADA]);
  const viajeTerminado = fase === FASES.TERMINADA || fase === FASES.LIQUIDADA;
  const claves = [
    [PASOS.AUTORIZACION, msg('pipeline.paso.autorizacion')],
    [PASOS.AUTORIZADO, msg('pipeline.paso.autorizado')],
    [PASOS.VIAJE, msg(viajeTerminado ? 'pipeline.paso.terminado' : 'pipeline.paso.enCurso')],
    [PASOS.LIQUIDADO, msg('pipeline.paso.liquidado')]
  ];
  return estados.map((estado, i) => ({ clave: claves[i][0], etiqueta: claves[i][1], estado }));
}

function detalleDe(fase, { esLargo, fechaSalida, fechaRegreso, motivoRechazo, fechaLiquidacion }) {
  switch (fase) {
    case FASES.RECHAZADA:
      return motivoRechazo ? msg('pipeline.detalle.rechazada', { motivo: motivoRechazo }) : msg('pipeline.detalle.rechazadaSinMotivo');
    case FASES.AUTORIZADA:
      return msg(esLargo ? 'pipeline.detalle.autorizadaInicia' : 'pipeline.detalle.autorizadaViaja', { fecha: formatearFecha(fechaSalida) });
    case FASES.EN_CURSO:
      return msg('pipeline.detalle.en_curso', { fecha: formatearFecha(fechaRegreso) });
    case FASES.LIQUIDADA:
      return fechaLiquidacion ? msg('pipeline.detalle.liquidada', { fecha: formatearFecha(fechaLiquidacion) }) : msg('pipeline.detalle.liquidadaSinFecha');
    default:
      return msg(`pipeline.detalle.${fase}`);
  }
}

function accionesDe(fase, esLargo) {
  const acciones = [ACCIONES.VER];
  if (fase === FASES.ESPERANDO || fase === FASES.VENCIDA || fase === FASES.RECHAZADA) acciones.push(ACCIONES.MODIFICAR, ACCIONES.DAR_DE_BAJA);
  if (esLargo && fase === FASES.TERMINADA) acciones.push(ACCIONES.LIQUIDAR);
  return acciones;
}

// `hoy` es la fecha de Guatemala; motivoRechazo (último motivo del historial) y fechaLiquidacion solo adornan el detalle.
function calcularPipeline({ estado, modalidad, fechaSalida, fechaRegreso, hoy, motivoRechazo = null, fechaLiquidacion = null }) {
  const esLargo = modalidad === MODALIDADES.MAS_DE_UN_DIA;
  const fase = faseDe({ estado, modalidad, fechaSalida, fechaRegreso, hoy });
  return {
    fase,
    pasos: armarPasos(fase, esLargo),
    etiqueta: msg(`pipeline.estado.${fase}`),
    detalle: detalleDe(fase, { esLargo, fechaSalida, fechaRegreso, motivoRechazo, fechaLiquidacion }),
    vencida: fase === FASES.VENCIDA,
    acciones: accionesDe(fase, esLargo)
  };
}

module.exports = { calcularPipeline, faseDe, formatearFecha };
