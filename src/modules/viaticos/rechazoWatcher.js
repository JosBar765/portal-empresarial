// src/modules/viaticos/rechazoWatcher.js
// Una solicitud rechazada vence a las horas del ajuste `rechazo_vigencia_horas`: avisa cuando queda el 25 % y, al vencer, la pasa
// a un borrador del solicitante. Cada 60 s.
const db = require('../../config/database');
const service = require('./services/rechazoVencimientoService');

const INTERVALO_MS = 60 * 1000;

// Cada paso captura sus errores: que falle uno no impide el otro ni detiene el intervalo.
async function avisarPorVencer() {
  try {
    const avisadas = await service.avisarPorVencer();
    if (avisadas > 0) console.log(`[Viáticos] ${avisadas} solicitud(es) rechazada(s) por vencer avisada(s).`);
    return avisadas;
  } catch (error) {
    console.error('[Viáticos] Error avisando solicitudes rechazadas por vencer:', error.message);
    return 0;
  }
}

async function expirarVencidas() {
  try {
    const expiradas = await service.expirarVencidas();
    if (expiradas > 0) console.log(`[Viáticos] ${expiradas} solicitud(es) rechazada(s) vencida(s) pasaron a borrador.`);
    return expiradas;
  } catch (error) {
    console.error('[Viáticos] Error venciendo solicitudes rechazadas:', error.message);
    return 0;
  }
}

async function revisarRechazadas() {
  await avisarPorVencer();
  await expirarVencidas();
}

function iniciar() {
  // La conexión a MySQL se abre de forma asíncrona: la primera revisión espera a que esté lista.
  Promise.resolve(db.listo).then(revisarRechazadas).catch(() => {});
  setInterval(revisarRechazadas, INTERVALO_MS);
}

module.exports = { iniciar, avisarPorVencer, expirarVencidas, revisarRechazadas };
