// src/modules/admin/routes.js
const express = require('express');
const router = express.Router();
const adminController = require('./controllers/adminController');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');

// Permisos
const verAdmin = requirePermission('admin.ver');
const gestionarUsuarios = requirePermission('admin.usuarios.gestionar');
const gestionarRoles = requirePermission('admin.roles.gestionar');
const gestionarTalleres = requirePermission('admin.talleres.gestionar');
const gestionarTiendas = requirePermission('admin.tiendas.gestionar');
const gestionarMantenimiento = requirePermission('admin.mantenimiento.gestionar');

// Usuarios
router.get('/usuarios', verAdmin, (req, res) => adminController.listarUsuarios(req, res));
router.post('/usuarios', gestionarUsuarios, (req, res) => adminController.crearUsuario(req, res));
router.put('/usuarios/:id', gestionarUsuarios, (req, res) => adminController.actualizarUsuario(req, res));
router.patch('/usuarios/:id/activo', gestionarUsuarios, (req, res) => adminController.establecerActivoUsuario(req, res));
router.get('/usuarios/:id/tiendas-supervisadas', verAdmin, (req, res) => adminController.obtenerTiendasSupervisadas(req, res));

// Roles y permisos
router.get('/roles', verAdmin, (req, res) => adminController.listarRoles(req, res));
router.get('/permisos', verAdmin, (req, res) => adminController.listarPermisos(req, res));
router.post('/roles', gestionarRoles, (req, res) => adminController.crearRol(req, res));
router.put('/roles/:id', gestionarRoles, (req, res) => adminController.actualizarRol(req, res));
router.get('/roles/:id/permisos', verAdmin, (req, res) => adminController.obtenerPermisosDeRol(req, res));
router.put('/roles/:id/permisos', gestionarRoles, (req, res) => adminController.actualizarPermisosRol(req, res));
router.patch('/roles/:id/activo', gestionarRoles, (req, res) => adminController.establecerActivoRol(req, res));

// Talleres
router.get('/talleres', verAdmin, (req, res) => adminController.listarTalleres(req, res));
router.post('/talleres', gestionarTalleres, (req, res) => adminController.crearTaller(req, res));
router.patch('/talleres/:id/activo', gestionarTalleres, (req, res) => adminController.establecerActivoTaller(req, res));
router.get('/talleres/:id/personal', verAdmin, (req, res) => adminController.listarPersonalTaller(req, res));
router.post('/talleres/:id/encargado', gestionarTalleres, (req, res) => adminController.asignarEncargadoDeTaller(req, res));
router.delete('/talleres/:id/encargado', gestionarTalleres, (req, res) => adminController.quitarEncargadoDeTaller(req, res));
router.post('/talleres/:id/tecnicos', gestionarTalleres, (req, res) => adminController.asignarTecnicoATaller(req, res));
router.delete('/talleres/:id/tecnicos/:usuarioId', gestionarTalleres, (req, res) => adminController.quitarTecnicoDeTaller(req, res));
router.put('/talleres/:id/limite-diario', gestionarTalleres, (req, res) => adminController.actualizarLimiteDiarioTaller(req, res));

// Tiendas
router.get('/organizacion', verAdmin, (req, res) => adminController.obtenerOrganizacion(req, res));
router.get('/tiendas', verAdmin, (req, res) => adminController.listarTiendas(req, res));
router.post('/tiendas', gestionarTiendas, (req, res) => adminController.crearTienda(req, res));
router.put('/tiendas/:id', gestionarTiendas, (req, res) => adminController.actualizarTienda(req, res));
router.get('/tiendas/:id/personal', verAdmin, (req, res) => adminController.listarPersonalTienda(req, res));
router.post('/tiendas/:id/personal', gestionarTiendas, (req, res) => adminController.agregarPersonalATienda(req, res));
router.delete('/tiendas/:id/personal/:usuarioId', gestionarTiendas, (req, res) => adminController.quitarPersonalDeTienda(req, res));

// Mantenimiento
router.get('/mantenimiento', verAdmin, (req, res) => adminController.obtenerMantenimiento(req, res));
router.put('/mantenimiento', gestionarMantenimiento, (req, res) => adminController.actualizarMantenimiento(req, res));

module.exports = router;
