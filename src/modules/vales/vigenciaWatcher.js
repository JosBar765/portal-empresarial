// src/modules/vales/vigenciaWatcher.js
// Un vale recién creado (o una solicitud de modificación, el vale MOD-) tiene 24 h para ser autorizado: a las 6 h
// del final avisa al asesor y a sus supervisores, y al vencer lo elimina y avisa. Corre en el mismo proceso, cada 60 s.
const valeRepository = require('./repositories/valeRepository');
const usuarioValeRepository = require('./repositories/usuarioValeRepository');
const valeCreacionService = require('./services/valeCreacionService');
const valeEvents = require('./events');
const { ESTADOS, esValeDeModificacion } = require('./services/valeHelpers');

const INTERVALO_MS = 60 * 1000;
const HORAS_DE_AVISO = 6;

async function avisarPorExpirar() {
  for (const vale of await valeRepository.listarPorExpirar(HORAS_DE_AVISO)) {
    // Un vale rechazado está en manos del asesor: solo a él le sirve el aviso.
    const supervisores = vale.estado === ESTADOS.RECHAZADO ? [] : await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
    let texto = `está por expirar: se eliminará automáticamente en menos de ${HORAS_DE_AVISO} horas si no es autorizado`;
    if (esValeDeModificacion(vale)) {
      const original = await valeRepository.obtenerPorId(vale.vale_original_id);
      texto = `(solicitud de modificación${original ? ` de ${original.correlativo}` : ''}) está por expirar: se eliminará automáticamente en menos de ${HORAS_DE_AVISO} horas si no es autorizada`;
    }
    valeEvents.notificar({
      vale, tipo: 'POR_EXPIRAR', nivel: 'alerta', texto,
      salas: [`asesor:${vale.asesor_id}`, ...supervisores.map(s => `supervisor:${s.id}`)]
    });
    await valeRepository.marcarAvisoVigencia(vale.id);
  }
}

async function eliminarVencidos() {
  for (const vale of await valeRepository.listarVigenciaVencida()) {
    try {
      await valeCreacionService.expirarVale(vale.id);
    } catch (error) {
      console.error(`[VigenciaWatcher] No se pudo expirar ${vale.correlativo}:`, error.message);
    }
  }
}

async function revisarVigencia() {
  try {
    await avisarPorExpirar();
    await eliminarVencidos();
  } catch (error) {
    console.error('[VigenciaWatcher] Error revisando vigencias:', error.message);
  }
}

function iniciar() {
  setInterval(revisarVigencia, INTERVALO_MS);
}

module.exports = { iniciar, revisarVigencia };
