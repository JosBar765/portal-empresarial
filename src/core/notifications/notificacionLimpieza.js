// src/core/notifications/notificacionLimpieza.js
// Borra las notificaciones leídas con más de 60 días: al arrancar y luego cada 6 horas.
const notificacionService = require('./notificacionService');

const DIAS_DE_RETENCION = 60;
const INTERVALO_MS = 6 * 60 * 60 * 1000;

async function purgar() {
  try {
    const borradas = await notificacionService.purgarLeidasAntiguas(DIAS_DE_RETENCION);
    if (borradas) console.log(`[Notificaciones] Se purgaron ${borradas} leídas con más de ${DIAS_DE_RETENCION} días.`);
  } catch (error) {
    console.error('[Notificaciones] No se pudo purgar:', error.message);
  }
}

function iniciar() {
  purgar();
  setInterval(purgar, INTERVALO_MS);
}

module.exports = { iniciar, purgar, DIAS_DE_RETENCION };
