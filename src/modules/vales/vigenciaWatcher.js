// src/modules/vales/vigenciaWatcher.js
// Un vale recién creado (o una solicitud de modificación, el vale MOD-) tiene N horas laborales para ser autorizado:
// cuando queda el 25% del plazo avisa al asesor y a sus supervisores, y al vencer lo elimina y avisa. Cada 60 s.
const valeRepository = require('./repositories/valeRepository');
const usuarioValeRepository = require('./repositories/usuarioValeRepository');
const valeCreacionService = require('./services/valeCreacionService');
const valeEvents = require('./events');
const calendarioService = require('../../core/calendario/calendarioService');
const { ESTADOS, esValeDeModificacion } = require('./services/valeHelpers');

const INTERVALO_MS = 60 * 1000;

async function avisarPorExpirar() {
  const umbral = await calendarioService.umbralAvisoMinutos();
  for (const vale of await valeRepository.listarSinAvisoDeVigencia()) {
    const minutos = await calendarioService.minutosRestantes(vale.vigencia_hasta, calendarioService.idsDeCsv(vale.talleres_solicitados));
    if (minutos > umbral) continue;
    // Un vale rechazado está en manos del asesor: solo a él le sirve el aviso.
    const supervisores = vale.estado === ESTADOS.RECHAZADO ? [] : await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
    const restante = `le queda aproximadamente ${calendarioService.formatearDuracion(minutos)} de horario laboral`;
    let texto = `está por expirar: ${restante} y se eliminará automáticamente si no es autorizado`;
    if (esValeDeModificacion(vale)) {
      const original = await valeRepository.obtenerPorId(vale.vale_original_id);
      texto = `(solicitud de modificación${original ? ` de ${original.correlativo}` : ''}) está por expirar: ${restante} y se eliminará automáticamente si no es autorizada`;
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
