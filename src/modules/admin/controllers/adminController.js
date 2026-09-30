// src/modules/admin/controllers/adminController.js
const adminService = require('../services/adminService');
const { responderError, responderErrorInterno } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');

class AdminController {
  // ---- Usuarios ----
  async listarUsuarios(req, res) {
    try {
      const data = await adminService.listarUsuarios();
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async crearUsuario(req, res) {
    try {
      const usuario = await adminService.crearUsuario(req.body);
      return res.status(201).json(usuario);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async actualizarUsuario(req, res) {
    try {
      const usuario = await adminService.actualizarUsuario(idObligatorio(req.params.id), req.body, req.user.id);
      return res.json(usuario);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async establecerActivoUsuario(req, res) {
    try {
      await adminService.establecerActivoUsuario(idObligatorio(req.params.id), !!req.body.activo, req.user.id);
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async obtenerTiendasSupervisadas(req, res) {
    try {
      const tiendaIds = await adminService.obtenerTiendasSupervisadas(idObligatorio(req.params.id));
      return res.json(tiendaIds);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  // ---- Roles y Permisos ----
  async listarRoles(req, res) {
    try {
      const data = await adminService.listarRoles();
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async obtenerPermisosDeRol(req, res) {
    try {
      const permisoIds = await adminService.obtenerPermisosDeRol(idObligatorio(req.params.id));
      return res.json(permisoIds);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async listarPermisos(req, res) {
    try {
      const data = await adminService.listarPermisosAgrupados();
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async crearRol(req, res) {
    try {
      const id = await adminService.crearRol(req.body);
      return res.status(201).json({ id });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async actualizarRol(req, res) {
    try {
      await adminService.actualizarRol(idObligatorio(req.params.id), req.body);
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async actualizarPermisosRol(req, res) {
    try {
      await adminService.actualizarPermisosRol(idObligatorio(req.params.id), req.body.permisoIds);
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async establecerActivoRol(req, res) {
    try {
      await adminService.establecerActivoRol(idObligatorio(req.params.id), !!req.body.activo);
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  // ---- Tiendas ----
  async listarTiendas(req, res) {
    try {
      const data = await adminService.listarTiendas();
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async crearTienda(req, res) {
    try {
      const id = await adminService.crearTienda(req.body);
      return res.status(201).json({ id });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async actualizarTienda(req, res) {
    try {
      await adminService.actualizarTienda(idObligatorio(req.params.id), req.body);
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async listarPersonalTienda(req, res) {
    try {
      const personal = await adminService.listarPersonalTienda(idObligatorio(req.params.id));
      return res.json(personal);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async agregarPersonalATienda(req, res) {
    try {
      await adminService.agregarPersonalATienda(idObligatorio(req.params.id), idObligatorio(req.body.usuarioId, 'Usuario'));
      return res.status(201).json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async quitarPersonalDeTienda(req, res) {
    try {
      await adminService.quitarPersonalDeTienda(idObligatorio(req.params.id), idObligatorio(req.params.usuarioId, 'Usuario'));
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async obtenerOrganizacion(req, res) {
    try {
      const data = await adminService.obtenerOrganizacion();
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async listarTalleres(req, res) {
    try {
      const data = await adminService.listarTalleres();
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async crearTaller(req, res) {
    try {
      const taller = await adminService.crearTallerLocal(req.body);
      return res.status(201).json(taller);
    } catch (error) {
      return responderError(res, error);
    }
  }

  async establecerActivoTaller(req, res) {
    try {
      await adminService.establecerActivoTaller(idObligatorio(req.params.id), req.body && req.body.activo);
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async listarPersonalTaller(req, res) {
    try {
      const personal = await adminService.listarPersonalTaller(idObligatorio(req.params.id));
      return res.json(personal);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async asignarEncargadoDeTaller(req, res) {
    try {
      await adminService.asignarEncargadoDeTaller(idObligatorio(req.params.id), idObligatorio(req.body.usuarioId, 'Usuario'));
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async quitarEncargadoDeTaller(req, res) {
    try {
      await adminService.quitarEncargadoDeTaller(idObligatorio(req.params.id));
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async actualizarLimiteDiarioTaller(req, res) {
    try {
      await adminService.actualizarLimiteDiarioTaller(idObligatorio(req.params.id), req.body.limiteDiario);
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async asignarTecnicoATaller(req, res) {
    try {
      await adminService.asignarTecnicoATaller(idObligatorio(req.params.id), idObligatorio(req.body.usuarioId, 'Usuario'));
      return res.status(201).json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async quitarTecnicoDeTaller(req, res) {
    try {
      await adminService.quitarTecnicoDeTaller(idObligatorio(req.params.usuarioId, 'Usuario'));
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  // ---- Mantenimiento ----
  async obtenerMantenimiento(req, res) {
    try {
      const data = await adminService.obtenerMantenimiento();
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async actualizarMantenimiento(req, res) {
    try {
      const data = await adminService.actualizarMantenimiento(req.body, req.user);
      return res.json(data);
    } catch (error) {
      return responderError(res, error);
    }
  }
}

module.exports = new AdminController();
