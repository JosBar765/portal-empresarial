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
const TIENDAS_ENCARGADO_TALLER = [1, 2];
// analisis_correcciones_19.md #8/#10/#12: roles con asignación de taller.
const ROL_TECNICO = 6;
const ROL_ASISTENTE = 7;
const ROL_ENCARGADO_DISENO_LOCAL = 10;
// Diseño/Diseño UV-3D/Protextil son de toda la empresa — cada uno mapea a
// EXACTAMENTE un taller, así que asignar el rol ya implica cuál taller es
// (sin selector en el frontend); Encargado de taller local sí necesita
// elegir CUÁL de los N "Diseño Local" (uno por tienda).
const TALLER_FIJO_POR_ROL = { 4: 'Diseño', 5: 'Diseño UV/3D', 9: 'Protextil' };
// analisis_correcciones_19.md #10: el Asistente solo puede "clonar" uno de
// estos tres — nunca un Diseño Local (él trabaja para Munditrofeos).
const TALLERES_CLONABLES_ASISTENTE = ['Diseño', 'Diseño UV/3D', 'Protextil'];
// Todos los roles cuya asignación de taller orquesta `_sincronizarAsignacionTaller`.
const ROLES_CON_TALLER = [4, 5, 6, 7, 9, 10];

class AdminService {
  // analisis_correcciones_17.md #12/#13: valida al crear/editar un usuario
  // con rol de encargado único. `excluirId` es el propio usuario en edición
  // (para no chocar consigo mismo) o null al crear. Solo bloquea altas o
  // cambios nuevos — no toca datos ya existentes.
  async _validarEncargadoUnico(rolId, tiendaId, excluirId) {
    if (!ROLES_ENCARGADO_UNICO.includes(Number(rolId))) return;
    if (tiendaId != null && !TIENDAS_ENCARGADO_TALLER.includes(Number(tiendaId))) {
      throw new Error('Los encargados de taller de Diseño, Diseño 3D y Protextil solo pueden asignarse a MTC o MTS.');
    }
    const usuarios = await usuarioAdminRepository.listarConDetalle();
    const ocupante = usuarios.find(u => u.activo && Number(u.rol_id) === Number(rolId) && Number(u.id) !== Number(excluirId));
    if (ocupante) {
      throw new Error(`Ya existe un encargado activo para este rol: ${ocupante.nombre}.`);
    }
  }

  // analisis_correcciones_19.md #8/#10/#12: asigna/desasigna el taller de un
  // Técnico, Encargado de taller local o Asistente, según el rol.
  // Para roles 6 (Técnico) y 10 (Encargado de taller local) devuelve la
  // `tienda_id` final que debe QUEDAR en `usuarios` (siempre un valor
  // concreto, derivado del taller o de la elección MTC/MTS) — el llamador
  // la usa para sobreescribir la fila recién creada/actualizada. Para 4/5/9
  // (taller fijo por rol, sin selector) y 7 (Asistente, sin tienda propia)
  // no toca `usuarios.tienda_id` en absoluto.
  async _sincronizarAsignacionTaller(rolNum, usuarioId, tallerIdSolicitado, tiendaIdPropuesta) {
    const tallerFijoNombre = TALLER_FIJO_POR_ROL[rolNum];
    if (tallerFijoNombre) {
      // Roles 4/5/9: un solo taller posible en todo el sistema. La unicidad
      // ya la garantizó `_validarEncargadoUnico` (candado por rol) antes de
      // llegar aquí — esto solo sincroniza `talleres.encargado_id`, invisible
      // para el admin (sin selector en el frontend).
      const talleres = await tallerAdminRepository.listarTalleres();
      const taller = talleres.find(t => t.nombre === tallerFijoNombre);
      if (taller) await tallerAdminRepository.asignarEncargado(taller.id, usuarioId);
      return { tocaTienda: false };
    }

    if (rolNum === ROL_ENCARGADO_DISENO_LOCAL) {
      await tallerAdminRepository.quitarEncargadoDe(usuarioId);
      if (!tallerIdSolicitado) return { tocaTienda: true, tiendaId: null }; // "Sin taller asignado"
      const taller = await tallerAdminRepository.obtenerPorId(Number(tallerIdSolicitado));
      if (!taller) throw new Error('El taller seleccionado no es válido.');
      if (taller.encargado_id != null && Number(taller.encargado_id) !== Number(usuarioId)) {
        const ocupante = await usuarioAdminRepository.obtenerPorId(taller.encargado_id);
        if (ocupante && ocupante.activo) {
          throw new Error(`Ya existe un encargado activo para ${taller.nombre}: ${ocupante.nombre}. Desasígnalo primero.`);
        }
      }
      await tallerAdminRepository.asignarEncargado(taller.id, usuarioId);
      // analisis_correcciones_19.md #12: la tienda de un Diseño Local es
      // siempre la de su taller — un solo selector (Taller), no dos que se
      // puedan desincronizar.
      return { tocaTienda: true, tiendaId: taller.tienda_id };
    }

    if (rolNum === ROL_TECNICO || rolNum === ROL_ASISTENTE) {
      if (!tallerIdSolicitado) {
        await tallerAdminRepository.quitarTecnico(usuarioId);
        return rolNum === ROL_TECNICO ? { tocaTienda: true, tiendaId: null } : { tocaTienda: false };
      }
      const taller = await tallerAdminRepository.obtenerPorId(Number(tallerIdSolicitado));
      if (!taller) throw new Error('El taller seleccionado no es válido.');
      // analisis_correcciones_19.md #10: el Asistente nunca clona un Diseño Local.
      if (rolNum === ROL_ASISTENTE && !TALLERES_CLONABLES_ASISTENTE.includes(taller.nombre)) {
        throw new Error('El Asistente solo puede clonar Diseño, Diseño UV/3D o Protextil.');
      }
      await tallerAdminRepository.asignarTecnico(usuarioId, taller.id);
      if (rolNum === ROL_ASISTENTE) return { tocaTienda: false }; // el Asistente no tiene selector de tienda propio
      // Diseño Local: la tienda se deriva del taller. Taller compartido
      // (Diseño/UV-3D/Protextil): el técnico SÍ elige MTC o MTS (punto 6),
      // a diferencia del encargado de ese mismo taller.
      if (taller.tienda_id != null) return { tocaTienda: true, tiendaId: taller.tienda_id };
      if (!TIENDAS_ENCARGADO_TALLER.includes(Number(tiendaIdPropuesta))) {
        throw new Error('Un técnico de un taller de Munditrofeos debe indicar si trabaja en MTC o MTS.');
      }
      return { tocaTienda: true, tiendaId: Number(tiendaIdPropuesta) };
    }

    return { tocaTienda: false };
  }

