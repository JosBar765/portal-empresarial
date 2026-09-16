import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { cargarUsuarios } from '../views/usuarios.js';
import { cargarRoles } from '../views/roles.js';
import { cargarTiendas } from '../views/tiendas.js';
import { cargarTalleres } from '../views/talleres.js';
import { cargarMantenimiento } from '../views/mantenimiento.js';

// Sidebar: mismo patrón colapsable/cajón móvil que Vales de Arte. Las 5
// pestañas ahora sí varían por usuario — quien entra al panel sin ser
// Administrador (con solo `admin.ver` + alguno de los permisos
// `admin.*.gestionar`) solo debe ver las secciones que puede gestionar
// (correcciones_27 #1).
const SIDEBAR_ANCHO = '224px';
const SIDEBAR_ANCHO_COLAPSADO = '68px';
function actualizarOffsetSidebar(sidebar) {
  const offset = sidebar.classList.contains('colapsado') ? SIDEBAR_ANCHO_COLAPSADO : SIDEBAR_ANCHO;
  document.documentElement.style.setProperty('--sidebar-offset', offset);
}

// No perder la pestaña activa al recargar la página.
const TAB_ACTIVA_KEY = 'admin:tabActiva';
const PERMISO_POR_TAB = {
  usuarios: 'admin.usuarios.gestionar',
  roles: 'admin.roles.gestionar',
  tiendas: 'admin.tiendas.gestionar',
  talleres: 'admin.talleres.gestionar',
  mantenimiento: 'admin.mantenimiento.gestionar'
};
const TABS_VALIDOS = Object.keys(PERMISO_POR_TAB);

// El Administrador siempre tiene los 5 permisos `gestionar` en la práctica
// (ver seed.sql), pero se revisa el permiso igual en vez de asumirlo — mismo
// criterio de "no confiar en el rol, confiar en el permiso" que ya pidió
// correcciones_27 para el guard de entrada al panel.
function tienePermisoDeTab(tab) {
  return state.user.rolId === 1 || (state.user.permissions || []).includes(PERMISO_POR_TAB[tab]);
}

// Dispatcher de las 5 pestañas — vive aquí (no en app.js) para que
// `wireSidebar` pueda llamarlo directo en el click sin crear un ciclo de
// imports con el orquestador; `app.js` importa esta misma función para la
// carga inicial.
export async function cargarTab() {
  const cont = $('#panel-content');
  if (!state.tab) {
    cont.innerHTML = `<div class="buzon-vacio"><ion-icon name="lock-closed-outline"></ion-icon><h3>Sin secciones asignadas</h3><p>Tu rol tiene acceso al panel, pero no tiene ningún permiso de gestión asignado todavía.</p></div>`;
    return;
  }
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

  const botones = $$('.sidebar-item', sidebar);
  const botonesVisibles = botones.filter(b => tienePermisoDeTab(b.dataset.tab));
  // `.sidebar-item` ya trae `display: flex` en el CSS, con más peso en la
  // cascada que el `[hidden]` del navegador (mismo criterio que ya usa el
  // resto del código: alternar visibilidad con `style.display`, no con el
  // atributo `hidden`).
  botones.forEach(b => { b.style.display = botonesVisibles.includes(b) ? '' : 'none'; });
  const tabsVisibles = botonesVisibles.map(b => b.dataset.tab);

  const tabGuardada = localStorage.getItem(TAB_ACTIVA_KEY);
  state.tab = tabsVisibles.includes(tabGuardada) ? tabGuardada : (tabsVisibles[0] || null);
  botones.forEach(b => b.classList.toggle('sidebar-item-active', b.dataset.tab === state.tab));

  botonesVisibles.forEach(btn => {
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
