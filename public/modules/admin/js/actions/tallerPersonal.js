import { escapeHtml } from '../utils/formato.js';
import { $$ } from '../utils/dom.js';
import { ROL_DISENADOR, rolEncargadoDeTaller, rolPadreDe } from '../config/roles.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import {
  listarPersonalDeTaller, listarUsuariosRaw, listarRolesRaw,
  asignarEncargadoTaller, quitarEncargadoTaller,
  agregarDisenadorATaller, quitarDisenadorDeTaller
} from '../api/adminApi.js';
import { cargarTalleres } from '../views/talleres.js';

export async function abrirModalVerPersonalTaller(taller) {
  const [personal, rolesRaw] = await Promise.all([listarPersonalDeTaller(taller.id), listarRolesRaw()]);
  const esAsistenteRol = (rolId) => rolPadreDe(rolId, rolesRaw.data.roles) !== null;
  const encargado = personal.find(p => p.tipo_vinculo === 'encargado');
  const disenadores = personal.filter(p => p.tipo_vinculo === 'disenador');
  const bodyHtml = `
    <p class="section-title">Encargado</p>
    <div class="personal-lista">
      ${encargado
        ? `<div class="personal-item"><div class="personal-item-info"><span>${escapeHtml(encargado.nombre)}</span></div></div>`
        : '<p class="form-hint">Sin encargado asignado.</p>'}
    </div>
    <p class="section-title">Diseñadores (${disenadores.length})</p>
    <div class="personal-lista">
      ${disenadores.map(p => `
        <div class="personal-item">
          <div class="personal-item-info">
            <span>${escapeHtml(p.nombre)}</span>
            ${esAsistenteRol(p.rol_id) ? '<span class="rol">Asistente</span>' : ''}
          </div>
        </div>
      `).join('') || '<p class="form-hint">Sin diseñadores asignados.</p>'}
    </div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: `Personal — ${taller.nombre}`,
    bodyHtml,
    footerHtml: `<button class="btn btn--primary" id="btn-cerrar-ver-personal-taller">Cerrar</button>`
  });
  overlay.querySelector('#btn-cerrar-ver-personal-taller').addEventListener('click', cerrar);
}

// Datos del modal «Gestionar personal» del taller y su cuerpo HTML; se recalculan tras cada cambio para refrescar el modal en su sitio.
async function cargarDatosPersonalTaller(taller) {
  const [personal, usuariosRaw, rolesRaw] = await Promise.all([
    listarPersonalDeTaller(taller.id),
    listarUsuariosRaw(),
    listarRolesRaw()
  ]);
  const roles = rolesRaw.data.roles;
  const esAsistenteRol = (rolId) => rolPadreDe(rolId, roles) !== null;
  const todosUsuarios = usuariosRaw.data.usuarios;
  const encargadoActual = personal.find(p => p.tipo_vinculo === 'encargado');
  const disenadoresActuales = personal.filter(p => p.tipo_vinculo === 'disenador');
  const idsActuales = new Set(personal.map(p => p.id));

  const rolEsperado = rolEncargadoDeTaller(taller);
  const encargadosDisponibles = todosUsuarios.filter(u => u.activo && u.rol_id === rolEsperado && !u.taller_id);
  const disenadoresDisponibles = todosUsuarios.filter(u =>
    u.activo && !idsActuales.has(u.id) && !u.taller_id &&
    (u.rol_id === ROL_DISENADOR || rolPadreDe(u.rol_id, roles) === rolEsperado)
  );

  const bodyHtml = `
    <p class="section-title">Encargado</p>
    <div id="zona-encargado-taller" class="form-grid"></div>
    <p class="section-title">Diseñadores</p>
    <div id="disenadores-actual">
      ${disenadoresActuales.map(p => `
        <div class="personal-item" data-usuario-id="${p.id}">
          <div class="personal-item-info">
            <span>${escapeHtml(p.nombre)}</span>
            ${esAsistenteRol(p.rol_id) ? '<span class="rol">Asistente</span>' : ''}
          </div>
        </div>
      `).join('') || '<p class="form-hint">Sin diseñadores asignados.</p>'}
    </div>
    <p class="section-title">Agregar diseñador</p>
    <div class="form-grid">
      <div class="form-field">
        <label>Persona</label>
        <select id="input-agregar-disenador">
          <option value="">Seleccionar...</option>
          ${disenadoresDisponibles.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)}${esAsistenteRol(u.rol_id) ? ' (Asistente)' : ''}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
  return { bodyHtml, encargadoActual, encargadosDisponibles };
}

