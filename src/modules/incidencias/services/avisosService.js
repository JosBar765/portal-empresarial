// src/modules/incidencias/services/avisosService.js
// Los avisos de Incidencias: la campana del portal (notificaciones) y el refresco en vivo de las pantallas abiertas.
// Un aviso que falla nunca deshace lo que ya se hizo: se anota en el registro y se sigue.
const notificacionService = require('../../../core/notifications/notificacionService');
const socketManager = require('../../../core/websocket/socketManager');

const unicos = (ids, sin) => [...new Set(ids.filter(id => id && id !== sin))];

class AvisosService {
  // `destinatarios` reciben aviso en la campana; `involucrados` (y los destinatarios) solo refrescan su pantalla.
  async cambio({ incidencia, actorId = null, tipo, mensaje, destinatarios = [], involucrados = [], nivel = 'info' }) {
    try {
      const avisar = unicos(destinatarios, actorId);
      if (avisar.length) {
        await notificacionService.registrar(avisar, { modulo: 'incidencias', tipo, referenciaTipo: 'incidencia', referenciaId: incidencia.id, nivel, mensaje });
      }
      const refrescar = unicos([...destinatarios, ...involucrados], null);
      if (refrescar.length) socketManager.sendToRooms(refrescar.map(id => `usuario:${id}`), 'incidencia_actualizada', { id: incidencia.id });
    } catch (error) {
      console.error('[Incidencias] No se pudo avisar:', error.message);
    }
  }
}

module.exports = new AvisosService();
