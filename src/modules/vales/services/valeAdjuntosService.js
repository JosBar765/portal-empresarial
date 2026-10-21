// src/modules/vales/services/valeAdjuntosService.js
// Verificación de adjuntos por taller: el encargado confirma que los recibió o
// los rechaza; el asesor responde y el vale vuelve al encargado.
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const valeMensajeRepository = require('../repositories/valeMensajeRepository');
const valeEvents = require('../events');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const valeMutex = require('./valeMutex');
const valeTallerService = require('./valeTallerService');
const valeCreacionService = require('./valeCreacionService');
const calendarioService = require('../../../core/calendario/calendarioService');
const {
  ESTADOS_TALLER, esDeTaller, esValeDeModificacion, enriquecer, registrarHistorial,
  requerirVale, puedeActuarComoAsesor, algunTallerProtege, SALA_FUSION
} = require('./valeHelpers');

const MAX_CARACTERES_MENSAJE = 200;
const ESTADOS_POR_VERIFICAR = [ESTADOS_TALLER.VERIFICANDO_ADJUNTOS, ESTADOS_TALLER.ADJUNTOS_RESPONDIDOS];
// Mientras el taller tiene el vale rechazado (o ya respondido) la conversación está abierta; después es de solo lectura.
const ESTADOS_CONVERSACION_ABIERTA = [ESTADOS_TALLER.ADJUNTOS_RECHAZADOS, ESTADOS_TALLER.ADJUNTOS_RESPONDIDOS];

