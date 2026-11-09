// src/modules/proyectos/routes.js
// Montado en /api/proyectos detrás de requireAuth y proyectos.ver.
const express = require('express');
const router = express.Router();
const configController = require('./controllers/configController');
const catalogoController = require('./controllers/catalogoController');
const clienteController = require('./controllers/clienteController');
const importacionController = require('./controllers/importacionController');
const campoController = require('./controllers/campoController');
const proyectoController = require('./controllers/proyectoController');
const plantillaController = require('./controllers/plantillaController');
const gestionController = require('./controllers/gestionController');
const { rateLimit } = require('express-rate-limit');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');

const administrar = requirePermission('proyectos.administrar');
const registrar = requirePermission('proyectos.clientes.registrar');
const importar = requirePermission('proyectos.clientes.importar');
const activar = requirePermission('proyectos.activar');
const aprobar = requirePermission('proyectos.aprobar_activacion');
const gestionar = requirePermission('proyectos.gestionar');
// Ver la vista previa de un proyecto: quien lo crea o quien debe aprobarlo.
const creaOAprueba = (req, res, siguiente) => {
  const permisos = (req.user && req.user.permissions) || [];
  return permisos.includes('proyectos.activar') || permisos.includes('proyectos.aprobar_activacion') ? siguiente() : res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
};

// Límite por persona (no por IP): una importación es pesada y se puede repetir por error.
const limitarImportacion = (max, mensaje) => rateLimit({
  windowMs: 10 * 60 * 1000, max, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `proy-importar:${req.user.id}`,
  handler: (req, res) => res.status(429).json({ error: mensaje })
});
const limitarPrevia = limitarImportacion(30, 'Hiciste muchas vistas previas seguidas. Espera unos minutos e inténtalo de nuevo.');
const limitarConfirmar = limitarImportacion(10, 'Hiciste muchas importaciones seguidas. Espera unos minutos e inténtalo de nuevo.');

// Proyectos del mes: crear (borrador), vista previa del reparto, activar y cancelar. La lista y la ficha se limitan a las
// tiendas de cada persona dentro del servicio.
router.get('/proyectos/opciones', activar, proyectoController.opciones);
router.post('/proyectos/candidatos', activar, proyectoController.candidatos);
router.get('/proyectos', proyectoController.listar);
router.post('/proyectos', activar, proyectoController.crear);
router.get('/proyectos/:id', proyectoController.obtener);
router.put('/proyectos/:id', activar, proyectoController.editar);
router.post('/proyectos/:id/vista-previa', creaOAprueba, proyectoController.vistaPrevia);
router.post('/proyectos/:id/activar', activar, proyectoController.activar);
router.post('/proyectos/:id/cancelar', activar, proyectoController.cancelar);
router.post('/proyectos/:id/pedir-aprobacion', activar, proyectoController.pedirAprobacion);
router.post('/proyectos/:id/aprobar', aprobar, proyectoController.aprobar);
router.post('/proyectos/:id/rechazar', aprobar, proyectoController.rechazar);

// Trabajo del asesor: solo sobre SUS empresas (lo ajeno responde 404). Mi proyecto, Para hoy, ficha y registros.
router.get('/mi-proyecto', gestionar, gestionController.miProyecto);
router.get('/mi-proyecto/para-hoy', gestionar, gestionController.paraHoy);
router.get('/mis-proyectos-anteriores', gestionar, gestionController.anteriores);
router.get('/participaciones/opciones', gestionar, gestionController.opciones);
router.get('/participaciones', gestionar, gestionController.listar);
router.get('/participaciones/:id', gestionar, gestionController.ficha);
router.post('/participaciones/:id/gestiones', gestionar, gestionController.gestion);
router.post('/participaciones/:id/cotizaciones', gestionar, gestionController.cotizacion);
router.post('/participaciones/:id/ventas', gestionar, gestionController.venta);
router.post('/participaciones/:id/perdida', gestionar, gestionController.perdida);
router.post('/participaciones/:id/descartar', gestionar, gestionController.descartar);

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
// Plantillas de proyecto (A4 y A4b)
router.get('/config/plantillas', administrar, plantillaController.listar);
router.post('/config/plantillas', administrar, plantillaController.crear);
router.put('/config/plantillas/:id', administrar, plantillaController.editar);
router.patch('/config/plantillas/:id/activa', administrar, plantillaController.cambiarActivo);

// Campos propios de la empresa (A6) y alcance de usuarios por país (A7)
router.get('/config/campos', administrar, campoController.listar);
router.post('/config/campos', administrar, campoController.crear);
router.put('/config/campos/:id', administrar, campoController.editar);
router.patch('/config/campos/:id/activo', administrar, campoController.cambiarActivo);
router.get('/config/alcance', administrar, campoController.listarAlcance);
router.put('/config/alcance/:usuarioId', administrar, campoController.guardarAlcance);

router.get('/catalogos/:catalogo', administrar, (req, res) => catalogoController.listar(req, res));
router.post('/catalogos/:catalogo', administrar, (req, res) => catalogoController.crear(req, res));
router.put('/catalogos/:catalogo/:id', administrar, (req, res) => catalogoController.editar(req, res));
router.patch('/catalogos/:catalogo/:id/activo', administrar, (req, res) => catalogoController.cambiarActivo(req, res));

module.exports = router;
