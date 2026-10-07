// src/modules/vales/services/valeAdjuntosService.js
// Verificación de adjuntos por taller: el encargado confirma que los recibió o
// los rechaza; el asesor responde y el vale vuelve al encargado.
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const valeEvents = require('../events');
const valeMutex = require('./valeMutex');
const valeTallerService = require('./valeTallerService');
const {
  ESTADOS_TALLER, enriquecer, registrarHistorial, requerirVale, puedeActuarComoAsesor
} = require('./valeHelpers');

const MAX_PALABRAS_RESPUESTA = 200;
const MENSAJE_POR_DEFECTO = 'Adjuntos enviados al correo';
const ESTADOS_POR_VERIFICAR = [ESTADOS_TALLER.VERIFICANDO_ADJUNTOS, ESTADOS_TALLER.ADJUNTOS_RESPONDIDOS];

function validarRespuesta(mensaje) {
  const texto = String(mensaje || '').trim() || MENSAJE_POR_DEFECTO;
  const palabras = texto.split(/\s+/).filter(Boolean).length;
  if (palabras > MAX_PALABRAS_RESPUESTA) throw new Error(`El mensaje no puede tener más de ${MAX_PALABRAS_RESPUESTA} palabras.`);
  if (texto.length > 2000) throw new Error('El mensaje es demasiado largo. Resúmelo un poco.');
  return texto;
}

class ValeAdjuntosService {
  async _salasAsesor(vale) {
    const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
    return [`asesor:${vale.asesor_id}`, ...supervisores.map(s => `supervisor:${s.id}`)];
  }

  async _nombreTaller(tallerId) {
    const taller = await tallerRepository.obtenerPorId(tallerId);
    return taller ? taller.nombre : String(tallerId);
  }

  async verificarAdjuntos(usuario, valeId, tallerIdHint) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      const fila = await valeTallerService._resolverFilaTallerParaEncargado(usuario, valeId, tallerIdHint);
      if (!ESTADOS_POR_VERIFICAR.includes(fila.estado)) {
        throw new Error('Este vale no está esperando que verifiques sus adjuntos en tu taller.');
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.PENDIENTE_ASIGNACION);
      const nombre = await this._nombreTaller(fila.taller_id);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, fila.estado, ESTADOS_TALLER.PENDIENTE_ASIGNACION,
        `Encargado de ${nombre} confirmó que recibió los adjuntos`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: `adjuntos verificados (${nombre})`, tipo: 'ADJUNTOS_VERIFICADOS', actor: usuario.nombre, actorId: usuario.id,
        salas: [...await this._salasAsesor(vale), `taller:${fila.taller_id}`]
      });
      return enriquecer(actualizado);
    });
  }

  async rechazarAdjuntos(usuario, valeId, tallerIdHint) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      const fila = await valeTallerService._resolverFilaTallerParaEncargado(usuario, valeId, tallerIdHint);
      if (!ESTADOS_POR_VERIFICAR.includes(fila.estado)) {
        throw new Error('Este vale no está esperando que verifiques sus adjuntos en tu taller.');
      }
      await valeTallerRepository.rechazarAdjuntos(fila.id);
      const nombre = await this._nombreTaller(fila.taller_id);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, fila.estado, ESTADOS_TALLER.ADJUNTOS_RECHAZADOS,
        `Encargado de ${nombre} rechazó el vale: no recibió los adjuntos`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: `rechazado por falta de adjuntos (${nombre})`, tipo: 'ADJUNTOS_RECHAZADOS', actor: usuario.nombre, actorId: usuario.id,
        nivel: 'alerta', salas: [...await this._salasAsesor(vale), `taller:${fila.taller_id}`]
      });
      return enriquecer(actualizado);
    });
  }

  async responderAdjuntos(usuario, valeId, tallerId, mensaje) {
    return valeMutex.conLockDeVale(valeId, async () => {
      if (!puedeActuarComoAsesor(usuario)) {
        throw new Error('Solo un asesor o un supervisor de ventas puede responder sobre los adjuntos.');
      }
      const vale = await requerirVale(valeId);
      if (vale.asesor_id !== usuario.id) {
        throw new Error('Solo puedes responder sobre tus propios vales.');
      }
      const fila = (await valeTallerRepository.listarPorVale(valeId)).find(f => f.taller_id === Number(tallerId));
      if (!fila) throw new Error('Este vale no fue enviado a ese taller.');
      if (fila.estado !== ESTADOS_TALLER.ADJUNTOS_RECHAZADOS) {
        throw new Error('Este taller no está esperando una respuesta tuya sobre los adjuntos.');
      }
      const texto = validarRespuesta(mensaje);
      await valeTallerRepository.responderAdjuntos(fila.id, texto);
      const nombre = await this._nombreTaller(fila.taller_id);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.ADJUNTOS_RECHAZADOS, ESTADOS_TALLER.ADJUNTOS_RESPONDIDOS,
        `Asesor respondió sobre los adjuntos (${nombre}): ${texto}`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: `respondido sobre adjuntos (${nombre})`, tipo: 'ADJUNTOS_RESPONDIDOS', actor: usuario.nombre, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`]
      });
      return enriquecer(actualizado);
    });
  }
}

module.exports = new ValeAdjuntosService();
