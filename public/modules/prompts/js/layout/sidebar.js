import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { t } from '../textos.js';
import { cargarAsesor, liberarAsesor } from '../views/asesor/formulario.js';
import { renderAdminProductos } from '../views/adminProductos.js';
import { renderAdminAjustes } from '../views/adminAjustes.js';

// Mismo patrón colapsable/cajón móvil que Administración.
const SIDEBAR_ANCHO = '224px';
const SIDEBAR_ANCHO_COLAPSADO = '68px';
function actualizarOffsetSidebar(sidebar) {
  const offset = sidebar.classList.contains('colapsado') ? SIDEBAR_ANCHO_COLAPSADO : SIDEBAR_ANCHO;
  document.documentElement.style.setProperty('--sidebar-offset', offset);
}

const TAB_ACTIVA_KEY = 'prompts:tabActiva';
const COLAPSO_KEY = 'prompts:sidebarColapsado';
const PERMISO_POR_TAB = { asesor: 'prompts.generar', admin: 'prompts.administrar', ajustes: 'prompts.administrar' };

// localStorage puede fallar (modo privado, datos bloqueados): es solo comodidad.
const leer = (clave) => { try { return localStorage.getItem(clave); } catch (e) { return null; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch (e) { /* sin persistencia */ } };

const tienePermisoDeTab = (tab) => (state.user.permissions || []).includes(PERMISO_POR_TAB[tab]);

export async function cargarTab() {
  const cont = $('#panel-content');
  liberarAsesor();
  if (state.salidaVista) { state.salidaVista.liberar(); state.salidaVista = null; }
  if (!state.tab) {
    cont.innerHTML = `<div class="buzon-vacio"><ion-icon name="lock-closed-outline"></ion-icon><h3>${escapeHtml(t('shell.sinSecciones.titulo'))}</h3><p>${escapeHtml(t('shell.sinSecciones.texto'))}</p></div>`;
    return;
  }
  cont.innerHTML = `<div class="buzon-vacio"><ion-icon name="sync-outline" class="spin-animation"></ion-icon><p>${escapeHtml(t('shell.cargando'))}</p></div>`;
  try {
    if (state.tab === 'asesor') await cargarAsesor(cont);
    else if (state.tab === 'admin') await renderAdminProductos(cont);
    else if (state.tab === 'ajustes') await renderAdminAjustes(cont);
  } catch (error) {
    cont.innerHTML = `<div class="buzon-vacio buzon-vacio-error"><ion-icon name="alert-circle-outline"></ion-icon><h3>${escapeHtml(t('shell.errorCarga.titulo'))}</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

export function wireSidebar() {
  const sidebar = $('#sidebar-prompts');
  const toggleMovil = $('#sidebar-toggle-mobile');

  const botones = $$('.sidebar-item', sidebar);
  const botonesVisibles = botones.filter(b => tienePermisoDeTab(b.dataset.tab));
  // `.sidebar-item` trae display:flex; se oculta con style, no con [hidden].
  botones.forEach(b => { b.style.display = botonesVisibles.includes(b) ? '' : 'none'; });
  const tabsVisibles = botonesVisibles.map(b => b.dataset.tab);

  const tabGuardada = leer(TAB_ACTIVA_KEY);
  state.tab = tabsVisibles.includes(tabGuardada) ? tabGuardada : (tabsVisibles[0] || null);
  botones.forEach(b => b.classList.toggle('sidebar-item-active', b.dataset.tab === state.tab));

  botonesVisibles.forEach(btn => {
    btn.addEventListener('click', async () => {
      cerrarSidebarMovil();
      if (btn.dataset.tab === state.tab) return;
      // Una vista con cambios sin guardar (editor de productos) pide confirmar antes de salir.
      if (state.salidaVista && !(await state.salidaVista.confirmar())) return;
      $$('.sidebar-item', sidebar).forEach(b => b.classList.remove('sidebar-item-active'));
      btn.classList.add('sidebar-item-active');
      state.tab = btn.dataset.tab;
      guardar(TAB_ACTIVA_KEY, state.tab);
      cargarTab();
    });
  });

  if (leer(COLAPSO_KEY) === '1') sidebar.classList.add('colapsado');
  actualizarOffsetSidebar(sidebar);
  $('#sidebar-collapse-toggle').addEventListener('click', () => {
    const colapsado = sidebar.classList.toggle('colapsado');
    guardar(COLAPSO_KEY, colapsado ? '1' : '0');
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

export function wireAccountMenu() {
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
