// public/modules/incidencias/js/layout/shell.js
// El armazón: menú de la cuenta, menú lateral (colapsable en pantallas anchas, cajón en el celular) y alto del encabezado.
import { $, $$ } from '../utils/dom.js';

const SIDEBAR_ANCHO = '224px';
const SIDEBAR_ANCHO_COLAPSADO = '68px';
const COLAPSO_KEY = 'incidencias:sidebarColapsado';

// localStorage puede fallar (modo privado, datos bloqueados): es solo comodidad.
const leer = (clave) => { try { return localStorage.getItem(clave); } catch (e) { return null; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch (e) { /* sin persistencia */ } };

// El encabezado se achica en celulares: el menú lateral y los altos fijos usan su alto real.
export function seguirAltoEncabezado() {
  const encabezado = document.querySelector('.app-header');
  if (!encabezado) return;
  const fijar = () => document.documentElement.style.setProperty('--header-height', `${encabezado.offsetHeight}px`);
  fijar();
  if ('ResizeObserver' in window) new ResizeObserver(fijar).observe(encabezado);
}

export function wireAccountMenu() {
  const widget = $('#account-widget');
  const dropdown = $('#account-dropdown');
  const cerrar = () => { dropdown.classList.remove('visible'); widget.setAttribute('aria-expanded', 'false'); };
  widget.addEventListener('click', (e) => {
    e.stopPropagation();
    const abierto = dropdown.classList.toggle('visible');
    widget.setAttribute('aria-expanded', String(abierto));
  });
  document.addEventListener('click', (e) => { if (!dropdown.contains(e.target) && !widget.contains(e.target)) cerrar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
}

export function wireSidebar() {
  const sidebar = $('#sidebar-incidencias');
  const toggleMovil = $('#sidebar-toggle-mobile');
  const backdrop = $('#sidebar-backdrop');
  const icono = toggleMovil.querySelector('ion-icon');

  const fijarAncho = () => document.documentElement.style.setProperty('--sidebar-offset', sidebar.classList.contains('colapsado') ? SIDEBAR_ANCHO_COLAPSADO : SIDEBAR_ANCHO);
  if (leer(COLAPSO_KEY) === '1') sidebar.classList.add('colapsado');
  fijarAncho();
  $('#sidebar-collapse-toggle').addEventListener('click', () => {
    const colapsado = sidebar.classList.toggle('colapsado');
    guardar(COLAPSO_KEY, colapsado ? '1' : '0');
    fijarAncho();
  });

  const abrir = () => { sidebar.classList.add('abierto-movil'); backdrop.classList.add('visible'); toggleMovil.setAttribute('aria-expanded', 'true'); icono.setAttribute('name', 'close-outline'); document.body.style.overflow = 'hidden'; };
  const cerrar = () => { sidebar.classList.remove('abierto-movil'); backdrop.classList.remove('visible'); toggleMovil.setAttribute('aria-expanded', 'false'); icono.setAttribute('name', 'menu-outline'); document.body.style.overflow = ''; };
  toggleMovil.setAttribute('aria-expanded', 'false');
  toggleMovil.addEventListener('click', () => (sidebar.classList.contains('abierto-movil') ? cerrar() : abrir()));
  backdrop.addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  $$('.sidebar-item', sidebar).forEach(a => a.addEventListener('click', cerrar));
  return { cerrar };
}

// Muestra solo las opciones del menú que le tocan a esta persona.
export function ajustarMenu(permisos) {
  const mostrar = (ruta, visible) => { const el = document.querySelector(`.sidebar-item[data-ruta="${ruta}"]`); if (el) el.style.display = visible ? '' : 'none'; };
  mostrar('verificar', permisos.includes('incidencias.verificar'));
  mostrar('reportar', permisos.includes('incidencias.reportar'));
}

export function marcarActivo(ruta) {
  $$('.sidebar-item').forEach(a => {
    const activo = a.dataset.ruta === ruta;
    a.classList.toggle('sidebar-item-active', activo);
    if (activo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

export function mostrarContador(n) {
  const el = $('#contador-verificar');
  if (!el) return;
  el.hidden = !n;
  el.textContent = n > 99 ? '99+' : String(n || '');
}
