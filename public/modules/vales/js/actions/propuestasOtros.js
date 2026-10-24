import { abrirVisor } from '../components/visorDocumento.js';
import { hayExtras } from '../components/propuestaInfo.js';
import { obtenerDetalleVale, marcarPropuestaOtroVisto } from '../api/valesApi.js';
import { state } from '../state.js';
import { ROL } from '../config/roles.js';
import { cargarBuzon } from '../views/buzon.js';

const MARGEN = 16;
const SEPARACION = 8;
let tip = null;

// Posición del tooltip: debajo de la marca (o encima si no cabe), recortado horizontalmente al viewport.
export function posicionarTip(r, ancho, alto, vw, vh) {
  const left = Math.max(MARGEN, Math.min(r.left, vw - ancho - MARGEN));
  const abajo = r.bottom + SEPARACION;
  const top = abajo + alto + MARGEN <= vh || r.top - SEPARACION - alto < 0 ? abajo : r.top - SEPARACION - alto;
  return { left, top };
}

function mostrarTip(marca) {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'pn-tip';
    tip.setAttribute('role', 'tooltip');
    tip.innerHTML = '<strong>Propuesta disponible</strong>Otro taller ya tiene su propuesta aprobada. Puedes verla en el detalle del vale.';
    document.body.appendChild(tip);
  }
  tip.classList.add('is-visible');
  const r = marca.getBoundingClientRect();
  const { left, top } = posicionarTip(r, tip.offsetWidth, tip.offsetHeight, document.documentElement.clientWidth, window.innerHeight);
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function ocultarTip() {
  if (tip) tip.classList.remove('is-visible');
}

// Delegado: las filas del buzón se re-renderizan en cada refetch.
const marcaDe = e => (e.target instanceof Element ? e.target.closest('.pn-marca') : null);
document.addEventListener('mouseover', e => { const m = marcaDe(e); if (m) mostrarTip(m); });
document.addEventListener('mouseout', e => { if (marcaDe(e)) ocultarTip(); });
document.addEventListener('focusin', e => { const m = marcaDe(e); if (m && m.matches(':focus-visible')) mostrarTip(m); });
document.addEventListener('focusout', e => { if (marcaDe(e)) ocultarTip(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') ocultarTip(); });
document.addEventListener('scroll', ocultarTip, true);
document.addEventListener('click', ocultarTip, true);
window.addEventListener('resize', ocultarTip);

// Administrador y Gerente solo leen: nunca marcan propuestas como vistas.
const esLectorGlobal = () => state.user.rolId === ROL.ADMINISTRADOR || state.user.rolId === ROL.GERENTE;

// Visor con el vale y la última propuesta aprobada de cada taller hermano, una pestaña por taller (solo lectura).
export async function abrirVisorPropuestasOtros(vale) {
  let lista = [];
  try {
    const detalle = await obtenerDetalleVale(vale.id);
    if (Array.isArray(detalle.propuestasOtrosTalleres)) lista = detalle.propuestasOtrosTalleres;
  } catch {
    window.toast.error('No se pudo cargar', 'No se pudieron cargar las propuestas de otros talleres.');
    return;
  }

  const aprobadas = lista.filter(it => it.estado === 'APROBADO' && it.propuesta && (it.propuesta.url || hayExtras(it.propuesta)));
  if (!aprobadas.length) {
    window.toast.info('Sin propuestas aprobadas', esLectorGlobal() ? 'Ningún taller tiene todavía una propuesta aprobada en este vale.' : 'Ningún otro taller tiene todavía una propuesta aprobada en este vale.');
    return;
  }

  const documentos = [{ etiqueta: 'Vale de arte', url: `/api/vales/${vale.id}/pdf` }].concat(aprobadas.map(it => ({
    etiqueta: `Propuesta ${it.tallerNombre}`,
    // La pestaña se carga al mostrarse: ahí la propuesta nueva se da por vista.
    cargar: () => { marcarVisto(it, vale); return Promise.resolve(it.propuesta); }
  })));
  // Abre en la primera propuesta que aún no se ha visto (o en la primera, si todas ya se vieron).
  const primeraNueva = aprobadas.findIndex(it => it.visto === false);
  abrirVisor({ titulo: vale.correlativo, subtitulo: 'Propuestas de otros talleres', documentos, activo: 1 + Math.max(primeraNueva, 0) });
}

// Si falla el POST la propuesta igual se abre; solo se reintenta la próxima vez que se muestre.
async function marcarVisto(it, vale) {
  if (esLectorGlobal() || it.visto !== false || it.marcando) return;
  it.marcando = true;
  try {
    await marcarPropuestaOtroVisto(vale.id, it.tallerId);
    it.visto = true;
    cargarBuzon();
  } catch {
    /* se reintenta al volver a mostrar la pestaña */
  } finally {
    it.marcando = false;
  }
}
