// src/modules/viaticos/services/rechazoVencimientoService.js
// Vencimiento de las solicitudes rechazadas: avisa al solicitante cuando queda el 25 % del plazo y, al vencer, la pasa a un
// borrador suyo y la elimina con sus archivos. Lo ejecuta el vigilante cada minuto; el plazo se mide con el reloj de MySQL.
const db = require('../../../config/database');
const notificacionService = require('../../../core/notifications/notificacionService');
const rechazoRepo = require('../repositories/rechazoRepository');
const escrituraRepo = require('../repositories/solicitudEscrituraRepository');
const solicitudRepo = require('../repositories/solicitudRepository');
const { ESTADOS, NOTIFICACION, TIEMPO_REAL, RECHAZO, MOVIMIENTOS } = require('../constantes');
const events = require('../events');
const { msg } = require('../mensajes');
const solicitudService = require('./solicitudService');
const borradorService = require('./borradorService');
const movimientoService = require('./movimientoService');
const archivosService = require('./archivosViaticoService');
const { borradorDesdeSolicitud } = require('./borradorDesdeSolicitud');
const { horasDeVigencia, SEGUNDOS_POR_HORA } = require('./rechazoPlazoService');

const MINUTOS_POR_HORA = 60;

// «45 min», «1 h», «1 h 20 min»: lo que queda del plazo, dicho en el aviso.
function formatearDuracion(minutos) {
  const total = Math.max(Number(minutos) || 0, 1);
  if (total < MINUTOS_POR_HORA) return `${total} min`;
  const horas = Math.floor(total / MINUTOS_POR_HORA);
  const resto = total % MINUTOS_POR_HORA;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

class RechazoVencimientoService {
  // Una sola vez por rechazo: se marca antes de notificar para que un fallo del aviso no lo repita cada minuto.
  async avisarPorVencer() {
    const segundos = await horasDeVigencia() * SEGUNDOS_POR_HORA;
    const segundosAviso = Math.round(segundos * RECHAZO.FRACCION_AVISO);
    let avisadas = 0;
    for (const solicitud of await rechazoRepo.listarPorAvisar(segundosAviso, segundos)) {
      try {
        if (await rechazoRepo.marcarAviso(solicitud.id) === 0) continue;
        await notificacionService.registrar([solicitud.solicitanteId], {
          modulo: NOTIFICACION.MODULO,
          tipo: NOTIFICACION.TIPO_POR_VENCER,
          nivel: NOTIFICACION.NIVEL_RECHAZO,
          mensaje: msg('notificacion.solicitudPorVencer', { correlativo: solicitud.correlativo, restante: formatearDuracion(solicitud.minutosRestantes) })
        });
        avisadas += 1;
      } catch (error) {
        console.error(`[Viáticos] No se pudo avisar que la solicitud ${solicitud.correlativo} está por vencer:`, error.message);
      }
    }
    return avisadas;
  }

  // Cada solicitud va en su propia transacción: el fallo de una no detiene a las demás.
  async expirarVencidas() {
    const segundos = await horasDeVigencia() * SEGUNDOS_POR_HORA;
    let expiradas = 0;
    for (const solicitud of await rechazoRepo.listarVencidas(segundos)) {
      try {
        if (await this.expirar(solicitud.id, segundos)) expiradas += 1;
      } catch (error) {
        console.error(`[Viáticos] No se pudo vencer la solicitud ${solicitud.correlativo}:`, error.message);
      }
    }
    return expiradas;
  }

  // Devuelve false si la solicitud dejó de estar rechazada y vencida desde que se listó (p. ej. el solicitante la modificó).
  async expirar(id, segundos) {
    const estadoRechazadaId = await escrituraRepo.estadoId(ESTADOS.RECHAZADA);
    const vencida = await db.transaccion(async tx => {
      const fila = await rechazoRepo.bloquearVencida(id, estadoRechazadaId, segundos, tx);
      if (!fila) return null;
      const detalle = await solicitudService.armarDetalle(await solicitudService.leerEncabezado(id, tx), tx);
      const archivos = await solicitudRepo.listarArchivosDefectos(id, tx);
      const motivo = await rechazoRepo.motivoDelRechazo(id, tx);
      const { modalidad, datos } = borradorDesdeSolicitud(detalle);
      // Borrador y borrado van juntos: o pasan las dos cosas o ninguna.
      const borradorId = await borradorService.crearPorVencimiento(tx, {
        usuarioId: fila.solicitanteId, modalidad, datos, origenCorrelativo: fila.correlativo, origenMotivo: motivo
      });
      // Antes del DELETE y sin actor: lo hace el sistema.
      await movimientoService.registrar(MOVIMIENTOS.VENCIDA, { id, correlativo: fila.correlativo }, null, {}, tx);
      await escrituraRepo.eliminar(id, tx);
      return { ...fila, motivo, borradorId, urls: [...archivos.map(d => d.ruta), fila.pdfRuta] };
    });
    if (!vencida) return false;
    await this.despuesDelCommit(vencida);
    return true;
  }

  // Storage (solo borra en producción), aviso y tiempo real; un fallo se registra y no deshace el vencimiento.
  async despuesDelCommit({ id, correlativo, solicitanteId, motivo, urls }) {
    await archivosService.eliminarArchivos(urls);
    try {
      await notificacionService.registrar([solicitanteId], {
        modulo: NOTIFICACION.MODULO,
        tipo: NOTIFICACION.TIPO_VENCIDA,
        nivel: NOTIFICACION.NIVEL_RECHAZO,
        mensaje: msg('notificacion.solicitudVencida', { correlativo, motivo: motivo ?? '' })
      });
    } catch (error) {
      console.error(`[Viáticos] No se pudo avisar que la solicitud ${correlativo} venció:`, error.message);
    }
    events.emitirActualizacion({ id, correlativo, estado: null, solicitanteId, actorId: null, accion: TIEMPO_REAL.ACCION_VENCIDA });
    events.emitirBorradoresNuevos(solicitanteId);
  }
}

module.exports = new RechazoVencimientoService();
module.exports.formatearDuracion = formatearDuracion;
