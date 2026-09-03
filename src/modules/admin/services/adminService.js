// src/modules/admin/services/adminService.js
const bcrypt = require('bcryptjs');
const usuarioAdminRepository = require('../repositories/usuarioAdminRepository');
const rolRepository = require('../repositories/rolRepository');
const permisoRepository = require('../repositories/permisoRepository');
const tiendaAdminRepository = require('../repositories/tiendaAdminRepository');
const actividadRepository = require('../repositories/actividadRepository');
const mantenimientoRepository = require('../repositories/mantenimientoRepository');
const authService = require('../../../core/auth/authService');
const maintenanceGate = require('../../../core/permissions/maintenanceMiddleware');

// Roles base protegidos (analisis_correcciones_13.md #6): no se pueden
// eliminar ni renombrar, pero sus permisos sí se pueden editar.
// analisis_correcciones_14.md #9: Asesor de Ventas (3) deja de ser "base" —
// la protección real contra desactivarlo ya la da "no se puede desactivar un
// rol con usuarios activos", que en la práctica lo sigue cubriendo.
const ROLES_BASE = [1];
// analisis_correcciones_16.md #7: renumeración de roles (Supervisor de
// Ventas pasa de id 4 a id 3) tras eliminar los roles descontinuados.
const ROL_SUPERVISOR = 3;
const ROL_ADMINISTRADOR = 1;

function minutosDesde(fecha) {
  if (!fecha) return Infinity;
  return (Date.now() - new Date(fecha.replace(' ', 'T')).getTime()) / 60000;
}

function estadoPresencia(usuario) {
  if (!usuario.sesion_iniciada_en) return 'SIN_DATOS';
  const minutos = minutosDesde(usuario.ultima_actividad_en);
  if (minutos < 5) return 'EN_LINEA';
  if (minutos < 8 * 60) return 'INACTIVO';
  return 'SIN_DATOS';
}

class AdminService {
  // ---------------------------------------------------------------------
  // Gestionar Usuarios
  // ---------------------------------------------------------------------
  async listarUsuarios() {
    const usuarios = await usuarioAdminRepository.listarConDetalle();
    return {
      resumen: {
        total: usuarios.length,
        activos: usuarios.filter(u => u.activo).length,
        inactivos: usuarios.filter(u => !u.activo).length,
        rolesEnUso: new Set(usuarios.map(u => u.rol_id)).size
      },
      usuarios
    };
  }

  async crearUsuario(datos) {
    const { nombre, email, password, rolId, tiendaId, telefono, tiendasSupervisadas } = datos;
    if (!nombre || !email || !password || !rolId) {
      throw new Error('Nombre, correo, contraseña y rol son obligatorios.');
    }
    const existente = await usuarioAdminRepository.obtenerPorEmail(email);
    if (existente) {
      throw new Error('Ya existe un usuario con ese correo electrónico.');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const esSupervisor = Number(rolId) === ROL_SUPERVISOR;
    const id = await usuarioAdminRepository.crear({
      nombre, email, telefono,
      passwordHash,
      rolId: Number(rolId),
      tiendaId: esSupervisor ? null : (tiendaId || null)
    });
    if (esSupervisor && Array.isArray(tiendasSupervisadas)) {
      for (const tId of tiendasSupervisadas) {
        await tiendaAdminRepository.agregarSupervisorATienda(id, Number(tId));
      }
    }
    return usuarioAdminRepository.obtenerPorId(id);
  }

  async actualizarUsuario(id, datos, actorId) {
    const { nombre, email, password, rolId, tiendaId, telefono, tiendasSupervisadas } = datos;
    const usuario = await usuarioAdminRepository.obtenerPorId(id);
    if (!usuario) throw new Error('Usuario no encontrado.');
    if (!nombre || !email || !rolId) {
      throw new Error('Nombre, correo y rol son obligatorios.');
    }
    const existente = await usuarioAdminRepository.obtenerPorEmail(email);
    if (existente && existente.id !== Number(id)) {
      throw new Error('Ya existe otro usuario con ese correo electrónico.');
    }
    // analisis_correcciones_14.md #2: un Administrador no puede cambiar su
    // propia contraseña desde el panel (autoedición bloqueada).
    if (password && Number(id) === Number(actorId) && Number(usuario.rol_id) === ROL_ADMINISTRADOR) {
      throw new Error('No puedes cambiar tu propia contraseña de administrador.');
    }
    const esSupervisor = Number(rolId) === ROL_SUPERVISOR;
    await usuarioAdminRepository.actualizar(id, {
      nombre, email, telefono,
      rolId: Number(rolId),
      tiendaId: esSupervisor ? null : (tiendaId || null)
    });
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await usuarioAdminRepository.actualizarPassword(id, passwordHash);
    }
    if (esSupervisor && Array.isArray(tiendasSupervisadas)) {
      // Reemplaza la cobertura puntual por tienda: quita las que ya no están, agrega las nuevas.
      // La cobertura heredada por departamento/subdivisión no se toca aquí.
      const cubiertasAntes = await tiendaAdminRepository.listarTiendaIdsCubiertasDirectamente(id);
      const nuevas = tiendasSupervisadas.map(Number);
      for (const tId of cubiertasAntes) {
        if (!nuevas.includes(tId)) {
          await tiendaAdminRepository.quitarSupervisorDeTienda(id, tId);
        }
      }
      for (const tId of nuevas) {
        await tiendaAdminRepository.agregarSupervisorATienda(id, tId);
      }
    }
    return usuarioAdminRepository.obtenerPorId(id);
  }

