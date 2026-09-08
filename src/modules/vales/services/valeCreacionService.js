// src/modules/vales/services/valeCreacionService.js
// Creación de vales y autorización de esa creación por el Supervisor de
// Ventas. `validarDatosVale`/`fanOutTalleres`/`nombresDeTalleres`/
// `regenerarPdf` se exportan sin guion bajo porque también los usa
// valeConfirmacionService (solicitarModificacion/aprobarModificacion) y
// valeTallerService (aprobarGeneral, solo regenerarPdf) — ver el comentario
// original de _validarDatosVale, que ya documentaba esta dependencia
// compartida entre crearVale() y solicitarModificacion().
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const documentoRepository = require('../repositories/documentoRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const fileStorage = require('../../../core/files/fileStorage');
const valePdfService = require('./valePdfService');
const valeEvents = require('../events');
const valeMutex = require('./valeMutex');
const {
  ESTADOS, pad5, inicialesAsesor, hoyISO, horaActual, enriquecer,
  normalizarDatetime, calcularUrgente, registrarHistorial,
  esAdministrador, requerirVale
} = require('./valeHelpers');

class ValeCreacionService {
  async crearVale(usuario, payload, archivos) {
    const solicitante = await usuarioValeRepository.obtenerPorId(usuario.id);
    if (!solicitante || !solicitante.tienda_id) {
      throw new Error('El asesor no tiene una tienda asignada, no se puede generar el correlativo.');
    }
    const tienda = await catalogoRepository.obtenerTiendaPorId(solicitante.tienda_id);
    if (!tienda) {
      throw new Error('Tienda del asesor no encontrada.');
    }
    // Los talleres elegibles/exclusividad dependen de la tienda del propio
    // asesor — se resuelve ANTES de validar.
    const datos = await this.validarDatosVale(payload, { tiendaIdAsesor: tienda.id });

    // El conteo "cuántos vales tiene ya este asesor" (para el correlativo) +
    // el insert que depende de él se serializan por asesor — dos creaciones
    // casi simultáneas del mismo asesor antes leían el mismo conteo y podían
    // generar un correlativo duplicado. El servidor sigue siendo la única
    // fuente del conteo (nunca el cliente); esto solo cierra la ventana de
    // carrera entre leer y escribir. El límite diario es colectivo por
    // Supervisor y se valida al AUTORIZAR (autorizarCreacion), no al crear —
    // crear un vale nunca se pospone ni se bloquea.
    const valeId = await valeMutex.conColaDeCreacion(usuario.id, async () => {
      const hoy = hoyISO();
      const fechaCreacionDate = new Date(`${hoy}T00:00:00`);
      if (!(datos.fechaEventoDate > datos.fechaEntregaDate && datos.fechaEntregaDate >= fechaCreacionDate)) {
        throw new Error('Las fechas no son válidas: el evento debe ser posterior a la entrega, y la entrega igual o posterior a la creación.');
      }

      const secuencia = (await valeRepository.contarValesPorAsesor(usuario.id)) + 1;
      // {TIENDA}-{INICIALES}-{00001}. El contador (vales de este asesor) no
      // cambia, solo el formato impreso — los correlativos históricos
      // (GUA-3-0001, etc.) no se renumeran.
      const correlativo = `${tienda.codigo}-${inicialesAsesor(solicitante.nombre)}-${pad5(secuencia)}`;

      return valeRepository.crear({
        correlativo,
        asesorId: usuario.id,
        tiendaId: tienda.id,
        fechaCreacion: hoy,
        horaCreacion: horaActual(),
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
        descripcion: datos.descripcion,
        talleresSolicitados: datos.talleresIds.join(','),
        estado: ESTADOS.ESPERANDO_AUTORIZACION
      });
    });

    await this.guardarAdjuntos(valeId, archivos, usuario.id, false);
    const nombresTalleres = await this.nombresDeTalleres(datos.talleresIds);
    await registrarHistorial(valeId, usuario.id, null, null, ESTADOS.ESPERANDO_AUTORIZACION,
      `Vale de arte creado por el asesor — esperando autorización del Supervisor (taller${datos.talleresIds.length > 1 ? 'es' : ''} solicitado${datos.talleresIds.length > 1 ? 's' : ''}: ${nombresTalleres})`);
    await this.regenerarPdf(valeId);

    const vale = await valeRepository.obtenerPorId(valeId);
    // Un asesor puede tener MÁS de un supervisor cubriéndolo a la vez
    // (supervisores rotativos) — se notifica a todos, no solo a "el" supervisor.
    const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(usuario.id);
    valeEvents.notificar({
      vale, accion: 'creado, esperando autorización', actor: solicitante.nombre, actorId: usuario.id,
      salas: [`asesor:${usuario.id}`, ...supervisores.map(s => `supervisor:${s.id}`)]
    });
    return enriquecer(vale);
  }

  // El Supervisor de Ventas autoriza el envío a talleres de un vale creado
  // por uno de SUS asesores — recién aquí se reparten las filas de
  // vale_talleres (antes ocurría de inmediato en crearVale). Gated por el
  // cupo colectivo diario del propio Supervisor (obtenerLimiteColectivoSupervisor).
  async autorizarCreacion(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      if (vale.estado === ESTADOS.CREADO) {
        throw new Error('Este vale ya fue aprobado para su creación.');
      } else if (vale.estado !== ESTADOS.ESPERANDO_AUTORIZACION) {
        throw new Error('Solo se puede autorizar un vale en estado ESPERANDO_AUTORIZACION.');
      }
      // Un asesor puede tener más de un supervisor cubriéndolo a la vez
      // (supervisores rotativos) — se necesita la lista completa tanto para
      // el chequeo de pertenencia como para notificar a todos, no solo al
      // que ejecuta la acción (si no, el resto se queda con el vale
      // apareciendo accionable en su buzón hasta que recargan a mano).
      const supervisoresDelAsesor = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
      if (!esAdministrador(usuario)) {
        if (!supervisoresDelAsesor.some(s => s.id === usuario.id)) {
          throw new Error('Este vale de arte no pertenece a un asesor bajo su mando.');
        }
        const { autorizados, limite } = await this.obtenerLimiteColectivoSupervisor(usuario.id);
        if (autorizados >= limite) {
          throw new Error('Se alcanzó el límite diario colectivo de autorizaciones de creación de tu equipo. Vuelve a intentar mañana.');
        }
      }
      const talleresIds = (vale.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);
      if (talleresIds.length === 0) {
        throw new Error('Este vale de arte no tiene talleres solicitados registrados.');
      }

      await this.fanOutTalleres(valeId, talleresIds);
      const ahora = `${hoyISO()} ${horaActual()}`;
      await valeRepository.sellarAutorizacion(valeId, { autorizadoPor: usuario.id, autorizadoEn: ahora, autorizacionTipo: 'CREACION' });
      await valeRepository.actualizarEstado(valeId, ESTADOS.CREADO);
      const nombresTalleres = await this.nombresDeTalleres(talleresIds);
      await registrarHistorial(valeId, usuario.id, null, ESTADOS.ESPERANDO_AUTORIZACION, ESTADOS.CREADO,
        `Supervisor autorizó la creación — enviado a taller${talleresIds.length > 1 ? 'es' : ''}: ${nombresTalleres}`);
      // Regenera el PDF para que la firma de autorización aparezca.
      await this.regenerarPdf(valeId);

      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'autorizado (creación)', actor: usuario.nombre, actorId: usuario.id,
        salas: [`asesor:${vale.asesor_id}`, ...supervisoresDelAsesor.map(s => `supervisor:${s.id}`), ...talleresIds.map(id => `taller:${id}`)]
      });
      return enriquecer(actualizado);
    });
  }

  // El límite diario es COLECTIVO del Supervisor —
  // "vales_autorizados_crear/asesores", ascendente. El denominador es la
  // cantidad de asesores activos bajo su mando. Administrador no tiene límite.
  async obtenerLimiteColectivoSupervisor(supervisorId) {
    const asesores = await usuarioValeRepository.listarAsesoresPorSupervisor(supervisorId);
    const limite = asesores.length;
    const autorizados = await valeRepository.contarAutorizacionesCreacionPorSupervisorYFecha(supervisorId, hoyISO());
    return { autorizados, limite };
  }

  // Validaciones compartidas entre crearVale() y solicitarModificacion() (el
  // formulario de modificación es literalmente el mismo formulario de
  // creación, salvo por los talleres: la resolución del destino de una
  // modificación tiene su propia lógica, ver valeConfirmacionService — así
  // que crearVale() sigue exigiendo `talleresIds` aquí pero
  // solicitarModificacion() no pasa por este camino para elegir taller).
  async validarDatosVale(payload, { requiereTalleres = true, tiendaIdAsesor = null } = {}) {
    const {
      clienteEmpresa, clienteNombre, clienteTelefono, clienteCorreo,
      fechaEntrega, fechaEvento, urgente, producto, material, tecnica, acabado,
      cantidad, cotizacion, descripcion
    } = payload;

    if (!clienteNombre || !clienteTelefono || !clienteCorreo) {
      throw new Error('Los datos del cliente (nombre, teléfono, correo) son obligatorios.');
    }
    if (!producto || !material) {
      throw new Error('El producto y el material son obligatorios.');
    }
    if (!fechaEntrega || !fechaEvento) {
      throw new Error('Las fechas de entrega y de evento son obligatorias.');
    }
    // Técnica y acabado son opcionales — se guardan en blanco si no se
    // indican, valePdfService ya maneja ese caso. Entrega se normaliza a fin
    // de día (es una fecha límite: vale durante todo ese día) y evento a
    // inicio de día, para que, con ambas siendo solo fecha, la validación
    // "evento posterior a entrega" siga exigiendo que el evento caiga en un
    // día calendario distinto (y posterior) al de entrega.
    const fechaEntregaNorm = normalizarDatetime(fechaEntrega, true);
    const fechaEventoNorm = normalizarDatetime(fechaEvento, false);
    const cantidadNum = Number(cantidad);
    if (!Number.isFinite(cantidadNum) || cantidadNum <= 1) {
      throw new Error('La cantidad debe ser mayor a 1.');
    }
    const cotizacionNum = Number(cotizacion);
    if (!Number.isFinite(cotizacionNum) || cotizacionNum <= 0) {
      throw new Error('La cotización debe ser un valor numérico mayor a 0.');
    }

    const talleresIds = requiereTalleres ? await this.validarTalleresIds(payload.talleresIds, tiendaIdAsesor) : [];

    return {
      clienteEmpresa, clienteNombre, clienteTelefono, clienteCorreo,
      fechaEntregaNorm, fechaEventoNorm,
      fechaEntregaDate: new Date(fechaEntregaNorm.replace(' ', 'T')),
      fechaEventoDate: new Date(fechaEventoNorm.replace(' ', 'T')),
      urgente: calcularUrgente(fechaEntregaNorm, urgente),
      producto: producto.trim(), material: material.trim(),
      tecnica: (tecnica || '').trim(), acabado: (acabado || '').trim(),
      cantidad: cantidadNum, cotizacion: cotizacionNum, descripcion,
      talleresIds
    };
  }

  // Validación de talleres compartida con validarDatosVale() (creación /
  // solicitud de modificación) — acepta tanto un array real como el JSON
  // string que manda el formulario. `tiendaIdAsesor`, cuando se indica,
  // aplica las dos reglas de Diseño Local: nunca se mezcla con un taller de
  // toda la empresa en la misma selección, y nunca se elige el Diseño Local
  // de una tienda distinta a la del propio asesor — server-side, nunca
  // confiando en que el frontend ya filtró las opciones.
  async validarTalleresIds(talleresIdsRaw, tiendaIdAsesor = null) {
    let talleresIds;
    try {
      talleresIds = Array.isArray(talleresIdsRaw) ? talleresIdsRaw : JSON.parse(talleresIdsRaw || '[]');
    } catch {
      throw new Error('Los talleres seleccionados no tienen un formato válido.');
    }
    talleresIds = [...new Set((talleresIds || []).map(Number).filter(Number.isFinite))];
    if (talleresIds.length === 0) {
      throw new Error('Debe seleccionar al menos un taller para el vale de arte.');
    }
    const talleresActivos = await tallerRepository.listarActivos();
    const idsValidos = new Set(talleresActivos.map(t => t.id));
    if (!talleresIds.every(id => idsValidos.has(id))) {
      throw new Error('Uno o más talleres seleccionados no son válidos.');
    }
    if (tiendaIdAsesor !== null) {
      const seleccionados = talleresIds.map(id => talleresActivos.find(t => t.id === id));
      const locales = seleccionados.filter(t => t.tienda_id !== null);
      const generales = seleccionados.filter(t => t.tienda_id === null);
      if (locales.length > 0 && generales.length > 0) {
        throw new Error('No se puede combinar Diseño Local con talleres de Munditrofeos en el mismo vale.');
      }
      if (locales.some(t => t.tienda_id !== tiendaIdAsesor)) {
        throw new Error('Solo se puede enviar a Diseño Local de su propia tienda.');
      }
    }
    return talleresIds;
  }

  async fanOutTalleres(valeId, talleresIds) {
    for (const tallerId of talleresIds) {
      await valeTallerRepository.crear(valeId, tallerId);
    }
  }

  async nombresDeTalleres(talleresIds) {
    const talleres = await tallerRepository.listarActivos();
    return talleresIds.map(id => (talleres.find(t => t.id === id) || {}).nombre || `#${id}`).join(', ');
  }

  async guardarAdjuntos(valeId, archivos, subidoPor, esModificacion) {
    if (!archivos) return;
    const imagenes = archivos.imagenes || [];
    const documentos = archivos.documentos || [];

    for (const file of imagenes) {
      const saved = await fileStorage.saveFile(file.buffer, file.originalname, file.mimetype);
      await documentoRepository.crear({
        valeId, nombreOriginal: file.originalname, ruta: saved.path, tipo: 'imagen',
        mimeType: file.mimetype, tamano: saved.size, esModificacion, subidoPor
      });
    }
    for (const file of documentos) {
      const saved = await fileStorage.saveFile(file.buffer, file.originalname, file.mimetype);
      await documentoRepository.crear({
        valeId, nombreOriginal: file.originalname, ruta: saved.path, tipo: 'documento',
        mimeType: file.mimetype, tamano: saved.size, esModificacion, subidoPor
      });
    }
  }

  async regenerarPdf(valeId) {
    const vale = await valeRepository.obtenerPorId(valeId);
    const asesor = await usuarioValeRepository.obtenerPorId(vale.asesor_id);
    // Firma roja de autorización — solo existe una vez que el Supervisor
    // autorizó (creación o modificación); antes de eso la caja de firma del
    // PDF sigue vacía (ver valePdfService).
    let firmaAutorizacion = null;
    if (vale.autorizado_por && vale.autorizacion_tipo) {
      const supervisor = await usuarioValeRepository.obtenerPorId(vale.autorizado_por);
      if (supervisor) firmaAutorizacion = `${supervisor.nombre} ${vale.autorizacion_tipo}`;
    }
    const valeConAsesor = {
      ...vale,
      __asesorNombre: asesor ? asesor.nombre : null,
      __asesorCorreo: asesor ? asesor.email : null,
      __asesorTelefono: asesor ? asesor.telefono : null,
      __firmaAutorizacion: firmaAutorizacion
    };
    // Las imágenes se conservan (no se eliminan tras generar el PDF): una
    // modificación posterior necesita poder regenerar el documento completo
    // desde cero.
    const documentos = await documentoRepository.listarPorVale(valeId);
    const pdfBuffer = await valePdfService.generarPdfVale(valeConAsesor, documentos);
    const pdfUrlAnterior = vale.pdf_url;
    const saved = await fileStorage.saveFile(pdfBuffer, `${vale.correlativo}.pdf`, 'application/pdf');
    await valeRepository.actualizarPdfUrl(valeId, saved.path);
    if (pdfUrlAnterior) {
      await fileStorage.deleteFile(pdfUrlAnterior);
    }
  }
}

module.exports = new ValeCreacionService();
