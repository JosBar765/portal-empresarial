// src/modules/viaticos/services/gestionService.js
// Casos de uso de Gestiones: ver las solicitudes de todos los países y autorizar o rechazar las que esperan autorización.
const db = require('../../../config/database');
const notificacionService = require('../../../core/notifications/notificacionService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const solicitudRepo = require('../repositories/solicitudRepository');
const escrituraRepo = require('../repositories/solicitudEscrituraRepository');
const {
  ESTADOS, FASES, ORDEN_FASES, MODALIDADES, ETAPAS_DOCUMENTO, NOTIFICACION, TIEMPO_REAL, LIMITES_SOLICITUD
} = require('../constantes');
const events = require('../events');
const { Validador, cuerpoObjeto, vacio } = require('../validacion');
const { msg } = require('../mensajes');
const { accionesDeGestion } = require('./pipelineService');
const solicitudService = require('./solicitudService');
const documentoService = require('./documentoService');

// Lo que espera autorización va primero (para atenderlo en orden); el resto sigue el orden de fases de Solicitudes.
const grupoDe = fase => (fase === FASES.ESPERANDO ? 0 : ORDEN_FASES[fase] + 1);
const porCreacion = (a, b) => (a.fechaCreacion < b.fechaCreacion ? -1 : a.fechaCreacion > b.fechaCreacion ? 1 : a.id - b.id);

// Las acciones del pipeline de Solicitudes son del dueño; en Gestiones dependen de los permisos de quien consulta.
function pipelineDeGestion(pipeline, modalidad, usuario) {
  const acciones = accionesDeGestion({
    fase: pipeline.fase, esLargo: modalidad === MODALIDADES.MAS_DE_UN_DIA, permisos: usuario.permissions || []
  });
  return { ...pipeline, acciones };
}

// Motivo libre y obligatorio, sin motivos predeterminados.
function leerMotivo(cuerpo) {
  const parametros = cuerpoObjeto(cuerpo);
  const v = new Validador();
  const max = LIMITES_SOLICITUD.MOTIVO_RECHAZO;
  let motivo = null;
  if (vacio(parametros.motivo)) v.falla('motivo', msg('gestion.motivoObligatorio', { max }));
  else motivo = v.texto(parametros, 'motivo', msg('gestion.etiquetaMotivo'), { max });
  v.lanzar();
  return motivo;
}

class GestionService {
  async listar(usuario, query) {
    const { desde, hasta, hoy, busqueda } = solicitudService.leerParametrosDeLista(query);
    const filas = await solicitudRepo.listar({ desde, hasta, ...busqueda, nombre: busqueda.correlativo || null });
    const items = filas.map(fila => ({
      ...solicitudService.itemDeLista(fila, pipelineDeGestion(solicitudService.pipelineDe(fila, hoy), fila.modalidad, usuario)),
      solicitante: { id: fila.solicitanteId, nombre: fila.solicitanteNombre },
      pais: { codigo: fila.paisCodigo, nombre: fila.paisNombre }
    }));
    items.sort((a, b) => grupoDe(a.pipeline.fase) - grupoDe(b.pipeline.fase)
      || (grupoDe(a.pipeline.fase) === 0 ? porCreacion(a, b) : porCreacion(b, a)));
    return { desde, hasta, solicitudes: items };
  }

  async obtener(usuario, idCrudo) {
    const detalle = await solicitudService.leerDetalle(idCrudo);
    return { ...detalle, pipeline: pipelineDeGestion(detalle.pipeline, detalle.modalidad, usuario) };
  }

  // `externo` (solo pruebas): ejecutor de una transacción ya abierta; sin commit propio ni efectos posteriores.
  async autorizar(usuario, idCrudo, { externo } = {}) {
    return this.decidir(usuario, idCrudo, { estadoDestino: ESTADOS.AUTORIZADA, claveMensaje: 'gestion.noSeAutoriza', externo });
  }

  async rechazar(usuario, idCrudo, cuerpo, { externo } = {}) {
    const motivo = leerMotivo(cuerpo);
    return this.decidir(usuario, idCrudo, { estadoDestino: ESTADOS.RECHAZADA, claveMensaje: 'gestion.noSeRechaza', motivo, externo });
  }

  async decidir(usuario, idCrudo, { estadoDestino, claveMensaje, motivo = null, externo }) {
    const id = idObligatorio(idCrudo, 'Identificador de la solicitud');
    const aplicar = async tx => {
      const fila = await this.bloquearPendiente(id, claveMensaje, tx);
      const estadoId = await escrituraRepo.estadoId(estadoDestino, tx);
      await escrituraRepo.actualizarEstado(id, estadoId, tx);
      await escrituraRepo.insertarHistorial(id, estadoId, usuario.id, motivo, tx);
      return { id, correlativo: fila.correlativo, solicitanteId: fila.solicitanteId, estado: estadoDestino };
    };
    const decidida = await (externo ? aplicar(externo) : db.transaccion(aplicar));
    if (externo) return decidida;
    await this.despuesDelCommit(decidida, motivo, usuario.id);
    return this.obtener(usuario, id);
  }

  // Con la fila ya bloqueada se vuelve a comprobar el estado y el vencimiento: dos decisiones simultáneas (o un doble clic)
  // no pueden aplicarse las dos, la segunda recibe el error.
  async bloquearPendiente(id, claveMensaje, tx) {
    const fila = await escrituraRepo.bloquearParaDecidir(id, tx);
    if (!fila) throw new ErrorDeNegocio(msg('solicitud.noExiste', { id }), 404);
    const pipeline = solicitudService.pipelineDe(fila, solicitudService.instante().hoy);
    if (pipeline.fase !== FASES.ESPERANDO) {
      throw new ErrorDeNegocio(msg(claveMensaje, { correlativo: fila.correlativo, estado: pipeline.etiqueta }), 403);
    }
    return fila;
  }

  // PDF con el nombre de quien autorizó, aviso al solicitante y tiempo real; un fallo se registra y no deshace la decisión.
  async despuesDelCommit({ id, correlativo, solicitanteId, estado }, motivo, actorId) {
    const autorizada = estado === ESTADOS.AUTORIZADA;
    if (autorizada) {
      try {
        await documentoService.regenerarPdf(id, { etapa: ETAPAS_DOCUMENTO.AUTORIZACION });
      } catch (error) {
        console.error('[Viáticos] No se pudo regenerar el PDF de la solicitud autorizada:', error.message);
      }
    }
    try {
      await notificacionService.registrar([solicitanteId], {
        modulo: NOTIFICACION.MODULO,
        tipo: autorizada ? NOTIFICACION.TIPO_AUTORIZADA : NOTIFICACION.TIPO_RECHAZADA,
        nivel: autorizada ? NOTIFICACION.NIVEL : NOTIFICACION.NIVEL_RECHAZO,
        mensaje: autorizada ? msg('notificacion.solicitudAutorizada', { correlativo }) : msg('notificacion.solicitudRechazada', { correlativo, motivo })
      });
    } catch (error) {
      console.error('[Viáticos] No se pudo notificar la decisión sobre la solicitud:', error.message);
    }
    events.emitirActualizacion({
      id, correlativo, estado, solicitanteId, actorId, accion: autorizada ? TIEMPO_REAL.ACCION_AUTORIZADA : TIEMPO_REAL.ACCION_RECHAZADA
    });
  }
}

module.exports = new GestionService();
