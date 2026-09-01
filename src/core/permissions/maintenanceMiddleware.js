// src/core/permissions/maintenanceMiddleware.js
// Gate global de Modo Mantenimiento (analisis_correcciones_13.md #6). Se monta
// en app.js justo después de authenticateJWT: bloquea a todo usuario que no
// sea Administrador mientras el mantenimiento está activo. Lee de una caché en
// memoria del proceso (monolito de un solo proceso) para no pagar una consulta
// por request — la caché se refresca al arrancar y cada vez que el panel de
// Administrador cambia el estado (ver adminService.actualizarMantenimiento).
const db = require('../../config/database');
const mantenimientoRepository = require('../../modules/admin/repositories/mantenimientoRepository');

let estado = { activo: false, mensaje: null };

async function refrescar() {
  const fila = await mantenimientoRepository.obtener();
  estado = { activo: !!(fila && fila.activo), mensaje: fila ? fila.mensaje : null };
  return estado;
}

// Espera a que database.js decida MySQL real vs. mock antes de la primera
// consulta — evita el ECONNREFUSED ruidoso de intentar leer antes de que
// initializeDatabase() resuelva (ver database.js: `listo`).
Promise.resolve(db.listo).catch(() => {}).then(refrescar).catch(err => console.error('[Mantenimiento] No se pudo cargar el estado inicial:', err));

function paginaMantenimiento(mensaje) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mantenimiento | Portal Empresarial</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0F172A; color: #E7EAF0; font-family: Inter, system-ui, sans-serif; padding: 24px; box-sizing: border-box; }
  .box { max-width: 440px; text-align: center; }
  h1 { font-size: 1.5rem; margin: 16px 0 8px; }
  p { color: #94A3B8; line-height: 1.5; }
</style>
</head>
<body>
  <div class="box">
    <h1>Sistema en mantenimiento</h1>
    <p>${mensaje}</p>
  </div>
</body>
</html>`;
}

function maintenanceGate(req, res, next) {
  if (!estado.activo || req.user.rolId === 1) {
    return next();
  }

  const mensaje = estado.mensaje || 'El sistema está en mantenimiento. Vuelve a intentarlo más tarde.';
  const isApiRequest = req.originalUrl.startsWith('/api') || req.path.startsWith('/api');

  if (isApiRequest) {
    return res.status(503).json({ mantenimiento: true, mensaje });
  }
  return res.status(503).send(paginaMantenimiento(mensaje));
}

module.exports = maintenanceGate;
module.exports.refrescar = refrescar;
module.exports.obtenerEstado = () => estado;
