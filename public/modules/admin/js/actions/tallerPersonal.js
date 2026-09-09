import { escapeHtml } from '../utils/formato.js';
import { $$ } from '../utils/dom.js';
import { ROL_TECNICO, ROL_ASISTENTE, ROL_ENCARGADO_DISENO_LOCAL, TALLERES_CLONABLES_ASISTENTE } from '../config/roles.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import {
  listarPersonalDeTaller, listarUsuariosRaw,
  asignarEncargadoTaller, quitarEncargadoTaller,
  agregarTecnicoATaller, quitarTecnicoDeTaller
} from '../api/adminApi.js';
import { cargarTalleres } from '../views/talleres.js';

function rolEsperadoDeTaller(taller) {
  if (taller.nombre === 'Diseño') return 4;
  if (taller.nombre === 'Diseño UV/3D') return 5;
  if (taller.nombre === 'Protextil') return 9;
  return ROL_ENCARGADO_DISENO_LOCAL;
}

export async function abrirModalVerPersonalTaller(taller) {
  const personal = await listarPersonalDeTaller(taller.id);
  const encargado = personal.find(p => p.tipo_vinculo === 'encargado');
  const tecnicos = personal.filter(p => p.tipo_vinculo === 'tecnico');
  const bodyHtml = `
    <p class="section-title">Encargado</p>
    <div class="personal-lista">
      ${encargado
        ? `<div class="personal-item"><div class="personal-item-info"><span>${escapeHtml(encargado.nombre)}</span></div></div>`
        : '<p class="form-hint">Sin encargado asignado.</p>'}
    </div>
    <p class="section-title">Técnicos (${tecnicos.length})</p>
    <div class="personal-lista">
      ${tecnicos.map(p => `
        <div class="personal-item">
          <div class="personal-item-info">
            <span>${escapeHtml(p.nombre)}</span>
            ${p.rol_id === ROL_ASISTENTE ? '<span class="rol">Asistente</span>' : ''}
          </div>
        </div>
      `).join('') || '<p class="form-hint">Sin técnicos asignados.</p>'}
    </div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: `Personal — ${taller.nombre}`,
    bodyHtml,
    footerHtml: `<button class="btn btn--primary" id="btn-cerrar-ver-personal-taller">Cerrar</button>`
  });
  overlay.querySelector('#btn-cerrar-ver-personal-taller').addEventListener('click', cerrar);
}

export async function abrirModalPersonalTaller(taller) {
  const [personal, usuariosRaw] = await Promise.all([
    listarPersonalDeTaller(taller.id),
    listarUsuariosRaw()
  ]);
  const todosUsuarios = usuariosRaw.data.usuarios;
  const encargadoActual = personal.find(p => p.tipo_vinculo === 'encargado');
  const tecnicosActuales = personal.filter(p => p.tipo_vinculo === 'tecnico');
  const idsActuales = new Set(personal.map(p => p.id));

  const rolEsperado = rolEsperadoDeTaller(taller);
  const encargadosDisponibles = todosUsuarios.filter(u => u.activo && u.rol_id === rolEsperado && !u.taller_id);
  const tecnicosClonables = TALLERES_CLONABLES_ASISTENTE.includes(taller.nombre);
  const tecnicosDisponibles = todosUsuarios.filter(u =>
    u.activo && !idsActuales.has(u.id) && !u.taller_id &&
    (u.rol_id === ROL_TECNICO || (u.rol_id === ROL_ASISTENTE && tecnicosClonables))
  );

  const bodyHtml = `
    <p class="section-title">Encargado</p>
    <div id="zona-encargado-taller" class="form-grid"></div>
    <p class="section-title">Técnicos</p>
    <div id="tecnicos-actual">
      ${tecnicosActuales.map(p => `
        <div class="personal-item" data-usuario-id="${p.id}">
          <div class="personal-item-info">
            <span>${escapeHtml(p.nombre)}</span>
            ${p.rol_id === ROL_ASISTENTE ? '<span class="rol">Asistente</span>' : ''}
          </div>
        </div>
      `).join('') || '<p class="form-hint">Sin técnicos asignados.</p>'}
    </div>
    <p class="section-title">Agregar técnico</p>
    <div class="form-grid">
      <div class="form-field">
        <label>Persona</label>
        <select id="input-agregar-tecnico">
          <option value="">Seleccionar...</option>
          ${tecnicosDisponibles.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)}${u.rol_id === ROL_ASISTENTE ? ' (Asistente)' : ''}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: `Personal — ${taller.nombre}`,
    bodyHtml,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar-taller">Cerrar</button><button class="btn btn--primary" id="btn-agregar-tecnico">Agregar técnico</button>`
  });

  function renderZonaEncargado() {
    const zona = overlay.querySelector('#zona-encargado-taller');
    if (encargadoActual) {
      zona.innerHTML = `
        <div class="personal-item">
          <div class="personal-item-info"><span>${escapeHtml(encargadoActual.nombre)}</span></div>
        </div>
      `;
      const item = zona.querySelector('.personal-item');
      const btnQuitar = document.createElement('button');
      btnQuitar.className = 'btn-icon icon-danger';
      btnQuitar.title = 'Quitar';
      btnQuitar.innerHTML = '<ion-icon name="close-outline"></ion-icon>';
      btnQuitar.addEventListener('click', async () => {
        try {
          await quitarEncargadoTaller(taller.id);
          window.toast.success('Encargado actualizado', 'Se quitó al encargado del taller.');
          cerrar();
          cargarTalleres();
        } catch (error) {
          window.toast.error('No se pudo quitar', error.message);
        }
      });
      item.appendChild(btnQuitar);
    } else {
      zona.innerHTML = `
        <div class="form-field">
          <select id="input-asignar-encargado">
            <option value="">Seleccionar...</option>
            ${encargadosDisponibles.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)}</option>`).join('') || ''}
          </select>
        </div>
        <button class="btn btn--primary" id="btn-asignar-encargado" type="button">Asignar</button>
      `;
      if (!encargadosDisponibles.length) {
        zona.innerHTML = '<p class="form-hint">No hay usuarios disponibles con el rol correcto para este taller.</p>';
        return;
      }
      overlay.querySelector('#btn-asignar-encargado').addEventListener('click', async () => {
        const usuarioId = overlay.querySelector('#input-asignar-encargado').value;
        if (!usuarioId) return;
        try {
          await asignarEncargadoTaller(taller.id, usuarioId);
          window.toast.success('Encargado actualizado', 'Se asignó el encargado del taller.');
          cerrar();
          cargarTalleres();
        } catch (error) {
          mostrarErrorModal(overlay, error.message);
        }
      });
    }
  }
  renderZonaEncargado();

  $$('#tecnicos-actual .personal-item', overlay).forEach(item => {
    const btnQuitar = document.createElement('button');
    btnQuitar.className = 'btn-icon icon-danger';
    btnQuitar.title = 'Quitar';
    btnQuitar.innerHTML = '<ion-icon name="close-outline"></ion-icon>';
    btnQuitar.addEventListener('click', async () => {
      const usuarioId = item.dataset.usuarioId;
      try {
        await quitarTecnicoDeTaller(taller.id, usuarioId);
        window.toast.success('Personal actualizado', 'Se quitó del taller.');
        cerrar();
        cargarTalleres();
      } catch (error) {
        window.toast.error('No se pudo quitar', error.message);
      }
    });
    item.appendChild(btnQuitar);
  });

  overlay.querySelector('#btn-cerrar-taller').addEventListener('click', cerrar);
  overlay.querySelector('#btn-agregar-tecnico').addEventListener('click', async () => {
    const usuarioId = overlay.querySelector('#input-agregar-tecnico').value;
    if (!usuarioId) return;
    const btn = overlay.querySelector('#btn-agregar-tecnico');
    btn.disabled = true;
    try {
      await agregarTecnicoATaller(taller.id, usuarioId);
      window.toast.success('Personal actualizado', 'Se agregó al taller.');
      cerrar();
      cargarTalleres();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
