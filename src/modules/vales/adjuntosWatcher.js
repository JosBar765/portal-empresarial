// src/modules/vales/adjuntosWatcher.js
// Un taller que rechazó los adjuntos le da 24 h al asesor (desde el primer rechazo): a las 6 h del final lo avisa
// una vez y, al vencer sin respuesta, elimina el vale completo. Corre en el mismo proceso, cada 60 s.
const valeRepository = require('./repositories/valeRepository');
const valeTallerRepository = require('./repositories/valeTallerRepository');
const valeAdjuntosService = require('./services/valeAdjuntosService');
const valeEvents = require('./events');

const INTERVALO_MS = 60 * 1000;
const HORAS_DE_AVISO = 6;

async function avisarPorVencer() {
  for (const fila of await valeTallerRepository.listarAdjuntosPorVencer(HORAS_DE_AVISO)) {
    if (!(await valeTallerRepository.marcarAvisoAdjuntos(fila.id))) continue;
    const vale = await valeRepository.obtenerPorId(fila.vale_id);
    if (!vale) continue;
    const horas = Math.max(1, Math.ceil(fila.minutos_restantes / 60));
    valeEvents.notificar({
      vale, tipo: 'ADJUNTOS_POR_VENCER', nivel: 'alerta',
      texto: `te quedan ${horas} ${horas === 1 ? 'hora' : 'horas'} para enviar los adjuntos que reclama el taller: si no, el vale se eliminará automáticamente`,
      salas: [`asesor:${vale.asesor_id}`]
    });
  }
}

async function eliminarVencidos() {
  const valeIds = [...new Set((await valeTallerRepository.listarAdjuntosVencidos()).map(f => f.vale_id))];
  for (const valeId of valeIds) {
    try {
      await valeAdjuntosService.expirarPorAdjuntos(valeId);
    } catch (error) {
      console.error(`[AdjuntosWatcher] No se pudo expirar el vale ${valeId}:`, error.message);
    }
  }
}

async function revisarAdjuntos() {
  try {
    await avisarPorVencer();
    await eliminarVencidos();
  } catch (error) {
    console.error('[AdjuntosWatcher] Error revisando adjuntos:', error.message);
  }
}

function iniciar() {
  setInterval(revisarAdjuntos, INTERVALO_MS);
}

module.exports = { iniciar, revisarAdjuntos };
