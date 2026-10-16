// src/modules/vales/services/valeModificacionBasicaService.js
// Modificación básica: no crea vale MOD. Con el vale en el paso 5 (PENDIENTE_CONFIRMACION) o ya confirmado (RECIBIDO), el asesor le
// pide un cambio pequeño a uno o varios talleres y conversan; el taller acepta o rechaza. Si acepta, su fila vuelve a ASIGNADO (mismo
// diseñador) para rehacer la propuesta y el vale pasa a CREADO con la entrega en el siguiente día hábil; al aprobarse la nueva
// propuesta el vale vuelve al paso 5 para confirmarlo otra vez. Si rechaza (o el asesor cancela) nada cambia. No valida cupo.
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const tallerRepository = require('../repositories/tallerRepository');
const modificacionRepository = require('../repositories/valeModificacionBasicaRepository');
const valeEvents = require('../events');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const valeMutex = require('./valeMutex');
const valeTallerService = require('./valeTallerService');
const calendarioService = require('../../../core/calendario/calendarioService');
const {
  ESTADOS, ESTADOS_TALLER, DIAS_HABILES_MODIFICACION, esDeTaller, enriquecer, hoyISO, horaActual,
  requerirVale, assertPropioDelAsesor, puedeActuarComoAsesor, validarMensajeChat
} = require('./valeHelpers');

const EN_CONVERSACION = 'EN_CONVERSACION';
const fmtFecha = (iso) => String(iso).slice(0, 10).split('-').reverse().join('/');

class ValeModificacionBasicaService {
  async _salasAsesor(vale) {
    const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
    return [`asesor:${vale.asesor_id}`, ...supervisores.map(s => `supervisor:${s.id}`)];
  }

  // Fecha de entrega que regiría: el siguiente día hábil contado desde hoy, sin adelantar nunca la que ya tiene el vale.
  async _fechaNueva(vale, talleresIds) {
    const minima = await calendarioService.fechaMinimaModificacion(talleresIds, DIAS_HABILES_MODIFICACION.BASICA);
    if (!minima) throw new Error('No hay ningún día configurado para recibir vales de arte. Avisa al administrador.');
    const actual = String(vale.fecha_entrega).slice(0, 10);
    const iso = minima > actual ? minima : actual;
    if (iso >= String(vale.fecha_evento).slice(0, 10)) {
      throw new Error(`La nueva entrega (${fmtFecha(iso)}) llega al día del evento. Usa una Media o Avanzada.`);
    }
    return `${iso} 23:59:59`;
  }

  // Quién participa en la conversación: el asesor dueño o el equipo del taller (encargado y asistentes).
  async _resolverAcceso(usuario, vale, mod) {
    if (esDeTaller(usuario)) {
      const fila = await valeTallerService._resolverFilaTallerParaEncargado(usuario, vale.id, mod.taller_id);
      if (fila.id !== mod.vale_taller_id) throw new ErrorDeNegocio('No tienes acceso a esta conversación.', 403);
      return { fila, lado: 'TALLER' };
    }
    if (vale.asesor_id === usuario.id && puedeActuarComoAsesor(usuario)) {
      return { fila: await valeTallerRepository.obtenerPorId(mod.vale_taller_id), lado: 'ASESOR' };
    }
    throw new ErrorDeNegocio('No tienes acceso a esta conversación.', 403);
  }

  async _cargar(valeId, modId) {
    const vale = await requerirVale(valeId);
    const mod = await modificacionRepository.obtenerPorId(Number(modId));
    if (!mod || mod.vale_id !== vale.id) throw new Error('Esa solicitud no existe.');
    return { vale, mod };
  }

