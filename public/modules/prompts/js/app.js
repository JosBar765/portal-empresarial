// Orquestador del módulo Generador de Prompts: sesión y wiring de layout.
import { state } from './state.js';
import { $ } from './utils/dom.js';
import { inicialesAvatar } from './utils/formato.js';
import { sessionCheck, logout } from './api/promptsApi.js';
import { wireAccountMenu, wireSidebar, cargarTab } from './layout/sidebar.js';

// El encabezado se achica en celulares: el menú lateral y los altos fijos usan su alto real, no los 82px de escritorio.
function seguirAltoEncabezado() {
  const encabezado = document.querySelector('.app-header');
  if (!encabezado) return;
  const fijar = () => document.documentElement.style.setProperty('--header-height', `${encabezado.offsetHeight}px`);
  fijar();
  if ('ResizeObserver' in window) new ResizeObserver(fijar).observe(encabezado);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const sessionData = await sessionCheck();
    if (!sessionData.autenticado) { window.location.href = '/login/?expired=true'; return; }
    state.user = sessionData.user;
    if (!(state.user.permissions || []).includes('prompts.ver')) { window.location.href = '/dashboard/'; return; }

    $('#user-display-name').textContent = state.user.nombre;
    $('#user-display-role').textContent = state.user.rolNombre;
    $('#account-dropdown-name').textContent = state.user.nombre;
    $('#account-dropdown-role').textContent = state.user.rolNombre;
    $('#account-avatar').textContent = inicialesAvatar(state.user.nombre);
  } catch (error) {
    window.location.href = '/login/?error=conexion';
    return;
  }

  seguirAltoEncabezado();
  wireAccountMenu();
  wireSidebar();
  $('#logout-btn').addEventListener('click', async () => {
    try { await logout(); } catch (error) { /* redirige de todas formas */ }
    window.location.href = '/login/';
  });

  await cargarTab();
});
