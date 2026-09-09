import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { listarTalleres } from '../api/adminApi.js';
import { abrirModalVerPersonalTaller, abrirModalPersonalTaller } from '../actions/tallerPersonal.js';

export async function cargarTalleres() {
  const { talleres } = await listarTalleres();
  state.talleres = talleres;
  renderTalleres();
}

export function renderTalleres() {
  $('#panel-content').innerHTML = `
    <div class="panel-toolbar">
      <h2>Gestionar Talleres</h2>
    </div>
    <div class="tabla-wrapper">
      <table class="data-table sticky-header">
        <thead><tr><th>Taller</th><th>Encargado</th><th>Técnicos</th><th>Acciones</th></tr></thead>
        <tbody id="talleres-tbody"></tbody>
      </table>
    </div>
  `;
  const tbody = $('#talleres-tbody');
  tbody.innerHTML = state.talleres.map(t => `
    <tr>
      <td data-label="Taller">${escapeHtml(t.nombre)}</td>
      <td data-label="Encargado">${t.encargado_nombre ? escapeHtml(t.encargado_nombre) : '<span class="form-hint">Sin encargado</span>'}</td>
      <td data-label="Técnicos">${t.tecnicos_count}</td>
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
  });
}
