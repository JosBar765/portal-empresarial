// src/core/utils/erroresHttp.js
// Un error se considera "de negocio" cuando un servicio lo lanzó a propósito con
// un mensaje pensado para el usuario (`throw new Error('El técnico indicado no
// está bajo su mando.')`): ese mensaje sí se devuelve. Cualquier otra cosa
// (errores de MySQL, de Supabase, TypeError de un bug, cortes de red) es
// INTERNA: su `.message` trae detalles de SQL, nombres de tabla/columna,
// bucket o rutas. El detalle completo queda solo en el log del servidor; el
// cliente recibe siempre un mensaje genérico.
const {
  StorageUploadError, DatabaseInsertError, StorageRollbackError
} = require('../files/errores');

const MENSAJE_INTERNO = 'Algo salió mal de nuestro lado. Inténtalo de nuevo en unos minutos; si el problema continúa, avisa al administrador.';
const MENSAJE_ARCHIVO = 'No se pudo guardar el archivo adjunto. Inténtalo de nuevo en unos minutos.';

// Error de negocio explícito, con el estado HTTP que le corresponde (p. ej.
// 400 "Identificador inválido"). Los `throw new Error(...)` existentes en los
// servicios siguen contando como de negocio sin tener que tocarlos.
class ErrorDeNegocio extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.name = 'ErrorDeNegocio';
    this.status = status;
  }
}

// Errores conocidos de MySQL que el usuario puede entender y corregir.
const ERRORES_DB_AMIGABLES = {
  ER_DUP_ENTRY: [409, 'Ya existe un registro con esos datos.'],
  ER_DATA_TOO_LONG: [400, 'Uno de los datos escritos es demasiado largo.'],
  ER_NO_REFERENCED_ROW_2: [400, 'Un dato elegido ya no existe. Recarga la página e inténtalo de nuevo.'],
  ER_ROW_IS_REFERENCED_2: [409, 'No se puede eliminar porque está en uso en otros registros.'],
  ER_LOCK_DEADLOCK: [503, 'El sistema está ocupado. Inténtalo de nuevo en unos segundos.'],
  ER_LOCK_WAIT_TIMEOUT: [503, 'El sistema está ocupado. Inténtalo de nuevo en unos segundos.']
};
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con la base de datos. Inténtalo de nuevo en un momento.';

const ERRORES_DE_ARCHIVO = [StorageUploadError, DatabaseInsertError, StorageRollbackError];
const TIPOS_DE_BUG = [TypeError, RangeError, ReferenceError, SyntaxError, EvalError];

function esErrorDeArchivo(error) {
  return ERRORES_DE_ARCHIVO.some(Clase => error instanceof Clase);
}

// Un error lanzado por una librería (mysql2, supabase, sharp…) nunca es de negocio.
function vieneDeLibreria(error) {
  const origen = String(error.stack || '').split('\n')[1] || '';
  return origen.includes('node_modules');
}

function esErrorInterno(error) {
  if (!(error instanceof Error)) return true;
  if (error instanceof ErrorDeNegocio) return false;
  if (vieneDeLibreria(error)) return true;
  if (esErrorDeArchivo(error)) return true;
  if (TIPOS_DE_BUG.some(Tipo => error instanceof Tipo)) return true;
  // mysql2: códigos ER_*, PROTOCOL_*, ECONN*, ETIMEDOUT…, `sqlState`, `errno`, `fatal`.
  const codigo = String(error.code || '');
  if (/^(ER_|PROTOCOL_|ECONN|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_|ERR_)/.test(codigo)) return true;
  if (error.sqlState || error.sqlMessage || error.fatal) return true;
  return false;
}

/**
 * Responde un error de un controlador. Negocio → su mensaje y estado; interno →
 * 500 genérico (los fallos de archivos adjuntos llevan un texto propio, sin
 * nombre de bucket ni código de Supabase) y el detalle al log.
 * @param {object} res
 * @param {Error} error
 * @param {number} [statusNegocio=400] estado para errores de negocio sin `status` propio
 * @param {object} [extra] campos extra del cuerpo (p. ej. { ok: false } en el login)
 */
function responderError(res, error, statusNegocio = 400, extra = {}) {
  if (esErrorInterno(error)) {
    console.error('[Error interno]', (error && error.stack) || String(error));
    const amigable = error && ERRORES_DB_AMIGABLES[error.code];
    if (amigable) return res.status(amigable[0]).json({ ...extra, error: amigable[1] });
    if (/^(PROTOCOL_|ECONN|ETIMEDOUT|ENOTFOUND|EAI_)/.test(String(error && error.code))) {
      return res.status(503).json({ ...extra, error: MENSAJE_SIN_CONEXION });
    }
    const mensaje = esErrorDeArchivo(error) ? MENSAJE_ARCHIVO : MENSAJE_INTERNO;
    return res.status(500).json({ ...extra, error: mensaje });
  }
  return res.status(error.status || statusNegocio).json({ ...extra, error: error.message });
}

// Para controladores cuyo catch antes era siempre 500.
function responderErrorInterno(res, error) {
  return responderError(res, error, 500);
}

module.exports = { ErrorDeNegocio, esErrorInterno, responderError, responderErrorInterno, MENSAJE_INTERNO };
