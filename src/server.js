// src/server.js
const http = require('http');
const app = require('./app');
const config = require('./config/env');
const db = require('./config/database');
const sesionRepository = require('./core/auth/sesionRepository');
const socketManager = require('./core/websocket/socketManager');

// Crear servidor HTTP
const server = http.createServer(app);

// Inicializar capa de WebSocket (Socket.IO) transversalmente
socketManager.init(server);

// Iniciar servidor
const PORT = config.port;

(async () => {
  await db.listo;
  // Reconciliación de sesión única: un proceso recién arrancado no tiene
  // NINGÚN socket conectado, así que los contadores de conexiones que haya en
  // sesiones_activas son falsos. Se reinician, pero las sesiones vigentes se
  // conservan — su refresh token vive ahí y un reinicio/despliegue no debe
  // cerrarle la sesión a nadie.
  await sesionRepository.asegurarEsquema();
  await sesionRepository.reiniciarPresencia();

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  Portal Web de Herramientas Empresariales - MundiTrofeos`);
    console.log(`  Servidor corriendo en el puerto: ${PORT}`);
    console.log(`  Entorno: ${config.nodeEnv}`);
    console.log(`  URL Local: http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
})();

// Manejo de cierres limpios
process.on('SIGTERM', () => {
  console.log('[Server] Señal SIGTERM recibida. Cerrando conexiones...');
  server.close(() => {
    console.log('[Server] Servidor HTTP cerrado.');
    process.exit(0);
  });
});
