// src/modules/viaticos/controllers/solicitudController.js
// Solicitudes del propio usuario: la identidad sale siempre de req.user.
const service = require('../services/solicitudService');
const guardado = require('../services/solicitudGuardadoService');
const documentos = require('../services/documentoService');
const { ARCHIVOS } = require('../constantes');
const { manejar } = require('./manejar');

// Multer deja las fotos en req.files[campo]; sin multipart no hay archivos.
const fotosDe = req => (req.files && req.files[ARCHIVOS.CAMPO_DEFECTOS]) || [];

module.exports = {
  catalogos: manejar(req => service.catalogosSolicitud(req.user, req.query)),
  calcular: manejar(req => service.calcular(req.user, req.body)),
  listar: manejar(req => service.listar(req.user, req.query)),
  obtener: manejar(req => service.obtener(req.user, req.params.id)),
  crear: manejar(req => guardado.crear(req.user, req.body, fotosDe(req)), { status: 201 }),
  modificar: manejar(req => guardado.modificar(req.user, req.params.id, req.body, fotosDe(req))),
  darDeBaja: manejar(req => guardado.darDeBaja(req.user, req.params.id)),
  documentos: manejar(req => documentos.listar(req.user, req.params.id))
};
