// src/modules/vales/services/valeTallerService.js
// Transiciones dentro de un taller (asignar / comenzar / entregar / pausar /
// reanudar / cancelar / revisar) y la fusión final
// (aprobarGeneral, permiso `vales.aprobar_general`) — el paso terminal del ciclo de un taller, no una feature
// aparte, por eso vive aquí en vez de en un archivo propio.
const crypto = require('crypto');
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const subirYRegistrarArchivo = require('../../../core/files/subirYRegistrarArchivo');
const idempotencyRepository = require('../../../core/idempotency/idempotencyRepository');
const valeEvents = require('../events');
const valeMutex = require('./valeMutex');
const valeCatalogoService = require('./valeCatalogoService');
const valeCreacionService = require('./valeCreacionService');
const {
  ESTADOS, ESTADOS_TALLER, hoyISO, horaActual, enriquecer,
  etiquetaActorTaller, registrarHistorial, esAdministrador,
  requerirVale, SALA_FUSION
} = require('./valeHelpers');

class ValeTallerService {
  // Salas del asesor del vale y de sus supervisores.
  async _salasEquipo(asesorId) {
    const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(asesorId);
    return [`asesor:${asesorId}`, ...supervisores.map(s => `supervisor:${s.id}`)];
  }

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
      throw new Error('Este vale está en varios talleres: indica a cuál corresponde la acción.');
    }
    const talleres = await tallerRepository.listarActivos();
    const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
    const miTaller = talleres.find(t => t.encargado_id === idEfectivo);
    if (!miTaller) throw new Error('Tu usuario no tiene un taller asignado. Pide al administrador que te asigne uno.');
    const fila = filas.find(f => f.taller_id === miTaller.id);
    if (!fila) throw new Error('Este vale no fue enviado a tu taller.');
    return fila;
  }

  async asignar(usuario, valeId, disenadorId, tallerIdHint) {
    return valeMutex.conLockDeVale(valeId, async () => {
      await requerirVale(valeId);
      const fila = await this._resolverFilaTallerParaEncargado(usuario, valeId, tallerIdHint);
      if ([ESTADOS_TALLER.VERIFICANDO_ADJUNTOS, ESTADOS_TALLER.ADJUNTOS_RECHAZADOS, ESTADOS_TALLER.ADJUNTOS_RESPONDIDOS].includes(fila.estado)) {
        throw new Error('Primero verifica los adjuntos de este vale.');
      }
      if (fila.estado !== ESTADOS_TALLER.PENDIENTE_ASIGNACION) {
        throw new Error('Este vale ya tiene un diseñador asignado en tu taller.');
      }
      // Un encargado puede asignarse el vale a SÍ MISMO — la fila ya está
      // acotada a su propio taller por _resolverFilaTallerParaEncargado, así
      // que nunca cruza a un taller ajeno.
      const esAutoasignacion = !esAdministrador(usuario) && Number(disenadorId) === Number(usuario.id);
      const disenadores = await usuarioValeRepository.listarDisenadoresPorEncargado(await valeCatalogoService.idEncargadoEfectivo(usuario));
      if (!esAdministrador(usuario) && !esAutoasignacion && !disenadores.some(t => t.id === Number(disenadorId))) {
        throw new Error('Ese diseñador no está a tu cargo.');
      }
      await valeTallerRepository.asignar(fila.id, disenadorId, `${hoyISO()} ${horaActual()}`);
      const disenador = await usuarioValeRepository.obtenerPorId(disenadorId);
      const taller = await tallerRepository.obtenerPorId(fila.taller_id);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.PENDIENTE_ASIGNACION, ESTADOS_TALLER.ASIGNADO,
        `Asignado al diseñador ${disenador ? disenador.nombre : disenadorId} (taller ${taller ? taller.nombre : fila.taller_id})`, disenadorId);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'asignado', actor: usuario.nombre, actorId: usuario.id, destino: disenador ? disenador.nombre : null,
        salas: [`disenador:${disenadorId}`, `taller:${fila.taller_id}`, ...await this._salasEquipo(actualizado.asesor_id)]
      });
      return enriquecer(actualizado);
    });
  }

  async comenzar(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      await requerirVale(valeId);
      const fila = await this._filaDelDisenador(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.ASIGNADO) {
        throw new Error('Para comenzar el vale, primero debe estar asignado a ti.');
      }
      // Revisar "ya tengo otro en proceso" y pasar este a EN_PROCESO van en el mismo turno de la cola del diseñador.
      await valeMutex.conColaDeDisenador(usuario.id, async () => {
        const activasDelDisenador = await valeTallerRepository.listarActivasPorDisenador(usuario.id);
        for (const a of activasDelDisenador) {
          if (a.estado === ESTADOS_TALLER.EN_PROCESO) {
            const v = await valeRepository.obtenerPorId(a.vale_id);
            throw new Error(`Ya tienes un vale en proceso (${v ? v.correlativo : a.vale_id}). Debes entregarlo o cancelarlo antes de comenzar otro.`);
          }
        }
        await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_PROCESO);
      });
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, `${etiquetaActorTaller(usuario)} marcó el vale como en proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // Se enteran el taller y el equipo de ventas (su pantalla pasa al paso 3).
      valeEvents.notificar({ vale: actualizado, accion: 'tomado en proceso', actor: usuario.nombre, actorId: usuario.id, salas: [`taller:${fila.taller_id}`, ...await this._salasEquipo(actualizado.asesor_id)] });
      return enriquecer(actualizado);
    });
  }

  async _filaDelDisenador(usuario, valeId) {
    const activas = await valeTallerRepository.listarActivasPorDisenador(usuario.id);
    const fila = activas.find(a => a.vale_id === Number(valeId));
    if (!esAdministrador(usuario) && !fila) {
      throw new Error('Este vale no está asignado a ti.');
    }
    if (fila) return fila;
    // Administrador sin fila propia: toma la única fila activa del vale.
    const filas = await valeTallerRepository.listarPorVale(valeId);
    if (filas.length !== 1) throw new Error('Este vale está en varios talleres y no se pudo saber cuál es el tuyo.');
    return filas[0];
  }

  // La idempotency key (campo del FormData, junto al archivo de propuesta)
  // evita que un reintento de red vuelva a subir la propuesta y a escribir
  // una segunda fila en vale_propuestas — se valida aquí en el backend, no
  // solo confiando en que el frontend evite el doble envío. El chequeo vive
  // DENTRO del lock de valeMutex (no antes) para que dos requests casi
  // simultáneos con la misma key nunca lo evalúen en paralelo.
  async entregar(usuario, valeId, archivoPropuesta, idempotencyKey) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const key = idempotencyKey || crypto.randomUUID();
      const previo = await idempotencyRepository.buscar(key);
      if (previo) return previo.resultado;

      await requerirVale(valeId);
      const fila = await this._filaDelDisenador(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PROCESO) {
        throw new Error('Para entregar la propuesta, el vale debe estar en proceso.');
      }
      let url = null;
      if (archivoPropuesta) {
        await subirYRegistrarArchivo({
          buffer: archivoPropuesta.buffer, nombreOriginal: archivoPropuesta.originalname, mimeType: archivoPropuesta.mimetype,
          registrar: async (subida) => { url = subida.url; return propuestaRepository.crear(valeId, usuario.id, url); }
        });
      } else {
        await propuestaRepository.crear(valeId, usuario.id, null);
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_REVISION);
      fila.estado = ESTADOS_TALLER.EN_REVISION;
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION, `${etiquetaActorTaller(usuario)} entregó propuesta`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // Si quien entrega es el ENCARGADO de este mismo taller (se autoasignó
      // el vale), su trabajo se autoaprueba — no pasa por un período de
      // revisión de sí mismo.
      let autoaprueba = false;
      if (url) {
        const taller = await tallerRepository.obtenerPorId(fila.taller_id);
        const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
        autoaprueba = !!taller && taller.encargado_id === idEfectivo;
      }
      // Alerta roja si la propuesta va vacía. Con autoaprobación solo se emite el aviso de aprobación (una notificación por persona).
      if (!autoaprueba) {
        valeEvents.notificar({
          vale: actualizado, accion: 'entregado (propuesta)', actor: usuario.nombre, actorId: usuario.id,
          salas: [`taller:${fila.taller_id}`, `disenador:${usuario.id}`, ...await this._salasEquipo(actualizado.asesor_id)],
          nivel: url ? 'info' : 'alerta'
        });
      }

      let resultado;
      if (autoaprueba) {
        resultado = await this._revisarPropuestaInterno(usuario, valeId, fila, { aprobar: true, esAutoaprobacion: true });
      }
      if (!resultado) resultado = enriquecer(actualizado);
      await idempotencyRepository.registrar(key, 'vales.entregar', resultado);
      return resultado;
    });
  }

  // El diseñador puede pausar un vale EN_PROCESO (sin propuesta) para tomar
  // otro más urgente, y reanudarlo después. Mismo patrón que
  // cancelarProcesoDisenador, pero queda en EN_PAUSA en vez de volver a
  // EN_REVISION (la pausa no es una entrega).
  async pausarProceso(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      await requerirVale(valeId);
      const fila = await this._filaDelDisenador(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PROCESO) {
        throw new Error('Solo se puede pausar un vale que esté en proceso.');
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_PAUSA);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA, `${etiquetaActorTaller(usuario)} pausó el proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, texto: `${usuario.nombre} pausó el proceso`, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`, `disenador:${usuario.id}`]
      });
      return enriquecer(actualizado);
    });
  }

  async reanudarProceso(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      await requerirVale(valeId);
      const fila = await this._filaDelDisenador(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PAUSA) {
        throw new Error('Solo se puede reanudar un vale que esté en pausa.');
      }
      // Misma regla que comenzar(): un diseñador solo puede tener un vale EN_PROCESO a la vez.
      await valeMutex.conColaDeDisenador(usuario.id, async () => {
        const activasDelDisenador = await valeTallerRepository.listarActivasPorDisenador(usuario.id);
        for (const a of activasDelDisenador) {
          if (a.estado === ESTADOS_TALLER.EN_PROCESO) {
            const v = await valeRepository.obtenerPorId(a.vale_id);
            throw new Error(`Ya tienes un vale en proceso (${v ? v.correlativo : a.vale_id}). Debes entregarlo, cancelarlo o pausarlo antes de reanudar otro.`);
          }
        }
        await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_PROCESO);
      });
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PAUSA, ESTADOS_TALLER.EN_PROCESO, `${etiquetaActorTaller(usuario)} reanudó el proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, texto: `${usuario.nombre} reanudó el proceso`, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`, `disenador:${usuario.id}`]
      });
      return enriquecer(actualizado);
    });
  }

  async cancelarProcesoDisenador(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      await requerirVale(valeId);
      const fila = await this._filaDelDisenador(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PROCESO) {
        throw new Error('Solo se puede cancelar un vale que esté en proceso.');
      }
      // La cancelación no crea una fila "en blanco" en vale_propuestas — el
      // registro de auditoría de este evento vive únicamente en
      // vale_historial, igual que cualquier otra transición de estado.
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_REVISION);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION, `${etiquetaActorTaller(usuario)} canceló el proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, texto: `${usuario.nombre} canceló su proceso`, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`, `disenador:${usuario.id}`], nivel: 'alerta'
      });
      return enriquecer(actualizado);
    });
  }

  async revisarPropuesta(usuario, valeId, { aprobar, disenadorReasignadoId, tallerId }) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const fila = await this._resolverFilaTallerParaEncargado(usuario, valeId, tallerId);
      return this._revisarPropuestaInterno(usuario, valeId, fila, { aprobar, disenadorReasignadoId });
    });
  }

  // Extraído de revisarPropuesta para que entregar() pueda encadenar la
  // autoaprobación de un encargado sin volver a pedir el lock (no es
  // reentrante — ya se sostiene desde entregar()).
  async _revisarPropuestaInterno(usuario, valeId, fila, { aprobar, disenadorReasignadoId, esAutoaprobacion }) {
    const vale = await requerirVale(valeId);
    if (fila.estado !== ESTADOS_TALLER.EN_REVISION) {
      throw new Error('Solo se puede revisar el trabajo de un taller que ya entregó su propuesta.');
    }
    if (aprobar) {
      const ultimaPropuesta = await propuestaRepository.obtenerUltimaPorValeYDisenador(valeId, fila.disenador_id);
      if (!ultimaPropuesta || !ultimaPropuesta.url) {
        throw new Error('No se puede aprobar una propuesta en blanco: el diseñador debe adjuntar su documento.');
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.APROBADO);
      fila.estado = ESTADOS_TALLER.APROBADO;
      const taller = await tallerRepository.obtenerPorId(fila.taller_id);
      const accionHistorial = esAutoaprobacion
        ? 'Encargado aprobó su propio trabajo (autoasignación)'
        : `Encargado de ${taller ? taller.nombre : fila.taller_id} aprobó la propuesta de su taller`;
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_REVISION, ESTADOS_TALLER.APROBADO, accionHistorial, fila.disenador_id);
      await this._recalcularEstadoVale(valeId, usuario.id);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // El equipo de ventas se entera siempre; quien fusiona, solo si el vale queda esperando fusión.
      const targets = [`taller:${fila.taller_id}`, ...(fila.disenador_id ? [`disenador:${fila.disenador_id}`] : []), ...await this._salasEquipo(vale.asesor_id), ...(actualizado.estado === ESTADOS.APROBADO_DEPARTAMENTO ? [SALA_FUSION] : [])];
      // Último taller aprobado: el aviso dice que el vale quedó listo para fusionar.
      const listoParaFusionar = actualizado.estado === ESTADOS.APROBADO_DEPARTAMENTO;
      const aviso = listoParaFusionar
        ? { texto: `${usuario.nombre} aprobó el taller ${taller ? taller.nombre : fila.taller_id}: todos los talleres terminaron, el vale está listo para fusionar` }
        : { accion: 'aprobado (taller)' };
      valeEvents.notificar({ vale: actualizado, ...aviso, actor: usuario.nombre, actorId: usuario.id, salas: targets });
      return enriquecer(actualizado);
    }

    if (!disenadorReasignadoId) {
      throw new Error('Debe indicar a qué diseñador reasignar el vale desaprobado.');
    }
    // Igual que asignar(), el encargado puede reasignarse el trabajo
    // desaprobado a sí mismo.
    const esAutoasignacion = !esAdministrador(usuario) && Number(disenadorReasignadoId) === Number(usuario.id);
    const disenadores = await usuarioValeRepository.listarDisenadoresPorEncargado(await valeCatalogoService.idEncargadoEfectivo(usuario));
    if (!esAdministrador(usuario) && !esAutoasignacion && !disenadores.some(t => t.id === Number(disenadorReasignadoId))) {
      throw new Error('Ese diseñador no está a tu cargo.');
    }
    await valeTallerRepository.asignar(fila.id, disenadorReasignadoId, `${hoyISO()} ${horaActual()}`);
    const disenador = await usuarioValeRepository.obtenerPorId(disenadorReasignadoId);
    const accionReasignacion = esAutoasignacion
      ? 'Encargado desaprobó la propuesta y se reasignó el trabajo a sí mismo'
      : `Encargado desaprobó la propuesta y reasignó a ${disenador ? disenador.nombre : disenadorReasignadoId}`;
    await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_REVISION, ESTADOS_TALLER.ASIGNADO,
      accionReasignacion, disenadorReasignadoId);
    const actualizado = await valeRepository.obtenerPorId(valeId);
    valeEvents.notificar({
      vale: actualizado, accion: 'desaprobado y reasignado', actor: usuario.nombre, actorId: usuario.id, destino: disenador ? disenador.nombre : null,
      salas: [`disenador:${disenadorReasignadoId}`, `taller:${fila.taller_id}`]
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
    // Solo hay fusión que hacer cuando de verdad hay 2+ talleres
    // involucrados — pero en un vale de modificación (`vale_original_id`)
    // eso no se decide solo por los talleres de ESTE vale (la modificación
    // puede tocar un único taller), sino por cuántos talleres tuvo el vale
    // ORIGINAL desde su creación: si el original nació para 2+ talleres, el
    // quien fusiona debe volver a fusionar — combinando las propuestas
    // originales ya aprobadas de los demás talleres con la(s) corregida(s)
    // — aunque la modificación en sí solo haya tocado uno (correcciones_26
    // #3). Si el original nació para un único taller, su modificación
    // tampoco tiene nada que fusionar y sigue el camino directo de siempre.
    let talleresOriginales = filas.length;
    if (vale.vale_original_id) {
      talleresOriginales = (await valeTallerRepository.listarPorVale(vale.vale_original_id)).length;
    }
    const requiereEncargadoGeneral = filas.length > 1 || talleresOriginales > 1;
    const nuevoEstado = requiereEncargadoGeneral ? ESTADOS.APROBADO_DEPARTAMENTO : ESTADOS.PENDIENTE_CONFIRMACION;
    if (vale.estado === nuevoEstado) return;

    // Con un solo taller y sin ser modificación no hay fusión que hacer (el
    // la fusión nunca interviene en el camino feliz) — la propuesta
    // de ese único taller pasa a ser directamente el "documento oficial" del vale.
    if (filas.length === 1 && nuevoEstado === ESTADOS.PENDIENTE_CONFIRMACION) {
      const propuesta = await propuestaRepository.obtenerUltimaPorValeYDisenador(valeId, filas[0].disenador_id);
      if (propuesta && propuesta.url) {
        await valeRepository.actualizarPropuestaGeneral(valeId, propuesta.url);
      }
    }

    await valeRepository.actualizarEstado(valeId, nuevoEstado);
    const accion = nuevoEstado === ESTADOS.PENDIENTE_CONFIRMACION
      ? 'Único taller aprobado — pasa directo a confirmación del asesor'
      : 'Todos los talleres aprobaron — pendiente de fusión';
    await registrarHistorial(valeId, actorUsuarioId, null, vale.estado, nuevoEstado, accion);
  }

  // -----------------------------------------------------------------------
  // Fusión (permiso `vales.aprobar_general`): fusiona y aprueba vales multi-taller (también el
  // punto de reentrada cuando el asesor rechaza un vale)
  // -----------------------------------------------------------------------
  // Misma idempotency key por FormData que entregar() — un reintento de red
  // sobre esta fusión no debe volver a subir el documento ni volver a sellar
  // fusionado_por/fusionado_en con una fecha distinta.
  async aprobarGeneral(usuario, valeId, archivoFusion, idempotencyKey) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const key = idempotencyKey || crypto.randomUUID();
      const previo = await idempotencyRepository.buscar(key);
      if (previo) return previo.resultado;

      const vale = await requerirVale(valeId);
      if (vale.estado !== ESTADOS.APROBADO_DEPARTAMENTO) {
        throw new Error(vale.fusionado_por
          ? 'Este vale ya fue fusionado por otro encargado. Actualiza la página para ver su estado.'
          : 'Este vale aún no está listo para fusionar.');
      }
      // La fusión de las propuestas de los talleres NO la hace el sistema —
      // es trabajo manual de quien fusiona, que debe adjuntar su
      // propio documento final, aun cuando solo hubo un taller involucrado.
      if (!archivoFusion) {
        throw new Error('Debe adjuntar el documento de fusión antes de aprobar.');
      }

      // El documento que sube aquí quien fusiona queda disponible
      // como propuesta (enlace "Ver propuesta"), pero NUNCA se fusiona
      // (copyPages) dentro del PDF oficial del vale: ese PDF es el
      // documento ADMINISTRATIVO del vale (encabezado, cliente, venta,
      // firma), no el lugar donde vive el diseño/propuesta.
      await valeCreacionService.regenerarPdf(valeId);
      await subirYRegistrarArchivo({
        buffer: archivoFusion.buffer, nombreOriginal: archivoFusion.originalname, mimeType: archivoFusion.mimetype,
        registrar: (subida) => valeRepository.actualizarPropuestaGeneral(valeId, subida.url)
      });
      // Sella quién fusionó y cuándo — es lo que le permite a
      // _trabajoEncargadoTaller mostrarle a ESE encargado (y solo a él) una
      // fila de fusión con fecha propia, sin depender del estado del vale
      // (que sigue cambiando después).
      await valeRepository.sellarFusion(valeId, { fusionadoPor: usuario.id, fusionadoEn: `${hoyISO()} ${horaActual()}` });
      await valeRepository.actualizarEstado(valeId, ESTADOS.PENDIENTE_CONFIRMACION);
      await registrarHistorial(valeId, usuario.id, null, vale.estado, ESTADOS.PENDIENTE_CONFIRMACION,
        'Se adjuntó la fusión final del trabajo de los talleres y se aprobó el vale');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({ vale: actualizado, accion: 'aprobado (fusión general)', actor: usuario.nombre, actorId: usuario.id, salas: [SALA_FUSION, ...await this._salasEquipo(vale.asesor_id)] });
      const resultado = enriquecer(actualizado);
      await idempotencyRepository.registrar(key, 'vales.aprobarGeneral', resultado);
      return resultado;
    });
  }
}

module.exports = new ValeTallerService();
