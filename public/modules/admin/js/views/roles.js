import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import {
  listarRolesRaw, toggleActivoRol as apiToggleActivoRol, guardarRol,
  listarPermisos, listarPermisosDeRol, actualizarPermisosDeRol
} from '../api/adminApi.js';

export async function cargarRoles() {
  const { res, data } = await listarRolesRaw();
  if (!res.ok) throw new Error(data.error);
  state.roles = data.roles;
  renderRoles();
}

export function renderRoles() {
  $('#panel-content').innerHTML = `
    <div class="panel-toolbar">
      <h2>Roles y Permisos</h2>
      <div class="panel-toolbar-acciones">
        <button class="btn btn--primary" id="btn-nuevo-rol"><ion-icon name="add-outline"></ion-icon> Nuevo Rol</button>
      </div>
    </div>
    <div class="roles-grid" id="roles-grid"></div>
  `;

  const grid = $('#roles-grid');
  grid.innerHTML = state.roles.map(rol => `
    <div class="rol-card" data-rol-id="${rol.id}">
      <div class="rol-card-titulo">${escapeHtml(rol.nombre)}${rol.base ? '<span class="badge badge-base">Base</span>' : ''}</div>
      <div class="rol-card-descripcion">${escapeHtml(rol.descripcion || '')}</div>
      <div class="rol-card-meta"><span>${rol.usuarios_count} usuario(s)</span><span>${rol.permisos_count} permiso(s)</span></div>
      <div class="rol-card-acciones"></div>
    </div>
  `).join('');

  state.roles.forEach(rol => {
    const acciones = grid.querySelector(`[data-rol-id="${rol.id}"] .rol-card-acciones`);
    const btnPermisos = document.createElement('button');
    btnPermisos.className = 'btn btn--ghost btn--sm';
    btnPermisos.textContent = 'Permisos';
    btnPermisos.addEventListener('click', () => abrirModalPermisos(rol));
    acciones.appendChild(btnPermisos);

    if (!rol.base) {
      const btnEditar = document.createElement('button');
      btnEditar.className = 'btn-icon';
      btnEditar.title = 'Editar';
      btnEditar.innerHTML = '<ion-icon name="create-outline"></ion-icon>';
      btnEditar.addEventListener('click', () => abrirModalRol(rol));
      acciones.appendChild(btnEditar);

      // El candado ES el indicador de estado (no hay badge "Activo"/
      // "Inactivo" aparte) — desbloqueado y verde cuando el rol está
      // activo, bloqueado y rojo cuando no.
      const btnToggle = document.createElement('button');
      btnToggle.className = `btn-icon candado-estado ${rol.activo ? 'candado-activo' : 'candado-inactivo'}`;
      btnToggle.title = rol.activo ? 'Rol activo — clic para desactivar' : 'Rol inactivo — clic para activar';
      btnToggle.setAttribute('aria-label', btnToggle.title);
      btnToggle.innerHTML = `<ion-icon name="${rol.activo ? 'lock-open-outline' : 'lock-closed-outline'}"></ion-icon>`;
      btnToggle.addEventListener('click', () => toggleActivoRol(rol));
      acciones.appendChild(btnToggle);
    }
  });

  $('#btn-nuevo-rol').addEventListener('click', () => abrirModalRol(null));
}

async function toggleActivoRol(rol) {
  if (rol.activo && !confirm(`¿Desactivar el rol "${rol.nombre}"?`)) return;
  try {
    await apiToggleActivoRol(rol.id, !rol.activo);
    window.toast.success(rol.activo ? 'Rol desactivado' : 'Rol activado', rol.nombre);
    cargarRoles();
  } catch (error) {
    window.toast.error('No se pudo actualizar el rol', error.message);
  }
}

function abrirModalRol(rol) {
  const esEdicion = !!rol;
  const bodyHtml = `
    <div class="form-grid">
      <div class="form-field full">
        <label>Nombre del rol</label>
        <input type="text" id="input-nombre-rol">
      </div>
      <div class="form-field full">
        <label>Descripción</label>
        <textarea id="input-descripcion-rol"></textarea>
      </div>
    </div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: esEdicion ? `Editar rol — ${rol.nombre}` : 'Nuevo rol',
    bodyHtml,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-guardar">Guardar</button>`
  });
  overlay.querySelector('#input-nombre-rol').value = esEdicion ? rol.nombre : '';
  overlay.querySelector('#input-descripcion-rol').value = esEdicion ? (rol.descripcion || '') : '';

  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-guardar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-guardar');
    const payload = {
      nombre: overlay.querySelector('#input-nombre-rol').value.trim(),
      descripcion: overlay.querySelector('#input-descripcion-rol').value.trim()
    };
    if (!payload.nombre) {
      mostrarErrorModal(overlay, 'El nombre del rol es obligatorio.');
      return;
    }
    btn.disabled = true;
    try {
      await guardarRol(esEdicion ? rol.id : null, payload);
      window.toast.success(esEdicion ? 'Rol actualizado' : 'Rol creado', payload.nombre);
      cerrar();
      cargarRoles();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}

async function abrirModalPermisos(rol) {
  const [grupos, permisoIdsActuales] = await Promise.all([
    listarPermisos(),
    listarPermisosDeRol(rol.id)
  ]);

  const bodyHtml = Object.keys(grupos).sort().map(modulo => `
    <div class="permisos-grupo" data-modulo="${escapeHtml(modulo)}">
      <div class="permisos-grupo-header">
        <h4>${escapeHtml(modulo)}</h4>
        <button type="button" class="btn btn--ghost btn--sm btn-toggle-grupo">Marcar/Desmarcar todos</button>
      </div>
      <div class="permisos-lista">
        ${grupos[modulo].map(p => `
          <label class="permiso-item">
            <input type="checkbox" class="chk-permiso" value="${p.id}" ${permisoIdsActuales.includes(p.id) ? 'checked' : ''}>
            ${escapeHtml(p.nombre)}
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  const { overlay, cerrar } = abrirModal({
    title: `Permisos — ${rol.nombre}`,
    bodyHtml,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-guardar">Guardar</button>`,
    size: 'lg'
  });

  $$('.btn-toggle-grupo', overlay).forEach(btn => {
    btn.addEventListener('click', () => {
      const lista = btn.closest('.permisos-grupo').querySelectorAll('.chk-permiso');
      const algunoSinMarcar = Array.from(lista).some(c => !c.checked);
      lista.forEach(c => { c.checked = algunoSinMarcar; });
    });
  });

  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-guardar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-guardar');
    const permisoIds = $$('.chk-permiso', overlay).filter(c => c.checked).map(c => Number(c.value));
    btn.disabled = true;
    try {
      await actualizarPermisosDeRol(rol.id, permisoIds);
      window.toast.success('Permisos actualizados', rol.nombre);
      cerrar();
      cargarRoles();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
