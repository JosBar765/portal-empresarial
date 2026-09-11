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
  // Reconciliación de sesión única: un proceso recién arrancado no puede
  // tener NINGÚN socket todavía conectado, así que cualquier fila de
  // sesiones_activas que exista es forzosamente huérfana de un crash o
  // reinicio anterior — borrarlas todas aquí da recuperación inmediata en
  // vez de obligar a esperar a que cada `expira_en` venza por su cuenta.
  await sesionRepository.limpiarTodas();

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
