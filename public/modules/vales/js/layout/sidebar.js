import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { ROL, ROLES_CON_SIDEBAR } from '../config/roles.js';
import { cargarBuzon } from '../views/buzon.js';
import { actualizarIndicadoresOrden } from './toolbar.js';

// Sidebar de navegación: colapsable en escritorio (icon-only, se recuerda por
// usuario vía localStorage) y cajón deslizante superpuesto en móvil. Ancho a
// compensar en .app-shell (--sidebar-offset, ver global.css) para que el
// header y el contenido no queden debajo del sidebar fijo. En móvil el propio
// media query de styles.css lo vuelve a poner en 0.
const SIDEBAR_ANCHO = '224px';
const SIDEBAR_ANCHO_COLAPSADO = '68px';

export function actualizarOffsetSidebar(sidebar) {
  const offset = !ROLES_CON_SIDEBAR.includes(state.user.rolId)
    ? '0px'
    : (sidebar.classList.contains('colapsado') ? SIDEBAR_ANCHO_COLAPSADO : SIDEBAR_ANCHO);
  document.documentElement.style.setProperty('--sidebar-offset', offset);
}

// El Gerente reemplaza contadores-grid + buzon-section por su propio
// dashboard-gerencia mientras esté en la vista "dashboard"; el Supervisor hace
// lo mismo pero solo cuando entra a SU tercer botón — sus otras dos vistas
// (Buzón/Trabajo realizado) siguen normales. El resto de roles solo cambian
// el título.
export function actualizarTituloYSeccionesVista() {
  const enDashboard = state.vista === 'dashboard';
  if ([ROL.SUPERVISOR, ROL.GERENTE].includes(state.user.rolId)) {
    $('#buzon-titulo').textContent = enDashboard ? 'Dashboard' : (state.user.rolId === ROL.GERENTE ? 'Vales de Arte' : (state.vista === 'trabajo' ? 'Trabajo Realizado' : 'Buzón de Vales de Arte'));
    $('#dashboard-gerencia').style.display = enDashboard ? 'block' : 'none';
    $('#contadores-grid').style.display = enDashboard ? 'none' : '';
    $('.buzon-section').style.display = enDashboard ? 'none' : '';
    return;
  }
  $('#buzon-titulo').textContent = state.vista === 'trabajo' ? 'Trabajo Realizado' : 'Buzón de Vales de Arte';
}

export function wireSidebar() {
  const sidebar = $('#sidebar-vales');
  const toggleMovil = $('#sidebar-toggle-mobile');
  if (!ROLES_CON_SIDEBAR.includes(state.user.rolId)) {
    sidebar.style.display = 'none';
    actualizarOffsetSidebar(sidebar);
    return;
  }
  sidebar.style.display = 'flex';
  // El botón de menú móvil arranca oculto por HTML (evita el parpadeo antes de
  // saber el rol); se limpia el estilo inline para que la regla CSS (oculto en
  // escritorio, visible <900px) tome el control.
  toggleMovil.style.display = '';

  // El Gerente reusa los mismos dos botones del sidebar, pero con su propio
  // par de vistas — Dashboard / Vales de Arte — en vez de Buzón/Trabajo
  // realizado.
  if (state.user.rolId === ROL.GERENTE) {
    const primario = $('#sidebar-item-primario', sidebar);
    const secundario = $('#sidebar-item-secundario', sidebar);
    primario.dataset.vista = 'dashboard';
    primario.querySelector('ion-icon').setAttribute('name', 'bar-chart-outline');
    primario.querySelector('span').textContent = 'Dashboard';
    secundario.dataset.vista = 'vales';
    secundario.querySelector('ion-icon').setAttribute('name', 'file-tray-full-outline');
    secundario.querySelector('span').textContent = 'Vales de Arte';
    state.vista = 'dashboard';
  }
  // Supervisor de Ventas: conserva sus dos botones normales y gana un tercero
  // al mismo dashboard que ve el Gerente, acotado a las tiendas que cubre.
  if (state.user.rolId === ROL.SUPERVISOR) {
    $('#sidebar-item-terciario', sidebar).style.display = '';
  }

  // No perder la vista activa al recargar — se valida contra las vistas que
  // este rol realmente tiene (los botones ya quedaron reescritos arriba para
  // Gerente/Supervisor).
  const VISTA_ACTIVA_KEY = 'vales:vistaActiva';
  const vistasValidas = $$('.sidebar-item', sidebar).map(b => b.dataset.vista);
  const vistaGuardada = localStorage.getItem(VISTA_ACTIVA_KEY);
  if (vistasValidas.includes(vistaGuardada)) {
    state.vista = vistaGuardada;
  }
  $$('.sidebar-item', sidebar).forEach(b => b.classList.toggle('sidebar-item-active', b.dataset.vista === state.vista));
  actualizarTituloYSeccionesVista();

  $$('.sidebar-item', sidebar).forEach(btn => {
    btn.addEventListener('click', () => {
      cerrarSidebarMovil();
      if (btn.dataset.vista === state.vista) return;
      $$('.sidebar-item', sidebar).forEach(b => b.classList.remove('sidebar-item-active'));
      btn.classList.add('sidebar-item-active');
      state.vista = btn.dataset.vista;
      localStorage.setItem(VISTA_ACTIVA_KEY, state.vista);
      state.sort = { key: null, dir: null };
      state.filtroContador = null; // un filtro de contador es propio de la vista activa
      state.soloAtrasados = false;
      state.estadoFiltro = ''; // el conjunto de estados válidos cambia entre Buzón/Trabajo realizado
      actualizarIndicadoresOrden();
      actualizarTituloYSeccionesVista();
      cargarBuzon();
    });
  });

  // Colapso de escritorio — se recuerda por navegador (conveniencia local, no
  // es una preferencia que deba viajar al servidor).
  const COLAPSO_KEY = 'vales:sidebarColapsado';
  if (localStorage.getItem(COLAPSO_KEY) === '1') {
    sidebar.classList.add('colapsado');
  }
  actualizarOffsetSidebar(sidebar);
  $('#sidebar-collapse-toggle').addEventListener('click', () => {
    const colapsado = sidebar.classList.toggle('colapsado');
    localStorage.setItem(COLAPSO_KEY, colapsado ? '1' : '0');
    actualizarOffsetSidebar(sidebar);
  });

  // Cajón móvil — el botón de menú del header lo abre Y lo cierra (toggle
  // real); también se cierra tocando el fondo oscuro, con Escape, o al elegir
  // una vista (arriba).
  const backdrop = $('#sidebar-backdrop');
  const iconoToggleMovil = toggleMovil.querySelector('ion-icon');
  toggleMovil.setAttribute('aria-expanded', 'false');
  toggleMovil.addEventListener('click', () => {
    if (sidebar.classList.contains('abierto-movil')) {
      cerrarSidebarMovil();
    } else {
      abrirSidebarMovil();
    }
  });
  backdrop.addEventListener('click', cerrarSidebarMovil);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarSidebarMovil();
  });

  function abrirSidebarMovil() {
    sidebar.classList.add('abierto-movil');
    backdrop.classList.add('visible');
    toggleMovil.setAttribute('aria-expanded', 'true');
    iconoToggleMovil.setAttribute('name', 'close-outline');
    // Bloquea el scroll del fondo mientras el cajón está abierto — evita que
    // el contenido se desplace detrás del overlay y de paso evita el reflow
    // de la barra de direcciones móvil a media apertura, que es lo que
    // recortaba el sidebar.
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
