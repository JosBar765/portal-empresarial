// src/modules/vales/retencionArchivosWatcher.js
// Purga de archivos vencidos: al arrancar (con el pool ya conectado) y luego cada 6 horas.
const db = require('../../config/database');
const retencionArchivosService = require('./services/retencionArchivosService');

const INTERVALO_MS = 6 * 60 * 60 * 1000;

async function purgar() {
  try {
    const { archivos, propuestas } = await retencionArchivosService.ejecutar();
    if (archivos || propuestas) {
      console.log(`[RetencionArchivos] Purgados: ${archivos} vale(s) con PDF/adjuntos, ${propuestas} con propuestas.`);
    }
  } catch (error) {
    console.error('[RetencionArchivos] No se pudo purgar:', error.message);
  }
}

function iniciar() {
  // `database.js` conecta de forma asíncrona; la primera purga espera a que el pool esté listo.
  db.listo.then(purgar, () => {});
  setInterval(purgar, INTERVALO_MS);
}

module.exports = { iniciar, purgar };
