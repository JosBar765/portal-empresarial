// src/modules/vales/adjuntosWatcher.js
// Un taller que rechazó los adjuntos le da N horas laborales al asesor (desde el primer rechazo): cuando queda el 25%
// del plazo lo avisa una vez y, al vencer sin respuesta, da de baja a ese taller (vale multitaller) o elimina el vale
// (último taller: ver expirarPorAdjuntos). Cada 60 s.
const valeRepository = require('./repositories/valeRepository');
const valeTallerRepository = require('./repositories/valeTallerRepository');
const tallerRepository = require('./repositories/tallerRepository');
const usuarioValeRepository = require('./repositories/usuarioValeRepository');
const valeAdjuntosService = require('./services/valeAdjuntosService');
const valeEvents = require('./events');
const calendarioService = require('../../core/calendario/calendarioService');
const { esValeDeModificacion } = require('./services/valeHelpers');

const INTERVALO_MS = 60 * 1000;

async function avisarPorVencer() {
  const umbral = await calendarioService.umbralAvisoMinutos();
  for (const fila of await valeTallerRepository.listarAdjuntosSinAviso()) {
    const minutos = await calendarioService.minutosRestantes(fila.adjuntos_vence_en, [fila.taller_id]);
    if (minutos > umbral) continue;
    const vale = await valeRepository.obtenerPorId(fila.vale_id);
    if (!vale) continue;
    const talleres = await valeTallerRepository.listarPorVale(vale.id);
    const multitaller = talleres.length >= 2 && !esValeDeModificacion(vale);
    if (!multitaller && valeAdjuntosService.algunTallerProtege(talleres)) continue; // no se va a borrar: no se avisa ni se marca
    if (!(await valeTallerRepository.marcarAvisoAdjuntos(fila.id))) continue;
    const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
    const salasTalleres = talleres.map(t => `taller:${t.taller_id}`);
    const taller = await tallerRepository.obtenerPorId(fila.taller_id);
    const nombre = taller ? taller.nombre : fila.taller_id;
    valeEvents.notificar({
      vale, tipo: 'ADJUNTOS_POR_VENCER', nivel: 'alerta',
      texto: `quedan aproximadamente ${calendarioService.formatearDuracion(minutos)} de horario laboral para que el asesor envíe los adjuntos que reclama el taller ${nombre}: si no, ${multitaller ? 'ese taller se dará de baja del vale' : 'el vale se eliminará automáticamente'}`,
      salas: [`asesor:${vale.asesor_id}`, ...supervisores.map(s => `supervisor:${s.id}`), ...new Set(salasTalleres)]
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
