// src/modules/incidencias/routes.js
// Montado en /api/incidencias detrás de requireAuth e incidencias.ver. Cada ruta pide además su permiso; el servicio vuelve a
// comprobar la relación de la persona con la incidencia (si es suya, de su tienda o de su buzón).
const express = require('express');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();
const incidenciaController = require('./controllers/incidenciaController');
const configRoutes = require('./configRoutes');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');
const { PERMISO } = require('./constantes');

const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  // Un tipo no permitido se rechaza con error (nunca se descarta en silencio); el tipo REAL se vuelve a revisar en fotoService.
  fileFilter: (req, file, cb) => {
    if (TIPOS_PERMITIDOS.has(file.mimetype)) return cb(null, true);
    const error = new multer.MulterError('TIPO_NO_PERMITIDO', file.fieldname);
    error.archivo = String(file.originalname || '').replace(/[<>"'&]/g, '').slice(0, 80);
    return cb(error);
  }
});
const conFotos = upload.array('fotos', 10);

// Por persona (no por IP): subir fotos es lo más pesado y se repite sin querer con una señal mala.
const limitarSubidas = rateLimit({
  windowMs: 10 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `incidencias-subidas:${req.user.id}`,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Hiciste muchas acciones seguidas. Espera unos minutos e inténtalo de nuevo.' }
});

const reportar = requirePermission(PERMISO.REPORTAR);
const resolver = requirePermission(PERMISO.RESOLVER);
const verificar = requirePermission(PERMISO.VERIFICAR);
const asignar = requirePermission(PERMISO.ASIGNAR);

// Lo que necesita el formulario y los avisos de reportes parecidos.
router.get('/formulario', reportar, incidenciaController.formulario);
router.get('/similares', reportar, incidenciaController.similares);

// La configuración va antes de «/:id» para que no se confunda con un identificador.
router.use('/configuracion', configRoutes);

router.get('/resumen', incidenciaController.resumen);
router.get('/', incidenciaController.listar);
router.post('/', reportar, limitarSubidas, conFotos, incidenciaController.crear);
router.get('/:id', incidenciaController.detalle);

// Técnico
router.post('/:id/tomar', resolver, incidenciaController.tomar);
router.post('/:id/avances', resolver, limitarSubidas, conFotos, incidenciaController.avance);
router.post('/:id/espera', resolver, incidenciaController.espera);
router.post('/:id/reanudar', resolver, incidenciaController.reanudar);
router.post('/:id/verificacion', resolver, limitarSubidas, conFotos, incidenciaController.verificacion);
router.post('/:id/devolver', resolver, incidenciaController.devolver);

// Verificador
router.post('/:id/aprobar', verificar, incidenciaController.aprobar);
router.post('/:id/correccion', verificar, limitarSubidas, conFotos, incidenciaController.correccion);

// Asignador
router.post('/:id/reasignar', asignar, incidenciaController.reasignar);
router.post('/:id/descartar', asignar, incidenciaController.descartar);
router.put('/:id/prioridad', asignar, incidenciaController.prioridad);

// Comentarios: quien reportó, el técnico y quien verifica la tienda (lo decide el servicio).
router.post('/:id/comentarios', incidenciaController.comentar);

module.exports = router;
