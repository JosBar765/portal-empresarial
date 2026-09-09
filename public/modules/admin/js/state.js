// Estado global del módulo de administración — un solo objeto mutable
// compartido por todas las vistas (sin accessors: se lee y escribe directo).
export const state = {
  user: null,
  tab: 'usuarios',
  usuarios: [], usuariosResumen: { total: 0, activos: 0, inactivos: 0, rolesEnUso: 0 }, busquedaUsuarios: '',
  filtroTiendaUsuarios: '', filtroRolUsuarios: '',
  roles: [],
  tiendas: [], filtroTiendaTiendas: '',
  // Catálogos livianos (id + nombre) para poblar los <select> de filtro,
  // cargados una vez y reusados por las distintas pestañas.
  catalogoTiendas: [], catalogoRoles: [],
  mantenimiento: null,
  socket: null
};
