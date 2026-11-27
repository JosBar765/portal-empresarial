// HTTP de la venta por orden de venta (OV).
const valeVentaService = require('../services/valeVentaService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');

// `codigo` (y el número vigente) acompañan al mensaje cuando la OV cambió o ya se resolvió.
async function responder(req, res, accion) {
  try {
    return res.json(await valeVentaService[accion](req.user, idObligatorio(req.params.id), req.body?.numeroOv));
  } catch (error) {
    return responderError(res, error, 400, error.codigo && error.datos ? { codigo: error.codigo, ...error.datos } : {});
  }
}

module.exports = {
  registrar: (req, res) => responder(req, res, 'registrar'),
  corregir: (req, res) => responder(req, res, 'corregir'),
  borrar: (req, res) => responder(req, res, 'borrar'),
  confirmar: (req, res) => responder(req, res, 'confirmar'),
  rechazar: (req, res) => responder(req, res, 'rechazar')
};
