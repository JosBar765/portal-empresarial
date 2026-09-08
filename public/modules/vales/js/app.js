// Orquestador del módulo de vales: arranque de sesión, catálogos y wiring de
// las piezas de layout/tiempo real. La lógica de negocio vive en views/,
// forms/ y actions/ — este archivo no la implementa, solo la conecta.
import { state } from './state.js';
import { $ } from './utils/dom.js';
import { ROL, ROLES_TALLER_Y_TECNICO, ROLES_ENCARGADO_TALLER } from './config/roles.js';
import { puede } from './permisos.js';
import { inicialesAvatar } from './utils/formato.js';
import { sessionCheck, logout } from './api/authApi.js';
import { obtenerCatalogos } from './api/valesApi.js';
import { wireAccountMenu } from './layout/accountMenu.js';
import { wireSidebar } from './layout/sidebar.js';
import { wireToolbar, wireSortHeaders } from './layout/toolbar.js';
import { initSocket } from './socket.js';
import { cargarBuzon, wireScrollInfinito } from './views/buzon.js';
import { abrirModalCrearVale } from './forms/valeForm.js';
import { abrirModalCargaTrabajo } from './actions/cargaTrabajo.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const sessionData = await sessionCheck();
    if (!sessionData.autenticado) {
      window.location.href = '/login/?expired=true';
      return;
    }
    state.user = sessionData.user;
    if (!(state.user.modulosPermitidos || []).includes('vales') && state.user.rolId !== ROL.ADMINISTRADOR) {
      window.location.href = '/dashboard/';
      return;
    }
  } catch (error) {
    window.location.href = '/login/?error=conexion';
    return;
  }

  $('#user-display-name').textContent = state.user.nombre;
  $('#user-display-role').textContent = state.user.rolNombre;
  $('#account-dropdown-name').textContent = state.user.nombre;
  $('#account-dropdown-role').textContent = state.user.rolNombre;
  $('#account-avatar').textContent = inicialesAvatar(state.user.nombre);

  // Encargados y técnicos ya trabajan scoped a su propio taller — la columna
  // "Taller" (pensada para el asesor y roles de supervisión) sobra ahí.
  $('.buzon-table').classList.toggle('oculta-taller', ROLES_TALLER_Y_TECNICO.includes(state.user.rolId));

  $('#btn-nuevo-vale').style.display = puede('crear') ? 'flex' : 'none';
  // La carga de trabajo es una herramienta de gestión del propio equipo del
  // encargado de UN taller; el administrador ya ve todo desde el buzón
  // general, por lo que no aplica para él.
  $('#btn-carga-trabajo').style.display = ROLES_ENCARGADO_TALLER.includes(state.user.rolId) ? 'flex' : 'none';

  try {
    state.catalogos = await obtenerCatalogos();
  } catch (error) {
    state.catalogos = { tiendas: [], paises: [], talleres: [], miTiendaId: null };
  }

  wireSidebar();
  wireAccountMenu();
  wireToolbar();
  wireSortHeaders();
  wireScrollInfinito();
  initSocket();

  await cargarBuzon();

  $('#logout-btn').addEventListener('click', async () => {
    await logout();
    window.location.href = '/login/';
  });
  $('#btn-nuevo-vale').addEventListener('click', () => abrirModalCrearVale());
  $('#btn-carga-trabajo').addEventListener('click', () => abrirModalCargaTrabajo());
});
