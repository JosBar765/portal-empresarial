// src/core/permissions/modulesCatalog.js
// Catálogo único de módulos del portal. Lo consumen /api/modules (qué
// tarjetas ve cada usuario en su dashboard) y el gate de /modules/<id> (a
// qué módulos puede entrar): ambos dependen del MISMO permiso "ver", así que
// un módulo que no aparece en el dashboard tampoco se puede abrir a mano.
const MODULOS = [
  {
    id: 'vales',
    nombre: 'Vales de Arte',
    descripcion: 'Gestión, creación y control de vales artísticos y órdenes de diseño.',
    icono: 'color-palette-outline',
    path: '/modules/vales',
    permission: 'vales.ver',
    color: '#3B4C8C'
  },
  {
    id: 'admin',
    nombre: 'Administración Central',
    descripcion: 'Gestión de roles, permisos, usuarios y reportería del portal.',
    icono: 'settings-outline',
    path: '/modules/admin',
    permission: 'admin.ver',
    color: '#52525B'
  }
];

module.exports = { MODULOS };
