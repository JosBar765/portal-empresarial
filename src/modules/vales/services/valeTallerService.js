// src/modules/vales/services/valeTallerService.js
// Transiciones dentro de un taller (asignar / comenzar / entregar / pausar /
// reanudar / cancelar / revisar) y la fusión final del Encargado General
// (aprobarGeneral) — el paso terminal del ciclo de un taller, no una feature
// aparte, por eso vive aquí en vez de en un archivo propio.
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const fileStorage = require('../../../core/files/fileStorage');
const valeEvents = require('../events');
const valeMutex = require('./valeMutex');
const valeCatalogoService = require('./valeCatalogoService');
const valeCreacionService = require('./valeCreacionService');
const {
  ESTADOS, ESTADOS_TALLER, hoyISO, horaActual, enriquecer,
  etiquetaActorTaller, registrarHistorial, esAdministrador,
  esValeDeModificacion, requerirVale
} = require('./valeHelpers');

class ValeTallerService {
  // Resuelve la fila de vale_talleres sobre la que un encargado puede
  // actuar para un vale dado: la de SU PROPIO taller (nunca confía en un
  // tallerId del cliente, salvo para el administrador, que no tiene taller
  // propio y puede indicarlo).
  async _resolverFilaTallerParaEncargado(usuario, valeId, tallerIdHint) {
    const filas = await valeTallerRepository.listarPorVale(valeId);
    if (esAdministrador(usuario)) {
      if (tallerIdHint) {
        const fila = filas.find(f => f.taller_id === Number(tallerIdHint));
        if (!fila) throw new Error('Este vale no fue enviado a ese taller.');
        return fila;
      }
      if (filas.length === 1) return filas[0];
      throw new Error('Este vale tiene más de un taller — indique a cuál taller corresponde la acción.');
    }
    const talleres = await tallerRepository.listarActivos();
    const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
    const miTaller = talleres.find(t => t.encargado_id === idEfectivo);
    if (!miTaller) throw new Error('Su usuario no tiene un taller asignado.');
    const fila = filas.find(f => f.taller_id === miTaller.id);
    if (!fila) throw new Error('Este vale no fue enviado a su taller.');
    return fila;
  }

