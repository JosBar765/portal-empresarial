import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { obtenerMantenimiento, actualizarMantenimiento } from '../api/adminApi.js';

let intervaloCuenta = null;
const formatoCuenta = (seg) => `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

export async function cargarMantenimiento() {
  state.mantenimiento = await obtenerMantenimiento();
  renderMantenimiento();
}

export function renderMantenimiento() {
  const m = state.mantenimiento || { activo: 0, mensaje: null };
  const activo = !!m.activo;
  const enCuenta = activo && !!m.enCuentaRegresiva;
  clearInterval(intervaloCuenta);
  const titulo = enCuenta
    ? `Entra en mantenimiento en <span id="cuenta-regresiva">${formatoCuenta(m.segundosRestantes)}</span>`
    : (activo ? 'Mantenimiento activo' : 'El sistema opera con normalidad');
  $('#panel-content').innerHTML = `
    <div class="panel-toolbar"><h2>Modo Mantenimiento</h2></div>
    <div class="mantenimiento-banner ${activo ? 'activo' : 'normal'}">
      <h3>${titulo}</h3>
      <p>${activo ? (m.mensaje || 'El sistema está en mantenimiento.') : 'Todos los usuarios tienen acceso normal al portal.'}</p>
    </div>
    <div class="mantenimiento-form">
      <p class="form-hint">Al activarlo, los usuarios ven un aviso con una cuenta regresiva de 10 minutos y siguen trabajando. Al terminar, solo las cuentas administradoras pueden usar el sistema: se cierran las sesiones del resto, que ve una pantalla de aviso con el mensaje configurado.</p>
      <div class="form-field">
        <label>Mensaje para los usuarios</label>
        <textarea id="input-mensaje-mantenimiento" ${activo ? 'disabled' : ''}>${escapeHtml(m.mensaje || '')}</textarea>
      </div>
      ${activo
        ? `<button class="btn btn--primary" id="btn-desactivar-mantenimiento">${enCuenta ? 'Cancelar mantenimiento' : 'Desactivar Modo Mantenimiento'}</button>`
        : `<button class="btn btn--danger" id="btn-activar-mantenimiento">Activar Modo Mantenimiento</button>`}
    </div>
  `;

  if (enCuenta) {
    const finMs = Date.now() + m.segundosRestantes * 1000;
    intervaloCuenta = setInterval(() => {
      const etiqueta = document.getElementById('cuenta-regresiva');
      if (!etiqueta) return clearInterval(intervaloCuenta);
      const restante = Math.max(0, Math.ceil((finMs - Date.now()) / 1000));
      etiqueta.textContent = formatoCuenta(restante);
      if (restante === 0) {
        clearInterval(intervaloCuenta);
        // Margen para que el servidor ya esté bloqueando al releer el estado.
        setTimeout(cargarMantenimiento, 1500);
      }
    }, 1000);
  }

  if (activo) {
    $('#btn-desactivar-mantenimiento').addEventListener('click', async () => {
      try {
        await actualizarMantenimiento({ activo: false });
        window.toast.success(enCuenta ? 'Mantenimiento cancelado' : 'Mantenimiento desactivado', 'El acceso normal fue restablecido.');
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
    <p>Los usuarios verán un aviso durante 10 minutos; al terminar se cerrarán las sesiones de todos menos las de administrador.</p>
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
      window.toast.success('Mantenimiento programado', 'Los usuarios verán un aviso de 10 minutos antes del bloqueo.');
      cerrar();
      cargarMantenimiento();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
