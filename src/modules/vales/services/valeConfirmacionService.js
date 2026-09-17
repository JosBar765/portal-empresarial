// src/modules/vales/services/valeConfirmacionService.js
// Asesor: confirmar recibido, y el ciclo completo de modificación
// (solicitar → aprobar, que crea un vale de arte NUEVO con prefijo MOD-).
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const documentoRepository = require('../repositories/documentoRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const solicitudModificacionRepository = require('../repositories/solicitudModificacionRepository');
const valeEvents = require('../events');
const valeMutex = require('./valeMutex');
const valeCreacionService = require('./valeCreacionService');
const valeDetalleService = require('./valeDetalleService');
const capacidadEntregaService = require('./capacidadEntregaService');
const {
  ESTADOS, hoyISO, horaActual, enriquecer, registrarHistorial,
  esAdministrador, esValeDeModificacion, requerirVale, assertPropioDelAsesor
} = require('./valeHelpers');

class ValeConfirmacionService {
  async confirmarRecibido(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      assertPropioDelAsesor(usuario, vale);
      if (vale.estado !== ESTADOS.PENDIENTE_CONFIRMACION) {
        throw new Error('Solo se puede confirmar de recibido un vale PENDIENTE_CONFIRMACION.');
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

  // Ya no existe una acción separada de "rechazar": un vale
  // PENDIENTE_CONFIRMACION que el asesor no acepta sigue este MISMO camino —
  // solicitar modificación — en vez de caer a un estado EN_CORRECCION.
  async solicitarModificacion(usuario, valeId, payload) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      assertPropioDelAsesor(usuario, vale);
      if (![ESTADOS.RECIBIDO, ESTADOS.PENDIENTE_CONFIRMACION].includes(vale.estado)) {
        throw new Error('Solo se puede solicitar modificación sobre un vale RECIBIDO o PENDIENTE_CONFIRMACION.');
      }
      // Un vale ya no puede modificarse si YA utilizó su única modificación
      // (`vale.modificado`) NI si él mismo es el resultado de una
      // modificación (`vale.vale_original_id`, es decir su correlativo ya
      // lleva el prefijo MOD-) — chequear solo `modificado` permitía que un
      // vale MOD-... que llegaba a RECIBIDO encadenara una segunda modificación.
      if (esValeDeModificacion(vale)) {
        throw new Error('Este vale de arte ya utilizó su única modificación permitida.');
      }
      if (!payload.justificacion) {
        throw new Error('Debe justificar la modificación solicitada.');
      }
      if (String(payload.justificacion).length > 2000) {
        throw new Error('La justificación supera el largo máximo permitido (2000 caracteres).');
      }
      const datos = await valeCreacionService.validarDatosVale(payload, { requiereTalleres: false });

      // El destino de la modificación se resuelve AQUÍ, con el
      // vale_talleres del original: si fue a un solo taller (Munditrofeos o
      // Diseño Local, da igual), el destino es obvio y no hace falta
      // preguntar; si fue a 2+ talleres de Munditrofeos, el asesor debe
      // elegir un subconjunto no vacío de esos MISMOS talleres (nunca uno al
      // que el vale original nunca fue).
      const filasOriginal = await valeTallerRepository.listarPorVale(valeId);
      const talleresOriginalIds = [...new Set(filasOriginal.map(f => f.taller_id))];
      let talleresIdsModificacion;
      if (talleresOriginalIds.length <= 1) {
        talleresIdsModificacion = talleresOriginalIds;
      } else {
        let elegidos;
        try {
          elegidos = Array.isArray(payload.talleresIds) ? payload.talleresIds : JSON.parse(payload.talleresIds || '[]');
        } catch {
          throw new Error('Los talleres seleccionados no tienen un formato válido.');
        }
        elegidos = [...new Set((elegidos || []).map(Number).filter(Number.isFinite))];
        if (elegidos.length === 0) {
          throw new Error('Debe indicar a cuál(es) de los talleres originales enviar la modificación.');
        }
        if (!elegidos.every(id => talleresOriginalIds.includes(id))) {
          throw new Error('Solo puede elegir entre los talleres a los que se envió el vale original.');
        }
        talleresIdsModificacion = elegidos;
      }
      // Mismo límite diario opcional por taller que en crearVale() — sin
      // esto, la modificación era un camino sin vigilar para saltarse el
      // límite (analisis_correcciones_28.md).
      await capacidadEntregaService.validarLimiteDiario(talleresIdsModificacion, datos.fechaEntregaNorm.slice(0, 10));

      await solicitudModificacionRepository.crear({
        valeOriginalId: valeId,
        asesorId: usuario.id,
        fechaEntrega: datos.fechaEntregaNorm,
        fechaEvento: datos.fechaEventoNorm,
        urgente: datos.urgente,
        clienteEmpresa: datos.clienteEmpresa,
        clienteNombre: datos.clienteNombre,
        clienteTelefono: datos.clienteTelefono,
        clienteCorreo: datos.clienteCorreo,
        producto: datos.producto,
        material: datos.material,
        tecnica: datos.tecnica,
        acabado: datos.acabado,
        cantidad: datos.cantidad,
        cotizacion: datos.cotizacion,
        talleresIds: talleresIdsModificacion.join(','),
        justificacion: payload.justificacion
      });
      await valeRepository.actualizarEstado(valeId, ESTADOS.SOLICITANDO_MODIFICACION);
      await registrarHistorial(valeId, usuario.id, null, vale.estado, ESTADOS.SOLICITANDO_MODIFICACION, 'Asesor solicitó modificación');

      const actualizado = await valeRepository.obtenerPorId(valeId);
      // Notifica a todos los supervisores que cubren la tienda de este asesor.
      const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(usuario.id);
      valeEvents.notificar({
        vale: actualizado, accion: 'puesto en solicitud de modificación', actor: usuario.nombre, actorId: usuario.id,
        salas: supervisores.map(s => `supervisor:${s.id}`)
      });
      return enriquecer(actualizado);
    });
  }

  async aprobarModificacion(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const original = await requerirVale(valeId);
      if (original.estado === ESTADOS.MODIFICADO) {
        throw new Error('Este vale ya fue aprobado para su modificación.');
      } else if (original.estado !== ESTADOS.SOLICITANDO_MODIFICACION)  {
        throw new Error('Solo se pueden aprobar vales en estado SOLICITANDO_MODIFICACION.');
      }

      const solicitud = await solicitudModificacionRepository.obtenerPendientePorValeOriginal(valeId);
      if (!solicitud) {
        throw new Error('No se encontró una solicitud de modificación pendiente para este vale.');
      }
      const talleresIdsModificacion = (solicitud.talleres_ids || '').split(',').map(Number).filter(Number.isFinite);
      // Se revalida el límite diario aquí (no solo al solicitar la
      // modificación): entre la solicitud y esta aprobación pudieron
      // entrar otros vales que llenaran el día — este es el momento real en
      // que el vale entra al buzón del taller (fanOutTalleres, más abajo).
      await capacidadEntregaService.validarLimiteDiario(talleresIdsModificacion, String(solicitud.fecha_entrega).slice(0, 10));

      const correlativoNuevo = original.correlativo.startsWith('MOD-') ? original.correlativo : `MOD-${original.correlativo}`;
      const nuevoValeId = await valeRepository.crear({
        correlativo: correlativoNuevo,
        asesorId: solicitud.asesor_id,
        tiendaId: original.tienda_id,
        valeOriginalId: original.id,
        fechaCreacion: hoyISO(),
        horaCreacion: horaActual(),
        fechaEntrega: solicitud.fecha_entrega,
        fechaEvento: solicitud.fecha_evento,
        urgente: solicitud.urgente,
        clienteEmpresa: solicitud.cliente_empresa,
        clienteNombre: solicitud.cliente_nombre,
        clienteTelefono: solicitud.cliente_telefono,
        clienteCorreo: solicitud.cliente_correo,
        producto: solicitud.producto,
        material: solicitud.material,
        tecnica: solicitud.tecnica,
        acabado: solicitud.acabado,
        cantidad: solicitud.cantidad,
        cotizacion: solicitud.cotizacion,
        // La justificación de la modificación ES el nuevo "Boceto y Descripción" del vale de arte
        descripcion: solicitud.justificacion,
        estado: ESTADOS.MODIFICADO,
        autorizadoPor: usuario.id,
        autorizadoEn: `${hoyISO()} ${horaActual()}`,
        autorizacionTipo: 'MODIFICACION'
      });

      await valeCreacionService.fanOutTalleres(nuevoValeId, talleresIdsModificacion);
      const nombresTalleresModificacion = await valeCreacionService.nombresDeTalleres(talleresIdsModificacion);

      // El documento adjunto al nuevo vale es la propuesta ya aprobada del vale original
      const propuestaOriginal = original.propuesta_general_url
        || (await propuestaRepository.obtenerUltimaPorVale(original.id))?.url;

      if (propuestaOriginal) {
        await documentoRepository.crear({
          valeId: nuevoValeId,
          nombreOriginal: `Propuesta original - ${original.correlativo}.pdf`,
          ruta: propuestaOriginal,
          tipo: 'documento',
          mimeType: 'application/pdf',
          tamano: 0,
          esModificacion: true,
          subidoPor: usuario.id
        });
      }

      await valeRepository.marcarModificado(original.id);
      // El original pasa a CONFIRMADO (estado final propio), no a RECIBIDO —
      // antes era indistinguible de un vale sin modificación y desaparecía
      // de vistas que excluyen RECIBIDO a propósito.
      await valeRepository.actualizarEstado(original.id, ESTADOS.RECIBIDO);
      // El original puede llegar aquí sin haber pasado nunca por
      // confirmarRecibido() (ej. se solicitó modificación directo desde
      // PENDIENTE_CONFIRMACION, el camino de "rechazo"); en ese caso este es
      // el primer y único momento en que su atraso debe congelarse. Si ya
      // estaba congelado (venía de RECIBIDO), congelarAtraso() no hace nada
      // (WHERE atraso_congelado_en IS NULL).
      await valeRepository.congelarAtraso(original.id, `${hoyISO()} ${horaActual()}`);
      await solicitudModificacionRepository.marcarEstado(solicitud.id, 'APROBADA');

      await registrarHistorial(original.id, usuario.id, null, ESTADOS.SOLICITANDO_MODIFICACION, ESTADOS.CONFIRMADO,
        `Supervisor aprobó la solicitud de modificación — se creó el vale ${correlativoNuevo}`);
      await registrarHistorial(nuevoValeId, usuario.id, null, null, ESTADOS.MODIFICADO,
        `Vale creado a partir de la modificación aprobada de ${original.correlativo} — enviado a taller${talleresIdsModificacion.length > 1 ? 'es' : ''}: ${nombresTalleresModificacion}`);
      await valeCreacionService.regenerarPdf(nuevoValeId);

      const nuevoVale = await valeRepository.obtenerPorId(nuevoValeId);
      // Mismo criterio que autorizarCreacion: notificar a TODOS los
      // supervisores que cubren a este asesor, no solo a quien ejecutó la
      // acción — si no, el resto se queda con el vale apareciendo
      // accionable en su buzón hasta que recargan la página a mano.
      const supervisoresDelAsesor = await usuarioValeRepository.obtenerSupervisoresDeAsesor(solicitud.asesor_id);
      valeEvents.notificar({
        vale: nuevoVale, accion: 'autorizado (modificación)', actor: usuario.nombre, actorId: usuario.id,
        salas: [`asesor:${solicitud.asesor_id}`, ...supervisoresDelAsesor.map(s => `supervisor:${s.id}`), ...talleresIdsModificacion.map(id => `taller:${id}`)]
      });
      return enriquecer(nuevoVale);
    });
  }

  // "Ver PDF" siempre sirve el PDF del vale que se pidió — nunca lo
  // sustituye por el de otro vale (el original y su MOD- quedan como dos
  // vales independientes y consultables, cada uno con su propio PDF;
  // aprobarModificacion siempre hace un INSERT nuevo, no un UPDATE). Mismo
  // chequeo de pertenencia que ya usa valeDetalleService.obtenerDetalle —
  // sin esto, cualquier usuario con vales.ver podía descargar el PDF de
  // CUALQUIER vale con solo cambiar el id en la URL.
  async obtenerValeParaPdf(usuario, valeId) {
    const vale = await requerirVale(valeId);
    if (!(await valeDetalleService.puedeVerValePorId(usuario, valeId))) {
      throw new Error('No tienes acceso a este vale de arte.');
    }
    return vale;
  }
}

module.exports = new ValeConfirmacionService();
