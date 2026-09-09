import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { cargarUsuarios } from '../views/usuarios.js';
import { cargarRoles } from '../views/roles.js';
import { cargarTiendas } from '../views/tiendas.js';
import { cargarTalleres } from '../views/talleres.js';
import { cargarMantenimiento } from '../views/mantenimiento.js';

// Sidebar: mismo patrón colapsable/cajón móvil que Vales de Arte, aquí con
// 5 pestañas fijas (no hay reescritura dinámica por rol — solo el
// Administrador ve este panel).
const SIDEBAR_ANCHO = '224px';
const SIDEBAR_ANCHO_COLAPSADO = '68px';
function actualizarOffsetSidebar(sidebar) {
  const offset = sidebar.classList.contains('colapsado') ? SIDEBAR_ANCHO_COLAPSADO : SIDEBAR_ANCHO;
  document.documentElement.style.setProperty('--sidebar-offset', offset);
}

// No perder la pestaña activa al recargar la página.
const TAB_ACTIVA_KEY = 'admin:tabActiva';
const TABS_VALIDOS = ['usuarios', 'roles', 'tiendas', 'talleres', 'mantenimiento'];

// Dispatcher de las 5 pestañas — vive aquí (no en app.js) para que
// `wireSidebar` pueda llamarlo directo en el click sin crear un ciclo de
// imports con el orquestador; `app.js` importa esta misma función para la
// carga inicial.
export async function cargarTab() {
  const cont = $('#panel-content');
  cont.innerHTML = `<div class="buzon-vacio"><ion-icon name="sync-outline" class="spin-animation"></ion-icon><p>Cargando...</p></div>`;
  try {
    if (state.tab === 'usuarios') await cargarUsuarios();
    else if (state.tab === 'roles') await cargarRoles();
    else if (state.tab === 'tiendas') await cargarTiendas();
    else if (state.tab === 'talleres') await cargarTalleres();
    else if (state.tab === 'mantenimiento') await cargarMantenimiento();
  } catch (error) {
    cont.innerHTML = `<div class="buzon-vacio buzon-vacio-error"><ion-icon name="alert-circle-outline"></ion-icon><h3>No se pudo cargar</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

export function wireSidebar() {
  const sidebar = $('#sidebar-admin');
  const toggleMovil = $('#sidebar-toggle-mobile');

  const tabGuardada = localStorage.getItem(TAB_ACTIVA_KEY);
  if (TABS_VALIDOS.includes(tabGuardada)) {
    state.tab = tabGuardada;
    $$('.sidebar-item', sidebar).forEach(b => b.classList.toggle('sidebar-item-active', b.dataset.tab === tabGuardada));
  }

  $$('.sidebar-item', sidebar).forEach(btn => {
    btn.addEventListener('click', () => {
      cerrarSidebarMovil();
      if (btn.dataset.tab === state.tab) return;
      $$('.sidebar-item', sidebar).forEach(b => b.classList.remove('sidebar-item-active'));
      btn.classList.add('sidebar-item-active');
      state.tab = btn.dataset.tab;
      localStorage.setItem(TAB_ACTIVA_KEY, state.tab);
      cargarTab();
    });
  });

  const COLAPSO_KEY = 'admin:sidebarColapsado';
  if (localStorage.getItem(COLAPSO_KEY) === '1') sidebar.classList.add('colapsado');
  actualizarOffsetSidebar(sidebar);
  $('#sidebar-collapse-toggle').addEventListener('click', () => {
    const colapsado = sidebar.classList.toggle('colapsado');
    localStorage.setItem(COLAPSO_KEY, colapsado ? '1' : '0');
    actualizarOffsetSidebar(sidebar);
  });

  const backdrop = $('#sidebar-backdrop');
  const iconoToggleMovil = toggleMovil.querySelector('ion-icon');
  toggleMovil.setAttribute('aria-expanded', 'false');
  toggleMovil.addEventListener('click', () => {
    if (sidebar.classList.contains('abierto-movil')) cerrarSidebarMovil(); else abrirSidebarMovil();
  });
  backdrop.addEventListener('click', cerrarSidebarMovil);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarSidebarMovil(); });

  function abrirSidebarMovil() {
    sidebar.classList.add('abierto-movil');
    backdrop.classList.add('visible');
    toggleMovil.setAttribute('aria-expanded', 'true');
    iconoToggleMovil.setAttribute('name', 'close-outline');
    document.body.style.overflow = 'hidden';
  }
  function cerrarSidebarMovil() {
    sidebar.classList.remove('abierto-movil');
    backdrop.classList.remove('visible');
    toggleMovil.setAttribute('aria-expanded', 'false');
    iconoToggleMovil.setAttribute('name', 'menu-outline');
    document.body.style.overflow = '';
  }
}
