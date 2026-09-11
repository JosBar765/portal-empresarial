// src/core/utils/erroresHttp.js
// Un error 500 es, por definición, uno que la capa de servicio NO anticipó
// con un `throw new Error('mensaje amigable')` propio (esos ya usan 400 en
// los controllers) — su `.message` real puede traer detalles de SQL/MySQL,
// nombres de tabla/columna o rutas internas. El detalle completo queda solo
// en el log del servidor; el cliente recibe siempre un mensaje genérico.
function responderErrorInterno(res, error) {
  console.error(error);
  return res.status(500).json({ error: 'Ocurrió un error interno en el servidor.' });
}

module.exports = { responderErrorInterno };
