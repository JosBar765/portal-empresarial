// src/modules/vales/atrasoWatcher.js
// El atraso es una condición calculada al vuelo (calcularAtraso en
// valeService), nunca un estado persistido, así que no hay ningún punto de
// escritura donde "enganchar" la alerta roja. Un vigilante periódico (60s,
// vive en el mismo proceso Node — monolito modular, sin infraestructura
// nueva) es lo mínimo necesario para detectar el MOMENTO en que un vale
// cruza su fecha_entrega y avisar una sola vez por vale (columna
// `vales.atraso_notificado_en`, sellada aquí mismo).
const valeRepository = require('./repositories/valeRepository');
const valeTallerRepository = require('./repositories/valeTallerRepository');
const usuarioValeRepository = require('./repositories/usuarioValeRepository');
const valeEvents = require('./events');
const { ESTADOS_TALLER } = require('./services/valeService');
const { SALA_FUSION } = require('./services/valeHelpers');

const INTERVALO_MS = 60 * 1000;
const ESTADOS_TALLER_ACTIVOS = [ESTADOS_TALLER.PENDIENTE_ASIGNACION, ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION];
const ESTADOS_TALLER_CON_DISENADOR = [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION];

// Mismo offset fijo UTC-6 que valeHelpers.js (hoyISO/horaActual) — no
// depender de la zona horaria del sistema operativo del proceso Node.
function ahoraLocal() {
  const d = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// Solo se avisa a quien actualmente tiene este vale "en su vista" — un vale que
// todavía está siendo trabajado por un taller no aparece en la cola de fusión,
// por ejemplo, así que tampoco debe sonarle a quien fusiona.
async function salasParaVale(vale) {
  const salas = [`asesor:${vale.asesor_id}`];
  // Puede haber más de un supervisor cubriendo la tienda de este asesor
  // (rotativos) — se avisa a todos.
  const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
  supervisores.forEach(s => salas.push(`supervisor:${s.id}`));

  const filas = await valeTallerRepository.listarPorVale(vale.id);
  filas.forEach(f => {
    if (ESTADOS_TALLER_ACTIVOS.includes(f.estado)) salas.push(`taller:${f.taller_id}`);
    if (f.disenador_id && ESTADOS_TALLER_CON_DISENADOR.includes(f.estado)) salas.push(`disenador:${f.disenador_id}`);
  });

  // Un vale APROBADO_DEPARTAMENTO espera fusión en el buzón de quien tenga el
  // permiso de fusión.
  if (vale.estado === 'APROBADO_DEPARTAMENTO') salas.push(SALA_FUSION);

  return salas;
}

async function revisarAtrasos() {
  try {
    const vencidos = await valeRepository.listarAtrasadosSinNotificar();
    for (const vale of vencidos) {
      const salas = await salasParaVale(vale);
      valeEvents.notificar({ vale, accion: 'marcado como atrasado', tipo: 'ATRASO', salas, nivel: 'alerta' });
      await valeRepository.marcarAtrasoNotificado(vale.id, ahoraLocal());
    }
  } catch (error) {
    console.error('[AtrasoWatcher] Error revisando atrasos:', error);
  }
}

function iniciar() {
  // No se revisa de inmediato: `database.js` conecta a MySQL de forma
  // ASÍNCRONA justo al cargarse, y esto se llama desde el nivel superior de
  // app.js, antes de que esa conexión termine de establecerse. Con el primer
  // chequeo recién a los 60s, para entonces el pool ya está listo (si la
  // conexión hubiera fallado, el proceso ya habría terminado).
  setInterval(revisarAtrasos, INTERVALO_MS);
}

module.exports = { iniciar };
