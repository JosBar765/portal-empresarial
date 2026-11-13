// src/modules/incidencias/services/rolesConfigService.js
// «Roles y permisos» dentro del módulo: qué rol puede reportar, atender, verificar, asignar, consultar todo o configurar.
// Escribe en `rol_permisos` con el mismo servicio de Administración (así valen las mismas reglas de herencia entre roles y los
// usuarios conectados renuevan su sesión solos); solo toca los permisos `incidencias.*` y deja intactos los de otros módulos.
const configRepository = require('../repositories/configRepository');
const adminService = require('../../admin/services/adminService');
const { errorDeValidacion, conflicto } = require('../errores');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { PERMISO } = require('../constantes');

class RolesConfigService {
  async listar() {
    const [permisos, roles, asignados] = await Promise.all([configRepository.permisosDelModulo(), configRepository.rolesActivos(), configRepository.permisosPorRol()]);
    return {
      permisos: permisos.map(p => ({ codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion })),
      roles: roles.map(r => ({
        id: r.id, nombre: r.nombre, descripcion: r.descripcion, heredaDeRolId: r.hereda_de_rol_id, usuarios: Number(r.usuarios),
        permisos: asignados.filter(a => a.rol_id === r.id).map(a => a.codigo)
      }))
    };
  }

  // `permisos`: los códigos `incidencias.*` que debe tener el rol.
  async actualizar(usuario, rolId, datos) {
    const rol = await configRepository.rol(rolId);
    if (!rol) throw new ErrorDeNegocio('Ese rol no existe o está desactivado.', 404);
    if (!Array.isArray(datos.permisos)) throw errorDeValidacion('Revisa los datos marcados.', { permisos: 'Indica los permisos del rol.' });
    const catalogo = await configRepository.permisosDelModulo();
    const validos = new Set(catalogo.map(p => p.codigo));
    const pedidos = [...new Set(datos.permisos.map(String))];
    const invalido = pedidos.find(c => !validos.has(c));
    if (invalido) throw errorDeValidacion('Revisa los datos marcados.', { permisos: 'Uno de los permisos no existe.' });
    // Sin «Ver Incidencias» nadie entra al módulo: se agrega solo.
    const agregados = [];
    if (pedidos.length && !pedidos.includes(PERMISO.VER)) { pedidos.push(PERMISO.VER); agregados.push(PERMISO.VER); }

    // Al menos un rol debe poder configurar: si no, nadie podría volver a cambiar nada desde aquí.
    const actuales = (await configRepository.permisosPorRol()).filter(a => a.rol_id === rolId).map(a => a.codigo);
    if (actuales.includes(PERMISO.CONFIGURAR) && !pedidos.includes(PERMISO.CONFIGURAR) && await configRepository.rolesConPermiso(PERMISO.CONFIGURAR, rolId) === 0) {
      throw conflicto('Al menos un rol debe poder configurar Incidencias. Dale ese permiso a otro rol antes de quitárselo a este.');
    }

    // Los permisos de otros módulos del rol se conservan tal cual.
    const filas = await configRepository.permisoIdsDeRol(rolId);
    const ajenos = filas.filter(f => f.modulo !== 'incidencias').map(f => f.permiso_id);
    const idsNuevos = catalogo.filter(p => pedidos.includes(p.codigo)).map(p => p.id);
    await adminService.actualizarPermisosRol(rolId, [...ajenos, ...idsNuevos].map(aEntero));

    try {
      await configRepository.registrarHistorial({ usuarioId: usuario.id, entidad: 'rol', clave: rol.nombre, accion: 'cambiar', antes: actuales, despues: pedidos });
    } catch (error) { console.error('[Incidencias] No se pudo anotar el cambio de configuración:', error.message); }
    return { ...(await this.listar()), agregados, aviso: 'Quienes tienen este rol y están conectados ven el cambio al momento; los demás, al volver a entrar.' };
  }
}

module.exports = new RolesConfigService();
