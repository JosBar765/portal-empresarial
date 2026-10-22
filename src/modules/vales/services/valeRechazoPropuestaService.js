// src/modules/vales/services/valeRechazoPropuestaService.js
// Rechazo de propuesta: con el vale en PENDIENTE_CONFIRMACION, el asesor dueño rechaza la propuesta de uno o varios talleres y
// conversa con cada uno en su hilo. El taller acepta (su fila vuelve a PENDIENTE_ASIGNACION sin diseñador, el vale a CREADO y el
// atraso se reanuda; la fecha de entrega no cambia) o rechaza (todo sigue igual y el asesor puede volver a rechazar). No valida cupo.
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const tallerRepository = require('../repositories/tallerRepository');
const rechazoRepository = require('../repositories/valeRechazoPropuestaRepository');
const valeEvents = require('../events');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const valeMutex = require('./valeMutex');
const valeTallerService = require('./valeTallerService');
const {
  ESTADOS, ESTADOS_TALLER, esDeTaller, enriquecer, requerirVale, validarMensajeChat
} = require('./valeHelpers');

const ABIERTO = 'ABIERTO';
const PERMISO_RECHAZAR = 'vales.rechazar_propuesta';
const PERMISO_RESPONDER = 'vales.responder_rechazo_propuesta';
// El taller puede responder mientras el vale no haya salido de su trabajo (otro taller pudo aceptar antes).
const ESTADOS_RESPONDIBLES = [ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.CREADO, ESTADOS.APROBADO_DEPARTAMENTO];

const tienePermiso = (usuario, permiso) => (usuario.permissions || []).includes(permiso);
const esAsesorDuenio = (usuario, vale) => vale.asesor_id === usuario.id && tienePermiso(usuario, PERMISO_RECHAZAR);

