// src/core/websocket/socketManager.js
const { Server } = require('socket.io');

let io = null;
const activeConnections = new Map(); // Guardar conexiones activas asociadas a usuarios

function init(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Permitir conexiones desde cualquier origen en desarrollo
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    // Intentar asociar conexión con usuario si viene información en el handshake
    const userId = socket.handshake.query.userId;
    if (userId) {
      activeConnections.set(userId, socket.id);
      console.log(`[WebSocket] Usuario conectado: ${userId} (Socket: ${socket.id})`);
    } else {
      console.log(`[WebSocket] Conexión anónima establecida (Socket: ${socket.id})`);
    }

    socket.on('disconnect', () => {
      if (userId) {
        activeConnections.delete(userId);
        console.log(`[WebSocket] Usuario desconectado: ${userId}`);
      } else {
        console.log(`[WebSocket] Conexión anónima cerrada: ${socket.id}`);
      }
    });

    // Escuchar eventos globales o de registro de canal
    socket.on('register_module', (moduleName) => {
      socket.join(moduleName);
      console.log(`[WebSocket] Socket ${socket.id} se unió al canal del módulo: ${moduleName}`);
    });
  });

  console.log('[WebSocket] Servidor Socket.IO inicializado transversalmente.');
  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.IO no ha sido inicializado. Llama a init(server) primero.');
  }
  return io;
}

/**
 * Envía un mensaje a todos los usuarios conectados.
 * @param {string} event 
 * @param {any} data 
 */
function broadcast(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Envía un mensaje a los usuarios de un módulo específico.
 * @param {string} moduleName 
 * @param {string} event 
 * @param {any} data 
 */
function sendToModule(moduleName, event, data) {
  if (io) {
    io.to(moduleName).emit(event, data);
  }
}

/**
 * Envía un mensaje a un usuario específico si está conectado.
 * @param {string|number} userId 
 * @param {string} event 
 * @param {any} data 
 */
function sendToUser(userId, event, data) {
  if (io && activeConnections.has(String(userId))) {
    const socketId = activeConnections.get(String(userId));
    io.to(socketId).emit(event, data);
  }
}

module.exports = {
  init,
  getIO,
  broadcast,
  sendToModule,
  sendToUser
};
