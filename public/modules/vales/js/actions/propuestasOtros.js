import { abrirModal } from '../components/modal.js';
import { abrirVisor } from '../components/visorDocumento.js';
import { hayExtras } from '../components/propuestaInfo.js';
import { obtenerDetalleVale, marcarPropuestaOtroVisto } from '../api/valesApi.js';
import { escapeHtml, formatearFechaHora } from '../utils/formato.js';
import { cargarBuzon } from '../views/buzon.js';

const ESTADOS = {
  APROBADO: { texto: 'Aprobada', clase: 'chip-estado--info' },
  EN_TRABAJO: { texto: 'En trabajo', clase: 'chip-estado--taller' }
};

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
document.addEventListener('scroll', ocultarTip, true);
document.addEventListener('click', ocultarTip, true);
window.addEventListener('resize', ocultarTip);

function htmlItem(it, i, correlativo) {
  const est = ESTADOS[it.estado] || ESTADOS.EN_TRABAJO;
  const p = it.propuesta;
  const verBtn = it.estado === 'APROBADO' && p && (p.url || hayExtras(p))
    ? `<button type="button" class="btn btn--ghost btn--sm" data-pn-ver="${i}"><ion-icon name="document-text-outline" aria-hidden="true"></ion-icon><span>Ver propuesta</span><span class="sr-only"> de ${escapeHtml(it.tallerNombre)}</span></button>`
    : '';
  return `
    <li class="pn-item">
      <div class="pn-info">
        <strong>${escapeHtml(it.tallerNombre)}</strong>
        <span class="chip-estado ${est.clase}">${est.texto}</span>
        ${it.visto === false ? '<span class="pn-nueva" data-pn-nueva><span class="pn-punto" aria-hidden="true"></span>Nueva</span>' : ''}
        ${p && p.fecha ? `<small class="pn-fecha">${escapeHtml(formatearFechaHora(p.fecha))}</small>` : ''}
      </div>
      ${verBtn}
    </li>`;
}

// Modal de solo lectura con la última propuesta aprobada de cada taller hermano.
export async function abrirModalPropuestasOtros(vale) {
  let lista = [];
  try {
    const detalle = await obtenerDetalleVale(vale.id);
    if (Array.isArray(detalle.propuestasOtrosTalleres)) lista = detalle.propuestasOtrosTalleres;
  } catch {
    window.toast.error('No se pudo cargar', 'No se pudieron cargar las propuestas de otros talleres.');
    return;
  }

  const { overlay } = abrirModal({
    title: `Propuestas de otros talleres — ${vale.correlativo}`,
    bodyHtml: lista.length
      ? `<ul class="pn-lista">${lista.map((it, i) => htmlItem(it, i, vale.correlativo)).join('')}</ul>`
      : '<p class="pn-vacio">No hay propuestas de otros talleres para mostrar en este vale.</p>'
  });

  overlay.querySelectorAll('[data-pn-ver]').forEach(btn => {
    btn.addEventListener('click', () => {
      const it = lista[Number(btn.dataset.pnVer)];
      if (!it || !it.propuesta) return;
      abrirVisor({
        titulo: `Propuesta — ${vale.correlativo} · ${it.tallerNombre}`,
        documentos: [{ etiqueta: 'Propuesta', cargar: () => Promise.resolve(it.propuesta) }]
      });
      if (it.visto === false) marcarVisto(it, vale, btn);
    });
  });
}

// Si falla el POST la propuesta igual se abre; solo se reintenta en el siguiente clic.
async function marcarVisto(it, vale, btn) {
  try {
    await marcarPropuestaOtroVisto(vale.id, it.tallerId);
  } catch {
    return;
  }
  it.visto = true;
  const marca = btn.closest('.pn-item').querySelector('[data-pn-nueva]');
  if (marca) marca.remove();
  cargarBuzon();
}