// Mensaje de la conversación: texto no vacío de hasta 200 caracteres (se cuentan caracteres, no palabras).
function validarMensaje(mensaje, { obligatorio = true, porDefecto = null } = {}) {
  const texto = String(mensaje == null ? '' : mensaje).trim() || (porDefecto || '');
  if (!texto) {
    if (obligatorio) throw new Error('Escribe un mensaje.');
    return '';
  }
  if (Array.from(texto).length > MAX_CARACTERES_MENSAJE) {
    throw new Error(`El mensaje no puede tener más de ${MAX_CARACTERES_MENSAJE} caracteres.`);
  }
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
      // Si hubo conversación, este es el acuerdo: se cierra y queda solo como registro (los mensajes se conservan).
      const totalMensajes = (await valeMensajeRepository.contarPorValeTaller([fila.id])).get(fila.id) || 0;
      await registrarHistorial(valeId, usuario.id, fila.taller_id, fila.estado, ESTADOS_TALLER.PENDIENTE_ASIGNACION,
        `Encargado de ${nombre} confirmó que recibió los adjuntos${totalMensajes ? `. Conversación cerrada: se llegó a un acuerdo (${totalMensajes} mensaje${totalMensajes === 1 ? '' : 's'})` : ''}`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, texto: `${usuario.nombre} verificó los adjuntos (${nombre})`, tipo: 'ADJUNTOS_VERIFICADOS', actor: usuario.nombre, actorId: usuario.id,
        salas: [...await this._salasAsesor(vale), `taller:${fila.taller_id}`]
      });
      return enriquecer(actualizado);
    });
  }

  // Rechazo general del taller: lleva siempre un mensaje (1 a 200 caracteres) que abre la conversación con el asesor.
  async rechazarAdjuntos(usuario, valeId, tallerIdHint, mensaje) {
    const texto = validarMensaje(mensaje);
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      const fila = await valeTallerService._resolverFilaTallerParaEncargado(usuario, valeId, tallerIdHint);
      if (!ESTADOS_POR_VERIFICAR.includes(fila.estado)) {
        throw new Error('Este vale no está esperando que verifiques sus adjuntos en tu taller.');
      }
      await valeTallerRepository.rechazarAdjuntos(fila.id, await calendarioService.vencimientoPlazo([fila.taller_id]));
      await valeMensajeRepository.crear(fila.id, usuario.id, 'TALLER', texto);
      const nombre = await this._nombreTaller(fila.taller_id);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, fila.estado, ESTADOS_TALLER.ADJUNTOS_RECHAZADOS,
        `Encargado de ${nombre} rechazó el vale: ${texto}`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, texto: `${usuario.nombre} (${nombre}): Rechazado (ver mensaje)`, tipo: 'ADJUNTOS_RECHAZADOS', actor: usuario.nombre, actorId: usuario.id,
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
      const texto = validarMensaje(mensaje);
      await valeTallerRepository.responderAdjuntos(fila.id, texto);
      await valeMensajeRepository.crear(fila.id, usuario.id, 'ASESOR', texto);
      const nombre = await this._nombreTaller(fila.taller_id);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.ADJUNTOS_RECHAZADOS, ESTADOS_TALLER.ADJUNTOS_RESPONDIDOS,
        `Asesor avisó que atendió el rechazo (${nombre})`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: `respondido sobre adjuntos (${nombre})`, tipo: 'ADJUNTOS_RESPONDIDOS', actor: usuario.nombre, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`]
      });
      // El equipo de ventas (supervisores y otras pestañas del asesor) solo refresca la pantalla, en silencio.
      valeEvents.refrescar({ vale: actualizado, salas: await this._salasAsesor(vale) });
      return enriquecer(actualizado);
    });
  }

  // El asesor dueño quita UN taller de un vale con 2 o más talleres mientras ese taller reclama los adjuntos; el vale
  // sigue para los demás. Revalida bajo el lock: el taller pudo verificar o responder entretanto.
  async darDeBajaTaller(usuario, valeId, tallerId) {
    if (!puedeActuarComoAsesor(usuario)) {
      throw new Error('Solo un asesor o un supervisor de ventas puede dar de baja un taller.');
    }
    return this.quitarTallerDeVale(valeId, tallerId, {
      actor: usuario,
      validarVale: (vale) => {
        if (vale.asesor_id !== usuario.id) throw new Error('Solo puedes dar de baja talleres de tus propios vales.');
      }
    });
  }

  // Núcleo reutilizable: `actor` es { id, nombre } (puede ser el sistema); `validarVale` es la comprobación de quién llama.
  async quitarTallerDeVale(valeId, tallerId, { actor, validarVale = null }) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const usuario = actor;
      const vale = await requerirVale(valeId);
      if (validarVale) validarVale(vale);
      if (esValeDeModificacion(vale)) {
        throw new Error('En una solicitud de modificación no se puede quitar un taller: da de baja la solicitud completa.');
      }
      const talleres = await valeTallerRepository.listarPorVale(valeId);
      const fila = talleres.find(f => f.taller_id === Number(tallerId));
      if (!fila) throw new Error('Este vale no fue enviado a ese taller.');
      if (!ESTADOS_CONVERSACION_ABIERTA.includes(fila.estado)) {
        throw new Error('Solo se puede dar de baja un taller que tiene los adjuntos rechazados o respondidos.');
      }
      if (talleres.length < 2) {
        throw new Error('Este es el único taller del vale: usa «Dar de baja» para eliminar el vale completo.');
      }
      await valeTallerRepository.desactivar(fila.id);
      // El texto de talleres solicitados debe quedar igual que las filas activas.
      await valeRepository.actualizarTalleresSolicitados(valeId, talleres.filter(f => f.id !== fila.id).map(f => f.taller_id).join(','));
      await valeTallerService._recalcularEstadoVale(valeId, usuario.id);
      const nombre = await this._nombreTaller(fila.taller_id);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, vale.estado, actualizado.estado,
        `Asesor dio de baja al taller ${nombre} del vale (adjuntos). Conversación cerrada`);
      valeEvents.notificar({
        vale: actualizado, texto: `${usuario.nombre} dio de baja al taller ${nombre}`, tipo: 'TALLER_DADO_DE_BAJA', actor: usuario.nombre, actorId: usuario.id,
        nivel: 'alerta', salas: [...await this._salasAsesor(vale), `taller:${fila.taller_id}`]
      });
      // Los talleres que siguen (y quienes fusionan, si el vale quedó listo) solo refrescan su pantalla.
      const salasQueSiguen = talleres.filter(f => f.id !== fila.id).flatMap(f => [`taller:${f.taller_id}`, ...(f.disenador_id ? [`disenador:${f.disenador_id}`] : [])]);
      valeEvents.refrescar({ vale: actualizado, salas: [...new Set([...salasQueSiguen, SALA_FUSION])] });
      return enriquecer(actualizado);
    });
  }

  // Quién puede leer y escribir la conversación de un taller dentro de un vale: solo el taller (encargado/asistente) y el
  // asesor dueño, mientras está abierta.
  async _resolverAcceso(usuario, vale, tallerId) {
    const fila = (await valeTallerRepository.listarPorVale(vale.id)).find(f => f.taller_id === Number(tallerId));
    if (!fila) throw new Error('Este vale no fue enviado a ese taller.');
    if (esDeTaller(usuario)) {
      await valeTallerService._resolverFilaTallerParaEncargado(usuario, vale.id, fila.taller_id);
      return { fila, escribe: 'TALLER' };
    }
    if (vale.asesor_id === usuario.id && puedeActuarComoAsesor(usuario)) return { fila, escribe: 'ASESOR' };
    // Nadie más la ve mientras está abierta (ni supervisor, ni administrador, ni gerente); ya cerrada, solo queda el registro
    // del historial para quien tenga `vales.ver_historial`.
    throw new ErrorDeNegocio('No tienes acceso a esta conversación.', 403);
  }

  // Mientras el taller tiene el vale rechazado o respondido la conversación está abierta. Al llegar a un acuerdo (el taller
  // verifica los adjuntos) deja de verse: el servidor no devuelve ningún mensaje y solo queda el registro del historial.
  async listarConversacion(usuario, valeId, tallerId) {
    const vale = await requerirVale(valeId);
    const { fila, escribe } = await this._resolverAcceso(usuario, vale, tallerId);
    if (!ESTADOS_CONVERSACION_ABIERTA.includes(fila.estado)) {
      return { taller_id: fila.taller_id, estado: fila.estado, cerrada: true, puede_escribir: false, total: 0, mensajes: [] };
    }
    const mensajes = await valeMensajeRepository.listarPorValeTaller(fila.id);
    return {
      taller_id: fila.taller_id, estado: fila.estado, vence_en: fila.adjuntos_vence_en, cerrada: false,
      puede_escribir: !!escribe, lado: escribe,
      total: mensajes.length,
      mensajes: mensajes.map(m => ({ id: m.id, lado: m.lado, autor: m.autor, autor_id: m.autor_id, mensaje: m.mensaje, creado_en: m.creado_en }))
    };
  }

  async enviarMensaje(usuario, valeId, tallerId, mensaje) {
    const texto = validarMensaje(mensaje);
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      const { fila, escribe } = await this._resolverAcceso(usuario, vale, tallerId);
      if (!escribe) throw new Error('Solo el taller y el asesor del vale pueden escribir en la conversación.');
      if (!ESTADOS_CONVERSACION_ABIERTA.includes(fila.estado)) {
        throw new Error('La conversación se cerró: se llegó a un acuerdo.');
      }
      await valeMensajeRepository.crear(fila.id, usuario.id, escribe, texto);
      const nombre = await this._nombreTaller(fila.taller_id);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: `comentado en la conversación del rechazo (${nombre})`, tipo: 'MENSAJE_RECHAZO', actor: usuario.nombre, actorId: usuario.id,
        salas: escribe === 'TALLER' ? [`asesor:${vale.asesor_id}`] : [`taller:${fila.taller_id}`] // el supervisor no lee la conversación: sin aviso ni campana
      });
      return this.listarConversacion(usuario, valeId, tallerId);
    });
  }

  // true si algún taller (filas de listarPorVale) protege el vale: el vencimiento de otro taller no lo borra.
  algunTallerProtege(talleres) {
    return algunTallerProtege(talleres);
  }

  // Venció el plazo sin respuesta del asesor: se borra el vale completo (el original de un MOD- no se toca), salvo que
  // otro taller ya lo haya aceptado o el asesor ya le haya respondido: ese trabajo no se pierde (el taller trabado se quita a mano, runbook en Engram).
  // Revalida bajo el lock: el asesor o el encargado pudieron actuar entretanto.
  async expirarPorAdjuntos(valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await valeRepository.obtenerPorId(valeId);
      if (!vale || !(await valeTallerRepository.listarAdjuntosVencidos(valeId)).length) return false;
      const talleres = await valeTallerRepository.listarPorVale(valeId);
      if (this.algunTallerProtege(talleres)) return false;
      const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
      const original = esValeDeModificacion(vale) ? await valeRepository.obtenerPorId(vale.vale_original_id) : null;
      const horas = await calendarioService.horasVencimiento();
      await valeCreacionService.eliminarValeConArchivos(valeId);
      const salasTalleres = [...new Set(talleres.flatMap(t => [`taller:${t.taller_id}`, ...(t.disenador_id ? [`disenador:${t.disenador_id}`] : [])]))];
      valeEvents.notificar({
        vale, tipo: 'ADJUNTOS_VENCIDOS', valeBorrado: true, nivel: 'alerta',
        texto: `${original ? '(solicitud de modificación) ' : ''}fue eliminado automáticamente: el asesor no envió los adjuntos en ${horas} ${horas === 1 ? 'hora laboral' : 'horas laborales'}${original ? `. ${original.correlativo} ya quedó como Recibido` : ''}`,
        salas: [`asesor:${vale.asesor_id}`, ...supervisores.map(s => `supervisor:${s.id}`), ...salasTalleres]
      });
      return true;
    });
  }
}

module.exports = new ValeAdjuntosService();
