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
  // Con la barra colapsada, el ícono de la categoría donde estás queda resaltado.
  $$('.sidebar-categoria').forEach(c => c.classList.toggle('con-activa', c === categoria));
}

// Barra colapsada: cada categoría es un ícono; al tocarlo se abre una ventanita con sus opciones.
const esColapsada = () => $('#sidebar-proyectos').classList.contains('colapsado') && window.matchMedia('(min-width: 901px)').matches;

function cerrarVolante() {
  $$('.sidebar-categoria.volante').forEach(c => {
    c.classList.remove('volante');
    c.querySelector('.sidebar-categoria-cab').setAttribute('aria-expanded', String(c.classList.contains('abierta')));
  });
}

// Un solo tooltip compartido (la barra recorta lo que sobresale de ella).
let tip = null;
function ocultarTip() { if (tip) tip.classList.remove('visible'); }
function mostrarTip(cab) {
  const categoria = cab.closest('.sidebar-categoria');
  if (!esColapsada() || categoria.classList.contains('volante')) return;
  if (!tip) { tip = document.createElement('div'); tip.className = 'sidebar-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  const nombre = categoria.querySelector('.sidebar-categoria-nombre').textContent;
  const n = categoria.querySelector('.sidebar-categoria-n').textContent;
  tip.textContent = nombre;
  const sub = document.createElement('span'); sub.textContent = `${n} opciones`; tip.appendChild(sub);
  const r = cab.getBoundingClientRect();
  tip.style.left = `${r.right + 8}px`;
  tip.style.top = `${r.top + r.height / 2}px`;
  tip.classList.add('visible');
}

function abrirVolante(categoria) {
  cerrarVolante();
  const cab = categoria.querySelector('.sidebar-categoria-cab');
  const items = categoria.querySelector('.sidebar-categoria-items');
  const r = cab.getBoundingClientRect();
  // La ventanita nace a la altura del ícono, pero sin salirse de la pantalla.
  items.style.maxHeight = `${window.innerHeight - 24}px`;
  items.dataset.titulo = `${categoria.querySelector('.sidebar-categoria-nombre').textContent} · ${categoria.querySelector('.sidebar-categoria-n').textContent} opciones`;
  categoria.classList.add('volante');
  items.style.top = `${Math.max(12, Math.min(r.top - 4, window.innerHeight - items.offsetHeight - 12))}px`;
  cab.setAttribute('aria-expanded', 'true');
  ocultarTip();
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
    cerrarVolante();
    ocultarTip();
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
  $$('.sidebar-categoria-cab').forEach((cab) => {
    cab.addEventListener('click', () => {
      const categoria = cab.closest('.sidebar-categoria');
      if (esColapsada()) { if (categoria.classList.contains('volante')) cerrarVolante(); else abrirVolante(categoria); return; }
      abrirCategoria(categoria, !categoria.classList.contains('abierta'));
    });
    cab.addEventListener('mouseenter', () => mostrarTip(cab));
    cab.addEventListener('focus', () => { if (cab.matches(':focus-visible')) mostrarTip(cab); });
    cab.addEventListener('mouseleave', ocultarTip);
    cab.addEventListener('blur', ocultarTip);
  });
  // La ventanita se cierra al elegir una opción, con Esc, al tocar fuera o al cambiar el tamaño.
  $$('.sidebar-item[data-ruta]').forEach(item => item.addEventListener('click', cerrarVolante));
  document.addEventListener('click', (e) => { if (!e.target.closest('.sidebar-categoria')) cerrarVolante(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const abierta = $('.sidebar-categoria.volante .sidebar-categoria-cab');
    cerrarVolante();
    if (abierta) abierta.focus();
  });
  window.addEventListener('resize', cerrarVolante);
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