  // Libera la asignación de taller al cambiar de rol A uno que ya no la usa
  // — mismo patrón que ya existe para asesor/supervisor.
  async _liberarAsignacionTaller(rolAnterior, usuarioId) {
    if (TALLER_FIJO_POR_ROL[rolAnterior] || rolAnterior === ROL_ENCARGADO_DISENO_LOCAL) {
      await tallerAdminRepository.quitarEncargadoDe(usuarioId);
    }
    if (rolAnterior === ROL_TECNICO || rolAnterior === ROL_ASISTENTE) {
      await tallerAdminRepository.quitarTecnico(usuarioId);
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

  // analisis_correcciones_18.md #5: Asesor de Ventas y Supervisor de Ventas
  // ya no guardan tienda/teléfono en `usuarios` — viven en sus filas
  // satélite (`asesores`/`supervisores`), que esta clase orquesta según el
  // rol elegido en el formulario. `usuarios.tienda_id`/`telefono` quedan
  // reservados para los roles sin entidad propia (Encargados de taller,
  // Técnico, Asistente, Gerente).
  async crearUsuario(datos) {
    const { nombre, email, password, rolId, tiendaId, tallerId, telefono, tiendasSupervisadas } = datos;
    if (!nombre || !email || !password || !rolId) {
      throw new Error('Nombre, correo, contraseña y rol son obligatorios.');
    }
    const existente = await usuarioAdminRepository.obtenerPorEmail(email);
    if (existente) {
      throw new Error('Ya existe un usuario con ese correo electrónico.');
    }
    await this._validarEncargadoUnico(rolId, tiendaId, null);
    const passwordHash = await bcrypt.hash(password, 10);
    const rolNum = Number(rolId);
    const esSupervisor = rolNum === ROL_SUPERVISOR;
    const esAsesor = rolNum === ROL_ASESOR;
    // analisis_correcciones_18.md #1: el Administrador administra el sistema
    // completo — nunca pertenece a ninguna tienda, tampoco al crearlo.
    const esAdministrador = rolNum === ROL_ADMINISTRADOR;
    const id = await usuarioAdminRepository.crear({
      nombre, email,
      passwordHash,
      rolId: rolNum,
      tiendaId: (esSupervisor || esAsesor || esAdministrador) ? null : (tiendaId || null)
    });
    if (esAsesor) {
      await usuarioAdminRepository.crearAsesor(id, tiendaId || null, telefono || null);
    } else if (esSupervisor) {
      await usuarioAdminRepository.crearSupervisor(id, telefono || null);
      if (Array.isArray(tiendasSupervisadas)) {
        for (const tId of tiendasSupervisadas) {
          await tiendaAdminRepository.agregarSupervisorATienda(id, Number(tId));
        }
      }
    } else if (ROLES_CON_TALLER.includes(rolNum)) {
      // analisis_correcciones_19.md #8/#10/#12: la tienda final de un
      // Técnico/Encargado de taller local puede depender del taller recién
      // asignado — el insert de arriba ya guardó la que vino del formulario,
      // aquí se corrige si corresponde (necesita el id ya creado).
      const resultado = await this._sincronizarAsignacionTaller(rolNum, id, tallerId, tiendaId);
      if (resultado.tocaTienda) {
        await usuarioAdminRepository.actualizar(id, { nombre, email, rolId: rolNum, tiendaId: resultado.tiendaId });
      }
    }
    return usuarioAdminRepository.obtenerPorId(id);
  }

  async actualizarUsuario(id, datos, actorId) {
    const { nombre, email, password, rolId, tiendaId, tallerId, telefono, tiendasSupervisadas } = datos;
    const usuario = await usuarioAdminRepository.obtenerPorId(id);
    if (!usuario) throw new Error('Usuario no encontrado.');
    // analisis_correcciones_17.md #11: el rol Administrador es intocable
    // desde este panel — ni siquiera otro administrador puede modificarlo.
    if (Number(usuario.rol_id) === ROL_ADMINISTRADOR) {
      throw new Error('El usuario Administrador no se puede modificar desde este panel.');
    }
    if (!nombre || !email || !rolId) {
      throw new Error('Nombre, correo y rol son obligatorios.');
    }
    const existente = await usuarioAdminRepository.obtenerPorEmail(email);
    if (existente && existente.id !== Number(id)) {
      throw new Error('Ya existe otro usuario con ese correo electrónico.');
    }
    await this._validarEncargadoUnico(rolId, tiendaId, id);
    // analisis_correcciones_14.md #2: un Administrador no puede cambiar su
    // propia contraseña desde el panel (autoedición bloqueada).
    if (password && Number(id) === Number(actorId) && Number(usuario.rol_id) === ROL_ADMINISTRADOR) {
      throw new Error('No puedes cambiar tu propia contraseña de administrador.');
    }
    const rolAnterior = Number(usuario.rol_id);
    const rolNuevo = Number(rolId);
    const esSupervisor = rolNuevo === ROL_SUPERVISOR;
    const esAsesor = rolNuevo === ROL_ASESOR;
    // El rol cambió y dejó de usar taller: libera la asignación previa PRIMERO
    // — roles 6/7 comparten `taller_tecnicos` (misma PK en usuario_id), así
    // que si esto corriera después de sincronizar el rol nuevo borraría la
    // asignación recién hecha.
    if (rolAnterior !== rolNuevo && ROLES_CON_TALLER.includes(rolAnterior)) {
      await this._liberarAsignacionTaller(rolAnterior, id);
    }
    // analisis_correcciones_19.md #8/#10/#12: para los roles con taller, la
    // tienda final puede depender del taller elegido — se resuelve ANTES de
    // guardar (a diferencia de crearUsuario, aquí el id ya existe).
    let tiendaFinal = (esSupervisor || esAsesor) ? null : (tiendaId || null);
    if (ROLES_CON_TALLER.includes(rolNuevo)) {
      const resultado = await this._sincronizarAsignacionTaller(rolNuevo, id, tallerId, tiendaId);
      if (resultado.tocaTienda) tiendaFinal = resultado.tiendaId;
    }
    await usuarioAdminRepository.actualizar(id, {
      nombre, email,
      rolId: rolNuevo,
      tiendaId: tiendaFinal
    });
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await usuarioAdminRepository.actualizarPassword(id, passwordHash);
    }
    // El rol cambió y dejó de ser Asesor/Supervisor: limpia la fila satélite huérfana.
    if (rolAnterior === ROL_ASESOR && !esAsesor) await usuarioAdminRepository.eliminarAsesor(id);
    if (rolAnterior === ROL_SUPERVISOR && !esSupervisor) await usuarioAdminRepository.eliminarSupervisor(id);

    if (esAsesor) {
      // analisis_correcciones_18.md #5: este modal general NO reasigna la
      // tienda de un asesor (regla de negocio: primero hay que desasignarlo
      // y luego asignarlo desde Gestionar Tiendas → Gestionar personal) —
      // aquí solo se actualiza el teléfono, conservando la tienda que ya
      // tuviera (o sin tienda, si el rol acaba de cambiar A asesor).
      const asesorExistente = await usuarioAdminRepository.obtenerAsesorPorUsuarioId(id);
      if (asesorExistente) {
        await usuarioAdminRepository.actualizarAsesor(id, asesorExistente.tienda_id, telefono || null);
      } else {
        await usuarioAdminRepository.crearAsesor(id, null, telefono || null);
      }
    } else if (esSupervisor) {
      const supervisorExistente = await usuarioAdminRepository.obtenerSupervisorPorUsuarioId(id);
      if (supervisorExistente) {
        await usuarioAdminRepository.actualizarSupervisor(id, telefono || null);
      } else {
        await usuarioAdminRepository.crearSupervisor(id, telefono || null);
      }
      if (Array.isArray(tiendasSupervisadas)) {
        // Reemplaza la cobertura por tienda: quita las que ya no están, agrega las nuevas.
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

  // analisis_correcciones_18.md #1: el Administrador administra el sistema
  // en general, no pertenece a ninguna tienda — nunca es asignable como
  // personal.
  async agregarPersonalATienda(tiendaId, usuarioId) {
    const usuario = await usuarioAdminRepository.obtenerPorId(usuarioId);
    if (!usuario) throw new Error('Usuario no encontrado.');
    if (Number(usuario.rol_id) === ROL_ADMINISTRADOR) {
      throw new Error('El Administrador no pertenece a ninguna tienda.');
    }
    // analisis_correcciones_18.md #5: el encargado de Diseño/Diseño 3D/
    // Protextil pertenece a MTC y MTS por ser dueño de un taller compartido
    // (`encargado_tienda`), no por una asignación de personal directa — no
    // se puede tocar desde aquí.
    if (ROLES_ENCARGADO_UNICO.includes(Number(usuario.rol_id))) {
      throw new Error('Este encargado pertenece a MTC y MTS por ser dueño de un taller compartido — no se asigna desde aquí.');
    }
    if (Number(usuario.rol_id) === ROL_SUPERVISOR) {
      return tiendaAdminRepository.agregarSupervisorATienda(usuarioId, tiendaId);
    }
    if (Number(usuario.rol_id) === ROL_ASESOR) {
      // analisis_correcciones_18.md #5: un asesor trabaja para UNA tienda a
      // la vez — hay que desasignarlo primero para poder reasignarlo.
      const asesor = await usuarioAdminRepository.obtenerAsesorPorUsuarioId(usuarioId);
      if (asesor && asesor.tienda_id != null && Number(asesor.tienda_id) !== Number(tiendaId)) {
        throw new Error('Este asesor ya está asignado a otra tienda. Desasígnalo primero antes de asignarlo a una nueva.');
      }
      return usuarioAdminRepository.actualizarAsesor(usuarioId, tiendaId, asesor ? asesor.telefono : null);
    }
    return tiendaAdminRepository.asignarTiendaAUsuario(usuarioId, tiendaId);
  }

  async quitarPersonalDeTienda(tiendaId, usuarioId) {
    const usuario = await usuarioAdminRepository.obtenerPorId(usuarioId);
    if (!usuario) throw new Error('Usuario no encontrado.');
    if (ROLES_ENCARGADO_UNICO.includes(Number(usuario.rol_id))) {
      throw new Error('Este encargado pertenece a MTC y MTS por ser dueño de un taller compartido — no se puede quitar desde aquí.');
    }
    if (Number(usuario.rol_id) === ROL_SUPERVISOR) {
      return tiendaAdminRepository.quitarSupervisorDeTienda(usuarioId, tiendaId);
    }
    if (Number(usuario.rol_id) === ROL_ASESOR) {
      const asesor = await usuarioAdminRepository.obtenerAsesorPorUsuarioId(usuarioId);
      return usuarioAdminRepository.actualizarAsesor(usuarioId, null, asesor ? asesor.telefono : null);
    }
    return tiendaAdminRepository.quitarTiendaDeUsuario(usuarioId);
  }

  async obtenerOrganizacion() {
    return {
      empresas: await tiendaAdminRepository.listarEmpresas(),
      departamentos: await tiendaAdminRepository.listarDepartamentos(),
      subdivisiones: await tiendaAdminRepository.listarSubdivisiones()
    };
  }

  // analisis_correcciones_19.md #8/#10/#12: catálogo de talleres para poblar
  // el selector "Taller" del modal "Editar usuario" (Técnico, Encargado de
  // taller local y Asistente).
  async listarTalleres() {
    return { talleres: await tallerAdminRepository.listarTalleres() };
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
