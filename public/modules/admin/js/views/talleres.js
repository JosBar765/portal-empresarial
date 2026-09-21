import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { listarTalleres, toggleActivoTaller as apiToggleActivoTaller } from '../api/adminApi.js';
import { abrirModalVerPersonalTaller, abrirModalPersonalTaller } from '../actions/tallerPersonal.js';
import { abrirModalLimiteTaller } from '../actions/tallerLimite.js';
import { abrirModalNuevoTaller } from '../forms/tallerForm.js';

export async function cargarTalleres() {
  const { talleres } = await listarTalleres();
  state.talleres = talleres;
  renderTalleres();
}

export function renderTalleres() {
  const total = state.talleres.length;
  const activos = state.talleres.filter(t => t.activo).length;
  $('#panel-content').innerHTML = `
    <div class="panel-toolbar">
      <h2>Gestionar Talleres</h2>
      <div class="panel-toolbar-acciones">
        <button class="btn btn--primary" id="btn-nuevo-taller"><ion-icon name="add-outline"></ion-icon> Nuevo Taller</button>
      </div>
    </div>
    <div class="resumen-grid">
      <div class="resumen-card"><div class="valor">${total}</div><div class="etiqueta">Total de Talleres</div></div>
      <div class="resumen-card"><div class="valor">${activos}</div><div class="etiqueta">Activos</div></div>
      <div class="resumen-card"><div class="valor">${total - activos}</div><div class="etiqueta">Inactivos</div></div>
    </div>
    <div class="tabla-wrapper">
      <table class="data-table sticky-header">
        <thead><tr><th>Taller</th><th>Tienda</th><th>Encargado</th><th>Técnicos</th><th>Límite diario</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody id="talleres-tbody"></tbody>
      </table>
    </div>
  `;
  $('#btn-nuevo-taller').addEventListener('click', () => abrirModalNuevoTaller());
  const tbody = $('#talleres-tbody');
  tbody.innerHTML = state.talleres.map(t => `
    <tr class="${t.activo ? '' : 'fila-inactiva'}">
      <td data-label="Taller">${escapeHtml(t.nombre)}</td>
      <td data-label="Tienda">${t.tienda_id != null
        ? `${escapeHtml(t.tienda_nombre || '')}<div class="tabla-secundaria">${escapeHtml(t.tienda_codigo || '')}</div>`
        : '<span class="form-hint">Toda la empresa</span>'}</td>
      <td data-label="Encargado">${t.encargado_nombre ? escapeHtml(t.encargado_nombre) : '<span class="form-hint">Sin encargado</span>'}</td>
      <td data-label="Técnicos">${t.tecnicos_count}</td>
      <td data-label="Límite diario">${t.limite_diario != null ? `${t.limite_diario} / día` : '<span class="form-hint">Sin límite</span>'}</td>
      <td data-label="Estado"><span class="badge ${t.activo ? 'badge-activo' : 'badge-inactivo'}">${t.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td data-label="Acciones" class="acciones-cell" data-taller-id="${t.id}"></td>
    </tr>
  `).join('');
  state.talleres.forEach(t => {
    const celda = tbody.querySelector(`[data-taller-id="${t.id}"]`);
    const btnVer = document.createElement('button');
    btnVer.className = 'btn-icon';
    btnVer.title = 'Ver personal';
    btnVer.innerHTML = '<ion-icon name="eye-outline"></ion-icon>';
    btnVer.addEventListener('click', () => abrirModalVerPersonalTaller(t));
    celda.appendChild(btnVer);

    const btnGestionar = document.createElement('button');
    btnGestionar.className = 'btn-icon';
    btnGestionar.title = 'Gestionar personal';
    btnGestionar.innerHTML = '<ion-icon name="people-outline"></ion-icon>';
    btnGestionar.addEventListener('click', () => abrirModalPersonalTaller(t));
    celda.appendChild(btnGestionar);

    const btnLimite = document.createElement('button');
    btnLimite.className = 'btn-icon';
    btnLimite.title = 'Editar límite diario';
    btnLimite.innerHTML = '<ion-icon name="speedometer-outline"></ion-icon>';
    btnLimite.addEventListener('click', () => abrirModalLimiteTaller(t));
    celda.appendChild(btnLimite);

    // Mismo candado que los usuarios: abierto = activo, cerrado = inactivo.
    const btnToggle = document.createElement('button');
    btnToggle.className = `btn-icon candado-estado ${t.activo ? 'candado-activo' : 'candado-inactivo'}`;
    btnToggle.title = t.activo ? 'Taller activo — clic para desactivar' : 'Taller inactivo — clic para activar';
    btnToggle.setAttribute('aria-label', btnToggle.title);
    btnToggle.innerHTML = `<ion-icon name="${t.activo ? 'lock-open-outline' : 'lock-closed-outline'}"></ion-icon>`;
    btnToggle.addEventListener('click', () => toggleActivoTaller(t));
    celda.appendChild(btnToggle);
  });
}

// El servidor rechaza desactivar un taller con vales de arte en proceso; el
// mensaje que devuelve explica cuántos son.
export async function toggleActivoTaller(t) {
  if (t.activo && !confirm(`¿Desactivar el taller ${t.nombre}? Dejará de ofrecerse para nuevos vales de arte.`)) return;
  try {
    await apiToggleActivoTaller(t.id, !t.activo);
    window.toast.success(t.activo ? 'Taller desactivado' : 'Taller activado', t.nombre);
    cargarTalleres();
  } catch (error) {
    window.toast.error('No se pudo actualizar', error.message);
  }
}