export async function abrirModalPersonalTaller(taller) {
  let datos = await cargarDatosPersonalTaller(taller);
  const { overlay, cerrar } = abrirModal({
    title: `Personal — ${taller.nombre}`,
    bodyHtml: datos.bodyHtml,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar-taller">Cerrar</button><button class="btn btn--primary" id="btn-agregar-disenador">Agregar diseñador</button>`
  });
  const cuerpo = overlay.querySelector('.modal-body');

  // Tras cada cambio: la lista de la página se actualiza al fondo y este mismo modal se repinta con los datos nuevos.
  // Nunca lanza: el cambio ya se guardó.
  const refrescar = async () => {
    cargarTalleres();
    try {
      datos = await cargarDatosPersonalTaller(taller);
    } catch (error) {
      window.toast.error('No se pudo actualizar la lista', error.message);
      return;
    }
    cuerpo.innerHTML = datos.bodyHtml;
    conectar();
  };

  function renderZonaEncargado() {
    const { encargadoActual, encargadosDisponibles } = datos;
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
        btnQuitar.disabled = true;
        try {
          await quitarEncargadoTaller(taller.id);
          window.toast.success('Encargado actualizado', 'Se quitó al encargado del taller.');
          await refrescar();
        } catch (error) {
          window.toast.error('No se pudo quitar', error.message);
          btnQuitar.disabled = false;
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
      const btnAsignar = overlay.querySelector('#btn-asignar-encargado');
      btnAsignar.addEventListener('click', async () => {
        const usuarioId = overlay.querySelector('#input-asignar-encargado').value;
        if (!usuarioId) return;
        btnAsignar.disabled = true;
        try {
          await asignarEncargadoTaller(taller.id, usuarioId);
          window.toast.success('Encargado actualizado', 'Se asignó el encargado del taller.');
          await refrescar();
        } catch (error) {
          mostrarErrorModal(overlay, error.message);
          btnAsignar.disabled = false;
        }
      });
    }
  }

  const conectar = () => {
    renderZonaEncargado();
    $$('#disenadores-actual .personal-item', overlay).forEach(item => {
      const btnQuitar = document.createElement('button');
      btnQuitar.className = 'btn-icon icon-danger';
      btnQuitar.title = 'Quitar';
      btnQuitar.innerHTML = '<ion-icon name="close-outline"></ion-icon>';
      btnQuitar.addEventListener('click', async () => {
        const usuarioId = item.dataset.usuarioId;
        btnQuitar.disabled = true;
        try {
          await quitarDisenadorDeTaller(taller.id, usuarioId);
          window.toast.success('Personal actualizado', 'Se quitó del taller.');
          await refrescar();
        } catch (error) {
          window.toast.error('No se pudo quitar', error.message);
          btnQuitar.disabled = false;
        }
      });
      item.appendChild(btnQuitar);
    });
  };
  conectar();

  overlay.querySelector('#btn-cerrar-taller').addEventListener('click', cerrar);
  overlay.querySelector('#btn-agregar-disenador').addEventListener('click', async () => {
    const usuarioId = overlay.querySelector('#input-agregar-disenador').value;
    if (!usuarioId) return;
    const btn = overlay.querySelector('#btn-agregar-disenador');
    btn.disabled = true;
    try {
      await agregarDisenadorATaller(taller.id, usuarioId);
      window.toast.success('Personal actualizado', 'Se agregó al taller.');
      await refrescar();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
    }
    btn.disabled = false;
  });
}
