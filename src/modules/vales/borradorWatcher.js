// src/modules/vales/borradorWatcher.js
// Un borrador vive 30 días desde su creación: al vencer se borra con sus archivos. Cada hora.
const db = require('../../config/database');
const borradorService = require('./services/borradorService');

const INTERVALO_MS = 60 * 60 * 1000;

async function revisarBorradores() {
  try {
    const borrados = await borradorService.purgarVencidos();
    if (borrados > 0) console.log(`[Borradores] ${borrados} borrador(es) vencido(s) eliminado(s).`);
  } catch (error) {
    console.error('[Borradores] Error revisando borradores vencidos:', error.message);
  }
}

function iniciar() {
  // La conexión a MySQL se abre de forma asíncrona: la primera revisión espera a que esté lista.
  Promise.resolve(db.listo).then(revisarBorradores).catch(() => {});
  setInterval(revisarBorradores, INTERVALO_MS);
}

module.exports = { iniciar, revisarBorradores };
