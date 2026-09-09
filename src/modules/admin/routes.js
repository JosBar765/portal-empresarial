// src/modules/admin/routes.js
const express = require('express');
const router = express.Router();
const adminController = require('./controllers/adminController');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');

const soloAdmin = requirePermission('admin.ver');

// Usuarios
router.get('/usuarios', soloAdmin, (req, res) => adminController.listarUsuarios(req, res));
router.post('/usuarios', soloAdmin, (req, res) => adminController.crearUsuario(req, res));
router.put('/usuarios/:id', soloAdmin, (req, res) => adminController.actualizarUsuario(req, res));
router.patch('/usuarios/:id/activo', soloAdmin, (req, res) => adminController.establecerActivoUsuario(req, res));
router.get('/usuarios/:id/tiendas-supervisadas', soloAdmin, (req, res) => adminController.obtenerTiendasSupervisadas(req, res));

// Roles y permisos
router.get('/roles', soloAdmin, (req, res) => adminController.listarRoles(req, res));
router.get('/permisos', soloAdmin, (req, res) => adminController.listarPermisos(req, res));
router.post('/roles', soloAdmin, (req, res) => adminController.crearRol(req, res));
router.put('/roles/:id', soloAdmin, (req, res) => adminController.actualizarRol(req, res));
router.get('/roles/:id/permisos', soloAdmin, (req, res) => adminController.obtenerPermisosDeRol(req, res));
router.put('/roles/:id/permisos', soloAdmin, (req, res) => adminController.actualizarPermisosRol(req, res));
router.patch('/roles/:id/activo', soloAdmin, (req, res) => adminController.establecerActivoRol(req, res));

// Talleres
router.get('/talleres', soloAdmin, (req, res) => adminController.listarTalleres(req, res));
router.get('/talleres/:id/personal', soloAdmin, (req, res) => adminController.listarPersonalTaller(req, res));
router.post('/talleres/:id/encargado', soloAdmin, (req, res) => adminController.asignarEncargadoDeTaller(req, res));
router.delete('/talleres/:id/encargado', soloAdmin, (req, res) => adminController.quitarEncargadoDeTaller(req, res));
router.post('/talleres/:id/tecnicos', soloAdmin, (req, res) => adminController.asignarTecnicoATaller(req, res));
router.delete('/talleres/:id/tecnicos/:usuarioId', soloAdmin, (req, res) => adminController.quitarTecnicoDeTaller(req, res));

// Tiendas
router.get('/organizacion', soloAdmin, (req, res) => adminController.obtenerOrganizacion(req, res));
router.get('/tiendas', soloAdmin, (req, res) => adminController.listarTiendas(req, res));
router.post('/tiendas', soloAdmin, (req, res) => adminController.crearTienda(req, res));
router.put('/tiendas/:id', soloAdmin, (req, res) => adminController.actualizarTienda(req, res));
router.get('/tiendas/:id/personal', soloAdmin, (req, res) => adminController.listarPersonalTienda(req, res));
router.post('/tiendas/:id/personal', soloAdmin, (req, res) => adminController.agregarPersonalATienda(req, res));
router.delete('/tiendas/:id/personal/:usuarioId', soloAdmin, (req, res) => adminController.quitarPersonalDeTienda(req, res));

// Mantenimiento
router.get('/mantenimiento', soloAdmin, (req, res) => adminController.obtenerMantenimiento(req, res));
router.put('/mantenimiento', soloAdmin, (req, res) => adminController.actualizarMantenimiento(req, res));

module.exports = router;
