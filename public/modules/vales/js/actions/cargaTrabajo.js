import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { abrirModal } from '../components/modal.js';
import { formatearFecha } from '../utils/formato.js';
import { ESTADOS_LABEL } from '../config/estados.js';
import { obtenerCargaTrabajo, obtenerAsignacionesTecnico } from '../api/valesApi.js';

// -----------------------------------------------------------------------
// Carga de trabajo (encargados de taller) — se mantiene actualizada en tiempo
// real mientras el modal (o su detalle) está abierto, sin necesidad de
// cerrarlo.
// -----------------------------------------------------------------------
async function renderContenidoCargaTrabajo(overlay) {
  let data = [];
  try {
    data = await obtenerCargaTrabajo();
  } catch { /* se muestra vacío si falla */ }

  const maxAsignaciones = Math.max(1, ...data.map(t => t.asignaciones));
  const body = overlay.querySelector('.modal-body');
  body.innerHTML = data.length ? data.map(t => `
    <div class="carga-tecnico" data-tecnico-id="${t.tecnicoId}">
      <div class="nombre">${t.nombre}</div>
      <div class="carga-barra"><div class="carga-barra-fill" style="transform:scaleX(${t.asignaciones / maxAsignaciones})"></div></div>
      <div style="font-size:12px;color:var(--color-text-secondary);">
        Asignaciones: ${t.asignaciones} · En proceso: ${t.enProceso || 'Ninguno'}
      </div>
    </div>
  `).join('') : '<p style="font-size:13px;">No tienes técnicos bajo tu mando.</p>';

  $$('.carga-tecnico', body).forEach(el => {
    el.addEventListener('click', () => abrirModalAsignacionesTecnico(el.dataset.tecnicoId));
  });
}

export function abrirModalCargaTrabajo() {
  const { overlay } = abrirModal({ title: 'Carga de trabajo', bodyHtml: '<p class="tabla-vacia">Cargando...</p>' });
  state.cargaTrabajoModal = { overlay, actualizar: () => renderContenidoCargaTrabajo(overlay) };
  renderContenidoCargaTrabajo(overlay);
}

async function renderContenidoAsignacionesTecnico(overlay, tecnicoId) {
  let vales = [];
  try {
    vales = await obtenerAsignacionesTecnico(tecnicoId);
  } catch { /* se muestra vacío si falla */ }

  const body = overlay.querySelector('.modal-body');
  body.innerHTML = vales.length ? `
    <table class="buzon-table data-table"><thead><tr><th>Correlativo</th><th>Entrega</th><th>Estado</th></tr></thead>
    <tbody>${vales.map(v => `
      <tr${v.atrasado ? ' style="color:var(--color-danger);"' : ''}>
        <td>${v.correlativo}</td><td>${formatearFecha(v.fecha_entrega)}</td>
        <td><span class="estado-pill estado-${v.estado_taller}">${ESTADOS_LABEL[v.estado_taller] || v.estado_taller}</span></td>
      </tr>`).join('')}</tbody></table>
  ` : '<p style="font-size:13px;">Este técnico no tiene asignaciones activas.</p>';
}

function abrirModalAsignacionesTecnico(tecnicoId) {
  const { overlay } = abrirModal({ title: 'Asignaciones del técnico', bodyHtml: '<p class="tabla-vacia">Cargando...</p>' });
  state.cargaTrabajoModal = { overlay, actualizar: () => renderContenidoAsignacionesTecnico(overlay, tecnicoId) };
  renderContenidoAsignacionesTecnico(overlay, tecnicoId);
}
