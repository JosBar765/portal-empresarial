// src/server.js
const http = require('http');
const app = require('./app');
const config = require('./config/env');
const db = require('./config/database');
const migraciones = require('./core/migrations/ejecutor');
const { verificarMarca, leerMarcaDeBase } = require('./core/entorno/verificarMarca');
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
  // Antes de migrar: un staging apuntando a la base de producción (o al revés) no debe tocarla.
  const entorno = await verificarMarca({ nodeEnv: config.nodeEnv, leerMarca: () => leerMarcaDeBase(db.query) });
  if (entorno.fatal) {
    console.error(`[FATAL] ${entorno.mensaje}`);
    process.exit(1);
  }
  if (entorno.mensaje) console.log(`[Entorno] ${entorno.mensaje}`);
  // Migraciones automáticas solo en staging y producción; antes de cualquier
  // otra consulta y sin escuchar: no se sirve tráfico con la base a medias.
  if (['staging', 'production'].includes(config.nodeEnv)) {
    try {
      await migraciones.ejecutar({ conexion: config.db });
    } catch (error) {
      console.error(`[FATAL] ${error.message}`);
      console.error('[FATAL] Migraciones fallidas: el servidor no arranca. Corregir el script y reiniciar.');
      process.exit(1);
    }
  } else {
    console.log(`[Migraciones] NODE_ENV=${config.nodeEnv}: no se aplican solas (usar npm run migrate).`);
  }
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