  async establecerActivoUsuario(id, activo, usuarioActualId) {
    if (Number(id) === Number(usuarioActualId) && !activo) {
      throw new Error('No puedes desactivar tu propia cuenta.');
    }
    return usuarioAdminRepository.establecerActivo(id, activo);
  }

  async obtenerCoberturaHeredada(usuarioId) {
    return tiendaAdminRepository.listarCoberturaHeredada(usuarioId);
  }

  async obtenerTiendasSupervisadas(usuarioId) {
    return tiendaAdminRepository.listarTiendaIdsCubiertasDirectamente(usuarioId);
  }

  // ---------------------------------------------------------------------
  // Roles y Permisos
  // ---------------------------------------------------------------------
  async listarRoles() {
    const roles = await rolRepository.listarConConteo();
    const permisos = await permisoRepository.listarTodos();
    return {
      resumen: { rolesConfigurados: roles.length, permisosDisponibles: permisos.length },
      roles: roles.map(r => ({ ...r, base: ROLES_BASE.includes(r.id) }))
    };
  }

  async obtenerPermisosDeRol(rolId) {
    return rolRepository.listarPermisoIds(rolId);
  }

  async listarPermisosAgrupados() {
    const permisos = await permisoRepository.listarTodos();
    const grupos = {};
    permisos.forEach(p => {
      if (!grupos[p.modulo]) grupos[p.modulo] = [];
      grupos[p.modulo].push(p);
    });
    return grupos;
  }

  async crearRol({ nombre, descripcion, permisoIds }) {
    if (!nombre) throw new Error('El nombre del rol es obligatorio.');
    const id = await rolRepository.crear({ nombre, descripcion });
    if (Array.isArray(permisoIds) && permisoIds.length) {
      await rolRepository.establecerPermisos(id, permisoIds);
    }
    return id;
  }

  async actualizarRol(id, { nombre, descripcion }) {
    if (ROLES_BASE.includes(Number(id))) {
      throw new Error('No se puede renombrar un rol base del sistema.');
    }
    if (!nombre) throw new Error('El nombre del rol es obligatorio.');
    return rolRepository.actualizar(id, { nombre, descripcion });
  }

  async actualizarPermisosRol(id, permisoIds) {
    if (!Array.isArray(permisoIds)) throw new Error('La lista de permisos debe ser un arreglo.');
    return rolRepository.establecerPermisos(id, permisoIds);
  }

  async establecerActivoRol(id, activo) {
    if (!activo) {
      if (ROLES_BASE.includes(Number(id))) {
        throw new Error('No se puede desactivar un rol base del sistema.');
      }
      const totalUsuarios = await rolRepository.contarUsuarios(id);
      if (totalUsuarios > 0) {
        throw new Error(`No se puede desactivar: hay ${totalUsuarios} usuario(s) con este rol. Reasígnalos primero.`);
      }
    }
    return rolRepository.establecerActivo(id, activo);
  }

