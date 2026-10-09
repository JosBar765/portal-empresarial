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
const { validarTelefono } = require('../../../core/utils/validar');
const valePdfService = require('./valePdfService');
const valeEvents = require('../events');
const valeMutex = require('./valeMutex');
const valeVistoService = require('./valeVistoService');
const valeRechazoRepository = require('../repositories/valeRechazoRepository');
const {
  ESTADOS, hoyISO, horaActual, esDomingoHoy, esSabadoHoy, esFechaFinDeSemana, fechaMinimaEntrega, vencimiento24h, enriquecer,
  normalizarDatetime, calcularUrgente, registrarHistorial,
  esAdministrador, requerirVale, ROL, ESTADOS_EDITABLES_ASESOR, ESTADOS_TALLER, validarMotivoRechazo,
  esValeDeModificacion, estadoEnAutorizacion, puedeActuarComoAsesor
} = require('./valeHelpers');

class ValeCreacionService {
  formatearFecha(iso) {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  // Sábado y domingo: acciones que piden entrega (crear, modificar, corregir, reenviar).
  exigirDiaHabil(accion) {
    if (esSabadoHoy()) throw new Error(`Los sábados no se pueden ${accion} (día de descanso).`);
    this.exigirNoDomingo(accion);
  }

  // Domingo: además autorizar y aprobar modificación (el sábado sí se pueden).
  exigirNoDomingo(accion) {
    if (esDomingoHoy()) throw new Error(`Los domingos no se pueden ${accion} (día de descanso).`);
  }

  // Al autorizar, la entrega no puede haber quedado por debajo del mínimo vigente.
  exigirFechaAutorizable(vale) {
    const entrega = String(vale.fecha_entrega).slice(0, 10);
    if (entrega >= fechaMinimaEntrega()) return;
    throw new Error(entrega < hoyISO()
      ? 'La fecha de entrega ya pasó. Rechaza el vale para que el asesor modifique la fecha de entrega.'
      : 'La fecha de entrega ya no está disponible porque son pasadas las 12:00. Rechaza el vale para que el asesor modifique la fecha de entrega.');
  }

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
    this.exigirDiaHabil('crear vales de arte');

    const solicitante = await usuarioValeRepository.obtenerPorId(usuario.id);
    if (!solicitante || !solicitante.tienda_id) {
      throw new Error('Tu usuario no tiene una tienda asignada, así que no se puede crear el vale. Pide al administrador que te asigne una.');
    }
    const tienda = await catalogoRepository.obtenerTiendaPorId(solicitante.tienda_id);
    if (!tienda) {
      throw new Error('No se encontró la tienda asignada a tu usuario. Avisa al administrador.');
    }
    // Un supervisor autoriza también sus propios vales, pero solo si su tienda tiene algún supervisor que la cubra.
    if (Number(solicitante.rol_id) === ROL.SUPERVISOR && (await usuarioValeRepository.obtenerSupervisoresDeAsesor(usuario.id)).length === 0) {
      throw new Error('Tu tienda no tiene ningún supervisor que pueda autorizar tus vales, así que no se puede crear. Avisa al administrador.');
    }
    // El prefijo del correlativo es el país de la empresa de la tienda, salvo que la empresa defina uno propio (Trofex: TX).
    if (!tienda.prefijo_pais) {
      throw new Error('La tienda asignada a tu usuario no tiene un país configurado, así que no se puede crear el vale. Avisa al administrador.');
    }
    // Los talleres elegibles/exclusividad dependen de la tienda del propio
    // asesor — se resuelve ANTES de validar.
    const datos = await this.validarDatosVale(payload, { tiendaIdAsesor: tienda.id });

    // El límite diario COLECTIVO DEL SUPERVISOR se valida al AUTORIZAR
    // (autorizarCreacion), no al crear — crear un vale nunca se pospone ni
    // se bloquea. El lock por asesor se conserva para serializar la
    // creación en sí (mismo mutex que usan el resto de transiciones).
    //
    // El límite diario OPCIONAL POR TALLER (analisis_correcciones_28.md) SÍ
    // bloquea la creación — y a diferencia del de arriba, verificarlo y
    // luego insertar deben ser atómicos entre sí: `conColaDeCreacion` no
    // alcanza porque está indexada por asesor, así que dos asesores
    // DISTINTOS podían leer "queda 1 cupo" al mismo tiempo y ambos
    // insertar. `conColaDeCapacidad` (global) serializa esto contra
    // cualquier otra creación/aprobación que también consuma cupo.
    const valeId = await valeMutex.conColaDeCapacidad(async () => {
      await capacidadEntregaService.validarLimiteDiario(datos.talleresIds, datos.fechaEntregaNorm.slice(0, 10));

      return valeMutex.conColaDeCreacion(usuario.id, async () => {
        const hoy = hoyISO();

        // {PAÍS}-{TIENDA}-{MMAA}-{ID}: país de la empresa de la tienda y mes/año de creación. El número es el id
        // autoincremental de MySQL (asignado por valeRepository.crear DESPUÉS del insert) — global, y nunca se
        // reutiliza ni retrocede sin importar cuántos vales se borren después. Los correlativos anteriores no se renumeran.
        const correlativoPrefijo = `${tienda.prefijo_pais}-${tienda.codigo}-${hoy.slice(5, 7)}${hoy.slice(2, 4)}`;

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
          estado: ESTADOS.ESPERANDO_AUTORIZACION,
          vigenciaHasta: vencimiento24h()
        });
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
  // vale_talleres (antes ocurría de inmediato en crearVale).
  async autorizarCreacion(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      this.exigirNoDomingo('autorizar vales de arte');
      const vale = await requerirVale(valeId);
      if (esValeDeModificacion(vale)) {
        throw new Error('Este vale es una solicitud de modificación: se autoriza con "Aprobar modificación".');
      }
      if (vale.estado === ESTADOS.CREADO) {
        throw new Error('Este vale ya fue autorizado.');
      } else if (vale.estado !== ESTADOS.ESPERANDO_AUTORIZACION) {
        throw new Error('Solo se puede autorizar un vale que está esperando autorización.');
      }
      // Un asesor puede tener más de un supervisor cubriéndolo a la vez
      // (supervisores rotativos) — se necesita la lista completa tanto para
      // el chequeo de pertenencia como para notificar a todos, no solo al
      // que ejecuta la acción (si no, el resto se queda con el vale
      // apareciendo accionable en su buzón hasta que recargan a mano).
      const supervisoresDelAsesor = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
      if (!esAdministrador(usuario) && !supervisoresDelAsesor.some(s => s.id === usuario.id)) {
        throw new Error('Este vale es de un asesor que no está a tu cargo.');
      }
      this.exigirFechaAutorizable(vale);
      await valeVistoService.exigirVisto(usuario, valeId);
      const talleresIds = (vale.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);
      if (talleresIds.length === 0) {
        throw new Error('Este vale no tiene talleres seleccionados, no se puede autorizar.');
      }

      // El PDF con la firma se genera y sube ANTES de tocar la base: si falla, nada cambió.
      const ahora = `${hoyISO()} ${horaActual()}`;
      const nombresTalleres = await this.nombresDeTalleres(talleresIds);
      const documentos = await documentoRepository.listarPorVale(valeId);
      const pdfBuffer = await this.generarBufferPdf(vale, documentos,
        { autorizado_por: usuario.id, autorizado_en: ahora, autorizacion_tipo: 'CREACION' });
      const pdf = await supabaseStorage.subir(pdfBuffer, `${vale.correlativo}.pdf`, 'application/pdf');
      try {
        // El vale recién ocupa cupo al autorizarse; si dos supervisores compiten por el último lugar, solo gana uno.
        await valeMutex.conColaDeCapacidad(async () => {
          await capacidadEntregaService.validarLimiteDiario(talleresIds, String(vale.fecha_entrega).slice(0, 10), { paraSupervisor: true });
          await valeRepository.autorizarCreacionAtomico({
            valeId, usuarioId: usuario.id, talleresIds, autorizadoEn: ahora, tipo: 'CREACION', pdfUrl: pdf.url,
            estadoAnterior: ESTADOS.ESPERANDO_AUTORIZACION, estadoNuevo: ESTADOS.CREADO,
            accionHistorial: `Supervisor autorizó la creación — enviado a taller${talleresIds.length > 1 ? 'es' : ''}: ${nombresTalleres}`
          });
        });
      } catch (error) {
        try { await supabaseStorage.eliminar(pdf.url); } catch (e) { console.error(`[Storage] PDF huérfano sin borrar: ${pdf.url} (${e.message})`); }
        throw error;
      }
      // Recién con la base confirmada se borra el PDF anterior.
      if (vale.pdf_url) {
        try { await supabaseStorage.eliminar(vale.pdf_url); } catch (e) { console.error(`[Storage] PDF anterior sin borrar: ${vale.pdf_url} (${e.message})`); }
      }
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'autorizado (creación)', actor: usuario.nombre, actorId: usuario.id,
        salas: [`asesor:${vale.asesor_id}`, ...supervisoresDelAsesor.map(s => `supervisor:${s.id}`), ...talleresIds.map(id => `taller:${id}`)]
      });
      return enriquecer(actualizado);
    });
  }

  // El Supervisor rechaza un vale pendiente: una creación vuelve al asesor (RECHAZADO) con el motivo; una modificación
  // (`modificacion: true`) se elimina y el asesor recibe el motivo en una notificación (el original ya quedó RECIBIDO).
  async rechazarCreacion(usuario, valeId, motivo, { modificacion = false } = {}) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      if (esValeDeModificacion(vale) !== modificacion) {
        throw new Error(modificacion
          ? 'Este vale no es una solicitud de modificación.'
          : 'Este vale es una solicitud de modificación: se rechaza con "Rechazar modificación".');
      }
      const estadoPendiente = estadoEnAutorizacion(vale);
      if (vale.estado !== estadoPendiente) {
        throw new Error(modificacion
          ? 'Solo se puede rechazar una modificación que está esperando autorización.'
          : 'Solo se puede rechazar un vale que está esperando autorización.');
      }
      const supervisoresDelAsesor = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
      if (!esAdministrador(usuario) && !supervisoresDelAsesor.some(s => s.id === usuario.id)) {
        throw new Error('Este vale es de un asesor que no está a tu cargo.');
      }
      const motivoLimpio = validarMotivoRechazo(motivo);
      if (modificacion) {
        const original = await valeRepository.obtenerPorId(vale.vale_original_id);
        await this.eliminarValeConArchivos(valeId);
        const codigoOriginal = original ? original.correlativo : 'El vale original';
        valeEvents.notificar({
          vale, tipo: 'RECHAZADO', valeBorrado: true, nivel: 'alerta', actorId: usuario.id,
          texto: `(solicitud de modificación${original ? ` de ${original.correlativo}` : ''}) fue rechazada por ${usuario.nombre}`,
          detalle: `Motivo: ${motivoLimpio}. ${codigoOriginal} ya quedó como Recibido`,
          salas: [`asesor:${vale.asesor_id}`, ...supervisoresDelAsesor.map(s => `supervisor:${s.id}`)]
        });
        return { ...enriquecer(vale), eliminado: true };
      }
      const ahora = `${hoyISO()} ${horaActual()}`;
      await valeRechazoRepository.rechazar({
        valeId, usuarioId: usuario.id, motivo: motivoLimpio, rechazadoEn: ahora, estadoPendiente,
        accionHistorial: `Supervisor rechazó la creación y lo devolvió al asesor — motivo: ${motivoLimpio}`
      });
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'rechazado', tipo: 'RECHAZADO', actor: usuario.nombre, actorId: usuario.id,
        detalle: `Motivo: ${motivoLimpio}`, nivel: 'alerta',
        salas: [`asesor:${vale.asesor_id}`, ...supervisoresDelAsesor.map(s => `supervisor:${s.id}`)]
      });
      return enriquecer(actualizado);
    });
  }

  // Un vale (o una solicitud de modificación) sin autorizar cumple su vigencia de 24 h: se elimina solo (con sus archivos,
  // salvo los que comparte con su original) y se avisa con su código. El original no se toca.
  async expirarVale(valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await valeRepository.obtenerPorId(valeId);
      if (!vale || !ESTADOS_EDITABLES_ASESOR.includes(vale.estado)) return false;
      const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
      const original = esValeDeModificacion(vale) ? await valeRepository.obtenerPorId(vale.vale_original_id) : null;
      await this.eliminarValeConArchivos(valeId);
      valeEvents.notificar({
        vale, tipo: 'EXPIRADO', valeBorrado: true, nivel: 'alerta',
        texto: original
          ? `(solicitud de modificación) fue eliminado automáticamente: venció su vigencia de 24 horas sin ser autorizado. ${original.correlativo} ya quedó como Recibido`
          : 'fue eliminado automáticamente: venció su vigencia de 24 horas sin ser autorizado',
        salas: [`asesor:${vale.asesor_id}`, ...supervisores.map(s => `supervisor:${s.id}`)]
      });
      return true;
    });
  }

  // El asesor da de baja un vale propio sin autorizar (o rechazado), o ya autorizado mientras algún taller
  // reclame sus adjuntos: se borra el vale completo y se avisa a los talleres que ya lo tenían.
  async darDeBaja(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      if (!puedeActuarComoAsesor(usuario)) {
        throw new Error('Solo un asesor o un supervisor de ventas puede dar de baja un vale.');
      }
      const vale = await requerirVale(valeId);
      if (vale.asesor_id !== usuario.id) {
        throw new Error('Solo puedes dar de baja tus propios vales.');
      }
      const talleres = await valeTallerRepository.listarPorVale(valeId);
      if (!ESTADOS_EDITABLES_ASESOR.includes(vale.estado)
        && !talleres.some(t => [ESTADOS_TALLER.ADJUNTOS_RECHAZADOS, ESTADOS_TALLER.ADJUNTOS_RESPONDIDOS].includes(t.estado))) {
        throw new Error(`${esValeDeModificacion(vale) ? 'Esta modificación ya fue autorizada' : 'Este vale ya fue autorizado'}: solo se puede dar de baja mientras un taller reclame sus adjuntos.`);
      }
      const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
      await this.eliminarValeConArchivos(valeId);
      const salasTalleres = [...new Set(talleres.flatMap(t => [`taller:${t.taller_id}`, ...(t.disenador_id ? [`disenador:${t.disenador_id}`] : [])]))];
      valeEvents.notificar({
        vale, accion: 'dado de baja', valeBorrado: true, actor: usuario.nombre, actorId: usuario.id,
        salas: [`asesor:${vale.asesor_id}`, ...supervisores.map(s => `supervisor:${s.id}`), ...salasTalleres]
      });
      return { valeId: vale.id, correlativo: vale.correlativo };
    });
  }

  // El asesor vuelve a mandar a autorización un vale rechazado, ya corregido.
  async reenviarAutorizacion(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      this.exigirDiaHabil('reenviar vales a autorización');
      if (!puedeActuarComoAsesor(usuario)) {
        throw new Error('Solo un asesor o un supervisor de ventas puede reenviar un vale a autorización.');
      }
      const vale = await requerirVale(valeId);
      if (vale.asesor_id !== usuario.id) {
        throw new Error('Solo puedes reenviar tus propios vales.');
      }
      if (esValeDeModificacion(vale)) throw new Error('Las modificaciones rechazadas se eliminan: solicita una nueva.');
      if (vale.estado !== ESTADOS.RECHAZADO) {
        throw new Error('Este vale no está rechazado, no hace falta reenviarlo.');
      }
      const fechaEntrega = String(vale.fecha_entrega).slice(0, 10);
      if (esFechaFinDeSemana(fechaEntrega) || fechaEntrega < fechaMinimaEntrega()) {
        throw new Error(`La fecha de entrega ya no está disponible (mínima: ${this.formatearFecha(fechaMinimaEntrega())}). Corrige el vale con una fecha de entrega válida antes de reenviarlo.`);
      }
      await capacidadEntregaService.validarLimiteDiario(
        (vale.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite), fechaEntrega
      );
      await valeRechazoRepository.reenviar({
        valeId, usuarioId: usuario.id, estadoDestino: ESTADOS.ESPERANDO_AUTORIZACION,
        accionHistorial: 'Asesor corrigió el vale y lo reenvió a autorización'
      });
      const actualizado = await valeRepository.obtenerPorId(valeId);
      const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
      valeEvents.notificar({
        vale: actualizado, accion: 'reenviado a autorización', actor: usuario.nombre, actorId: usuario.id,
        salas: [`asesor:${vale.asesor_id}`, ...supervisores.map(s => `supervisor:${s.id}`)]
      });
      return enriquecer(actualizado);
    });
  }

  // Validaciones compartidas entre crearVale() y solicitarModificacion() (el
  // formulario de modificación es literalmente el mismo formulario de
  // creación, salvo por los talleres: la resolución del destino de una
  // modificación tiene su propia lógica, ver valeConfirmacionService — así
  // que crearVale() sigue exigiendo `talleresIds` aquí pero
  // solicitarModificacion() no pasa por este camino para elegir taller).
  async validarDatosVale(payload, { requiereTalleres = true, tiendaIdAsesor = null } = {}) {
    const {
      clienteEmpresa, clienteTelefono, clienteCorreo,
      fechaEntrega, fechaEvento, tecnica, acabado,
      cantidad, cotizacion, descripcion
    } = payload;
    // Los obligatorios se validan ya sin espacios: "   " cuenta como vacío.
    const recortar = (valor) => String(valor ?? '').trim();
    const clienteNombre = recortar(payload.clienteNombre);
    const producto = recortar(payload.producto);
    const material = recortar(payload.material);

    if (!clienteNombre) throw new Error('El nombre del cliente es obligatorio.');
    if (!recortar(clienteTelefono)) throw new Error('El teléfono del cliente es obligatorio.');
    if (!recortar(clienteCorreo)) throw new Error('El correo del cliente es obligatorio.');
    if (!producto) throw new Error('El código de producto es obligatorio.');
    if (!material) throw new Error('El material es obligatorio.');
    if (!fechaEntrega || !fechaEvento) {
      throw new Error('Las fechas de entrega y de evento son obligatorias.');
    }
    // Límites de longitud alineados a las columnas reales de `vales` — sin
    // esto, un valor demasiado largo llega intacto hasta MySQL y el error
    // de "Data too long for column" (con el nombre de la columna) podía
    // filtrarse hasta el cliente.
    const limitesLongitud = {
      // Máximos que caben en su celda del PDF aun con letras anchas (ver valePdfService); la descripción se autoajusta.
      clienteNombre: 100, clienteEmpresa: 100, clienteTelefono: 20, clienteCorreo: 100,
      producto: 40, material: 40, tecnica: 40, acabado: 40, descripcion: 600
    };
    const etiquetasCampo = {
      clienteNombre: 'El nombre del cliente', clienteEmpresa: 'La empresa', clienteTelefono: 'El teléfono',
      clienteCorreo: 'El correo', producto: 'El código de producto', material: 'El material',
      tecnica: 'La técnica', acabado: 'El acabado', descripcion: 'La descripción'
    };
    for (const [campo, valor] of Object.entries({ clienteNombre, clienteEmpresa, clienteTelefono, clienteCorreo, producto, material, tecnica, acabado, descripcion })) {
      if (valor && String(valor).length > limitesLongitud[campo]) {
        const fem = etiquetasCampo[campo].startsWith('La ');
        throw new Error(`${etiquetasCampo[campo]} es demasiad${fem ? 'a larga' : 'o largo'} (máximo ${limitesLongitud[campo]} caracteres).`);
      }
    }
    await valePdfService.validarTextos(Object.entries({ clienteNombre, clienteEmpresa, clienteTelefono, clienteCorreo, producto, material, tecnica, acabado, descripcion })
      .map(([campo, valor]) => ({ etiqueta: etiquetasCampo[campo].replace(/^(El|La) /, ''), valor })));
    validarTelefono(clienteTelefono, 'El teléfono del cliente');
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
    // Las fechas se validan una por una y luego entre sí, cada error con su propio mensaje.
    const fechaReal = (norm) => {
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(norm)) return false;
      const d = new Date(`${norm.slice(0, 10)}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === norm.slice(0, 10);
    };
    if (!fechaReal(fechaEntregaNorm)) throw new Error('La fecha de entrega no es válida.');
    if (!fechaReal(fechaEventoNorm)) throw new Error('La fecha del evento no es válida.');
    const entregaISO = fechaEntregaNorm.slice(0, 10);
    if (esFechaFinDeSemana(entregaISO)) throw new Error('La fecha de entrega no puede ser sábado ni domingo.');
    const minima = fechaMinimaEntrega();
    if (entregaISO < minima) {
      throw new Error(`La fecha de entrega mínima es ${this.formatearFecha(minima)}: no se puede pedir para días pasados, para hoy después de las 12:00 ni para sábados y domingos.`);
    }
    if (!(new Date(fechaEventoNorm.replace(' ', 'T')) > new Date(fechaEntregaNorm.replace(' ', 'T')))) {
      throw new Error('La fecha del evento debe ser posterior a la fecha de entrega.');
    }
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
      urgente: calcularUrgente(fechaEntregaNorm),
      producto, material,
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
      throw new Error('No se pudieron leer los talleres seleccionados. Vuelve a elegirlos.');
    }
    const numeros = (Array.isArray(talleresIds) ? talleresIds : []).map(id => (typeof id === 'string' && id.trim() === '' ? NaN : Number(id)));
    if (numeros.some(n => !Number.isInteger(n) || n <= 0)) {
      throw new Error('Alguno de los talleres elegidos no es válido. Vuelve a elegirlos.');
    }
    talleresIds = [...new Set(numeros)];
    if (talleresIds.length === 0) {
      throw new Error('Debe seleccionar al menos un taller para el vale de arte.');
    }
    const talleresActivos = await tallerRepository.listarActivos();
    const idsValidos = new Set(talleresActivos.map(t => t.id));
    if (!talleresIds.every(id => idsValidos.has(id))) {
      throw new Error('Alguno de los talleres elegidos ya no está disponible. Vuelve a elegirlos.');
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
        // Un archivo que otro vale (el original de una modificación) también usa no se borra de Storage.
        if (await documentoRepository.contarReferenciasEnOtrosVales(doc.ruta, valeId) > 0) continue;
        await supabaseStorage.eliminar(doc.ruta);
      } catch { /* best-effort — el vale se borra de todas formas */ }
    }
    if (vale.pdf_url) {
      try {
        await supabaseStorage.eliminar(vale.pdf_url);
      } catch { /* best-effort */ }
    }
    await valeRepository.eliminar(valeId);
    // Un MOD- ya autorizado que se elimina nunca se trabajó: el original puede pedir otra modificación.
    if (vale.vale_original_id && await valeRepository.reabrirModificacion(vale.vale_original_id)) {
      const original = await valeRepository.obtenerPorId(vale.vale_original_id);
      if (original) {
        await registrarHistorial(original.id, vale.asesor_id, null, original.estado, original.estado,
          'Solicitud de modificación eliminada: puede solicitar una nueva');
      }
    }
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

  // `overrides`: campos del vale que aún no están en la base (p. ej. la firma de autorización).
  async regenerarPdf(valeId, overrides) {
    const vale = await valeRepository.obtenerPorId(valeId);
    const documentos = await documentoRepository.listarPorVale(valeId);
    const pdfBuffer = await this.generarBufferPdf(vale, documentos, overrides);
    const pdfUrlAnterior = vale.pdf_url;
    await subirYRegistrarArchivo({
      buffer: pdfBuffer, nombreOriginal: `${vale.correlativo}.pdf`, mimeType: 'application/pdf',
      registrar: (subida) => valeRepository.actualizarPdfUrl(valeId, subida.url)
    });
    if (pdfUrlAnterior) {
      try { await supabaseStorage.eliminar(pdfUrlAnterior); } catch (e) { console.error(`[Storage] PDF anterior sin borrar: ${pdfUrlAnterior} (${e.message})`); }
    }
  }

  // Genera el PDF de un vale a partir de sus datos y documentos, sin guardar nada.
  async generarBufferPdf(vale, documentos, overrides) {
    if (overrides) vale = { ...vale, ...overrides };
    const asesor = await usuarioValeRepository.obtenerPorId(vale.asesor_id);
    // Firma roja de autorización — solo existe una vez que el Supervisor
    // autorizó (creación o modificación); antes de eso la caja de firma del
    // PDF sigue vacía (ver valePdfService).
    let firmaAutorizacion = null;
    if (vale.autorizado_por && vale.autorizacion_tipo) {
      const supervisor = await usuarioValeRepository.obtenerPorId(vale.autorizado_por);
      if (supervisor) firmaAutorizacion = { nombre: supervisor.nombre, tipo: vale.autorizacion_tipo, fechaHora: vale.autorizado_en || null };
    }
    const valeConAsesor = {
      ...vale,
      __asesorNombre: asesor ? asesor.nombre : null,
      __asesorCorreo: asesor ? asesor.email : null,
      __asesorTelefono: asesor ? asesor.telefono : null,
      __firmaAutorizacion: firmaAutorizacion
    };
    return valePdfService.generarPdfVale(valeConAsesor, documentos);
  }
}

module.exports = new ValeCreacionService();
