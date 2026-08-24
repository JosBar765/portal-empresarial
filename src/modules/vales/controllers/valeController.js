// src/modules/vales/controllers/valeController.js
const valeService = require('../services/valeService');

const IMAGEN_MAX_BYTES = 2 * 1024 * 1024;
const DOCUMENTO_MAX_BYTES = 3 * 1024 * 1024;

function validarArchivos(files) {
  const imagenes = (files && files.imagenes) || [];
  const documentos = (files && files.documentos) || [];

  for (const img of imagenes) {
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(img.mimetype)) {
      throw new Error(`Formato de imagen no soportado: ${img.originalname}`);
    }
    if (img.size > IMAGEN_MAX_BYTES) {
      throw new Error(`La imagen ${img.originalname} supera los 2MB permitidos.`);
    }
  }
  for (const doc of documentos) {
    if (doc.mimetype !== 'application/pdf') {
      throw new Error(`Formato de documento no soportado: ${doc.originalname} (solo se permite PDF).`);
    }
    if (doc.size > DOCUMENTO_MAX_BYTES) {
      throw new Error(`El documento ${doc.originalname} supera los 3MB permitidos.`);
    }
  }
  return { imagenes, documentos };
}

class ValeController {
  async catalogos(req, res) {
    try {
      const data = await valeService.obtenerCatalogos();
      return res.json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async talleres(req, res) {
    try {
      const data = await valeService.obtenerTalleres();
      return res.json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async limiteRestante(req, res) {
    try {
      const restantes = await valeService.obtenerLimiteRestanteAsesor(req.user.id);
      return res.json({ restantes });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async crear(req, res) {
    try {
      const archivos = validarArchivos(req.files);
      const vale = await valeService.crearVale(req.user, req.body, archivos);
      return res.status(201).json(vale);
    } catch (error) {
      return res.status(400).json({ error: error.message });
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
        filtroContador: req.query.filtroContador,
        busqueda: req.query.busqueda
      };
      const data = await valeService.obtenerBuzon(req.user, filtros);
      return res.json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async detalle(req, res) {
    try {
      const data = await valeService.obtenerDetalle(req.user, Number(req.params.id));
      return res.json(data);
    } catch (error) {
      return res.status(404).json({ error: error.message });
    }
  }

  async descargarPdf(req, res) {
    try {
      // Si el vale pedido ya fue modificado, sirve el PDF del vale MOD- vigente en
      // vez del original congelado (analisis_correcciones_5.md #4).
      const vale = await valeService.obtenerValeParaPdf(req.user, Number(req.params.id));
      if (!vale.pdf_url) {
        return res.status(404).json({ error: 'El PDF de este vale aún no ha sido generado.' });
      }
      return res.redirect(`/${vale.pdf_url}`);
    } catch (error) {
      return res.status(404).json({ error: error.message });
    }
  }

  async asignar(req, res) {
    try {
      const vale = await valeService.asignar(req.user, Number(req.params.id), Number(req.body.tecnicoId), req.body.tallerId ? Number(req.body.tallerId) : null);
      return res.json(vale);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async comenzar(req, res) {
    try {
      const vale = await valeService.comenzar(req.user, Number(req.params.id));
      return res.json(vale);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async entregar(req, res) {
    try {
      const propuesta = req.files && req.files.propuesta ? req.files.propuesta[0] : null;
      if (propuesta && propuesta.mimetype !== 'application/pdf') {
        throw new Error('La propuesta debe adjuntarse en formato PDF.');
      }
      const vale = await valeService.entregar(req.user, Number(req.params.id), propuesta);
      return res.json(vale);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async cancelarProceso(req, res) {
    try {
      const vale = await valeService.cancelarProcesoTecnico(req.user, Number(req.params.id));
      return res.json(vale);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async revisar(req, res) {
    try {
      const { aprobar, tecnicoReasignadoId, tallerId } = req.body;
      const vale = await valeService.revisarPropuesta(req.user, Number(req.params.id), {
        aprobar: aprobar === true || aprobar === 'true',
        tecnicoReasignadoId: tecnicoReasignadoId ? Number(tecnicoReasignadoId) : null,
        tallerId: tallerId ? Number(tallerId) : null
      });
      return res.json(vale);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async aprobarGeneral(req, res) {
    try {
      const archivo = req.files && req.files.fusion ? req.files.fusion[0] : null;
      if (archivo && archivo.mimetype !== 'application/pdf') {
        throw new Error('El documento de fusión debe adjuntarse en formato PDF.');
      }
      const vale = await valeService.aprobarGeneral(req.user, Number(req.params.id), archivo);
      return res.json(vale);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async confirmar(req, res) {
    try {
      const vale = await valeService.confirmarRecibido(req.user, Number(req.params.id));
      return res.json(vale);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async solicitarModificacion(req, res) {
    try {
      const vale = await valeService.solicitarModificacion(req.user, Number(req.params.id), req.body);
      return res.json(vale);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async aprobarModificacion(req, res) {
    try {
      const vale = await valeService.aprobarModificacion(req.user, Number(req.params.id));
      return res.json(vale);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async reenviarModificacion(req, res) {
    try {
      const vale = await valeService.reenviarModificacion(req.user, Number(req.params.id), req.body.talleresIds);
      return res.json(vale);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async cargaTrabajo(req, res) {
    try {
      const data = await valeService.obtenerCargaTrabajo(req.user.id);
      return res.json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async cargaTrabajoTecnico(req, res) {
    try {
      const data = await valeService.obtenerAsignacionesDeTecnico(req.user, Number(req.params.tecnicoId));
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async tecnicos(req, res) {
    try {
      const data = await valeService.obtenerTecnicosAsignables(req.user);
      return res.json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ValeController();
