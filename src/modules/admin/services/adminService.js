// src/modules/admin/services/adminService.js
const bcrypt = require('bcryptjs');
const usuarioAdminRepository = require('../repositories/usuarioAdminRepository');
const rolRepository = require('../repositories/rolRepository');
const permisoRepository = require('../repositories/permisoRepository');
const tiendaAdminRepository = require('../repositories/tiendaAdminRepository');
const tallerAdminRepository = require('../repositories/tallerAdminRepository');
const mantenimientoRepository = require('../repositories/mantenimientoRepository');
const authService = require('../../../core/auth/authService');
const maintenanceGate = require('../../../core/permissions/maintenanceMiddleware');
const socketManager = require('../../../core/websocket/socketManager');

// Roles base protegidos (analisis_correcciones_13.md #6): no se pueden
// eliminar ni renombrar, pero sus permisos sí se pueden editar.
// analisis_correcciones_14.md #9: Asesor de Ventas (3) deja de ser "base" —
// la protección real contra desactivarlo ya la da "no se puede desactivar un
// rol con usuarios activos", que en la práctica lo sigue cubriendo.
const ROLES_BASE = [1];
// analisis_correcciones_16.md #7: renumeración de roles (Supervisor de
// Ventas pasa de id 4 a id 3) tras eliminar los roles descontinuados.
const ROL_ASESOR = 2;
const ROL_SUPERVISOR = 3;
const ROL_ADMINISTRADOR = 1;
// analisis_correcciones_17.md #12/#13: Diseño, Diseño 3D y Protextil son
// talleres únicos a nivel de toda la empresa (a diferencia de Diseño Local,
// que tiene uno por tienda) — un solo encargado activo a la vez, y solo en
// MTC (1) o MTS (2).
const ROLES_ENCARGADO_UNICO = [4, 5, 9];
const ROL_TECNICO = 6;
const ROL_ASISTENTE = 7;
const ROL_ENCARGADO_DISENO_LOCAL = 10;
// Diseño/Diseño UV-3D/Protextil son de toda la empresa — cada uno mapea a
// exactamente un taller.
const TALLER_FIJO_POR_ROL = { 4: 'Diseño', 5: 'Diseño UV/3D', 9: 'Protextil' };
const TALLERES_CLONABLES_ASISTENTE = ['Diseño', 'Diseño UV/3D', 'Protextil'];

class AdminService {
  async _validarEncargadoUnico(rolId, excluirId) {
    if (!ROLES_ENCARGADO_UNICO.includes(Number(rolId))) return;
    const usuarios = await usuarioAdminRepository.listarConDetalle();
    const ocupante = usuarios.find(u => u.activo && Number(u.rol_id) === Number(rolId) && Number(u.id) !== Number(excluirId));
    if (ocupante) {
      throw new Error(`Ya existe un encargado activo para este rol: ${ocupante.nombre}.`);
    }
  }

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

  // "Gestionar Usuarios" solo crea usuarios y edita su información personal
  // (nombre/correo/contraseña/teléfono) — ninguna asignación de tienda o
  // taller pasa por aquí; esa vive en "Gestionar Tiendas"/"Gestionar
  // Talleres". Como no queda ningún paso fallible después del insert base,
  // no puede quedar un usuario huérfano a medio crear.
  async crearUsuario(datos) {
    const { nombre, email, password, rolId, telefono } = datos;
    if (!nombre || !email || !password || !rolId) {
      throw new Error('Nombre, correo, contraseña y rol son obligatorios.');
    }
    const existente = await usuarioAdminRepository.obtenerPorEmail(email);
    if (existente) {
      throw new Error('Ya existe un usuario con ese correo electrónico.');
    }
    await this._validarEncargadoUnico(rolId, null);
    const passwordHash = await bcrypt.hash(password, 10);
    const rolNum = Number(rolId);
    const esSupervisor = rolNum === ROL_SUPERVISOR;
    const esAsesor = rolNum === ROL_ASESOR;
    const id = await usuarioAdminRepository.crear({ nombre, email, passwordHash, rolId: rolNum });
    if (esAsesor) {
      await usuarioAdminRepository.crearAsesor(id, null, telefono || null);
    } else if (esSupervisor) {
      await usuarioAdminRepository.crearSupervisor(id, telefono || null);
    }
    return usuarioAdminRepository.obtenerPorId(id);
  }

