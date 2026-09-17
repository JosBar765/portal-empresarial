// src/modules/vales/services/valeCreacionService.js
// Creación de vales y autorización de esa creación por el Supervisor de
// Ventas. `validarDatosVale`/`fanOutTalleres`/`nombresDeTalleres`/
// `regenerarPdf` se exportan sin guion bajo porque también los usa
// valeConfirmacionService (solicitarModificacion/aprobarModificacion) y
// valeTallerService (aprobarGeneral, solo regenerarPdf) — ver el comentario
// original de _validarDatosVale, que ya documentaba esta dependencia
// compartida entre crearVale() y solicitarModificacion().
const crypto = require('crypto');
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const capacidadEntregaService = require('./capacidadEntregaService');
const documentoRepository = require('../repositories/documentoRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const supabaseStorage = require('../../../core/files/supabaseStorage');
const subirYRegistrarArchivo = require('../../../core/files/subirYRegistrarArchivo');
const idempotencyRepository = require('../../../core/idempotency/idempotencyRepository');
const valePdfService = require('./valePdfService');
const valeEvents = require('../events');
const valeMutex = require('./valeMutex');
const {
  ESTADOS, inicialesAsesor, hoyISO, horaActual, enriquecer,
  normalizarDatetime, calcularUrgente, registrarHistorial,
  esAdministrador, requerirVale
} = require('./valeHelpers');

class ValeCreacionService {
  // La idempotency key viaja como campo del propio FormData (junto a los
  // adjuntos) — nunca solo se confía en que el frontend evite el doble
  // envío: un reintento con la MISMA key devuelve el resultado ya calculado
  // sin volver a subir archivos ni volver a escribir en la base de datos.
  // Si no llega ninguna (compatibilidad hacia atrás), se genera una interna
  // solo para tener un valor que guardar — no protege un reintento real
  // porque el cliente nunca la reutilizaría.
  async crearVale(usuario, payload, archivos) {
    const idempotencyKey = payload.idempotencyKey || crypto.randomUUID();
    const previo = await idempotencyRepository.buscar(idempotencyKey);
    if (previo) return previo.resultado;

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
    // Límite diario OPCIONAL por taller sobre la fecha de entrega
    // (analisis_correcciones_28.md) — a diferencia del límite colectivo del
    // Supervisor de abajo, este SÍ bloquea la creación en sí: es lo que
    // impide que un asesor cree un vale para un día ya lleno.
    await capacidadEntregaService.validarLimiteDiario(datos.talleresIds, datos.fechaEntregaNorm.slice(0, 10));

    // El límite diario COLECTIVO DEL SUPERVISOR se valida al AUTORIZAR
    // (autorizarCreacion), no al crear — crear un vale nunca se pospone ni
    // se bloquea. El lock por asesor se conserva para serializar la
    // creación en sí (mismo mutex que usan el resto de transiciones).
    const valeId = await valeMutex.conColaDeCreacion(usuario.id, async () => {
      const hoy = hoyISO();
      const fechaCreacionDate = new Date(`${hoy}T00:00:00`);
      if (!(datos.fechaEventoDate > datos.fechaEntregaDate && datos.fechaEntregaDate >= fechaCreacionDate)) {
        throw new Error('Las fechas no son válidas: el evento debe ser posterior a la entrega, y la entrega igual o posterior a la creación.');
      }

      // {TIENDA}-{INICIALES}-{ID}. El número es el id autoincremental de
      // MySQL (asignado por valeRepository.crear DESPUÉS del insert) —
      // nunca se reutiliza ni retrocede sin importar cuántos vales se
      // borren después (a diferencia de un contador en vivo). Los
      // correlativos históricos (GUA-3-0001, etc.) no se renumeran.
      const correlativoPrefijo = `${tienda.codigo}-${inicialesAsesor(solicitante.nombre)}`;

      return valeRepository.crear({
        correlativoPrefijo,
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

    // El INSERT de arriba ya dejó la fila en `vales` — de aquí en adelante
    // todo lo que puede fallar (subir adjuntos, generar el PDF) toca
    // Supabase. subirYRegistrarArchivo ya revierte SU PROPIA subida si el
    // registro en BD falla, pero no sabe nada del vale que lo originó —
    // por eso, si cualquier paso de este bloque falla, se revierte la
    // creación completa (eliminarValeConArchivos) en vez de dejar un vale
    // huérfano sin PDF ni adjuntos.
    try {
      await this.guardarAdjuntos(valeId, archivos, usuario.id, false);
      const nombresTalleres = await this.nombresDeTalleres(datos.talleresIds);
      await registrarHistorial(valeId, usuario.id, null, null, ESTADOS.ESPERANDO_AUTORIZACION,
        `Vale de arte creado por el asesor — esperando autorización del Supervisor (taller${datos.talleresIds.length > 1 ? 'es' : ''} solicitado${datos.talleresIds.length > 1 ? 's' : ''}: ${nombresTalleres})`);
      await this.regenerarPdf(valeId);
    } catch (error) {
      await this.eliminarValeConArchivos(valeId);
      throw error;
    }

    const vale = await valeRepository.obtenerPorId(valeId);
    // Un asesor puede tener MÁS de un supervisor cubriéndolo a la vez
    // (supervisores rotativos) — se notifica a todos, no solo a "el" supervisor.
    const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(usuario.id);
    valeEvents.notificar({
      vale, accion: 'creado, esperando autorización', actor: solicitante.nombre, actorId: usuario.id,
      salas: [`asesor:${usuario.id}`, ...supervisores.map(s => `supervisor:${s.id}`)]
    });
    const resultado = enriquecer(vale);
    await idempotencyRepository.registrar(idempotencyKey, 'vales.crear', resultado);
    return resultado;
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

  // El Supervisor rechaza un vale ESPERANDO_AUTORIZACION que el asesor no
  // debió enviar (error de captura, cliente que se arrepintió, etc.) — a
  // diferencia de autorizarCreacion, esto BORRA el vale por completo (fila,
  // adjuntos y PDF ya generado) en vez de cambiarle el estado. Mismas
  // reglas de pertenencia que autorizarCreacion (supervisor del asesor, o
  // Administrador).
  async rechazarCreacion(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      if (vale.estado !== ESTADOS.ESPERANDO_AUTORIZACION) {
        throw new Error('Solo se puede rechazar un vale en estado ESPERANDO_AUTORIZACION.');
      }
      const supervisoresDelAsesor = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
      if (!esAdministrador(usuario) && !supervisoresDelAsesor.some(s => s.id === usuario.id)) {
        throw new Error('Este vale de arte no pertenece a un asesor bajo su mando.');
      }
      await this.eliminarValeConArchivos(valeId);
      valeEvents.notificar({
        vale, accion: 'rechazado por el Supervisor', actor: usuario.nombre, actorId: usuario.id,
        salas: [`asesor:${vale.asesor_id}`, ...supervisoresDelAsesor.map(s => `supervisor:${s.id}`)]
      });
      return { valeId: vale.id, correlativo: vale.correlativo };
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
    // Límites de longitud alineados a las columnas reales de `vales` — sin
    // esto, un valor demasiado largo llega intacto hasta MySQL y el error
    // de "Data too long for column" (con el nombre de la columna) podía
    // filtrarse hasta el cliente.
    const limitesLongitud = {
      clienteNombre: 150, clienteEmpresa: 150, clienteTelefono: 30, clienteCorreo: 150,
      producto: 150, material: 150, tecnica: 150, acabado: 150, descripcion: 600
    };
    for (const [campo, valor] of Object.entries({ clienteNombre, clienteEmpresa, clienteTelefono, clienteCorreo, producto, material, tecnica, acabado, descripcion })) {
      if (valor && String(valor).length > limitesLongitud[campo]) {
        throw new Error(`El campo "${campo}" supera el largo máximo permitido (${limitesLongitud[campo]} caracteres).`);
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteCorreo)) {
      throw new Error('El correo del cliente no tiene un formato válido.');
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

  // Borra un vale por completo: del bucket lo que sí llegó a subirse y
  // registrarse (adjuntos, PDF) y luego la fila de `vales` — el cascade de
  // FKs se lleva vale_documentos/vale_talleres/vale_historial. Usado en dos
  // casos: revertir una creación a medias cuando falla algo después del
  // INSERT principal (ver el try/catch en crearVale), y el rechazo
  // explícito del Supervisor (rechazarCreacion). La limpieza de Storage es
  // best-effort: si Supabase sigue caído no hay forma de borrar ahí, pero
  // igual se borra el vale de MySQL (no vale la pena bloquear el borrado
  // completo por un archivo que de todas formas queda inalcanzable).
  async eliminarValeConArchivos(valeId) {
    const vale = await valeRepository.obtenerPorId(valeId);
    if (!vale) return;
    const documentos = await documentoRepository.listarPorVale(valeId);
    for (const doc of documentos) {
      try {
        await supabaseStorage.eliminar(doc.ruta);
      } catch { /* best-effort — el vale se borra de todas formas */ }
    }
    if (vale.pdf_url) {
      try {
        await supabaseStorage.eliminar(vale.pdf_url);
      } catch { /* best-effort */ }
    }
    await valeRepository.eliminar(valeId);
  }

  async guardarAdjuntos(valeId, archivos, subidoPor, esModificacion) {
    if (!archivos) return;
    const imagenes = archivos.imagenes || [];
    const documentos = archivos.documentos || [];

    for (const file of imagenes) {
      await subirYRegistrarArchivo({
        buffer: file.buffer, nombreOriginal: file.originalname, mimeType: file.mimetype,
        registrar: (subida) => documentoRepository.crear({
          valeId, nombreOriginal: file.originalname, ruta: subida.url, tipo: 'imagen',
          mimeType: file.mimetype, tamano: subida.size, esModificacion, subidoPor
        })
      });
    }
    for (const file of documentos) {
      await subirYRegistrarArchivo({
        buffer: file.buffer, nombreOriginal: file.originalname, mimeType: file.mimetype,
        registrar: (subida) => documentoRepository.crear({
          valeId, nombreOriginal: file.originalname, ruta: subida.url, tipo: 'documento',
          mimeType: file.mimetype, tamano: subida.size, esModificacion, subidoPor
        })
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
    await subirYRegistrarArchivo({
      buffer: pdfBuffer, nombreOriginal: `${vale.correlativo}.pdf`, mimeType: 'application/pdf',
      registrar: (subida) => valeRepository.actualizarPdfUrl(valeId, subida.url)
    });
    if (pdfUrlAnterior) {
      await supabaseStorage.eliminar(pdfUrlAnterior);
    }
  }
}

module.exports = new ValeCreacionService();