class ValeRechazoPropuestaService {
  // Refresco silencioso: el asesor dueño y los talleres del vale; los supervisores solo cuando cambia el estado del vale.
  async _salasRefresco(vale, { conSupervisores = false } = {}) {
    const filas = await valeTallerRepository.listarPorVale(vale.id);
    const supervisores = conSupervisores ? (await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id)).map(s => `supervisor:${s.id}`) : [];
    return [...new Set([`asesor:${vale.asesor_id}`, ...supervisores, ...filas.map(f => `taller:${f.taller_id}`)])];
  }

  // Quién participa en la conversación: el asesor dueño o el equipo del taller (encargado y asistentes).
  async _resolverAcceso(usuario, vale, ronda) {
    if (esDeTaller(usuario) && tienePermiso(usuario, PERMISO_RESPONDER)) {
      const fila = await valeTallerService._resolverFilaTallerParaEncargado(usuario, vale.id, ronda.taller_id);
      if (fila.id !== ronda.vale_taller_id) throw new ErrorDeNegocio('No tienes acceso a esta conversación.', 403);
      return { fila, lado: 'TALLER' };
    }
    if (esAsesorDuenio(usuario, vale)) {
      return { fila: await valeTallerRepository.obtenerPorId(ronda.vale_taller_id), lado: 'ASESOR' };
    }
    throw new ErrorDeNegocio('No tienes acceso a esta conversación.', 403);
  }

  async _cargar(valeId, rondaId) {
    const vale = await requerirVale(valeId);
    const ronda = await rechazoRepository.obtenerPorId(Number(rondaId));
    if (!ronda || ronda.vale_id !== vale.id) throw new Error('Ese rechazo no existe.');
    return { vale, ronda };
  }

  async solicitar(usuario, valeId, { talleres, mensaje }) {
    const texto = validarMensajeChat(mensaje);
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      if (!esAsesorDuenio(usuario, vale)) throw new ErrorDeNegocio('Solo el asesor dueño del vale puede rechazar la propuesta.', 403);
      if (vale.estado !== ESTADOS.PENDIENTE_CONFIRMACION) {
        throw new Error('La propuesta solo se puede rechazar mientras el vale espera tu confirmación.');
      }
      if (await valeRepository.obtenerModificacionEnTramite(valeId)) {
        throw new Error('Ya hay una modificación en trámite. Espera la decisión del supervisor.');
      }
      const filas = await valeTallerRepository.listarPorVale(valeId);
      const pedidos = [...new Set((Array.isArray(talleres) ? talleres : []).map(Number).filter(Number.isFinite))];
      const elegidas = filas.length === 1 && !pedidos.length ? filas : filas.filter(f => pedidos.includes(f.taller_id));
      if (!elegidas.length || (pedidos.length && elegidas.length !== pedidos.length)) throw new Error('Elige al menos un taller.');
      const nombres = new Map((await tallerRepository.listarActivos()).map(t => [t.id, t.nombre]));
      for (const fila of elegidas) {
        if (!nombres.has(fila.taller_id)) throw new Error('Ese taller ya no está activo.');
        if (fila.estado !== ESTADOS_TALLER.APROBADO) throw new Error('Ese taller aún no tiene su propuesta aprobada.');
      }
      await rechazoRepository.crear({
        valeId, solicitanteId: usuario.id, mensaje: texto, estadoVale: vale.estado,
        filas: elegidas.map(f => ({ id: f.id, taller_id: f.taller_id, disenador_id: f.disenador_id, taller_nombre: nombres.get(f.taller_id) }))
      });
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, texto: `${usuario.nombre} rechazó la propuesta: ${texto}`, tipo: 'RECHAZO_PROPUESTA_SOLICITADO', actor: usuario.nombre, actorId: usuario.id,
        salas: elegidas.map(f => `taller:${f.taller_id}`)
      });
      valeEvents.refrescar({ vale: actualizado, salas: await this._salasRefresco(vale) });
      return this.listar(usuario, valeId);
    });
  }

  // Rondas a la vista del usuario: todas las del vale para el asesor dueño, solo las de su taller para el equipo del taller.
  async listar(usuario, valeId) {
    const vale = await requerirVale(valeId);
    let rondas = await rechazoRepository.listarVigentesPorVales([vale.id]);
    if (esDeTaller(usuario) && tienePermiso(usuario, PERMISO_RESPONDER)) {
      const fila = await valeTallerService._resolverFilaTallerParaEncargado(usuario, valeId);
      rondas = rondas.filter(r => r.vale_taller_id === fila.id);
    } else if (!esAsesorDuenio(usuario, vale)) {
      throw new ErrorDeNegocio('No tienes acceso a los rechazos de este vale.', 403);
    }
    return rondas.map(r => ({ id: r.id, taller_id: r.taller_id, taller: r.taller, estado: r.estado, creado_en: r.creado_en, resuelto_en: r.resuelto_en }));
  }

  async listarConversacion(usuario, valeId, rondaId) {
    const { vale, ronda } = await this._cargar(valeId, rondaId);
    const { lado } = await this._resolverAcceso(usuario, vale, ronda);
    const abierta = ronda.estado === ABIERTO;
    const mensajes = await rechazoRepository.listarMensajes(ronda.vale_taller_id);
    return {
      id: ronda.id, taller_id: ronda.taller_id, taller: ronda.taller, estado: ronda.estado, cerrada: !abierta, lado,
      puede_escribir: abierta, puede_decidir: abierta && lado === 'TALLER', puede_cancelar: abierta && lado === 'ASESOR',
      total: mensajes.length,
      mensajes: mensajes.map(m => ({ id: m.id, lado: m.lado, autor: m.autor, autor_id: m.autor_id, mensaje: m.mensaje, creado_en: m.creado_en }))
    };
  }

  async enviarMensaje(usuario, valeId, rondaId, mensaje) {
    const texto = validarMensajeChat(mensaje);
    return valeMutex.conLockDeVale(valeId, async () => {
      const { vale, ronda } = await this._cargar(valeId, rondaId);
      const { lado } = await this._resolverAcceso(usuario, vale, ronda);
      if (ronda.estado !== ABIERTO) throw new Error('La conversación ya se cerró.');
      await rechazoRepository.crearMensaje(ronda.vale_taller_id, usuario.id, lado, texto);
      valeEvents.notificar({
        vale, texto: `${usuario.nombre} escribió en el rechazo de propuesta (${ronda.taller})`, tipo: 'RECHAZO_PROPUESTA_MENSAJE', actor: usuario.nombre, actorId: usuario.id,
        salas: lado === 'TALLER' ? [`asesor:${vale.asesor_id}`] : [`taller:${ronda.taller_id}`]
      });
      return this.listarConversacion(usuario, valeId, rondaId);
    });
  }

  // El taller acepta: su fila vuelve a «Por asignar» (el encargado decide el diseñador) y el vale sale del paso 5 con su fecha intacta.
  async aceptar(usuario, valeId, rondaId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const { vale, ronda } = await this._cargar(valeId, rondaId);
      const { lado, fila } = await this._resolverAcceso(usuario, vale, ronda);
      if (lado !== 'TALLER') throw new ErrorDeNegocio('Solo el taller puede aceptar o rechazar.', 403);
      if (ronda.estado !== ABIERTO) throw new Error('Este rechazo ya se cerró.');
      if (!ESTADOS_RESPONDIBLES.includes(vale.estado)) throw new Error('El vale ya no admite este rechazo.');
      if (fila.estado !== ESTADOS_TALLER.APROBADO) throw new Error('Tu propuesta de este vale ya no está aprobada.');
      await rechazoRepository.aceptar({
        id: ronda.id, valeId, valeTallerId: fila.id, tallerId: fila.taller_id, usuarioId: usuario.id, estadoValeAnterior: vale.estado,
        accion: `Taller ${ronda.taller} aceptó el rechazo de propuesta: vuelve a Por asignar`
      });
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, texto: `${ronda.taller} aceptó el rechazo de la propuesta`, tipo: 'RECHAZO_PROPUESTA_ACEPTADO',
        actor: usuario.nombre, actorId: usuario.id, salas: [`asesor:${vale.asesor_id}`, `taller:${fila.taller_id}`]
      });
      // El diseñador que lo tenía ya no lo ve: se le refresca la pantalla sin aviso.
      const salasRefresco = await this._salasRefresco(vale, { conSupervisores: true });
      if (fila.disenador_id) salasRefresco.push(`disenador:${fila.disenador_id}`);
      valeEvents.refrescar({ vale: actualizado, salas: salasRefresco });
      return enriquecer(actualizado);
    });
  }

  // El taller rechaza el rechazo: su mensaje queda en el hilo, el vale sigue en el paso 5 y el atraso sigue detenido.
  async rechazar(usuario, valeId, rondaId, mensaje) {
    if (!String(mensaje == null ? '' : mensaje).trim()) throw new Error('Escribe el motivo del rechazo (por ejemplo, que tramite una modificación).');
    const texto = validarMensajeChat(mensaje);
    return this._cerrar(usuario, valeId, rondaId, { lado: 'TALLER', estado: 'RECHAZADO', mensaje: texto,
      accion: (ronda) => `Taller ${ronda.taller} rechazó el rechazo de propuesta: ${texto}`,
      texto: (ronda) => `${ronda.taller} rechazó tu solicitud: ${texto}`,
      tipo: 'RECHAZO_PROPUESTA_RECHAZADO', salasDe: (vale) => [`asesor:${vale.asesor_id}`], nivel: 'alerta' });
  }

  async cancelar(usuario, valeId, rondaId) {
    return this._cerrar(usuario, valeId, rondaId, { lado: 'ASESOR', estado: 'CANCELADO',
      accion: (ronda) => `Asesor canceló el rechazo de propuesta a ${ronda.taller}`,
      texto: (ronda, u) => `${u.nombre} canceló el rechazo de la propuesta (${ronda.taller})`,
      tipo: 'RECHAZO_PROPUESTA_CANCELADO', salasDe: (vale, ronda) => [`taller:${ronda.taller_id}`], nivel: 'info' });
  }

  async _cerrar(usuario, valeId, rondaId, { lado, estado, mensaje = null, accion, texto, tipo, salasDe, nivel }) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const { vale, ronda } = await this._cargar(valeId, rondaId);
      const acceso = await this._resolverAcceso(usuario, vale, ronda);
      if (acceso.lado !== lado) {
        throw new ErrorDeNegocio(lado === 'TALLER' ? 'Solo el taller puede aceptar o rechazar.' : 'Solo el asesor puede cancelarlo.', 403);
      }
      if (ronda.estado !== ABIERTO) throw new Error('Este rechazo ya se cerró.');
      await rechazoRepository.cerrar({
        id: ronda.id, estado, usuarioId: usuario.id, valeId, tallerId: ronda.taller_id, valeTallerId: ronda.vale_taller_id,
        estadoVale: vale.estado, accion: accion(ronda), mensaje
      });
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({ vale: actualizado, texto: texto(ronda, usuario), tipo, actor: usuario.nombre, actorId: usuario.id, nivel, salas: salasDe(vale, ronda) });
      valeEvents.refrescar({ vale: actualizado, salas: await this._salasRefresco(vale) });
      return enriquecer(actualizado);
    });
  }
}

module.exports = new ValeRechazoPropuestaService();