  async asignar(usuario, valeId, tecnicoId, tallerIdHint) {
    return valeMutex.conLockDeVale(valeId, async () => {
      await requerirVale(valeId);
      const fila = await this._resolverFilaTallerParaEncargado(usuario, valeId, tallerIdHint);
      if (fila.estado !== ESTADOS_TALLER.PENDIENTE_ASIGNACION) {
        throw new Error('Este taller ya tiene un técnico asignado para este vale.');
      }
      // Un encargado puede asignarse el vale a SÍ MISMO — la fila ya está
      // acotada a su propio taller por _resolverFilaTallerParaEncargado, así
      // que nunca cruza a un taller ajeno.
      const esAutoasignacion = !esAdministrador(usuario) && Number(tecnicoId) === Number(usuario.id);
      const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(await valeCatalogoService.idEncargadoEfectivo(usuario));
      if (!esAdministrador(usuario) && !esAutoasignacion && !tecnicos.some(t => t.id === Number(tecnicoId))) {
        throw new Error('El técnico indicado no está bajo su mando.');
      }
      await valeTallerRepository.asignar(fila.id, tecnicoId, `${hoyISO()} ${horaActual()}`);
      const tecnico = await usuarioValeRepository.obtenerPorId(tecnicoId);
      const taller = await tallerRepository.obtenerPorId(fila.taller_id);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.PENDIENTE_ASIGNACION, ESTADOS_TALLER.ASIGNADO,
        `Asignado al técnico ${tecnico ? tecnico.nombre : tecnicoId} (taller ${taller ? taller.nombre : fila.taller_id})`, tecnicoId);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'asignado', actor: usuario.nombre, actorId: usuario.id, destino: tecnico ? tecnico.nombre : null,
        salas: ['tecnico:' + tecnicoId, `taller:${fila.taller_id}`]
      });
      return enriquecer(actualizado);
    });
  }

  async comenzar(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      await requerirVale(valeId);
      const fila = await this._filaDelTecnico(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.ASIGNADO) {
        throw new Error('El vale debe estar ASIGNADO en su taller para poder comenzarlo.');
      }
      const activasDelTecnico = await valeTallerRepository.listarActivasPorTecnico(usuario.id);
      for (const a of activasDelTecnico) {
        if (a.estado === ESTADOS_TALLER.EN_PROCESO) {
          const v = await valeRepository.obtenerPorId(a.vale_id);
          throw new Error(`Ya tienes un vale en proceso (${v ? v.correlativo : a.vale_id}). Debes entregarlo o cancelarlo antes de comenzar otro.`);
        }
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_PROCESO);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, `${etiquetaActorTaller(usuario)} marcó el vale como en proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // El encargado del taller sí debe enterarse cuando su técnico empieza
      // a trabajar un vale.
      valeEvents.notificar({ vale: actualizado, accion: 'tomado en proceso', actor: usuario.nombre, actorId: usuario.id, salas: [`taller:${fila.taller_id}`] });
      return enriquecer(actualizado);
    });
  }

  async _filaDelTecnico(usuario, valeId) {
    const activas = await valeTallerRepository.listarActivasPorTecnico(usuario.id);
    const fila = activas.find(a => a.vale_id === Number(valeId));
    if (!esAdministrador(usuario) && !fila) {
      throw new Error('Este vale de arte no está asignado a este técnico.');
    }
    if (fila) return fila;
    // Administrador sin fila propia: toma la única fila activa del vale.
    const filas = await valeTallerRepository.listarPorVale(valeId);
    if (filas.length !== 1) throw new Error('Este vale tiene más de un taller — no se puede resolver automáticamente.');
    return filas[0];
  }

  async entregar(usuario, valeId, archivoPropuesta) {
    return valeMutex.conLockDeVale(valeId, async () => {
      await requerirVale(valeId);
      const fila = await this._filaDelTecnico(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PROCESO) {
        throw new Error('El vale debe estar EN_PROCESO en su taller para poder entregar la propuesta.');
      }
      let url = null;
      if (archivoPropuesta) {
        const saved = await fileStorage.saveFile(archivoPropuesta.buffer, archivoPropuesta.originalname, archivoPropuesta.mimetype);
        url = saved.path;
      }
      await propuestaRepository.crear(valeId, usuario.id, url);
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_REVISION);
      fila.estado = ESTADOS_TALLER.EN_REVISION;
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION, `${etiquetaActorTaller(usuario)} entregó propuesta`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // Alerta roja si la propuesta va vacía (sin archivo).
      valeEvents.notificar({
        vale: actualizado, accion: 'entregado (propuesta)', actor: usuario.nombre, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`, `tecnico:${usuario.id}`], nivel: url ? 'info' : 'alerta'
      });

      // Si quien entrega es el ENCARGADO de este mismo taller (se autoasignó
      // el vale), su trabajo se autoaprueba — no pasa por un período de
      // revisión de sí mismo.
      if (url) {
        const taller = await tallerRepository.obtenerPorId(fila.taller_id);
        const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
        if (taller && taller.encargado_id === idEfectivo) {
          return this._revisarPropuestaInterno(usuario, valeId, fila, { aprobar: true, esAutoaprobacion: true });
        }
      }
      return enriquecer(actualizado);
    });
  }

  // El técnico puede pausar un vale EN_PROCESO (sin propuesta) para tomar
  // otro más urgente, y reanudarlo después. Mismo patrón que
  // cancelarProcesoTecnico, pero queda en EN_PAUSA en vez de volver a
  // EN_REVISION (la pausa no es una entrega).
  async pausarProceso(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      await requerirVale(valeId);
      const fila = await this._filaDelTecnico(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PROCESO) {
        throw new Error('Solo se puede pausar un vale que esté EN_PROCESO en su taller.');
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_PAUSA);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA, `${etiquetaActorTaller(usuario)} pausó el proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'pausó el proceso', actor: usuario.nombre, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`, `tecnico:${usuario.id}`]
      });
      return enriquecer(actualizado);
    });
  }

  async reanudarProceso(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      await requerirVale(valeId);
      const fila = await this._filaDelTecnico(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PAUSA) {
        throw new Error('Solo se puede reanudar un vale que esté EN_PAUSA en su taller.');
      }
      // Misma regla que comenzar(): un técnico solo puede tener un vale EN_PROCESO a la vez.
      const activasDelTecnico = await valeTallerRepository.listarActivasPorTecnico(usuario.id);
      for (const a of activasDelTecnico) {
        if (a.estado === ESTADOS_TALLER.EN_PROCESO) {
          const v = await valeRepository.obtenerPorId(a.vale_id);
          throw new Error(`Ya tienes un vale en proceso (${v ? v.correlativo : a.vale_id}). Debes entregarlo, cancelarlo o pausarlo antes de reanudar otro.`);
        }
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_PROCESO);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PAUSA, ESTADOS_TALLER.EN_PROCESO, `${etiquetaActorTaller(usuario)} reanudó el proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'reanudó el proceso', actor: usuario.nombre, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`, `tecnico:${usuario.id}`]
      });
      return enriquecer(actualizado);
    });
  }

  async cancelarProcesoTecnico(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      await requerirVale(valeId);
      const fila = await this._filaDelTecnico(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PROCESO) {
        throw new Error('Solo se puede cancelar un vale que esté EN_PROCESO en su taller.');
      }
      // La cancelación no crea una fila "en blanco" en vale_propuestas — el
      // registro de auditoría de este evento vive únicamente en
      // vale_historial, igual que cualquier otra transición de estado.
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_REVISION);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION, `${etiquetaActorTaller(usuario)} canceló el proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'canceló su proceso', actor: usuario.nombre, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`, `tecnico:${usuario.id}`], nivel: 'alerta'
      });
      return enriquecer(actualizado);
    });
  }

  async revisarPropuesta(usuario, valeId, { aprobar, tecnicoReasignadoId, tallerId }) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const fila = await this._resolverFilaTallerParaEncargado(usuario, valeId, tallerId);
      return this._revisarPropuestaInterno(usuario, valeId, fila, { aprobar, tecnicoReasignadoId });
    });
  }

  // Extraído de revisarPropuesta para que entregar() pueda encadenar la
  // autoaprobación de un encargado sin volver a pedir el lock (no es
  // reentrante — ya se sostiene desde entregar()).
  async _revisarPropuestaInterno(usuario, valeId, fila, { aprobar, tecnicoReasignadoId, esAutoaprobacion }) {
    const vale = await requerirVale(valeId);
    if (fila.estado !== ESTADOS_TALLER.EN_REVISION) {
      throw new Error('Solo se pueden revisar talleres en estado EN_REVISION.');
    }
    if (aprobar) {
      const ultimaPropuesta = await propuestaRepository.obtenerUltimaPorValeYTecnico(valeId, fila.tecnico_id);
      if (!ultimaPropuesta || !ultimaPropuesta.url) {
        throw new Error('No se puede aprobar una propuesta en blanco: el técnico debe adjuntar el documento de propuesta.');
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.APROBADO);
      fila.estado = ESTADOS_TALLER.APROBADO;
      const taller = await tallerRepository.obtenerPorId(fila.taller_id);
      const accionHistorial = esAutoaprobacion
        ? 'Encargado aprobó su propio trabajo (autoasignación)'
        : `Encargado de ${taller ? taller.nombre : fila.taller_id} aprobó la propuesta de su taller`;
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_REVISION, ESTADOS_TALLER.APROBADO, accionHistorial, fila.tecnico_id);
      await this._recalcularEstadoVale(valeId, usuario.id);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // El encargado que aprobó también se entera (self-broadcast, igual que
      // el resto de acciones del módulo), además de a quien le toca seguir
      // el flujo (asesor o quien fusiona).
      const targets = actualizado.estado === ESTADOS.PENDIENTE_CONFIRMACION
        ? [`asesor:${vale.asesor_id}`, `taller:${fila.taller_id}`]
        : actualizado.estado === ESTADOS.APROBADO_DEPARTAMENTO
          ? [await valeCatalogoService.salaFusion(), `taller:${fila.taller_id}`]
          : [`taller:${fila.taller_id}`];
      valeEvents.notificar({ vale: actualizado, accion: 'aprobado (taller)', actor: usuario.nombre, actorId: usuario.id, salas: targets });
      return enriquecer(actualizado);
    }

    if (!tecnicoReasignadoId) {
      throw new Error('Debe indicar a qué técnico reasignar el vale desaprobado.');
    }
    // Igual que asignar(), el encargado puede reasignarse el trabajo
    // desaprobado a sí mismo.
    const esAutoasignacion = !esAdministrador(usuario) && Number(tecnicoReasignadoId) === Number(usuario.id);
    const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(await valeCatalogoService.idEncargadoEfectivo(usuario));
    if (!esAdministrador(usuario) && !esAutoasignacion && !tecnicos.some(t => t.id === Number(tecnicoReasignadoId))) {
      throw new Error('El técnico indicado no está bajo su mando.');
    }
    await valeTallerRepository.asignar(fila.id, tecnicoReasignadoId, `${hoyISO()} ${horaActual()}`);
    const tecnico = await usuarioValeRepository.obtenerPorId(tecnicoReasignadoId);
    const accionReasignacion = esAutoasignacion
      ? 'Encargado desaprobó la propuesta y se reasignó el trabajo a sí mismo'
      : `Encargado desaprobó la propuesta y reasignó a ${tecnico ? tecnico.nombre : tecnicoReasignadoId}`;
    await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_REVISION, ESTADOS_TALLER.ASIGNADO,
      accionReasignacion, tecnicoReasignadoId);
    const actualizado = await valeRepository.obtenerPorId(valeId);
    valeEvents.notificar({
      vale: actualizado, accion: 'desaprobado y reasignado', actor: usuario.nombre, actorId: usuario.id, destino: tecnico ? tecnico.nombre : null,
      salas: [`tecnico:${tecnicoReasignadoId}`, `taller:${fila.taller_id}`]
    });
    return enriquecer(actualizado);
  }

  // Recalcula el estado GENERAL del vale a partir del progreso de sus
  // talleres. Si algún taller no está APROBADO, el vale permanece en su
  // estado actual (CREADO/MODIFICADO/etc.) — no hay nada más que hacer todavía.
  async _recalcularEstadoVale(valeId, actorUsuarioId) {
    const filas = await valeTallerRepository.listarPorVale(valeId);
    const todosAprobados = filas.length > 0 && filas.every(f => f.estado === ESTADOS_TALLER.APROBADO);
    if (!todosAprobados) return;

    const vale = await valeRepository.obtenerPorId(valeId);
    // Un vale de modificación (MOD-...) SIEMPRE debe retornar al Encargado
    // General para que apruebe/fusione la corrección — sin importar si se
    // envió a uno o varios talleres — porque esa corrección sobrescribe la
    // propuesta original del taller que cometió el error. Solo un vale
    // "normal" con un único taller puede saltarse al Encargado General.
    const requiereEncargadoGeneral = filas.length > 1 || esValeDeModificacion(vale);
    const nuevoEstado = requiereEncargadoGeneral ? ESTADOS.APROBADO_DEPARTAMENTO : ESTADOS.PENDIENTE_CONFIRMACION;
    if (vale.estado === nuevoEstado) return;

    // Con un solo taller y sin ser modificación no hay fusión que hacer (el
    // Encargado General nunca interviene en el camino feliz) — la propuesta
    // de ese único taller pasa a ser directamente el "documento oficial" del vale.
    if (filas.length === 1 && nuevoEstado === ESTADOS.PENDIENTE_CONFIRMACION) {
      const propuesta = await propuestaRepository.obtenerUltimaPorValeYTecnico(valeId, filas[0].tecnico_id);
      if (propuesta && propuesta.url) {
        await valeRepository.actualizarPropuestaGeneral(valeId, propuesta.url);
      }
    }

    await valeRepository.actualizarEstado(valeId, nuevoEstado);
    const accion = nuevoEstado === ESTADOS.PENDIENTE_CONFIRMACION
      ? 'Único taller aprobado — pasa directo a confirmación del asesor'
      : 'Todos los talleres aprobaron — pendiente de fusión por Encargado General';
    await registrarHistorial(valeId, actorUsuarioId, null, vale.estado, nuevoEstado, accion);
  }

  // -----------------------------------------------------------------------
  // Encargado General: fusiona y aprueba vales multi-taller (también el
  // punto de reentrada cuando el asesor rechaza un vale)
  // -----------------------------------------------------------------------
  async aprobarGeneral(usuario, valeId, archivoFusion) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      if (vale.estado !== ESTADOS.APROBADO_DEPARTAMENTO) {
        throw new Error('Solo se pueden fusionar y aprobar vales en estado APROBADO_DEPARTAMENTO.');
      }
      // La fusión de las propuestas de los talleres NO la hace el sistema —
      // es trabajo manual del Encargado General, que debe adjuntar su
      // propio documento final, aun cuando solo hubo un taller involucrado.
      if (!archivoFusion) {
        throw new Error('Debe adjuntar el documento de fusión antes de aprobar.');
      }
      const saved = await fileStorage.saveFile(archivoFusion.buffer, archivoFusion.originalname, archivoFusion.mimetype);

      // El documento que sube aquí el Encargado General queda disponible
      // como propuesta (enlace "Ver propuesta"), pero NUNCA se fusiona
      // (copyPages) dentro del PDF oficial del vale: ese PDF es el
      // documento ADMINISTRATIVO del vale (encabezado, cliente, venta,
      // firma), no el lugar donde vive el diseño/propuesta.
      await valeCreacionService.regenerarPdf(valeId);
      await valeRepository.actualizarPropuestaGeneral(valeId, saved.path);
      // Sella quién fusionó y cuándo — es lo que le permite a
      // _trabajoEncargadoTaller mostrarle a ESE encargado (y solo a él) una
      // fila de fusión con fecha propia, sin depender del estado del vale
      // (que sigue cambiando después).
      await valeRepository.sellarFusion(valeId, { fusionadoPor: usuario.id, fusionadoEn: `${hoyISO()} ${horaActual()}` });
      await valeRepository.actualizarEstado(valeId, ESTADOS.PENDIENTE_CONFIRMACION);
      await registrarHistorial(valeId, usuario.id, null, vale.estado, ESTADOS.PENDIENTE_CONFIRMACION,
        'Encargado General adjuntó la fusión final del trabajo de los talleres y aprobó el vale');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({ vale: actualizado, accion: 'aprobado (fusión general)', actor: usuario.nombre, actorId: usuario.id, salas: [`asesor:${vale.asesor_id}`] });
      return enriquecer(actualizado);
    });
  }
}

module.exports = new ValeTallerService();
