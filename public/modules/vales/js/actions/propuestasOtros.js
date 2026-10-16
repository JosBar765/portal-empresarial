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
