// src/core/auth/presenciaTracker.js
// Rastro de presencia de usuarios (analisis_correcciones_13.md #6, pestaña
// "Actividad de Usuarios" de la Vista Administrador). Vive en `core/auth` y no
// en el módulo `admin` porque escribe desde el login/logout/middleware global
// — el módulo `admin` solo LEE esta información para mostrarla.
const db = require('../../config/database');

// Rangos de red privada/loopback — en este entorno toda conexión llega de ahí,
// así que no hay geolocalización externa: si la IP es privada se etiqueta
// "Local", si no "Desconocida". Sin llamadas a servicios externos.
function resolverCiudad(ip) {
  if (!ip) return 'Desconocida';
  const limpia = ip.replace('::ffff:', '');
  const esLocal = limpia === '127.0.0.1' || limpia === '::1' ||
    /^10\./.test(limpia) || /^192\.168\./.test(limpia) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(limpia);
  return esLocal ? 'Local' : 'Desconocida';
}

async function sellarLogin(usuarioId, ip) {
  const ciudad = resolverCiudad(ip);
  await db.query(
    'UPDATE usuarios SET sesion_iniciada_en = NOW(), ultima_actividad_en = NOW(), ultima_ip = ?, ultima_ciudad = ? WHERE id = ?',
    [ip || null, ciudad, usuarioId],
    'usuario:sellar_login'
  );
}

async function limpiarSesion(usuarioId) {
  await db.query('UPDATE usuarios SET sesion_iniciada_en = NULL WHERE id = ?', [usuarioId], 'usuario:limpiar_sesion');
}

// Throttleado a 1 escritura por usuario por minuto — se llama en cada request
// autenticado (ver permissionMiddleware.authenticateJWT) y no puede costar una
// consulta por request.
const ultimoRefresco = new Map();
const THROTTLE_MS = 60 * 1000;

async function refrescarActividad(usuarioId) {
  const ahora = Date.now();
  const anterior = ultimoRefresco.get(usuarioId);
  if (anterior && ahora - anterior < THROTTLE_MS) return;
  ultimoRefresco.set(usuarioId, ahora);
  await db.query('UPDATE usuarios SET ultima_actividad_en = NOW() WHERE id = ?', [usuarioId], 'usuario:refrescar_actividad');
}

module.exports = { sellarLogin, limpiarSesion, refrescarActividad, resolverCiudad };
