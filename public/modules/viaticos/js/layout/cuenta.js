import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { inicialesAvatar } from '../utils/formato.js';
import { logout } from '../api/authApi.js';

function pintarCuenta() {
  $('#user-display-name').textContent = state.user.nombre;
  $('#user-display-role').textContent = state.user.rolNombre;
  $('#account-dropdown-name').textContent = state.user.nombre;
  $('#account-dropdown-role').textContent = state.user.rolNombre;
  $('#account-avatar').textContent = inicialesAvatar(state.user.nombre);
}

// Menú desplegable de cuenta: abre/cierra con clic, se cierra al hacer clic afuera o con Escape.
function conectarMenu() {
  const widget = $('#account-widget');
  const dropdown = $('#account-dropdown');
  const cerrar = () => {
    dropdown.classList.remove('visible');
    widget.setAttribute('aria-expanded', 'false');
  };
  widget.addEventListener('click', (e) => {
    e.stopPropagation();
    const abierto = dropdown.classList.toggle('visible');
    widget.setAttribute('aria-expanded', String(abierto));
  });
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !widget.contains(e.target)) cerrar();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
}

export function iniciarCuenta() {
  pintarCuenta();
  conectarMenu();
  $('#logout-btn').addEventListener('click', async () => {
    try { await logout(); } catch (error) { /* redirige de todas formas */ }
    window.location.href = '/login/';
  });
}
