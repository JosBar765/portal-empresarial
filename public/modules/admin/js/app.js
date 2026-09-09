// Orquestador del módulo de administración: arranque de sesión y wiring de
// layout/tiempo real. La lógica de negocio de cada pestaña vive en views/,
// forms/ y actions/ — este archivo no la implementa, solo la conecta.
import { state } from './state.js';
import { $ } from './utils/dom.js';
import { inicialesAvatar } from './utils/formato.js';
import { sessionCheck, logout } from './api/authApi.js';
import { wireAccountMenu } from './layout/accountMenu.js';
import { wireSidebar, cargarTab } from './layout/sidebar.js';
import { initSocket } from './socket.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const sessionData = await sessionCheck();
    if (!sessionData.autenticado) { window.location.href = '/login/?expired=true'; return; }
    state.user = sessionData.user;
    if (state.user.rolId !== 1) { window.location.href = '/dashboard/'; return; }

    $('#user-display-name').textContent = state.user.nombre;
    $('#user-display-role').textContent = state.user.rolNombre;
    $('#account-dropdown-name').textContent = state.user.nombre;
    $('#account-dropdown-role').textContent = state.user.rolNombre;
    $('#account-avatar').textContent = inicialesAvatar(state.user.nombre);
  } catch (error) {
    window.location.href = '/login/?error=conexion';
    return;
  }

  wireAccountMenu();
  wireSidebar();
  initSocket();
  $('#logout-btn').addEventListener('click', async () => {
    try { await logout(); } catch (error) { /* redirige de todas formas */ }
    window.location.href = '/login/';
  });

  await cargarTab();
});
