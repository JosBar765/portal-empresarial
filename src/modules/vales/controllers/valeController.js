// src/modules/vales/controllers/valeController.js
const valeService = require('../services/valeService');
const valeFiltroAvisosService = require('../services/valeFiltroAvisosService');
const valeUbicacionService = require('../services/valeUbicacionService');
const { leerAdjuntos } = require('../services/propuestaAdjuntos');
const { validarArchivos, tipoRealCoincide } = require('../../../core/files/fileSignature');
const { responderError, responderErrorInterno, ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { ESTADOS_DESGLOSE } = require('../services/valeReporteFiltroDesglose');
const { idObligatorio, idOpcional } = require('../../../core/utils/validar');
const { responderErrorReporte } = require('../utils/reporteErrores');

// Taller de la conversación: obligatorio y válido.
function idTallerConversacion(valor) {
  try { return idObligatorio(valor, 'Taller'); } catch { throw new Error('Indica de qué taller es la conversación.'); }
}

// Pista de la pantalla; el servicio solo la honra si el usuario es el dueño del vale.
const ladoPedido = (valor) => (valor === 'ASESOR' ? 'ASESOR' : null);

class ValeController {
  async filtroAvisos(req, res) {
    try {
      return res.json(await valeFiltroAvisosService.leer(req.user));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async guardarFiltroAvisos(req, res) {
    try {
      return res.json(await valeFiltroAvisosService.guardar(req.user, req.body));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async catalogos(req, res) {
    try {
      const data = await valeService.obtenerCatalogos(req.user);
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async talleres(req, res) {
    try {
      const data = await valeService.obtenerTalleres(req.user);
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  // Capacidad por día (mes visible) de los talleres elegidos, para el
  // calendario de "Fecha de entrega" — analisis_correcciones_28.md.
  async capacidadEntrega(req, res) {
    try {
      const talleresIds = String(req.query.talleres || '').split(',').map(Number).filter(Number.isFinite);
      const anio = Number(req.query.anio);
      const mes = Number(req.query.mes);
      if (!talleresIds.length || !Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ error: 'Parámetros inválidos: se requieren talleres, anio y mes.' });
      }
      const data = await valeService.obtenerCapacidadEntrega(talleresIds, anio, mes, req.user);
      return res.json(data);
    } catch (error) {
      return responderError(res, error);
    }
  }

  // Mínima y días no disponibles (feriados, días sin recepción, hora máxima) para los talleres elegidos.
  async fechasEntrega(req, res) {
    try {
      const data = await valeService.obtenerFechasEntrega(req.query.talleres, req.query.desde, req.query.hasta, req.query.urgente, req.query.modificacion, req.user);
      return res.json(data);
    } catch (error) {
      return responderError(res, error);
    }
  }

  // Información por día del calendario desplegable del Buzón (cupo para el Supervisor y el Asesor, conteo para Encargado y Diseñador).
  async calendarioBuzon(req, res) {
    try {
      const anio = Number(req.query.anio);
      const mes = Number(req.query.mes);
      if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12 || anio < 2000 || anio > 2100) {
        return res.status(400).json({ error: 'Parámetros inválidos: se requieren anio y mes.' });
      }
      return res.json(await valeService.obtenerCalendarioBuzon(req.user, anio, mes));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async crear(req, res) {
    try {
      const archivos = validarArchivos(req.files);
      const vale = await valeService.crearVale(req.user, req.body, archivos);
      return res.status(201).json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async corregir(req, res) {
    try {
      const archivos = validarArchivos(req.files);
      const vale = await valeService.corregirVale(req.user, idObligatorio(req.params.id), req.body, archivos);
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  // Dónde ve este usuario el vale que nombra un aviso.
  async ubicacion(req, res) {
    try {
      return res.json(await valeUbicacionService.ubicar(req.user, idObligatorio(req.params.id)));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async buzon(req, res) {
    try {
      const filtros = {
        ventana: req.query.ventana,
        fecha: req.query.fecha,
        desde: req.query.desde,
        hasta: req.query.hasta,
        vista: req.query.vista,
        offset: req.query.offset,
        cursor: req.query.cursor,
        filtroContador: req.query.filtroContador,
        busqueda: req.query.busqueda,
        soloAtrasados: req.query.soloAtrasados,
        soloRechazos: req.query.soloRechazos,
        soloModificados: req.query.soloModificados,
        disenadorId: req.query.disenadorId,
        tiendaId: req.query.tiendaId,
        tiendaIds: req.query.tiendaIds,
        asesorIds: req.query.asesorIds,
        sortKey: req.query.sortKey,
        sortDir: req.query.sortDir
      };
      const data = await valeService.obtenerBuzon(req.user, filtros);
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  // Solo el PDF: filtro del desglose por contador (estado exclusivo + urgentes); un estado desconocido responde 400.
  _filtroDesglose(req) {
    const estado = String(req.query.desgloseEstado ?? '');
    if (estado && !ESTADOS_DESGLOSE.includes(estado)) throw new ErrorDeNegocio('El filtro del desglose no es válido.', 400);
    return { desgloseEstado: estado || null, desgloseUrgentes: req.query.desgloseUrgentes === '1' };
  }

  // Reporte de actividad de tienda: el período igual que Actividad y, opcional, lo que emite el filtro en cascada (una tienda o una lista).
  // Un id mal formado responde 400 en vez de ignorarse.
  _filtrosReporteTienda(req) {
    const lista = String(req.query.tiendaIds ?? '').split(',').filter(t => t.trim() !== '');
    return {
      ventana: req.query.ventana, fecha: req.query.fecha, desde: req.query.desde, hasta: req.query.hasta,
      tiendaId: idOpcional(req.query.tiendaId, 'Tienda'),
      tiendaIds: lista.map(t => idObligatorio(t.trim(), 'Tienda')),
      // Solo el PDF lo usa: `desglose=0` lo imprime sin el desglose de vales (contadores y gráfica siempre van).
      incluirDesglose: req.query.desglose !== '0',
      // Solo el PDF: id de la tienda enfocada en la gráfica; el desglose se imprime de esa tienda (null = el del filtro).
      tiendaDesglose: idOpcional(req.query.tiendaDesglose, 'Tienda'),
      ...this._filtroDesglose(req)
    };
  }

  async reporteActividadTienda(req, res) {
    try {
      return res.json(await valeService.obtenerReporteActividadTienda(req.user, this._filtrosReporteTienda(req)));
    } catch (error) {
      return responderErrorReporte(req, res, error, { reporte: 'actividad-tienda', etapa: 'generar' });
    }
  }

  async opcionesActividadTienda(req, res) {
    try {
      return res.json(await valeService.obtenerOpcionesActividadTienda(req.user));
    } catch (error) {
      return responderErrorReporte(req, res, error, { reporte: 'actividad-tienda', etapa: 'opciones' });
    }
  }

  async opcionesActividadEquipo(req, res, tipo) {
    try {
      return res.json(await valeService.obtenerOpcionesActividadEquipo(tipo, req.user));
    } catch (error) {
      return responderErrorReporte(req, res, error, { reporte: `actividad-${tipo}`, etapa: 'opciones' });
    }
  }

  async reporteActividadTiendaPdf(req, res) {
    try {
      const { reporte, pdf } = await valeService.generarReporteActividadTiendaPdf(req.user, this._filtrosReporteTienda(req));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte-actividad-tienda-${reporte.periodo.desde}.pdf"`);
      res.setHeader('Content-Length', pdf.length);
      return res.end(pdf);
    } catch (error) {
      return responderErrorReporte(req, res, error, { reporte: 'actividad-tienda', etapa: 'pdf' });
    }
  }

  // Reportes de actividad de talleres, diseñadores y asesores: el período igual que Actividad y la lista de su filtro (id mal formado: 400).
  _filtrosReporteEquipo(req, tipo) {
    const lista = (valor, etiqueta) => String(valor ?? '').split(',').filter(t => t.trim() !== '').map(t => idObligatorio(t.trim(), etiqueta));
    const periodo = { ventana: req.query.ventana, fecha: req.query.fecha, desde: req.query.desde, hasta: req.query.hasta };
    if (tipo === 'taller') {
      // Taller enfocado en la gráfica (solo PDF) y su modo (entregados | tarde), como el diseñador en su reporte.
      const modo = String(req.query.tallerModo ?? '').trim();
      if (modo !== '' && modo !== 'entregados' && modo !== 'tarde') throw new ErrorDeNegocio('El modo del taller no es válido.', 400);
      return {
        ...periodo, tallerId: idOpcional(req.query.tallerId, 'Taller'), tallerIds: lista(req.query.tallerIds, 'Taller'),
        incluirDesglose: req.query.desglose !== '0', tallerDesglose: idOpcional(req.query.tallerDesglose, 'Taller'), tallerModo: modo || null, ...this._filtroDesglose(req)
      };
    }
    if (tipo === 'disenador') {
      // Diseñador enfocado en la gráfica (solo PDF): el 0 es el grupo «Sin diseñador asignado», que `idOpcional` no admite.
      const enfocado = String(req.query.disenadorDesglose ?? '').trim();
      const disenadorDesglose = enfocado === '' ? null : enfocado === '0' ? 0 : idObligatorio(enfocado, 'Diseñador');
      const modo = String(req.query.disenadorModo ?? '').trim();
      if (modo !== '' && modo !== 'entregados' && modo !== 'tarde') throw new ErrorDeNegocio('El modo del diseñador no es válido.', 400);
      return { ...periodo, disenadorIds: lista(req.query.disenadorIds, 'Diseñador'), tallerId: idOpcional(req.query.tallerId, 'Taller'), tallerIds: lista(req.query.tallerIds, 'Taller'), incluirDesglose: req.query.desglose !== '0', disenadorDesglose, disenadorModo: modo || null, ...this._filtroDesglose(req) };
    }
    // Asesores: además filtra por tienda (una o una lista para un país o grupo) y su PDF puede omitir el desglose (`desglose=0`).
    return {
      ...periodo, asesorIds: lista(req.query.asesorIds, 'Asesor'),
      tiendaId: idOpcional(req.query.tiendaId, 'Tienda'), tiendaIds: lista(req.query.tiendaIds, 'Tienda'),
      incluirDesglose: req.query.desglose !== '0',
      // Asesor enfocado en la gráfica: su desglose en el PDF y, con `soloUrgentes=1`, solo sus vales urgentes (contadores y desglose).
      asesorDesglose: idOpcional(req.query.asesorDesglose, 'Asesor'), soloUrgentes: req.query.soloUrgentes === '1',
      ...this._filtroDesglose(req)
    };
  }

  async reporteActividadEquipo(req, res, tipo) {
    try {
      return res.json(await valeService.obtenerReporteActividadEquipo(tipo, req.user, this._filtrosReporteEquipo(req, tipo)));
    } catch (error) {
      return responderErrorReporte(req, res, error, { reporte: `actividad-${tipo}`, etapa: 'generar' });
    }
  }

  async reporteActividadEquipoPdf(req, res, tipo) {
    try {
      const { reporte, pdf } = await valeService.generarReporteActividadEquipoPdf(tipo, req.user, this._filtrosReporteEquipo(req, tipo));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte-actividad-${tipo}-${reporte.periodo.desde || 'historial'}.pdf"`);
      res.setHeader('Content-Length', pdf.length);
      return res.end(pdf);
    } catch (error) {
      return responderErrorReporte(req, res, error, { reporte: `actividad-${tipo}`, etapa: 'pdf' });
    }
  }

  // Propuesta de un vale con su nota y enlaces: tipo `taller` (con disenadorId), `general` (la fusión) o `ultima`.
  async propuesta(req, res) {
    try {
      const data = await valeService.obtenerPropuesta(req.user, idObligatorio(req.params.id), {
        tipo: String(req.query.tipo || 'ultima'), disenadorId: Number(req.query.disenadorId) || null
      });
      return res.json(data);
    } catch (error) {
      return responderError(res, error, 404);
    }
  }

  async detalle(req, res) {
    try {
      const data = await valeService.obtenerDetalle(req.user, idObligatorio(req.params.id));
      return res.json(data);
    } catch (error) {
      return responderError(res, error, 404);
    }
  }

  async descargarPdf(req, res) {
    try {
      // Si el vale pedido ya fue modificado, sirve el PDF del vale MOD- vigente en
      // vez del original congelado.
      const vale = await valeService.obtenerValeParaPdf(req.user, idObligatorio(req.params.id));
      valeService.marcarVisto(req.user, vale.id).catch(error => console.error('[Visto]', error.message));
      if (!vale.pdf_url) {
        const error = vale.archivos_purgados_en ? 'El PDF de este vale ya expiró y fue eliminado.' : 'El PDF de este vale aún no ha sido generado.';
        return res.status(404).json({ error });
      }
      return res.redirect(vale.pdf_url);
    } catch (error) {
      return responderError(res, error, 404);
    }
  }

  async asignar(req, res) {
    try {
      const vale = await valeService.asignar(req.user, idObligatorio(req.params.id), idObligatorio(req.body.disenadorId, 'Diseñador'), idOpcional(req.body.tallerId, 'Taller'));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async comenzar(req, res) {
    try {
      const vale = await valeService.comenzar(req.user, idObligatorio(req.params.id));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async entregar(req, res) {
    try {
      const propuesta = req.files && req.files.propuesta ? req.files.propuesta[0] : null;
      if (propuesta && (propuesta.mimetype !== 'application/pdf' || !tipoRealCoincide(propuesta.buffer, propuesta.mimetype))) {
        throw new Error('La propuesta debe adjuntarse en formato PDF.');
      }
      const vale = await valeService.entregar(req.user, idObligatorio(req.params.id), propuesta, req.body.idempotencyKey, leerAdjuntos(req.body));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async cancelarProceso(req, res) {
    try {
      const vale = await valeService.cancelarProcesoDisenador(req.user, idObligatorio(req.params.id));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async pausar(req, res) {
    try {
      const vale = await valeService.pausarProceso(req.user, idObligatorio(req.params.id));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async reanudar(req, res) {
    try {
      const vale = await valeService.reanudarProceso(req.user, idObligatorio(req.params.id));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async revisar(req, res) {
    try {
      const { aprobar, disenadorReasignadoId, tallerId } = req.body;
      const vale = await valeService.revisarPropuesta(req.user, idObligatorio(req.params.id), {
        aprobar: aprobar === true || aprobar === 'true',
        disenadorReasignadoId: idOpcional(disenadorReasignadoId, 'Diseñador'),
        tallerId: idOpcional(tallerId, 'Taller')
      });
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async aprobarGeneral(req, res) {
    try {
      const archivo = req.files && req.files.fusion ? req.files.fusion[0] : null;
      if (archivo && (archivo.mimetype !== 'application/pdf' || !tipoRealCoincide(archivo.buffer, archivo.mimetype))) {
        throw new Error('El documento de fusión debe adjuntarse en formato PDF.');
      }
      const vale = await valeService.aprobarGeneral(req.user, idObligatorio(req.params.id), archivo, req.body.idempotencyKey, leerAdjuntos(req.body));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async confirmar(req, res) {
    try {
      const vale = await valeService.confirmarRecibido(req.user, idObligatorio(req.params.id));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async solicitarModificacion(req, res) {
    try {
      const archivos = validarArchivos(req.files);
      const vale = await valeService.solicitarModificacion(req.user, idObligatorio(req.params.id), req.body, archivos);
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  // Rechazo de propuesta: el asesor dueño y el taller conversan; el taller acepta o rechaza.
  async solicitarRechazoPropuesta(req, res) {
    try {
      return res.json(await valeService.solicitarRechazoPropuesta(req.user, idObligatorio(req.params.id), req.body || {}));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async listarRechazosPropuesta(req, res) {
    try {
      return res.json(await valeService.listarRechazosPropuesta(req.user, idObligatorio(req.params.id)));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async conversacionRechazoPropuesta(req, res) {
    try {
      return res.json(await valeService.conversacionRechazoPropuesta(req.user, idObligatorio(req.params.id), idObligatorio(req.params.rechazoId), ladoPedido(req.query.lado)));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async enviarMensajeRechazoPropuesta(req, res) {
    try {
      return res.json(await valeService.enviarMensajeRechazoPropuesta(req.user, idObligatorio(req.params.id), idObligatorio(req.params.rechazoId), req.body && req.body.mensaje, ladoPedido(req.body && req.body.lado)));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async aceptarRechazoPropuesta(req, res) {
    try {
      return res.json(await valeService.aceptarRechazoPropuesta(req.user, idObligatorio(req.params.id), idObligatorio(req.params.rechazoId), req.body && req.body.mensaje));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async rechazarRechazoPropuesta(req, res) {
    try {
      return res.json(await valeService.rechazarRechazoPropuesta(req.user, idObligatorio(req.params.id), idObligatorio(req.params.rechazoId), req.body && req.body.mensaje));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async cancelarRechazoPropuesta(req, res) {
    try {
      return res.json(await valeService.cancelarRechazoPropuesta(req.user, idObligatorio(req.params.id), idObligatorio(req.params.rechazoId)));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async aprobarModificacion(req, res) {
    try {
      const vale = await valeService.aprobarModificacion(req.user, idObligatorio(req.params.id));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async rechazarModificacion(req, res) {
    try {
      const vale = await valeService.rechazarModificacion(req.user, idObligatorio(req.params.id), req.body && req.body.motivo);
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async autorizarCreacion(req, res) {
    try {
      const vale = await valeService.autorizarCreacion(req.user, idObligatorio(req.params.id));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async rechazarCreacion(req, res) {
    try {
      const resultado = await valeService.rechazarCreacion(req.user, idObligatorio(req.params.id), req.body && req.body.motivo);
      return res.json(resultado);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async darDeBaja(req, res) {
    try {
      const resultado = await valeService.darDeBaja(req.user, idObligatorio(req.params.id));
      return res.json(resultado);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async darDeBajaTaller(req, res) {
    try {
      const vale = await valeService.darDeBajaTaller(req.user, idObligatorio(req.params.id), idObligatorio(req.params.tallerId));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async verificarAdjuntos(req, res) {
    try {
      const vale = await valeService.verificarAdjuntos(req.user, idObligatorio(req.params.id), idOpcional(req.body && req.body.tallerId, 'Taller'));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async rechazarAdjuntos(req, res) {
    try {
      const vale = await valeService.rechazarAdjuntos(req.user, idObligatorio(req.params.id), idOpcional(req.body && req.body.tallerId, 'Taller'), req.body && req.body.mensaje);
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async conversacion(req, res) {
    try {
      return res.json(await valeService.listarConversacion(req.user, idObligatorio(req.params.id), idTallerConversacion(req.query.tallerId), ladoPedido(req.query.lado)));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async enviarMensaje(req, res) {
    try {
      return res.json(await valeService.enviarMensaje(req.user, idObligatorio(req.params.id), idTallerConversacion(req.body && req.body.tallerId), req.body && req.body.mensaje, ladoPedido(req.body && req.body.lado)));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async responderAdjuntos(req, res) {
    try {
      let tallerId = null;
      try { tallerId = idOpcional(req.body && req.body.tallerId, 'Taller'); } catch { /* inválido = no indicado */ }
      if (tallerId === null) throw new Error('Indica a qué taller respondes.');
      const vale = await valeService.responderAdjuntos(req.user, idObligatorio(req.params.id), tallerId, req.body && req.body.mensaje);
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async reenviar(req, res) {
    try {
      const vale = await valeService.reenviarAutorizacion(req.user, idObligatorio(req.params.id));
      return res.json(vale);
    } catch (error) {
      return responderError(res, error);
    }
  }

  // Marca como vista la propuesta aprobada de otro taller del vale.
  async propuestaOtroTallerVista(req, res) {
    try {
      const data = await valeService.marcarPropuestaOtroTallerVista(req.user, idObligatorio(req.params.id), idObligatorio(req.params.tallerId, 'Taller'));
      return res.json(data);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async marcarVisto(req, res) {
    try {
      await valeService.marcarVisto(req.user, idObligatorio(req.params.id));
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async cargaTrabajo(req, res) {
    try {
      const data = await valeService.obtenerCargaTrabajo(req.user);
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async cargaTrabajoDisenador(req, res) {
    try {
      const data = await valeService.obtenerAsignacionesDeDisenador(req.user, idObligatorio(req.params.disenadorId, 'Diseñador'));
      return res.json(data);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async disenadores(req, res) {
    try {
      const data = await valeService.obtenerDisenadoresAsignables(req.user);
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }
}

module.exports = new ValeController();