  // ---------------------------------------------------------------------
  // Actividad de Usuarios
  // ---------------------------------------------------------------------
  async listarActividad() {
    const filas = await actividadRepository.listar();
    const enriquecidas = filas.map(u => ({ ...u, estado: estadoPresencia(u) }));
    return {
      resumen: {
        enLinea: enriquecidas.filter(u => u.estado === 'EN_LINEA').length,
        inactivos: enriquecidas.filter(u => u.estado === 'INACTIVO').length,
        totalActivos: enriquecidas.length
      },
      actividad: enriquecidas
    };
  }

  // ---------------------------------------------------------------------
  // Gestionar Tiendas
  // ---------------------------------------------------------------------
  async listarTiendas() {
    const tiendas = await tiendaAdminRepository.listarConDetalle();
    return {
      resumen: {
        activas: tiendas.filter(t => t.activo).length,
        inactivas: tiendas.filter(t => !t.activo).length
      },
      tiendas
    };
  }

  async crearTienda({ codigo, nombre, paisId, departamentoId, subdivisionId }) {
    if (!codigo || !nombre || !departamentoId) {
      throw new Error('Código, nombre y departamento son obligatorios.');
    }
    const existente = await tiendaAdminRepository.obtenerPorCodigo(codigo);
    if (existente) throw new Error('Ya existe una tienda con ese código.');
    return tiendaAdminRepository.crear({ codigo, nombre, paisId, departamentoId, subdivisionId });
  }

  async actualizarTienda(id, { codigo, nombre, paisId, departamentoId, subdivisionId, activo }) {
    if (!codigo || !nombre || !departamentoId) {
      throw new Error('Código, nombre y departamento son obligatorios.');
    }
    const existente = await tiendaAdminRepository.obtenerPorCodigo(codigo);
    if (existente && existente.id !== Number(id)) {
      throw new Error('Ya existe otra tienda con ese código.');
    }
    return tiendaAdminRepository.actualizar(id, { codigo, nombre, paisId, departamentoId, subdivisionId, activo });
  }

  async actualizarOrdenTiendas(ordenes) {
    if (!Array.isArray(ordenes)) throw new Error('El nuevo orden debe ser un arreglo.');
    return tiendaAdminRepository.actualizarOrden(ordenes);
  }

  async listarPersonalTienda(tiendaId) {
    return tiendaAdminRepository.listarPersonalDetalle(tiendaId);
  }

  async agregarPersonalATienda(tiendaId, usuarioId) {
    const usuario = await usuarioAdminRepository.obtenerPorId(usuarioId);
    if (!usuario) throw new Error('Usuario no encontrado.');
    if (Number(usuario.rol_id) === ROL_SUPERVISOR) {
      return tiendaAdminRepository.agregarSupervisorATienda(usuarioId, tiendaId);
    }
    return tiendaAdminRepository.asignarTiendaAUsuario(usuarioId, tiendaId);
  }

  async quitarPersonalDeTienda(tiendaId, usuarioId) {
    const usuario = await usuarioAdminRepository.obtenerPorId(usuarioId);
    if (!usuario) throw new Error('Usuario no encontrado.');
    if (Number(usuario.rol_id) === ROL_SUPERVISOR) {
      return tiendaAdminRepository.quitarSupervisorDeTienda(usuarioId, tiendaId);
    }
    return tiendaAdminRepository.quitarTiendaDeUsuario(usuarioId);
  }

  async obtenerOrganizacion() {
    return {
      departamentos: await tiendaAdminRepository.listarDepartamentos(),
      subdivisiones: await tiendaAdminRepository.listarSubdivisiones()
    };
  }

  // ---------------------------------------------------------------------
  // Modo Mantenimiento
  // ---------------------------------------------------------------------
  async obtenerMantenimiento() {
    return mantenimientoRepository.obtener();
  }

  async actualizarMantenimiento({ activo, mensaje, password }, usuario) {
    if (activo) {
      if (!password) throw new Error('Debes ingresar tu contraseña para activar el Modo Mantenimiento.');
      try {
        await authService.authenticate(usuario.email, password);
      } catch {
        throw new Error('Contraseña incorrecta.');
      }
    }
    await mantenimientoRepository.actualizar({ activo, mensaje, activadoPor: usuario.id });
    await maintenanceGate.refrescar();
    return mantenimientoRepository.obtener();
  }
}

module.exports = new AdminService();
