// src/modules/proyectos/proyectosWatcher.js
// Vigilante periódico de Proyectos (vive en el mismo proceso Node, como los de Vales): avisa del seguimiento que vence o venció,
// del proyecto por cerrar y del proyecto vencido (fecha de fin + días hábiles de gracia). Cada aviso sale UNA sola vez: se sella con
// una clave por evento y fecha; el vencimiento del proyecto se sella en `proy_proyectos.aviso_vencido_en`. No cierra nada solo.
const avisosRepository = require('./repositories/avisosRepository');
const avisosService = require('./services/avisosService');
const configService = require('./services/configService');
const { sumarDiasHabiles } = require('./services/proyectoService');

const INTERVALO_MS = 15 * 60 * 1000;
const HORA_MS = 3600 * 1000;
const DIA_MS = 24 * HORA_MS;

const ahoraGT = (desfaseMs = 0) => new Date(Date.now() - 6 * HORA_MS + desfaseMs);
const aTexto = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const fechaDe = (d) => d.toISOString().slice(0, 10);
const objeto = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const hora = (t) => String(t || '').slice(11, 16);

async function seguimientosPorVencer(ahora) {
  const horas = await avisosService.anticipacion('seguimiento_vence');
  const hasta = aTexto(ahoraGT(horas * HORA_MS));
  const inicioHoy = `${fechaDe(ahora)} 00:00:00`;
  let n = 0;
  for (const f of await avisosRepository.seguimientosPorVencer({ inicioHoy, hasta })) {
    if (!(await avisosRepository.sellar(`vig:vence:${f.id}:${f.proxima_gestion_en}`))) continue;
    await avisosService.notificar('seguimiento_vence', { proyectoId: f.proyecto_id, explicitos: { asesor: [f.asesor_id] }, referenciaId: f.id, nivel: 'alerta', mensaje: `Seguimiento con «${f.empresa}» hoy a las ${hora(f.proxima_gestion_en)}.` });
    n += 1;
  }
  return n;
}

async function seguimientosVencidos(ahora) {
  const inicioHoy = `${fechaDe(ahora)} 00:00:00`;
  let n = 0;
  for (const f of await avisosRepository.seguimientosVencidos({ inicioHoy })) {
    if (!(await avisosRepository.sellar(`vig:vencido:${f.id}:${f.proxima_gestion_en}`))) continue;
    await avisosService.notificar('seguimiento_vencido', { proyectoId: f.proyecto_id, explicitos: { asesor: [f.asesor_id] }, referenciaId: f.id, nivel: 'alerta', mensaje: `Seguimiento vencido con «${f.empresa}» (${f.proyecto}).` });
    n += 1;
  }
  return n;
}

async function proyectos(ahora) {
  const dias = await avisosService.anticipacion('proyecto_por_cerrar');
  const hoy = fechaDe(ahora);
  const limite = fechaDe(new Date(ahora.getTime() + dias * DIA_MS));
  const vivos = await configService.valores();
  let porCerrar = 0;
  let vencidos = 0;
  for (const p of await avisosRepository.proyectosActivos()) {
    const fin = String(p.fecha_fin).slice(0, 10);
    if (fin >= hoy && fin <= limite && await avisosRepository.sellar(`vig:por_cerrar:${p.id}:${fin}`)) {
      await avisosService.notificar('proyecto_por_cerrar', { proyectoId: p.id, referenciaTipo: 'proyecto', referenciaId: p.id, mensaje: `«${p.nombre}» termina el ${fin.split('-').reverse().join('/')}: ve preparando el cierre.` });
      porCerrar += 1;
    }
    // Vencido: la fecha de fin más los días hábiles de gracia (los de la foto de configuración del proyecto) ya pasaron.
    const gracia = p.config_snapshot && objeto(p.config_snapshot).parametros ? objeto(p.config_snapshot).parametros['vencimiento.gracia_dias_habiles'] : vivos['vencimiento.gracia_dias_habiles'];
    if (!p.aviso_vencido_en && sumarDiasHabiles(fin, gracia) < hoy && await avisosRepository.marcarVencidoAvisado(p.id, aTexto(ahora))) {
      await avisosService.notificar('proyecto_vencido', { proyectoId: p.id, referenciaTipo: 'proyecto', referenciaId: p.id, nivel: 'alerta', mensaje: `«${p.nombre}» venció: ciérralo para poder iniciar otro en esas tiendas.` });
      vencidos += 1;
    }
  }
  return { porCerrar, vencidos };
}

// Una vuelta completa; devuelve cuántos avisos salieron de cada tipo (para probarla sin esperar al reloj).
async function revisar() {
  const ahora = ahoraGT();
  try {
    const [porVencer, vencidos, proy] = [await seguimientosPorVencer(ahora), await seguimientosVencidos(ahora), await proyectos(ahora)];
    return { seguimientosPorVencer: porVencer, seguimientosVencidos: vencidos, ...proy };
  } catch (error) {
    console.error('[ProyectosWatcher] Error revisando avisos:', error);
    return null;
  }
}

function iniciar() {
  // Sin revisión inmediata: la conexión a la base se establece de forma asíncrona al arrancar (igual que los vigilantes de Vales).
  setInterval(revisar, INTERVALO_MS);
}

module.exports = { iniciar, revisar };
