// src/modules/vales/atrasoWatcher.js
// analisis_correcciones_10.md #10: "alerta roja" de atraso — el atraso es una
// condición calculada al vuelo (calcularAtraso en valeService), nunca un estado
// persistido, así que no hay ningún punto de escritura donde "enganchar" este
// aviso. Un vigilante periódico (60s, vive en el mismo proceso Node — monolito
// modular, sin infraestructura nueva) es lo mínimo necesario para detectar el
// MOMENTO en que un vale cruza su fecha_entrega y avisar una sola vez por vale
// (columna `vales.atraso_notificado_en`, sellada aquí mismo).
const valeRepository = require('./repositories/valeRepository');
const valeTallerRepository = require('./repositories/valeTallerRepository');
const usuarioValeRepository = require('./repositories/usuarioValeRepository');
const tallerRepository = require('./repositories/tallerRepository');
const valeEvents = require('./events');
const { ESTADOS_TALLER } = require('./services/valeService');

const INTERVALO_MS = 60 * 1000;
const ESTADOS_TALLER_ACTIVOS = [ESTADOS_TALLER.PENDIENTE_ASIGNACION, ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION];
const ESTADOS_TALLER_CON_TECNICO = [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION];

function ahoraLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Solo se avisa a quien actualmente tiene este vale "en su vista" — un vale que
// todavía está siendo trabajado por un taller no aparece en la cola de fusión,
// por ejemplo, así que tampoco debe sonarle a quien fusiona.
async function salasParaVale(vale) {
  const salas = [`asesor:${vale.asesor_id}`];
  // analisis_correcciones_12.md #10: puede haber más de un supervisor cubriendo
  // la tienda de este asesor (rotativos) — se avisa a todos.
  const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
  supervisores.forEach(s => salas.push(`supervisor:${s.id}`));

  const filas = await valeTallerRepository.listarPorVale(vale.id);
  filas.forEach(f => {
    if (ESTADOS_TALLER_ACTIVOS.includes(f.estado)) salas.push(`taller:${f.taller_id}`);
    if (f.tecnico_id && ESTADOS_TALLER_CON_TECNICO.includes(f.estado)) salas.push(`tecnico:${f.tecnico_id}`);
  });

  // analisis_correcciones_12.md #11: ya no hay una sala fija de "encargado
  // general" — un vale APROBADO_DEPARTAMENTO espera fusión en el buzón de
  // quien tenga vales.aprobar_general (hoy, el taller "Diseño": su encargado
  // Y su clon, el Asistente de Diseño, ya están en esa misma sala `taller:<id>`
  // vía roomsParaUsuario en el frontend).
  if (vale.estado === 'APROBADO_DEPARTAMENTO') {
    const talleres = await tallerRepository.listarActivos();
    const diseno = talleres.find(t => t.nombre === 'Diseño');
    if (diseno) salas.push(`taller:${diseno.id}`);
  }

  return salas;
}

async function revisarAtrasos() {
  try {
    const vencidos = await valeRepository.listarAtrasadosSinNotificar();
    for (const vale of vencidos) {
      const salas = await salasParaVale(vale);
      valeEvents.notificar({ vale, accion: 'marcado como atrasado', salas, nivel: 'alerta' });
      await valeRepository.marcarAtrasoNotificado(vale.id, ahoraLocal());
    }
  } catch (error) {
    console.error('[AtrasoWatcher] Error revisando atrasos:', error);
  }
}

function iniciar() {
  // No se revisa de inmediato: `database.js` decide de forma ASÍNCRONA (intenta
  // conectar a MySQL real y cae al mock si falla) si usa el mock o no, justo al
  // cargarse — y esto se llama desde el nivel superior de app.js, antes de que
  // esa decisión se asiente. Revisar de una vez aquí alcanzaba a correr con
  // `useMock` todavía en `false`, disparando un intento real de conexión y un
  // error ruidoso en el arranque. Con el primer chequeo recién a los 60s, para
  // entonces la conexión (real o el fallback) ya está resuelta con certeza.
  setInterval(revisarAtrasos, INTERVALO_MS);
}

module.exports = { iniciar };
