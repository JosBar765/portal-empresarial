// src/modules/proyectos/routes.js
// Montado en /api/proyectos detrás de requireAuth y proyectos.ver.
const express = require('express');
const router = express.Router();
const configController = require('./controllers/configController');
const catalogoController = require('./controllers/catalogoController');
const clienteController = require('./controllers/clienteController');
const importacionController = require('./controllers/importacionController');
const { rateLimit } = require('express-rate-limit');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');

const administrar = requirePermission('proyectos.administrar');
const registrar = requirePermission('proyectos.clientes.registrar');
const importar = requirePermission('proyectos.clientes.importar');

// Límite por persona (no por IP): una importación es pesada y se puede repetir por error.
const limitarImportacion = (max, mensaje) => rateLimit({
  windowMs: 10 * 60 * 1000, max, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `proy-importar:${req.user.id}`,
  handler: (req, res) => res.status(429).json({ error: mensaje })
});
const limitarPrevia = limitarImportacion(30, 'Hiciste muchas vistas previas seguidas. Espera unos minutos e inténtalo de nuevo.');
const limitarConfirmar = limitarImportacion(10, 'Hiciste muchas importaciones seguidas. Espera unos minutos e inténtalo de nuevo.');

// Empresas de la base global (las lecturas solo exigen proyectos.ver; cada una ve los países de su alcance)
router.get('/clientes/importar/plantilla', importar, (req, res) => importacionController.plantilla(req, res));
router.post('/clientes/importar/previsualizar', importar, limitarPrevia, importacionController.recibirArchivo, importacionController.previsualizar);
router.post('/clientes/importar/confirmar', importar, limitarConfirmar, importacionController.recibirArchivo, importacionController.confirmar);
router.get('/clientes/opciones', clienteController.opciones);
router.get('/clientes', clienteController.listar);
router.post('/clientes/duplicados', registrar, clienteController.duplicados);
router.post('/clientes', registrar, clienteController.crear);
router.put('/clientes/contactos/:contactoId', registrar, clienteController.actualizarContacto);
router.patch('/clientes/contactos/:contactoId/activo', registrar, clienteController.cambiarActivoContacto);
router.get('/clientes/:id', clienteController.obtener);
router.put('/clientes/:id', registrar, clienteController.actualizar);
router.post('/clientes/:id/estado', clienteController.cambiarEstado);
router.post('/clientes/:id/contactos', registrar, clienteController.agregarContacto);

// Centro de configuración: inicio (A0), parámetros (A3), reglas e interruptores (A5), historial (A10) y país
router.get('/config/parametros', administrar, configController.listar('parametros'));
router.put('/config/parametros', administrar, configController.guardar('parametros'));
router.get('/config/reglas', administrar, configController.listar('reglas'));
router.put('/config/reglas', administrar, configController.guardar('reglas'));
router.post('/config/ajustes/:clave/restaurar', administrar, (req, res) => configController.restaurar(req, res));
router.get('/config/resumen', administrar, (req, res) => configController.resumen(req, res));
router.get('/config/historial', administrar, (req, res) => configController.historial(req, res));
router.post('/config/historial/:id/restaurar', administrar, (req, res) => configController.restaurarCambio(req, res));
router.get('/config/paises', administrar, (req, res) => configController.listarPaises(req, res));
router.put('/config/paises/:id', administrar, (req, res) => configController.guardarPais(req, res));

// Catálogos (A1): nichos, artículos, áreas, canales, resultados, motivos, estructuras y monedas
router.get('/catalogos/:catalogo', administrar, (req, res) => catalogoController.listar(req, res));
router.post('/catalogos/:catalogo', administrar, (req, res) => catalogoController.crear(req, res));
router.put('/catalogos/:catalogo/:id', administrar, (req, res) => catalogoController.editar(req, res));
router.patch('/catalogos/:catalogo/:id/activo', administrar, (req, res) => catalogoController.cambiarActivo(req, res));

module.exports = router;
