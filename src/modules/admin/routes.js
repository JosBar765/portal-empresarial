// src/modules/admin/routes.js
const express = require('express');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();
const adminController = require('./controllers/adminController');
const valePdfController = require('./controllers/adminValePdfController');
const horarioController = require('./controllers/adminHorarioController');
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
router.post('/talleres/:id/disenadores', gestionarTalleres, (req, res) => adminController.asignarDisenadorATaller(req, res));
router.delete('/talleres/:id/disenadores/:usuarioId', gestionarTalleres, (req, res) => adminController.quitarDisenadorDeTaller(req, res));
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

// Horario laboral y feriados
const gestionarHorarios = requirePermission('admin.horarios.gestionar');
router.get('/horarios', gestionarHorarios, (req, res) => horarioController.listarHorarios(req, res));
router.put('/horarios', gestionarHorarios, (req, res) => horarioController.guardarHorarios(req, res));
router.get('/horarios/paises', gestionarHorarios, (req, res) => horarioController.listarPaises(req, res));
router.get('/feriados', gestionarHorarios, (req, res) => horarioController.listarFeriados(req, res));
router.post('/feriados', gestionarHorarios, (req, res) => horarioController.crearFeriado(req, res));
router.put('/feriados/:id', gestionarHorarios, (req, res) => horarioController.actualizarFeriado(req, res));
router.delete('/feriados/:id', gestionarHorarios, (req, res) => horarioController.eliminarFeriado(req, res));

// Generar PDF de vale (correcciones). Mismos tipos y límites que al crear un vale.
const generarValePdf = requirePermission('admin.vales.generar');
const TIPOS_ADJUNTO = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']);
const subirAdjuntos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (TIPOS_ADJUNTO.has(file.mimetype)) return cb(null, true);
    const error = new multer.MulterError('TIPO_NO_PERMITIDO', file.fieldname);
    error.archivo = String(file.originalname || '').replace(/[<>"'&]/g, '').slice(0, 80);
    return cb(error);
  }
}).fields([{ name: 'imagenes', maxCount: 10 }, { name: 'documentos', maxCount: 5 }]);

// Solo cuentan las contraseñas incorrectas (403): 5 en 15 min bloquean la acción
// para ese usuario, sin tocar el bloqueo de la cuenta.
const limitarContrasenaVale = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 403,
  keyGenerator: (req) => `vale-pdf:${req.user.id}`,
  handler: (req, res) => {
    res.status(429).json({ error: 'Demasiados intentos de contraseña incorrecta. Espera unos minutos para volver a generar.' });
  }
});

router.get('/vale-pdf/opciones', generarValePdf, (req, res) => valePdfController.opciones(req, res));
router.get('/vale-pdf', generarValePdf, (req, res) => valePdfController.listar(req, res));
router.post('/vale-pdf', generarValePdf, limitarContrasenaVale, subirAdjuntos, (req, res) => valePdfController.generar(req, res));

module.exports = router;
