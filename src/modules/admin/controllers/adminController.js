// src/modules/admin/controllers/adminController.js
const adminService = require('../services/adminService');
const { responderErrorInterno } = require('../../../core/utils/erroresHttp');

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
      return res.status(400).json({ error: error.message });
    }
  }

  async actualizarUsuario(req, res) {
    try {
      const usuario = await adminService.actualizarUsuario(Number(req.params.id), req.body, req.user.id);
      return res.json(usuario);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async establecerActivoUsuario(req, res) {
    try {
      await adminService.establecerActivoUsuario(Number(req.params.id), !!req.body.activo, req.user.id);
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async obtenerTiendasSupervisadas(req, res) {
    try {
      const tiendaIds = await adminService.obtenerTiendasSupervisadas(Number(req.params.id));
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
      const permisoIds = await adminService.obtenerPermisosDeRol(Number(req.params.id));
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
      return res.status(400).json({ error: error.message });
    }
  }

  async actualizarRol(req, res) {
    try {
      await adminService.actualizarRol(Number(req.params.id), req.body);
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async actualizarPermisosRol(req, res) {
    try {
      await adminService.actualizarPermisosRol(Number(req.params.id), req.body.permisoIds);
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async establecerActivoRol(req, res) {
    try {
      await adminService.establecerActivoRol(Number(req.params.id), !!req.body.activo);
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
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
      return res.status(400).json({ error: error.message });
    }
  }

  async actualizarTienda(req, res) {
    try {
      await adminService.actualizarTienda(Number(req.params.id), req.body);
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async listarPersonalTienda(req, res) {
    try {
      const personal = await adminService.listarPersonalTienda(Number(req.params.id));
      return res.json(personal);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async agregarPersonalATienda(req, res) {
    try {
      await adminService.agregarPersonalATienda(Number(req.params.id), Number(req.body.usuarioId));
      return res.status(201).json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async quitarPersonalDeTienda(req, res) {
    try {
      await adminService.quitarPersonalDeTienda(Number(req.params.id), Number(req.params.usuarioId));
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
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

  async listarPersonalTaller(req, res) {
    try {
      const personal = await adminService.listarPersonalTaller(Number(req.params.id));
      return res.json(personal);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async asignarEncargadoDeTaller(req, res) {
    try {
      await adminService.asignarEncargadoDeTaller(Number(req.params.id), Number(req.body.usuarioId));
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async quitarEncargadoDeTaller(req, res) {
    try {
      await adminService.quitarEncargadoDeTaller(Number(req.params.id));
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async asignarTecnicoATaller(req, res) {
    try {
      await adminService.asignarTecnicoATaller(Number(req.params.id), Number(req.body.usuarioId));
      return res.status(201).json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async quitarTecnicoDeTaller(req, res) {
    try {
      await adminService.quitarTecnicoDeTaller(Number(req.params.usuarioId));
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
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
      return res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new AdminController();
