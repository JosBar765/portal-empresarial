// src/modules/vales/events.js
// Cada evento se envía SOLO a las salas del rol/usuario a quien concierne
// (más la sala del administrador, que ve todo) — si un cliente no está en
// ninguna de las salas objetivo, simplemente no recibe el evento. El mensaje
// llega ya formateado desde el servidor:
//   {dd/mm/aaaa hh:mm} – Vale: {correlativo} fue {qué pasó} por {actor}[ a {destino}]
// `nivel: 'alerta'` pinta el toast en rojo en el cliente (atrasos, propuesta
// vacía); `beep: false` permite emitir un evento sin sonido (usado por un
// reenvío a varios talleres a la vez: un solo emit, un solo beep, aunque el
// mensaje mencione a más de un destino).
const socketManager = require('../../core/websocket/socketManager');
const tallerRepository = require('./repositories/tallerRepository');
const valeCatalogoService = require('./services/valeCatalogoService');
const valeDetalleService = require('./services/valeDetalleService');
const { ROL, ROLES_ENCARGADO_TALLER, esAdministrador } = require('./services/valeHelpers');

const SALA_ADMIN = 'vales:admin';

// Valida, EN EL SERVIDOR, que el usuario ya autenticado del socket
// (ver socketManager.js) tenga derecho real a la sala que está pidiendo —
// nunca se confía en que el cliente arme la lista correcta por su cuenta,
// aunque el frontend (permisos.js:roomsParaUsuario) ya lo haga bien. Mismo
// criterio que esa función, pero recalculado del lado del servidor.
async function puedeUnirseASala(socket, sala) {
  const usuario = socket.user;
  if (sala === SALA_ADMIN) return esAdministrador(usuario);
  if (usuario.rolId === ROL.ASESOR) return sala === `asesor:${usuario.id}`;
  if (usuario.rolId === ROL.SUPERVISOR) return sala === `supervisor:${usuario.id}`;
  if (usuario.rolId === ROL.TECNICO) return sala === `tecnico:${usuario.id}`;
  if (ROLES_ENCARGADO_TALLER.includes(usuario.rolId) && sala.startsWith('taller:')) {
    const tallerId = Number(sala.slice('taller:'.length));
    if (!Number.isFinite(tallerId)) return false;
    const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
    const talleres = await tallerRepository.listarActivos();
    const miTaller = talleres.find(t => t.encargado_id === idEfectivo);
    return !!miTaller && miTaller.id === tallerId;
  }
  if (sala.startsWith('vale:')) {
    const valeId = Number(sala.slice('vale:'.length));
    if (!Number.isFinite(valeId)) return false;
    return valeDetalleService.puedeVerValePorId(usuario, valeId);
  }
  return false;
}
socketManager.registrarValidadorSala(puedeUnirseASala);

// Offset fijo UTC-6 (Centroamérica, sin horario de verano) — no depender de
// la zona horaria del sistema operativo del proceso Node (mismo criterio
// que valeHelpers.js hoyISO/horaActual).
function fechaHoraLocal() {
  const d = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const [fecha, hora] = d.toISOString().slice(0, 16).split('T');
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio} ${hora}`;
}

/**
 * @param {object} vale El vale de arte afectado (necesita al menos id/correlativo/estado/asesor_id).
 * @param {string} accion Verbo/frase en participio: "creado, esperando autorización", "autorizado (creación)", etc.
 * @param {string|null} actor Nombre de quien ejecutó la acción (o null si no aplica).
 * @param {number|null} actorId usuarios.id de quien ejecutó la acción (o null si no aplica, ej.
 *   el vigilante de atraso). El cliente lo compara contra su propio usuario para no duplicar
 *   la notificación de quien acaba de hacer la acción — ya recibió su propio toast optimista
 *   local al completarse el fetch.
 * @param {string|null} destino Complemento opcional ("a Diseño, Diseño UV/3D") — se agrega solo si viene.
 * @param {string[]} salas Salas objetivo (sin incluir vales:admin, que siempre se agrega).
 * @param {'info'|'alerta'} nivel 'alerta' pinta el toast en rojo en el cliente.
 * @param {boolean} beep Si debe sonar; false para notificaciones silenciosas.
 */
function notificar({ vale, accion, actor = null, actorId = null, destino = null, salas = [], nivel = 'info', beep = true }) {
  const mensaje = `${fechaHoraLocal()} – Vale: ${vale.correlativo} fue ${accion}${actor ? ` por ${actor}` : ''}${destino ? ` a ${destino}` : ''}`;
  const salasFinal = [...new Set([...(salas || []), SALA_ADMIN])];
  socketManager.sendToRooms(salasFinal, 'vale_evento', {
    valeId: vale.id,
    correlativo: vale.correlativo,
    estado: vale.estado,
    asesorId: vale.asesor_id,
    actorId,
    mensaje,
    nivel,
    beep
  });
  // Canal aparte, uno por vale, independiente de `salas` (que decide quién
  // oye el beep/toast de cada acción — un rol sin visibilidad "de oficio"
  // sobre esta transición no debe recibir esa alerta). Cualquier vista con
  // el historial de ESTE vale abierto se une a esta sala mientras el modal
  // está abierto (ver actions/historial.js) y así se refresca en vivo sin
  // importar el rol — antes solo pasaba por casualidad para los roles que
  // ya estaban en `salas`.
  socketManager.sendToRooms([`vale:${vale.id}`], 'vale_actualizado', { valeId: vale.id });
}

module.exports = { notificar };
