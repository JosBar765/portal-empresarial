// src/modules/incidencias/retencionFotosWatcher.js
// Aplica la regla de conservación de las fotos de Incidencias: al arrancar (con el pool ya conectado) y luego cada 6 horas.
const db = require('../../config/database');
const config = require('../../config/env');
const retencionFotosService = require('./services/retencionFotosService');

const INTERVALO_MS = 6 * 60 * 60 * 1000;

async function purgar() {
  try {
    const { purgadas } = await retencionFotosService.ejecutar();
    if (purgadas) console.log(`[RetencionFotosIncidencias] Fotos purgadas: ${purgadas}.`);
  } catch (error) {
    console.error('[RetencionFotosIncidencias] No se pudo purgar:', error.message);
  }
}

function iniciar() {
  // Borra archivos de forma irreversible: solo en producción.
  if (config.nodeEnv !== 'production') {
    console.log(`[RetencionFotosIncidencias] Desactivada (NODE_ENV=${config.nodeEnv}).`);
    return;
  }
  db.listo.then(purgar, () => {});
  setInterval(purgar, INTERVALO_MS);
}

module.exports = { iniciar, purgar };
