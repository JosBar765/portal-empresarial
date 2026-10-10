// src/core/permissions/maintenanceMiddleware.js
// Gate global de Modo Mantenimiento. Se monta en app.js justo después de
// authenticateJWT. Al activarlo empieza una cuenta regresiva (los usuarios
// siguen trabajando y ven un aviso); al terminar, el gate bloquea a todo
// usuario que no sea Administrador y se cierran sus sesiones.
// Lee de una caché en memoria del proceso (monolito de un solo proceso) para no
// pagar una consulta por request — la caché se refresca al arrancar y cada vez
// que el panel de Administrador cambia el estado (ver adminService.actualizarMantenimiento).
// El fin de la cuenta se guarda como "ms restantes según el reloj de MySQL" +
// Date.now(): no depende de la zona horaria de Node ni del reloj de los clientes.
const db = require('../../config/database');
const mantenimientoRepository = require('../../modules/admin/repositories/mantenimientoRepository');
const sesionRepository = require('../auth/sesionRepository');
const socketManager = require('../websocket/socketManager');

const MINUTOS_CUENTA_REGRESIVA = 10;

// venceEnMs: instante (Date.now) en que empieza el bloqueo; null = bloqueo ya en curso.
let estado = { activo: false, mensaje: null, venceEnMs: null, cerrada: false };
let temporizador = null;
let cerrando = false;

function calcular() {
  const mensaje = estado.mensaje;
  if (!estado.activo) {
    return { activo: false, enCuentaRegresiva: false, bloqueando: false, segundosRestantes: 0, mensaje };
  }
  const restanteMs = estado.venceEnMs === null ? 0 : estado.venceEnMs - Date.now();
  if (restanteMs > 0) {
    return { activo: true, enCuentaRegresiva: true, bloqueando: false, segundosRestantes: Math.ceil(restanteMs / 1000), mensaje };
  }
  return { activo: true, enCuentaRegresiva: false, bloqueando: true, segundosRestantes: 0, mensaje };
}

// Una sola vez por activación: borra las sesiones de quien no es Administrador y les ordena cerrar sesión.
async function cerrarSesiones() {
  if (cerrando || !estado.activo || estado.cerrada || estado.venceEnMs === null || calcular().enCuentaRegresiva) return;
  cerrando = true;
  try {
    const ids = await sesionRepository.eliminarNoAdministradores();
    socketManager.sendToUsers(ids, 'sesion_revocada', {});
    await mantenimientoRepository.marcarSesionesCerradas();
    estado.cerrada = true;
    console.log(`[Mantenimiento] Sesiones cerradas: ${ids.length}.`);
  } catch (err) {
    console.error('[Mantenimiento] No se pudieron cerrar las sesiones:', err);
  } finally {
    cerrando = false;
  }
}

// Arma el temporizador del fin de la cuenta; si ya venció y falta el cierre (p. ej. tras un reinicio), lo ejecuta ya.
function programar() {
  clearTimeout(temporizador);
  temporizador = null;
  if (!estado.activo || estado.venceEnMs === null || estado.cerrada) return;
  const restanteMs = estado.venceEnMs - Date.now();
  if (restanteMs <= 0) {
    cerrarSesiones();
    return;
  }
  temporizador = setTimeout(cerrarSesiones, restanteMs + 100);
  temporizador.unref();
}

async function refrescar() {
  const fila = await mantenimientoRepository.obtener();
  const conCuenta = !!(fila && fila.activo && fila.inicia_en !== null && fila.segundos_restantes !== null);
  estado = {
    activo: !!(fila && fila.activo),
    mensaje: fila ? fila.mensaje : null,
    venceEnMs: conCuenta ? Date.now() + Number(fila.segundos_restantes) * 1000 : null,
    cerrada: !!(fila && fila.sesiones_cerradas_en)
  };
  programar();
  return calcular();
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
  button { margin-top: 16px; background: transparent; color: #E7EAF0; border: 1px solid #475569; border-radius: 8px;
    padding: 10px 24px; font: inherit; font-weight: 600; cursor: pointer; }
  button:hover { background: #1E293B; }
  button:disabled { opacity: .6; cursor: default; }
  #error { color: #F87171; font-size: .875rem; margin: 12px 0 0; min-height: 1.2em; }
</style>
</head>
<body>
  <div class="box">
    <h1>Sistema en mantenimiento</h1>
    <p>${mensaje}</p>
    <button type="button" id="cerrar-sesion">Cerrar sesión</button>
    <p id="error" role="alert"></p>
  </div>
  <script>
    var boton = document.getElementById('cerrar-sesion');
    boton.addEventListener('click', function () {
      boton.disabled = true;
      fetch('/api/auth/logout', { method: 'POST' })
        .then(function (res) { if (!res.ok) throw new Error(); window.location.href = '/login/'; })
        .catch(function () {
          boton.disabled = false;
          document.getElementById('error').textContent = 'No se pudo cerrar la sesión. Inténtalo de nuevo.';
        });
    });
  </script>
</body>
</html>`;
}

function maintenanceGate(req, res, next) {
  if (req.user.rolId === 1 || !calcular().bloqueando) {
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
module.exports.obtenerEstado = calcular;
module.exports.MINUTOS_CUENTA_REGRESIVA = MINUTOS_CUENTA_REGRESIVA;
