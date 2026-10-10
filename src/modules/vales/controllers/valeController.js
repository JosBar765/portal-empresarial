// src/modules/vales/controllers/valeController.js
const valeService = require('../services/valeService');
const { validarArchivos, tipoRealCoincide } = require('../../../core/files/fileSignature');
const { responderError, responderErrorInterno } = require('../../../core/utils/erroresHttp');
const { idObligatorio, idOpcional } = require('../../../core/utils/validar');

// Taller de la conversación: obligatorio y válido.
function idTallerConversacion(valor) {
  try { return idObligatorio(valor, 'Taller'); } catch { throw new Error('Indica de qué taller es la conversación.'); }
}

class ValeController {
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
      const data = await valeService.obtenerTalleres();
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
      const data = await valeService.obtenerCapacidadEntrega(talleresIds, anio, mes);
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  // Mínima y días no disponibles (feriados, días sin recepción, hora máxima) para los talleres elegidos.
  async fechasEntrega(req, res) {
    try {
      const data = await valeService.obtenerFechasEntrega(req.query.talleres, req.query.desde, req.query.hasta);
      return res.json(data);
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
        soloModificados: req.query.soloModificados,
        disenadorId: req.query.disenadorId,
        tiendaId: req.query.tiendaId,
        sortKey: req.query.sortKey,
        sortDir: req.query.sortDir
      };
      const data = await valeService.obtenerBuzon(req.user, filtros);
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  // Vista Rendimiento (Gerente y Supervisor): KPIs, tendencia, ciclo por
  // etapa, ranking por taller/tienda y vales críticos. Solo lectura.
  _filtrosReporte(req) {
    return {
      ventana: req.query.ventana,
      fecha: req.query.fecha,
      desde: req.query.desde,
      hasta: req.query.hasta,
      tiendaId: req.query.tiendaId,
      tallerId: req.query.tallerId,
      personaIds: req.query.personaIds
    };
  }

  async reportes(req, res) {
    try {
      return res.json(await valeService.obtenerReporte(req.user, this._filtrosReporte(req)));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async reportePdf(req, res) {
    try {
      const { reporte, pdf } = await valeService.generarReportePdf(req.user, this._filtrosReporte(req));
      const fecha = reporte.periodo.desde && reporte.periodo.desde === reporte.periodo.hasta ? reporte.periodo.desde : (reporte.periodo.desde || 'historial');
      const quien = reporte.evaluados.length === 1
        ? reporte.evaluados[0].nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
        : (reporte.evaluados.length > 1 ? `${reporte.evaluados.length}-personas` : '');
      const sufijo = quien ? `${fecha}-${quien}` : fecha;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte-vales-${sufijo}.pdf"`);
      res.setHeader('Content-Length', pdf.length);
      return res.end(pdf);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async rendimientoGerencia(req, res) {
    try {
      const filtros = {
        ventana: req.query.ventana,
        fecha: req.query.fecha,
        desde: req.query.desde,
        hasta: req.query.hasta,
        tiendaId: req.query.tiendaId
      };
      const data = await valeService.obtenerRendimientoGerencia(req.user, filtros);
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  // "Encontrar vale" (solo Gerente, ver el guard en routes.js): un vale por
  // correlativo exacto, con sugerencias si no hay coincidencia.
  async buscarPorCorrelativo(req, res) {
    try {
      const data = await valeService.buscarValePorCorrelativo(req.query.correlativo);
      return res.json(data);
    } catch (error) {
      return responderError(res, error);
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
        return res.status(404).json({ error: 'El PDF de este vale aún no ha sido generado.' });
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
      const vale = await valeService.entregar(req.user, idObligatorio(req.params.id), propuesta, req.body.idempotencyKey);
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
      const vale = await valeService.aprobarGeneral(req.user, idObligatorio(req.params.id), archivo, req.body.idempotencyKey);
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
      return res.json(await valeService.listarConversacion(req.user, idObligatorio(req.params.id), idTallerConversacion(req.query.tallerId)));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async enviarMensaje(req, res) {
    try {
      return res.json(await valeService.enviarMensaje(req.user, idObligatorio(req.params.id), idTallerConversacion(req.body && req.body.tallerId), req.body && req.body.mensaje));
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
