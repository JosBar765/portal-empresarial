// src/core/websocket/socketManager.js
const { Server } = require('socket.io');
const jwtHelper = require('../auth/jwtHelper');

let io = null;
const activeConnections = new Map(); // Guardar conexiones activas asociadas a usuarios

// Cada módulo que use salas más específicas que "role_<rolId>" (genérico,
// ver más abajo) registra aquí su propia función de validación —
// socketManager se mantiene transversal/sin conocer reglas de negocio de
// ningún módulo en particular (mismo principio que permissionMiddleware:
// el middleware es genérico, los códigos de permiso los define cada
// módulo). Ver src/modules/vales/events.js para el validador de vales.
const validadoresDeSala = [];
function registrarValidadorSala(validador) {
  validadoresDeSala.push(validador);
}

// El JWT viaja en la misma cookie httpOnly que ya usa el resto de la app
// (permissionMiddleware.authenticateJWT) — se extrae a mano del header
// Cookie del handshake para no depender de una segunda instancia de
// cookie-parser fuera del pipeline de Express.
function extraerTokenDeCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const partes = cookieHeader.split(';').map(c => c.trim());
  const cookieToken = partes.find(c => c.startsWith('token='));
  return cookieToken ? decodeURIComponent(cookieToken.slice('token='.length)) : null;
}

async function puedeUnirseASala(socket, sala) {
  // Canal de refresco de permisos/rol — sin datos de negocio, cualquier
  // usuario autenticado puede unirse al de SU PROPIO rol.
  if (sala === `role_${socket.user.rolId}`) return true;
  for (const validador of validadoresDeSala) {
    try {
      if (await validador(socket, sala)) return true;
    } catch {
      // Un validador que falla (ej. vale inexistente) nunca debe tumbar la
      // conexión — simplemente no concede esa sala.
    }
  }
  return false;
}

function init(server) {
  io = new Server(server, {
    cors: {
      // Sin restringir esto, cualquier sitio web de terceros podría abrir
      // una conexión Socket.IO contra este servidor desde el navegador de
      // una víctima. En producción, configurar SOCKET_CORS_ORIGIN con el
      // dominio real de Hostinger.
      origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Sin esto, cualquiera (sin cuenta) podía conectarse y, vía
  // register_module, suscribirse a salas como "vales:admin" y recibir en
  // tiempo real la actividad de toda la empresa — los nombres de sala no
  // son secretos, están en el JS público del frontend.
  io.use((socket, next) => {
    const token = extraerTokenDeCookie(socket.handshake.headers.cookie);
    const payload = token ? jwtHelper.verifyToken(token) : null;
    if (!payload) {
      return next(new Error('No autenticado'));
    }
    socket.user = payload;
    next();
  });

  io.on('connection', (socket) => {
    const userId = String(socket.user.id);
    activeConnections.set(userId, socket.id);
    console.log(`[WebSocket] Usuario conectado: ${userId} (Socket: ${socket.id})`);

    socket.on('disconnect', () => {
      activeConnections.delete(userId);
      console.log(`[WebSocket] Usuario desconectado: ${userId}`);
    });

    // Escuchar eventos globales o de registro de canal. Acepta un nombre único
    // (compatibilidad con otros módulos) o un arreglo de salas (usado por Vales
    // de Arte para unirse solo a las salas relevantes a su rol/usuario).
    // Cada sala pedida se valida contra el usuario YA AUTENTICADO del
    // handshake — nunca se confía en lo que el cliente dice tener derecho a
    // ver, aunque el propio frontend ya arme la lista correcta por su cuenta.
    socket.on('register_module', async (canalONombres) => {
      const canales = Array.isArray(canalONombres) ? canalONombres : [canalONombres];
      const unidas = [];
      for (const canal of canales.filter(Boolean)) {
        if (await puedeUnirseASala(socket, canal)) {
          socket.join(canal);
          unidas.push(canal);
        } else {
          console.warn(`[WebSocket] Socket ${socket.id} (usuario ${userId}) intentó unirse a una sala no permitida: ${canal}`);
        }
      }
      if (unidas.length) console.log(`[WebSocket] Socket ${socket.id} se unió a: ${unidas.join(', ')}`);
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

/**
 * Envía un mensaje a un conjunto específico de salas (roles/usuarios objetivo).
 * @param {string[]} rooms
 * @param {string} event
 * @param {any} data
 */
function sendToRooms(rooms, event, data) {
  if (io && rooms && rooms.length) {
    io.to(rooms).emit(event, data);
  }
}

module.exports = {
  init,
  getIO,
  broadcast,
  sendToModule,
  sendToUser,
  sendToRooms,
  registrarValidadorSala
};
