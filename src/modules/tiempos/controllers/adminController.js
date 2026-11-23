// src/modules/tiempos/controllers/adminController.js
// HTTP de la administración de la Tabla de tiempos. La identidad sale siempre de req.user, nunca del cuerpo.
const adminService = require('../services/adminService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');

const extra = (error) => (error && error.campos ? { campos: error.campos } : {});
const accion = (estado, trabajo) => async (req, res) => {
  try { res.status(estado).json(await trabajo(req)); } catch (error) { responderError(res, error, 400, extra(error)); }
};
const idDe = (req) => { const id = aEntero(req.params.id); if (!id) throw new ErrorDeNegocio('Esa versión no existe.', 404); return id; };

class AdminController {
  constructor() {
    this.estado = accion(200, () => adminService.estado());
    this.tabla = accion(200, () => adminService.tablaAdmin());
    this.crearProducto = accion(201, (req) => adminService.guardarProducto(null, req.body, req.user));
    this.guardarProducto = accion(200, (req) => adminService.guardarProducto(String(req.params.clave), req.body, req.user));
    this.guardarExtras = accion(200, async (req) => { await adminService.guardarExtras(req.body, req.user); return { guardado: true }; });
    this.guardarAvisos = accion(200, async (req) => { await adminService.guardarAvisosGenerales(req.body, req.user); return { guardado: true }; });
    this.guardarCatalogos = accion(200, async (req) => { await adminService.guardarCatalogos(req.body, req.user); return { guardado: true }; });
    this.cambios = accion(200, async () => ({ cambios: await adminService.cambios() }));
    this.publicar = accion(200, (req) => adminService.publicar(req.body, req.user));
    this.descartar = accion(200, (req) => adminService.descartarBorrador(req.user));
    this.versiones = accion(200, () => adminService.versiones());
    this.cambiosDeVersion = accion(200, (req) => adminService.cambiosDeVersion(idDe(req)));
    this.usarComoBorrador = accion(201, (req) => adminService.usarComoBorrador(idDe(req), req.user));
    this.actividad = accion(200, () => adminService.actividad());
  }
}

module.exports = new AdminController();
