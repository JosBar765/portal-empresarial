import { $, $$ } from '../utils/dom.js';
import { marcarBarraInferior } from './barraInferior.js';

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

const CATEGORIA_KEY = 'proyectos:categoriaAbierta';

// Abre una categoría y cierra las demás (una a la vez); sin `abrir` la cierra.
function abrirCategoria(categoria, abrir) {
  $$('.sidebar-categoria').forEach((c) => {
    const abre = c === categoria && abrir;
    c.classList.toggle('abierta', abre);
    c.querySelector('.sidebar-categoria-cab').setAttribute('aria-expanded', String(abre));
  });
  if (abrir && categoria) guardar(CATEGORIA_KEY, categoria.dataset.grupo);
}

export function marcarRuta(ruta) {
  // La ficha de una empresa pertenece a Mi proyecto.
  const activa = ruta === 'empresa' ? 'miproyecto' : ruta === 'participacion' ? 'seguimiento' : ruta;
  $$('.sidebar-item[data-ruta]').forEach(item => item.classList.toggle('sidebar-item-active', item.dataset.ruta === activa));
  marcarBarraInferior(activa);
  // Se abre la categoría del lugar donde estás; si la pantalla no está en el menú, queda la que ya estaba abierta.
  const item = $$('.sidebar-item[data-ruta]').find(i => i.dataset.ruta === activa);
  const categoria = item && item.closest('.sidebar-categoria');
  if (categoria && !categoria.classList.contains('abierta')) abrirCategoria(categoria, true);
}

// Oculta lo que el rol no puede usar, y las categorías que quedaron sin opciones; cada categoría cuenta sus opciones.
export function mostrarSoloPermitidas(rutasPermitidas) {
  $$('.sidebar-item[data-ruta]').forEach(item => { item.style.display = rutasPermitidas.includes(item.dataset.ruta) ? '' : 'none'; });
  $$('.sidebar-categoria').forEach((categoria) => {
    const visibles = $$('.sidebar-item[data-ruta]', categoria).filter(i => i.style.display !== 'none').length;
    categoria.style.display = visibles ? '' : 'none';
    categoria.querySelector('.sidebar-categoria-n').textContent = String(visibles);
  });
  // Sin una categoría abierta (primera vez o ya no permitida), se abre la recordada o la primera visible.
  const abierta = $$('.sidebar-categoria').some(c => c.classList.contains('abierta') && c.style.display !== 'none');
  if (!abierta) {
    const visibles = $$('.sidebar-categoria').filter(c => c.style.display !== 'none');
    abrirCategoria(visibles.find(c => c.dataset.grupo === leer(CATEGORIA_KEY)) || visibles[0] || null, true);
  }
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
  // Tocar la cabecera de una categoría la abre (y cierra la otra); tocarla de nuevo, la cierra.
  $$('.sidebar-categoria-cab').forEach((cab) => cab.addEventListener('click', () => {
    const categoria = cab.closest('.sidebar-categoria');
    abrirCategoria(categoria, !categoria.classList.contains('abierta'));
  }));
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
