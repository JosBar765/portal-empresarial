// src/modules/proyectos/controllers/importacionController.js
// HTTP de la importación de empresas: recibe el CSV (en memoria), lo pasa al servicio y traduce los errores.
const multer = require('multer');
const importacionService = require('../services/importacionService');
const { responderError } = require('../../../core/utils/erroresHttp');

const TOPE_DURO_BYTES = 20 * 1024 * 1024; // el ajuste `importacion.max_mb` (máx. 20) lo afina dentro del servicio
const TIPOS = new Set(['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv', 'application/octet-stream']);

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TOPE_DURO_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/\.csv$/i.test(file.originalname || '') && TIPOS.has(file.mimetype)) return cb(null, true);
    return cb(new multer.MulterError('TIPO_NO_PERMITIDO', file.fieldname));
  }
}).single('archivo');

function mensajeDeSubida(error) {
  if (error.code === 'LIMIT_FILE_SIZE') return 'El archivo pesa demasiado. Divídelo en partes más pequeñas.';
  if (error.code === 'TIPO_NO_PERMITIDO') return 'Sube un archivo .csv (en Excel: Guardar como › CSV).';
  return 'No se pudo leer el archivo. Inténtalo de nuevo.';
}

// Recibe el archivo antes de la acción; un fallo de subida responde 400 con un mensaje claro.
const recibirArchivo = (req, res, siguiente) => subida(req, res, (error) => {
  if (!error) return siguiente();
  return res.status(error instanceof multer.MulterError ? 400 : 500).json({ error: mensajeDeSubida(error) });
});

const accion = (estado, fn) => async (req, res) => {
  try {
    return res.status(estado).json(await fn(req));
  } catch (error) {
    return responderError(res, error, 400);
  }
};

class ImportacionController {
  constructor() {
    this.recibirArchivo = recibirArchivo;
    this.previsualizar = accion(200, req => importacionService.previsualizar(req.user, req.file));
    this.confirmar = accion(200, req => importacionService.confirmar(req.user, req.file, {
      duplicadas: req.body && req.body.duplicadas, idempotencyKey: req.body && req.body.idempotencyKey
    }));
  }

  plantilla(req, res) {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="plantilla_empresas.csv"' });
    res.send(importacionService.plantilla());
  }
}

module.exports = new ImportacionController();