  async solicitar(usuario, valeId, { talleres, mensaje }) {
    const texto = validarMensajeChat(mensaje);
    return valeMutex.conLockDeVale(valeId, async () => {
      if (!puedeActuarComoAsesor(usuario)) throw new Error('Solo un asesor o supervisor de ventas puede pedirla.');
      const vale = await requerirVale(valeId);
      assertPropioDelAsesor(usuario, vale);
      if (![ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.RECIBIDO].includes(vale.estado)) {
        throw new Error('La básica se pide cuando el vale ya tiene su propuesta lista.');
      }
      if (Number(vale.modificado)) throw new Error('Este vale ya fue modificado. Pídela sobre el más reciente.');
      if (await valeRepository.obtenerModificacionEnTramite(valeId)) {
        throw new Error('Ya hay una modificación con vale MOD en trámite.');
      }
      const filas = await valeTallerRepository.listarPorVale(valeId);
      const pedidos = [...new Set((Array.isArray(talleres) ? talleres : []).map(Number).filter(Number.isFinite))];
      const elegidas = filas.length === 1 && !pedidos.length ? filas : filas.filter(f => pedidos.includes(f.taller_id));
      if (!elegidas.length || (pedidos.length && elegidas.length !== pedidos.length)) throw new Error('Elige un taller.');
      for (const fila of elegidas) {
        if (fila.estado !== ESTADOS_TALLER.APROBADO) throw new Error('Ese taller aún no tiene su propuesta aprobada.');
      }
      const nombres = new Map((await tallerRepository.listarActivos()).map(t => [t.id, t.nombre]));
      const fechaNueva = await this._fechaNueva(vale, filas.map(f => f.taller_id));
      await modificacionRepository.crear({
        valeId, solicitanteId: usuario.id, fechaAnterior: vale.fecha_entrega, fechaNueva, mensaje: texto, estadoVale: vale.estado,
        filas: elegidas.map(f => ({ id: f.id, taller_id: f.taller_id, disenador_id: f.disenador_id, taller_nombre: nombres.get(f.taller_id) || `#${f.taller_id}` }))
      });
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, texto: `${usuario.nombre} pidió una modificación: ${texto}`, tipo: 'MOD_BASICA_SOLICITADA', actor: usuario.nombre, actorId: usuario.id,
        salas: elegidas.map(f => `taller:${f.taller_id}`)
      });
      valeEvents.refrescar({ vale: actualizado, salas: await this._salasAsesor(vale) });
      return this.listar(usuario, valeId);
    });
  }

  // Solicitudes del vale que el usuario puede ver: todas para el asesor dueño, solo las de su taller para el equipo del taller.
  async listar(usuario, valeId) {
    const vale = await requerirVale(valeId);
    let mods = await modificacionRepository.listarPorVale(valeId);
    if (esDeTaller(usuario)) {
      const fila = await valeTallerService._resolverFilaTallerParaEncargado(usuario, valeId);
      mods = mods.filter(m => m.vale_taller_id === fila.id);
    } else if (!(vale.asesor_id === usuario.id && puedeActuarComoAsesor(usuario))) {
      throw new ErrorDeNegocio('No tienes acceso a las modificaciones de este vale.', 403);
    }
    const conteo = await modificacionRepository.contarMensajes(mods.map(m => m.id));
    return mods.map(m => ({
      id: m.id, taller_id: m.taller_id, taller: m.taller, estado: m.estado, solicitante: m.solicitante,
      fecha_entrega_anterior: m.fecha_entrega_anterior, fecha_entrega_nueva: m.fecha_entrega_nueva,
      creado_en: m.creado_en, resuelto_en: m.resuelto_en, mensajes: conteo.get(m.id) || 0
    }));
  }

  async listarConversacion(usuario, valeId, modId) {
    const { vale, mod } = await this._cargar(valeId, modId);
    const { lado } = await this._resolverAcceso(usuario, vale, mod);
    const abierta = mod.estado === EN_CONVERSACION;
    const mensajes = await modificacionRepository.listarMensajes(mod.id);
    return {
      id: mod.id, taller_id: mod.taller_id, taller: mod.taller, estado: mod.estado, cerrada: !abierta, lado,
      puede_escribir: abierta, puede_decidir: abierta && lado === 'TALLER', puede_cancelar: abierta && lado === 'ASESOR',
      fecha_entrega_anterior: mod.fecha_entrega_anterior, fecha_entrega_nueva: mod.fecha_entrega_nueva,
      total: mensajes.length,
      mensajes: mensajes.map(m => ({ id: m.id, lado: m.lado, autor: m.autor, autor_id: m.autor_id, mensaje: m.mensaje, creado_en: m.creado_en }))
    };
  }

  async enviarMensaje(usuario, valeId, modId, mensaje) {
    const texto = validarMensajeChat(mensaje);
    return valeMutex.conLockDeVale(valeId, async () => {
      const { vale, mod } = await this._cargar(valeId, modId);
      const { lado } = await this._resolverAcceso(usuario, vale, mod);
      if (mod.estado !== EN_CONVERSACION) throw new Error('La conversación ya se cerró.');
      await modificacionRepository.crearMensaje(mod.id, usuario.id, lado, texto);
      valeEvents.notificar({
        vale, texto: `${usuario.nombre} escribió en la modificación (${mod.taller})`, tipo: 'MOD_BASICA_MENSAJE', actor: usuario.nombre, actorId: usuario.id,
        salas: lado === 'TALLER' ? [`asesor:${vale.asesor_id}`] : [`taller:${mod.taller_id}`]
      });
      return this.listarConversacion(usuario, valeId, modId);
    });
  }

  // El taller acepta: su fila vuelve a ASIGNADO y el vale sale del paso 5 con la nueva fecha de entrega.
  async aceptar(usuario, valeId, modId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const { vale, mod } = await this._cargar(valeId, modId);
      const { lado, fila } = await this._resolverAcceso(usuario, vale, mod);
      if (lado !== 'TALLER') throw new ErrorDeNegocio('Solo el taller puede aceptar o rechazar.', 403);
      if (mod.estado !== EN_CONVERSACION) throw new Error('Esta solicitud ya se cerró.');
      if (![ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.CREADO, ESTADOS.RECIBIDO].includes(vale.estado)) {
        throw new Error('El vale ya no admite esta modificación.');
      }
      if (fila.estado !== ESTADOS_TALLER.APROBADO) throw new Error('Tu propuesta de este vale ya no está aprobada.');
      const filas = await valeTallerRepository.listarPorVale(valeId);
      // Si pasaron días desde la solicitud, la fecha se recalcula para que nunca quede en el pasado.
      const fechaEntrega = await this._fechaNueva(vale, filas.map(f => f.taller_id));
      await modificacionRepository.aceptar({
        id: mod.id, valeId, valeTallerId: fila.id, tallerId: fila.taller_id, disenadorId: fila.disenador_id, usuarioId: usuario.id,
        estadoValeAnterior: vale.estado, fechaEntrega, fechaAsignacion: `${hoyISO()} ${horaActual()}`,
        accion: `Taller ${mod.taller} aceptó la modificación básica — nueva fecha de entrega ${fmtFecha(fechaEntrega)}`
      });
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, texto: `${mod.taller} aceptó la modificación. Nueva entrega: ${fmtFecha(fechaEntrega)}`,
        tipo: 'MOD_BASICA_ACEPTADA', actor: usuario.nombre, actorId: usuario.id,
        salas: [`asesor:${vale.asesor_id}`, `taller:${fila.taller_id}`, ...(fila.disenador_id ? [`disenador:${fila.disenador_id}`] : [])]
      });
      valeEvents.refrescar({ vale: actualizado, salas: await this._salasAsesor(vale) });
      return enriquecer(actualizado);
    });
  }

  async rechazar(usuario, valeId, modId) {
    return this._cerrar(usuario, valeId, modId, { lado: 'TALLER', estado: 'RECHAZADA', tipo: 'MOD_BASICA_RECHAZADA',
      accion: (mod) => `Taller ${mod.taller} rechazó la modificación básica`,
      texto: (mod, u) => `${mod.taller} rechazó tu modificación`,
      salasDe: (vale) => [`asesor:${vale.asesor_id}`], nivel: 'alerta' });
  }

  async cancelar(usuario, valeId, modId) {
    return this._cerrar(usuario, valeId, modId, { lado: 'ASESOR', estado: 'CANCELADA', tipo: 'MOD_BASICA_CANCELADA',
      accion: (mod) => `Asesor canceló la modificación básica pedida a ${mod.taller}`,
      texto: (mod, u) => `${u.nombre} canceló la modificación (${mod.taller})`,
      salasDe: (vale, mod) => [`taller:${mod.taller_id}`], nivel: 'info' });
  }

  async _cerrar(usuario, valeId, modId, { lado, estado, tipo, accion, texto, salasDe, nivel }) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const { vale, mod } = await this._cargar(valeId, modId);
      const acceso = await this._resolverAcceso(usuario, vale, mod);
      if (acceso.lado !== lado) {
        throw new ErrorDeNegocio(lado === 'TALLER' ? 'Solo el taller puede aceptar o rechazar.' : 'Solo el asesor puede cancelarla.', 403);
      }
      if (mod.estado !== EN_CONVERSACION) throw new Error('Esta solicitud ya se cerró.');
      await modificacionRepository.cerrar({
        id: mod.id, estado, usuarioId: usuario.id, valeId, tallerId: mod.taller_id, estadoVale: vale.estado, accion: accion(mod)
      });
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({ vale: actualizado, texto: texto(mod, usuario), tipo, actor: usuario.nombre, actorId: usuario.id, nivel, salas: salasDe(vale, mod) });
      valeEvents.refrescar({ vale: actualizado, salas: await this._salasAsesor(vale) });
      return enriquecer(actualizado);
    });
  }
}

module.exports = new ValeModificacionBasicaService();
