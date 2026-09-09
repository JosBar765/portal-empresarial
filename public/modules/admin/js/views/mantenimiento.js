import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { obtenerMantenimiento, actualizarMantenimiento } from '../api/adminApi.js';

export async function cargarMantenimiento() {
  state.mantenimiento = await obtenerMantenimiento();
  renderMantenimiento();
}

export function renderMantenimiento() {
  const m = state.mantenimiento || { activo: 0, mensaje: null };
  const activo = !!m.activo;
  $('#panel-content').innerHTML = `
    <div class="panel-toolbar"><h2>Modo Mantenimiento</h2></div>
    <div class="mantenimiento-banner ${activo ? 'activo' : 'normal'}">
      <h3>${activo ? 'Mantenimiento activo' : 'El sistema opera con normalidad'}</h3>
      <p>${activo ? (m.mensaje || 'El sistema está en mantenimiento.') : 'Todos los usuarios tienen acceso normal al portal.'}</p>
    </div>
    <div class="mantenimiento-form">
      <p class="form-hint">Mientras el mantenimiento está activo, solo las cuentas administradoras pueden usar el sistema; el resto ve una pantalla de aviso con el mensaje configurado.</p>
      <div class="form-field">
        <label>Mensaje para los usuarios bloqueados</label>
        <textarea id="input-mensaje-mantenimiento" ${activo ? 'disabled' : ''}>${escapeHtml(m.mensaje || '')}</textarea>
      </div>
      ${activo
        ? `<button class="btn btn--primary" id="btn-desactivar-mantenimiento">Desactivar Modo Mantenimiento</button>`
        : `<button class="btn btn--danger" id="btn-activar-mantenimiento">Activar Modo Mantenimiento</button>`}
    </div>
  `;

  if (activo) {
    $('#btn-desactivar-mantenimiento').addEventListener('click', async () => {
      try {
        await actualizarMantenimiento({ activo: false });
        window.toast.success('Mantenimiento desactivado', 'El acceso normal fue restablecido.');
        cargarMantenimiento();
      } catch (error) {
        window.toast.error('No se pudo desactivar', error.message);
      }
    });
  } else {
    $('#btn-activar-mantenimiento').addEventListener('click', () => abrirModalActivarMantenimiento());
  }
}

function abrirModalActivarMantenimiento() {
  const mensaje = $('#input-mensaje-mantenimiento').value.trim();
  const bodyHtml = `
    <p>Activar el Modo Mantenimiento bloquea de inmediato a cualquier usuario que no sea Administrador, incluidos los que ya tengan sesión abierta.</p>
    <div class="form-field full" style="margin-top:12px;">
      <label>Confirma tu contraseña de administrador</label>
      <input type="password" id="input-password-confirmar" autocomplete="current-password">
    </div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: 'Activar Modo Mantenimiento',
    bodyHtml,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--danger" id="btn-confirmar">Activar</button>`
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-confirmar');
    const password = overlay.querySelector('#input-password-confirmar').value;
    if (!password) {
      mostrarErrorModal(overlay, 'Debes ingresar tu contraseña.');
      return;
    }
    btn.disabled = true;
    try {
      await actualizarMantenimiento({ activo: true, mensaje, password });
      window.toast.success('Mantenimiento activado', 'El sistema quedó bloqueado para el resto de usuarios.');
      cerrar();
      cargarMantenimiento();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
