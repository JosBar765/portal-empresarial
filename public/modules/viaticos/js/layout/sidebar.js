import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { PERMISO_POR_TAB, CLAVES_LOCALES } from '../config/constantes.js';
import { cargarTab } from './panel.js';

// Colapsable en escritorio (solo iconos, se recuerda en el navegador) y cajón deslizante en móvil.
const SIDEBAR_ANCHO = '224px';
const SIDEBAR_ANCHO_COLAPSADO = '68px';

function actualizarOffsetSidebar(sidebar, oculto = false) {
  const offset = oculto ? '0px' : (sidebar.classList.contains('colapsado') ? SIDEBAR_ANCHO_COLAPSADO : SIDEBAR_ANCHO);
  document.documentElement.style.setProperty('--sidebar-offset', offset);
}

// localStorage puede fallar (modo privado, datos bloqueados): es solo comodidad.
const leer = (clave) => { try { return localStorage.getItem(clave); } catch (e) { return null; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch (e) { /* sin persistencia */ } };

export const puedeVerTab = (tab) => (state.user.permissions || []).includes(PERMISO_POR_TAB[tab]);

function marcarTabActiva() {
  $$('#sidebar-vales .sidebar-item').forEach(b => b.classList.toggle('sidebar-item-active', b.dataset.tab === state.tab));
}

// Cambia de pestaña respetando una vista con cambios sin guardar (state.salidaVista).
export async function cambiarTab(id) {
  if (id === state.tab || !puedeVerTab(id)) return;
  if (state.salidaVista && !(await state.salidaVista.confirmar())) return;
  state.tab = id;
  guardar(CLAVES_LOCALES.TAB_ACTIVA, id);
  marcarTabActiva();
  await cargarTab();
}

export function wireSidebar() {
  const sidebar = $('#sidebar-vales');
  const toggleMovil = $('#sidebar-toggle-mobile');

  const botones = $$('.sidebar-item', sidebar);
  const botonesVisibles = botones.filter(b => puedeVerTab(b.dataset.tab));
  // `.sidebar-item` trae display:flex; se oculta con style, no con [hidden].
  botones.forEach(b => { b.style.display = botonesVisibles.includes(b) ? '' : 'none'; });
  const tabsVisibles = botonesVisibles.map(b => b.dataset.tab);

  const tabGuardada = leer(CLAVES_LOCALES.TAB_ACTIVA);
  state.tab = tabsVisibles.includes(tabGuardada) ? tabGuardada : (tabsVisibles[0] || null);
  marcarTabActiva();

  // Sin ninguna pestaña no hay nada que navegar: el menú desaparece y el contenido no se desplaza.
  if (!state.tab) {
    sidebar.style.display = 'none';
    toggleMovil.style.display = 'none';
    actualizarOffsetSidebar(sidebar, true);
    return;
  }

  botonesVisibles.forEach(btn => {
    btn.addEventListener('click', () => {
      cerrarSidebarMovil();
      cambiarTab(btn.dataset.tab);
    });
  });

  if (leer(CLAVES_LOCALES.SIDEBAR_COLAPSADO) === '1') sidebar.classList.add('colapsado');
  actualizarOffsetSidebar(sidebar);
  $('#sidebar-collapse-toggle').addEventListener('click', () => {
    const colapsado = sidebar.classList.toggle('colapsado');
    guardar(CLAVES_LOCALES.SIDEBAR_COLAPSADO, colapsado ? '1' : '0');
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
    // Sin esto el fondo se desplaza detrás del cajón y la barra de direcciones móvil recorta el menú.
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
