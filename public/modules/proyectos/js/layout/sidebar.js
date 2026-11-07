import { $, $$ } from '../utils/dom.js';

// Mismo patrón colapsable y cajón móvil que Administración.
const SIDEBAR_ANCHO = '224px';
const SIDEBAR_ANCHO_COLAPSADO = '68px';
const COLAPSO_KEY = 'proyectos:sidebarColapsado';

// localStorage puede fallar (modo privado, datos bloqueados): es solo comodidad.
const leer = (clave) => { try { return localStorage.getItem(clave); } catch (e) { return null; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch (e) { /* sin persistencia */ } };

function actualizarOffsetSidebar(sidebar) {
  const offset = sidebar.classList.contains('colapsado') ? SIDEBAR_ANCHO_COLAPSADO : SIDEBAR_ANCHO;
  document.documentElement.style.setProperty('--sidebar-offset', offset);
}

export function marcarRuta(ruta) {
  $$('.sidebar-item[data-ruta]').forEach(item => item.classList.toggle('sidebar-item-active', item.dataset.ruta === ruta));
}

// Oculta lo que el rol no puede usar, y los títulos de grupo que quedaron sin elementos.
export function mostrarSoloPermitidas(rutasPermitidas) {
  $$('.sidebar-item[data-ruta]').forEach(item => { item.style.display = rutasPermitidas.includes(item.dataset.ruta) ? '' : 'none'; });
  $$('.sidebar-grupo').forEach(grupo => {
    let siguiente = grupo.nextElementSibling;
    let hayVisible = false;
    while (siguiente && !siguiente.classList.contains('sidebar-grupo')) {
      if (siguiente.dataset.ruta && siguiente.style.display !== 'none') hayVisible = true;
      siguiente = siguiente.nextElementSibling;
    }
    grupo.style.display = hayVisible ? '' : 'none';
  });
}

export function wireSidebar() {
  const sidebar = $('#sidebar-proyectos');
  const toggleMovil = $('#sidebar-toggle-mobile');
  const backdrop = $('#sidebar-backdrop');
  const iconoToggleMovil = toggleMovil.querySelector('ion-icon');

  if (leer(COLAPSO_KEY) === '1') sidebar.classList.add('colapsado');
  actualizarOffsetSidebar(sidebar);
  $('#sidebar-collapse-toggle').addEventListener('click', () => {
    const colapsado = sidebar.classList.toggle('colapsado');
    guardar(COLAPSO_KEY, colapsado ? '1' : '0');
    actualizarOffsetSidebar(sidebar);
  });

  function abrirMovil() {
    sidebar.classList.add('abierto-movil');
    backdrop.classList.add('visible');
    toggleMovil.setAttribute('aria-expanded', 'true');
    iconoToggleMovil.setAttribute('name', 'close-outline');
    document.body.style.overflow = 'hidden';
  }
  function cerrarMovil() {
    sidebar.classList.remove('abierto-movil');
    backdrop.classList.remove('visible');
    toggleMovil.setAttribute('aria-expanded', 'false');
    iconoToggleMovil.setAttribute('name', 'menu-outline');
    document.body.style.overflow = '';
  }
  toggleMovil.setAttribute('aria-expanded', 'false');
  toggleMovil.addEventListener('click', () => (sidebar.classList.contains('abierto-movil') ? cerrarMovil() : abrirMovil()));
  backdrop.addEventListener('click', cerrarMovil);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMovil(); });
  $$('.sidebar-item[data-ruta]').forEach(item => item.addEventListener('click', cerrarMovil));
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
