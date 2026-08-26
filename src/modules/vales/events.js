// src/modules/vales/events.js
// Cada evento se envía SOLO a las salas del rol/usuario a quien concierne (más la
// sala del administrador, que ve todo). Esto es lo que hace que el sonido de
// notificación en el cliente suene únicamente "del lado que cae la notificación"
// (ver .agents/correciones_mod_vales_de_arte_1.md, Cambios generales #1): si un
// cliente no está en ninguna de las salas objetivo, simplemente no recibe el evento.
//
// analisis_correcciones_10.md #10: rediseño completo — antes solo existían dos
// tipos genéricos ('creado'/'estado') y el cliente armaba un texto fijo sin actor
// ni fecha. Ahora el mensaje llega YA FORMATEADO desde el servidor:
//   {dd/mm/aaaa hh:mm} – Vale: {correlativo} fue {qué pasó} por {actor}[ a {destino}]
// `nivel: 'alerta'` pinta el toast en rojo en el cliente (atrasos, propuesta
// vacía); `beep: false` permite emitir un evento sin sonido (usado por el
// reenvío a varios talleres del Encargado General: un solo emit, un solo beep,
// aunque el mensaje mencione a más de un destino).
const socketManager = require('../../core/websocket/socketManager');

const SALA_ADMIN = 'vales:admin';

function fechaHoraLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * @param {object} vale El vale de arte afectado (necesita al menos id/correlativo/estado/asesor_id).
 * @param {string} accion Verbo/frase en participio: "creado, esperando autorización", "autorizado (creación)", etc.
 * @param {string|null} actor Nombre de quien ejecutó la acción (o null si no aplica).
 * @param {string|null} destino Complemento opcional ("a Diseño, Diseño UV/3D") — se agrega solo si viene.
 * @param {string[]} salas Salas objetivo (sin incluir vales:admin, que siempre se agrega).
 * @param {'info'|'alerta'} nivel 'alerta' pinta el toast en rojo en el cliente.
 * @param {boolean} beep Si debe sonar; false para notificaciones silenciosas.
 */
function notificar({ vale, accion, actor = null, destino = null, salas = [], nivel = 'info', beep = true }) {
  const mensaje = `${fechaHoraLocal()} – Vale: ${vale.correlativo} fue ${accion}${actor ? ` por ${actor}` : ''}${destino ? ` a ${destino}` : ''}`;
  const salasFinal = [...new Set([...(salas || []), SALA_ADMIN])];
  socketManager.sendToRooms(salasFinal, 'vale_evento', {
    valeId: vale.id,
    correlativo: vale.correlativo,
    estado: vale.estado,
    asesorId: vale.asesor_id,
    mensaje,
    nivel,
    beep
  });
}

module.exports = { notificar };
