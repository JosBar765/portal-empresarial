// src/modules/vales/services/valeConfirmacionService.js
// Asesor: confirmar de recibido y descarga del PDF de un vale.
const valeRepository = require('../repositories/valeRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const valeEvents = require('../events');
const valeMutex = require('./valeMutex');
const valeDetalleService = require('./valeDetalleService');
const {
  ESTADOS, hoyISO, horaActual, enriquecer, registrarHistorial, requerirVale, assertPropioDelAsesor
} = require('./valeHelpers');

class ValeConfirmacionService {
  async confirmarRecibido(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      assertPropioDelAsesor(usuario, vale);
      if (vale.estado !== ESTADOS.PENDIENTE_CONFIRMACION) {
        throw new Error('Solo se puede confirmar de recibido un vale que está pendiente de tu confirmación.');
      }
      // Con una modificación en trámite hay un solo camino a la vez: se espera su decisión, o se da de baja el MOD-.
      const modEnTramite = await valeRepository.obtenerModificacionEnTramite(valeId);
      if (modEnTramite) {
        throw new Error(`Este vale tiene la solicitud de modificación ${modEnTramite.correlativo} en trámite. Espera la decisión del supervisor o da de baja esa solicitud antes de confirmarlo.`);
      }
      await valeRepository.actualizarEstado(valeId, ESTADOS.RECIBIDO);
      const ahora = `${hoyISO()} ${horaActual()}`;
      // Congela el atraso de forma permanente — ya no debe seguir corriendo
      // aunque más adelante se solicite una modificación sobre este vale.
      await valeRepository.congelarAtraso(valeId, ahora);
      // Sella cuándo se confirmó — lo usa el Supervisor en su "Trabajo
      // Realizado" (segundo grupo, orden por esta fecha).
      await valeRepository.sellarConfirmacion(valeId, ahora);
      await registrarHistorial(valeId, usuario.id, null, vale.estado, ESTADOS.RECIBIDO, 'Asesor confirmó de recibido el vale de arte');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // Notifica a TODOS los supervisores que cubren la tienda de este
      // asesor (pueden ser varios, rotativos).
      const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(usuario.id);
      valeEvents.notificar({
        vale: actualizado, accion: 'confirmado de recibido', actor: usuario.nombre, actorId: usuario.id,
        salas: supervisores.map(s => `supervisor:${s.id}`)
      });
      return enriquecer(actualizado);
    });
  }

  // "Ver PDF" siempre sirve el PDF del vale que se pidió, nunca el de otro (el original y su MOD- son
  // dos vales independientes). Mismo chequeo de pertenencia que el detalle del vale.
  async obtenerValeParaPdf(usuario, valeId) {
    const vale = await requerirVale(valeId);
    if (!(await valeDetalleService.puedeVerValePorId(usuario, valeId))) {
      throw new Error('No tienes acceso a este vale de arte.');
    }
    return vale;
  }
}

module.exports = new ValeConfirmacionService();