  // El rol nunca cambia al editar — se fija en la creación.
  async actualizarUsuario(id, datos, actorId) {
    const { nombre, email, password, telefono } = datos;
    const usuario = await usuarioAdminRepository.obtenerPorId(id);
    if (!usuario) throw new Error('Usuario no encontrado.');
    if (Number(usuario.rol_id) === ROL_ADMINISTRADOR) {
      throw new Error('El usuario Administrador no se puede modificar desde este panel.');
    }
    if (!nombre || !email) {
      throw new Error('Nombre y correo son obligatorios.');
    }
    const existente = await usuarioAdminRepository.obtenerPorEmail(email);
    if (existente && existente.id !== Number(id)) {
      throw new Error('Ya existe otro usuario con ese correo electrónico.');
    }
    if (password && Number(id) === Number(actorId) && Number(usuario.rol_id) === ROL_ADMINISTRADOR) {
      throw new Error('No puedes cambiar tu propia contraseña de administrador.');
    }
    const rolNum = Number(usuario.rol_id);
    await usuarioAdminRepository.actualizar(id, { nombre, email, rolId: rolNum });
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await usuarioAdminRepository.actualizarPassword(id, passwordHash);
    }
    if (rolNum === ROL_ASESOR) {
      const asesorExistente = await usuarioAdminRepository.obtenerAsesorPorUsuarioId(id);
      await usuarioAdminRepository.actualizarAsesor(id, asesorExistente ? asesorExistente.tienda_id : null, telefono || null);
    } else if (rolNum === ROL_SUPERVISOR) {
      await usuarioAdminRepository.actualizarSupervisor(id, telefono || null);
    }
    return usuarioAdminRepository.obtenerPorId(id);
  }

  async establecerActivoUsuario(id, activo, usuarioActualId) {
    const usuario = await usuarioAdminRepository.obtenerPorId(id);
    // analisis_correcciones_17.md #11: el rol Administrador tampoco se
    // puede desactivar desde este panel.
    if (usuario && Number(usuario.rol_id) === ROL_ADMINISTRADOR) {
      throw new Error('El usuario Administrador no se puede desactivar.');
    }
    if (Number(id) === Number(usuarioActualId) && !activo) {
      throw new Error('No puedes desactivar tu propia cuenta.');
    }
    return usuarioAdminRepository.establecerActivo(id, activo);
  }

  async obtenerTiendasSupervisadas(usuarioId) {
    return tiendaAdminRepository.listarTiendaIdsCubiertasDirectamente(usuarioId);
  }

  // ---------------------------------------------------------------------
  // Roles y Permisos
  // ---------------------------------------------------------------------
  async listarRoles() {
    const roles = await rolRepository.listarConConteo();
    return {
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
    const resultado = await rolRepository.establecerPermisos(id, permisoIds);
    // analisis_correcciones_17.md #2: avisa a los usuarios de ese rol
    // conectados ahora mismo para que renueven su JWT sin cerrar sesión.
    socketManager.sendToRooms([`role_${id}`], 'permisos_actualizados', {});
    return resultado;
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
  // Gestionar Tiendas
  // ---------------------------------------------------------------------
  async listarTiendas() {
    const tiendas = await tiendaAdminRepository.listarConDetalle();
    return { tiendas };
  }

  // analisis_correcciones_18.md #3/#5: la tienda ya no tiene "nombre" propio
  // (se deriva de la empresa) ni "país" propio (viene de `empresas.pais_id`)
  // — el formulario elige Empresa + Departamento + Subdivisión. La
  // subdivisión puede ser una existente (`subdivisionId`) o una nueva a
  // crear al vuelo (`subdivisionNombre` + `paisId`, ya que un departamento
  // puede agrupar subdivisiones de varios países).
  // analisis_correcciones_19.md #9: un departamento nuevo creado desde aquí
  // es siempre de UN solo país (pais_id fijo) — el caso multi-país ("Ventas
  // Centroamérica") sigue siendo exclusivo del seed.
  async _resolverDepartamento({ departamentoId, departamentoNombre, paisId }) {
    if (departamentoId) return Number(departamentoId);
    if (departamentoNombre) {
      if (!paisId) throw new Error('El país es obligatorio para crear un departamento nuevo.');
      return tiendaAdminRepository.crearDepartamento(departamentoNombre, Number(paisId));
    }
    throw new Error('Debe seleccionar o crear un departamento.');
  }

  async _resolverSubdivision({ departamentoId, subdivisionId, subdivisionNombre, paisId }) {
    if (subdivisionId) return Number(subdivisionId);
    if (subdivisionNombre) {
      if (!paisId) throw new Error('El país es obligatorio para crear una subdivisión nueva.');
      return tiendaAdminRepository.crearSubdivision(Number(departamentoId), subdivisionNombre, Number(paisId));
    }
    return null;
  }

  async crearTienda({ codigo, empresaId, departamentoId, departamentoNombre, subdivisionId, subdivisionNombre, paisId }) {
    if (!codigo || !empresaId) {
      throw new Error('Código y empresa son obligatorios.');
    }
    const existente = await tiendaAdminRepository.obtenerPorCodigo(codigo);
    if (existente) throw new Error('Ya existe una tienda con ese código.');
    const depId = await this._resolverDepartamento({ departamentoId, departamentoNombre, paisId });
    const subId = await this._resolverSubdivision({ departamentoId: depId, subdivisionId, subdivisionNombre, paisId });
    return tiendaAdminRepository.crear({ codigo, empresaId: Number(empresaId), departamentoId: depId, subdivisionId: subId });
  }

  async actualizarTienda(id, { codigo, empresaId, departamentoId, departamentoNombre, subdivisionId, subdivisionNombre, paisId, activo }) {
    if (!codigo || !empresaId) {
      throw new Error('Código y empresa son obligatorios.');
    }
    const existente = await tiendaAdminRepository.obtenerPorCodigo(codigo);
    if (existente && existente.id !== Number(id)) {
      throw new Error('Ya existe otra tienda con ese código.');
    }
    const depId = await this._resolverDepartamento({ departamentoId, departamentoNombre, paisId });
    const subId = await this._resolverSubdivision({ departamentoId: depId, subdivisionId, subdivisionNombre, paisId });
    return tiendaAdminRepository.actualizar(id, { codigo, empresaId: Number(empresaId), departamentoId: depId, subdivisionId: subId, activo });
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
    if (Number(usuario.rol_id) === ROL_ASESOR) {
      const asesor = await usuarioAdminRepository.obtenerAsesorPorUsuarioId(usuarioId);
      if (asesor && asesor.tienda_id != null && Number(asesor.tienda_id) !== Number(tiendaId)) {
        throw new Error('Este asesor ya está asignado a otra tienda. Desasígnalo primero antes de asignarlo a una nueva.');
      }
      return usuarioAdminRepository.actualizarAsesor(usuarioId, tiendaId, asesor ? asesor.telefono : null);
    }
    throw new Error('Este rol no se asigna a una tienda desde aquí — su ubicación depende de su taller (ver Gestionar Talleres).');
  }

  async quitarPersonalDeTienda(tiendaId, usuarioId) {
    const usuario = await usuarioAdminRepository.obtenerPorId(usuarioId);
    if (!usuario) throw new Error('Usuario no encontrado.');
    if (Number(usuario.rol_id) === ROL_SUPERVISOR) {
      return tiendaAdminRepository.quitarSupervisorDeTienda(usuarioId, tiendaId);
    }
    if (Number(usuario.rol_id) === ROL_ASESOR) {
      const asesor = await usuarioAdminRepository.obtenerAsesorPorUsuarioId(usuarioId);
      return usuarioAdminRepository.actualizarAsesor(usuarioId, null, asesor ? asesor.telefono : null);
    }
    throw new Error('Este rol no se asigna a una tienda desde aquí — su ubicación depende de su taller (ver Gestionar Talleres).');
  }

  async obtenerOrganizacion() {
    return {
      empresas: await tiendaAdminRepository.listarEmpresas(),
      departamentos: await tiendaAdminRepository.listarDepartamentos(),
      subdivisiones: await tiendaAdminRepository.listarSubdivisiones(),
      paises: await tiendaAdminRepository.listarPaises()
    };
  }

  // analisis_correcciones_19.md #8/#10/#12: catálogo de talleres para poblar
  // el selector "Taller" del modal "Editar usuario" (Técnico, Encargado de
  // taller local y Asistente).
  async listarTalleres() {
    return { talleres: await tallerAdminRepository.listarConDetalle() };
  }

  async listarPersonalTaller(tallerId) {
    return tallerAdminRepository.listarPersonalDetalle(tallerId);
  }

  // Diseño/UV-3D/Protextil solo aceptan su rol fijo; cualquier otro taller
  // (un "Diseño Local - X") solo acepta rol 10.
  _rolEsperadoDeTaller(taller) {
    const fijo = Object.entries(TALLER_FIJO_POR_ROL).find(([, nombre]) => nombre === taller.nombre);
    return fijo ? Number(fijo[0]) : ROL_ENCARGADO_DISENO_LOCAL;
  }

  async asignarEncargadoDeTaller(tallerId, usuarioId) {
    const taller = await tallerAdminRepository.obtenerPorId(tallerId);
    if (!taller) throw new Error('Taller no encontrado.');
    const usuario = await usuarioAdminRepository.obtenerPorId(usuarioId);
    if (!usuario) throw new Error('Usuario no encontrado.');
    if (Number(usuario.rol_id) !== this._rolEsperadoDeTaller(taller)) {
      throw new Error('Este usuario no tiene el rol correcto para ser encargado de este taller.');
    }
    if (taller.encargado_id != null && Number(taller.encargado_id) !== Number(usuarioId)) {
      const ocupante = await usuarioAdminRepository.obtenerPorId(taller.encargado_id);
      if (ocupante && ocupante.activo) {
        throw new Error(`Ya existe un encargado activo para ${taller.nombre}: ${ocupante.nombre}. Desasígnalo primero.`);
      }
    }
    return tallerAdminRepository.asignarEncargado(tallerId, usuarioId);
  }

  async quitarEncargadoDeTaller(tallerId) {
    return tallerAdminRepository.asignarEncargado(tallerId, null);
  }

  async asignarTecnicoATaller(tallerId, usuarioId) {
    const taller = await tallerAdminRepository.obtenerPorId(tallerId);
    if (!taller) throw new Error('Taller no encontrado.');
    const usuario = await usuarioAdminRepository.obtenerPorId(usuarioId);
    if (!usuario) throw new Error('Usuario no encontrado.');
    const rolNum = Number(usuario.rol_id);
    if (rolNum !== ROL_TECNICO && rolNum !== ROL_ASISTENTE) {
      throw new Error('Solo un Técnico o el Asistente pueden agregarse como personal de un taller.');
    }
    if (rolNum === ROL_ASISTENTE && !TALLERES_CLONABLES_ASISTENTE.includes(taller.nombre)) {
      throw new Error('El Asistente solo puede clonar Diseño, Diseño UV/3D o Protextil.');
    }
    return tallerAdminRepository.asignarTecnico(usuarioId, tallerId);
  }

  async quitarTecnicoDeTaller(usuarioId) {
    return tallerAdminRepository.quitarTecnico(usuarioId);
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
