// public/modules/incidencias/js/components/visorFotos.js
// Visor de fotos dentro de la misma pestaña: ventana centrada en la computadora y pantalla completa en el celular. Pasa de foto con
// flechas, teclado o deslizando; acerca con la rueda, doble clic/toque o pellizco; cierra con ×, Esc, el fondo, deslizando hacia
// abajo o con el botón «atrás» del teléfono. Cada foto lleva su etiqueta (de qué etapa es, quién la subió y cuándo).
import { h, icono } from '../utils/dom.js';

const ESCALA_MAXIMA = 4;
const ESCALA_DOBLE_TOQUE = 2.5;
const UMBRAL_DESLIZAR = 60;
const UMBRAL_CERRAR = 110;
const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// `fotos`: [{ url, titulo, detalle }]; `origen`: el elemento al que vuelve el foco al cerrar.
export function abrirVisor({ fotos, indice = 0, origen = null }) {
  if (!fotos || !fotos.length) return null;
  const anterior = document.querySelector('.inc-visor');
  if (anterior) anterior.remove();
  const volverA = origen || document.activeElement;
  const raiz = document.querySelector('#modals-root') || document.body;
  let i = limitar(indice, 0, fotos.length - 1);
  const estado = { escala: 1, x: 0, y: 0 };
  let empujado = false;
  let cerrado = false;
  let temporizadorToque = null;
  let ultimoToque = 0;

  const contador = h('span', { class: 'inc-visor-contador', 'aria-hidden': 'true' });
  const anuncio = h('span', { class: 'inc-visor-anuncio', role: 'status', 'aria-live': 'polite' });
  const img = h('img', { class: 'inc-visor-img', alt: '', draggable: 'false' });
  const cargando = h('div', { class: 'inc-visor-cargando', role: 'status' }, icono('sync-outline', 'spin-animation'), h('span', { text: 'Cargando la foto…' }));
  const botonReintentar = h('button', { class: 'btn btn--ghost', type: 'button', text: 'Reintentar' });
  const error = h('div', { class: 'inc-visor-error', role: 'alert', hidden: true }, icono('image-outline'), h('p', { text: 'No se pudo cargar la foto.' }), botonReintentar);
  const titulo = h('div', { class: 'inc-visor-titulo' });
  const detalle = h('div', { class: 'inc-visor-detalle' });
  const puntos = h('div', { class: 'inc-visor-puntos', 'aria-hidden': 'true' }, fotos.map(() => h('span', { class: 'inc-visor-punto' })));
  puntos.hidden = fotos.length < 2;

  const boton = (nombre, etiqueta, clase = '') => h('button', { class: `inc-visor-boton ${clase}`.trim(), type: 'button', 'aria-label': etiqueta, title: etiqueta }, icono(nombre));
  const bCerrar = boton('close-outline', 'Cerrar el visor');
  const bMas = boton('add-outline', 'Acercar', 'inc-visor-zoom');
  const bMenos = boton('remove-outline', 'Alejar', 'inc-visor-zoom');
  const bRestablecer = boton('contract-outline', 'Tamaño original de la foto', 'inc-visor-zoom');
  const bDescargar = boton('download-outline', 'Descargar la foto');
  const bAbrir = boton('open-outline', 'Abrir la foto original');
  const bAnterior = boton('chevron-back-outline', 'Foto anterior', 'inc-visor-flecha inc-visor-flecha--anterior');
  const bSiguiente = boton('chevron-forward-outline', 'Foto siguiente', 'inc-visor-flecha inc-visor-flecha--siguiente');

  const escenario = h('div', { class: 'inc-visor-escenario' }, img, cargando, error);
  const barra = h('div', { class: 'inc-visor-barra' }, bCerrar, contador, bMenos, bMas, bRestablecer, bDescargar, bAbrir);
  const pie = h('div', { class: 'inc-visor-pie' }, titulo, detalle, puntos);
  const caja = h('div', { class: 'inc-visor-caja' }, barra, escenario, fotos.length > 1 ? [bAnterior, bSiguiente] : null, pie, anuncio);
  const overlay = h('div', { class: 'inc-visor', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Visor de fotos' }, caja);

  // --- Zoom y posición ---
  function aplicar() {
    const w = img.clientWidth * estado.escala;
    const alto = img.clientHeight * estado.escala;
    const mx = Math.max(0, (w - escenario.clientWidth) / 2);
    const my = Math.max(0, (alto - escenario.clientHeight) / 2);
    estado.x = limitar(estado.x, -mx, mx);
    estado.y = limitar(estado.y, -my, my);
    img.style.transform = `translate3d(${estado.x}px, ${estado.y}px, 0) scale(${estado.escala})`;
    overlay.classList.toggle('inc-visor--zoom', estado.escala > 1);
    bMenos.disabled = estado.escala <= 1;
    bMas.disabled = estado.escala >= ESCALA_MAXIMA;
    bRestablecer.disabled = estado.escala === 1;
  }
  // (px, py): el punto que se mantiene quieto, medido desde el centro del escenario.
  function zoomEn(nueva, px = 0, py = 0) {
    nueva = limitar(nueva, 1, ESCALA_MAXIMA);
    const r = nueva / estado.escala;
    estado.x = px - (px - estado.x) * r;
    estado.y = py - (py - estado.y) * r;
    estado.escala = nueva;
    if (nueva === 1) { estado.x = 0; estado.y = 0; }
    aplicar();
  }
  const centroDe = (cx, cy) => { const r = escenario.getBoundingClientRect(); return [cx - r.left - r.width / 2, cy - r.top - r.height / 2]; };
  const alternarZoom = (cx, cy) => { const [px, py] = centroDe(cx, cy); zoomEn(estado.escala > 1 ? 1 : ESCALA_DOBLE_TOQUE, px, py); };
  const restablecer = () => { estado.escala = 1; estado.x = 0; estado.y = 0; img.style.transition = ''; aplicar(); };

  // --- Mostrar una foto ---
  function precargar(n) { if (fotos[n]) { const p = new Image(); p.src = fotos[n].url; } }
  function mostrar() {
    const f = fotos[i];
    restablecer();
    error.hidden = true;
    cargando.hidden = false;
    img.classList.remove('inc-visor-img--lista');
    img.alt = f.titulo || `Foto ${i + 1}`;
    img.src = f.url;
    contador.textContent = fotos.length > 1 ? `${i + 1} de ${fotos.length}` : '1 foto';
    titulo.textContent = f.titulo || '';
    detalle.textContent = f.detalle || '';
    titulo.hidden = !f.titulo;
    detalle.hidden = !f.detalle;
    [...puntos.children].forEach((p, n) => p.classList.toggle('inc-visor-punto--activo', n === i));
    bAnterior.disabled = i === 0;
    bSiguiente.disabled = i === fotos.length - 1;
    anuncio.textContent = `Foto ${i + 1} de ${fotos.length}.${f.titulo ? ` ${f.titulo}.` : ''}`;
    precargar(i + 1);
    precargar(i - 1);
  }
  img.addEventListener('load', () => { cargando.hidden = true; img.classList.add('inc-visor-img--lista'); aplicar(); });
  img.addEventListener('error', () => { cargando.hidden = true; error.hidden = false; });
  botonReintentar.addEventListener('click', () => { error.hidden = true; cargando.hidden = false; const url = fotos[i].url; img.removeAttribute('src'); img.src = url; });
  function ir(n) { if (n < 0 || n >= fotos.length || n === i) { aplicar(); return; } i = n; mostrar(); }

  // --- Descargar y abrir el original ---
  const esLocal = (url) => url.startsWith('blob:') || url.startsWith(window.location.origin) || url.startsWith('/');
  function guardarComo(url, nombre) { const a = h('a', { href: url, download: nombre }); document.body.append(a); a.click(); a.remove(); }
  async function descargar() {
    const f = fotos[i];
    const nombre = f.nombreArchivo || `foto-${i + 1}.jpg`;
    if (esLocal(f.url)) { guardarComo(f.url, nombre); return; }
    try {
      const r = await fetch(f.url, { mode: 'cors' });
      if (!r.ok) throw new Error('sin permiso');
      const blob = await r.blob();
      const local = URL.createObjectURL(blob);
      guardarComo(local, nombre);
      setTimeout(() => URL.revokeObjectURL(local), 5000);
    } catch (e) { window.open(f.url, '_blank', 'noopener'); } // el almacenamiento no permite descargar desde aquí: se abre el original
  }

  // --- Cerrar (y el botón «atrás» del teléfono) ---
  function terminar() {
    if (cerrado) return;
    cerrado = true;
    clearTimeout(temporizadorToque);
    document.removeEventListener('keydown', alTeclear, true);
    window.removeEventListener('popstate', alVolver);
    window.removeEventListener('hashchange', alCambiarRuta);
    window.removeEventListener('resize', aplicar);
    overlay.remove();
    if (!document.querySelector('.modal-overlay')) document.body.classList.remove('inc-sin-scroll');
    if (volverA && volverA.isConnected && volverA.focus) volverA.focus();
  }
  function cerrar() {
    if (cerrado) return;
    if (empujado && history.state && history.state.visorIncidencias) { history.back(); setTimeout(terminar, 250); return; }
    terminar();
  }
  function alVolver() { empujado = false; terminar(); }
  function alCambiarRuta() { empujado = false; terminar(); }

  // --- Teclado ---
  function alTeclear(e) {
    if (!overlay.isConnected) return;
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cerrar(); return; }
    if (k === 'ArrowLeft') { e.preventDefault(); ir(i - 1); return; }
    if (k === 'ArrowRight') { e.preventDefault(); ir(i + 1); return; }
    if (k === '+' || k === '=') { e.preventDefault(); zoomEn(estado.escala * 1.4); return; }
    if (k === '-' || k === '_') { e.preventDefault(); zoomEn(estado.escala / 1.4); return; }
    if (k === '0') { e.preventDefault(); zoomEn(1); return; }
    if (k !== 'Tab') return;
    const lista = Array.from(overlay.querySelectorAll('button:not([disabled])')).filter(el => el.offsetParent !== null);
    if (!lista.length) return;
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    else if (!overlay.contains(document.activeElement)) { e.preventDefault(); primero.focus(); }
  }

  // --- Gestos (ratón, dedo y pellizco con los mismos eventos) ---
  const punteros = new Map();
  let gesto = null;
  escenario.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    try { escenario.setPointerCapture(e.pointerId); } catch (error) { /* sin captura el gesto sigue dentro del escenario */ }
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    img.style.transition = '';
    if (punteros.size === 1) gesto = { tipo: 'uno', sx: e.clientX, sy: e.clientY, ox: estado.x, oy: estado.y, t: Date.now(), movio: false, sobreFoto: e.target === img, toque: e.pointerType !== 'mouse' };
    else if (punteros.size === 2) { const [a, b] = [...punteros.values()]; gesto = { tipo: 'dos', d0: distancia(a, b), e0: estado.escala }; }
  });
  escenario.addEventListener('pointermove', (e) => {
    if (!punteros.has(e.pointerId) || !gesto) return;
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesto.tipo === 'dos' && punteros.size >= 2) {
      const [a, b] = [...punteros.values()];
      const [px, py] = centroDe((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomEn(gesto.e0 * (distancia(a, b) / gesto.d0), px, py);
      return;
    }
    if (gesto.tipo !== 'uno') return;
    const dx = e.clientX - gesto.sx;
    const dy = e.clientY - gesto.sy;
    if (Math.abs(dx) + Math.abs(dy) > 8) gesto.movio = true;
    if (!gesto.movio) return;
    if (estado.escala > 1) { estado.x = gesto.ox + dx; estado.y = gesto.oy + dy; aplicar(); return; }
    // Sin zoom: la foto sigue al dedo para mostrar hacia dónde va el gesto (a los lados cambia de foto, hacia abajo cierra).
    img.style.transform = Math.abs(dy) > Math.abs(dx) ? `translate3d(0, ${Math.max(0, dy)}px, 0)` : `translate3d(${dx * 0.7}px, 0, 0)`;
  });
  function terminarGesto(e) {
    if (!punteros.has(e.pointerId)) return;
    const g = gesto;
    punteros.delete(e.pointerId);
    if (!g) return;
    if (g.tipo === 'dos') { if (punteros.size < 2) { gesto = null; aplicar(); } return; }
    gesto = null;
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (estado.escala > 1) return;
    if (g.movio) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > UMBRAL_DESLIZAR) { ir(dx < 0 ? i + 1 : i - 1); return; }
      if (Math.abs(dy) > Math.abs(dx) && dy > UMBRAL_CERRAR) { cerrar(); return; }
      if (!sinMovimiento()) img.style.transition = 'transform .18s ease-out';
      aplicar();
      return;
    }
    // Un toque o un clic sin movimiento.
    if (!g.toque) { if (!g.sobreFoto) cerrar(); return; }
    const ahora = Date.now();
    if (ahora - ultimoToque < 300) { clearTimeout(temporizadorToque); ultimoToque = 0; alternarZoom(e.clientX, e.clientY); return; }
    ultimoToque = ahora;
    temporizadorToque = setTimeout(() => { overlay.classList.toggle('inc-visor--sin-controles'); }, 300);
  }
  escenario.addEventListener('pointerup', terminarGesto);
  escenario.addEventListener('pointercancel', (e) => { punteros.delete(e.pointerId); gesto = null; aplicar(); });
  escenario.addEventListener('dblclick', (e) => { if (e.target === img) alternarZoom(e.clientX, e.clientY); });
  escenario.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [px, py] = centroDe(e.clientX, e.clientY);
    zoomEn(estado.escala * (e.deltaY < 0 ? 1.18 : 1 / 1.18), px, py);
  }, { passive: false });
  window.addEventListener('resize', aplicar);

  bCerrar.addEventListener('click', cerrar);
  bMas.addEventListener('click', () => zoomEn(estado.escala * 1.4));
  bMenos.addEventListener('click', () => zoomEn(estado.escala / 1.4));
  bRestablecer.addEventListener('click', () => zoomEn(1));
  bAnterior.addEventListener('click', () => ir(i - 1));
  bSiguiente.addEventListener('click', () => ir(i + 1));
  bDescargar.addEventListener('click', descargar);
  bAbrir.addEventListener('click', () => window.open(fotos[i].url, '_blank', 'noopener'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target === caja) cerrar(); });

  raiz.appendChild(overlay);
  document.body.classList.add('inc-sin-scroll');
  document.addEventListener('keydown', alTeclear, true);
  try { history.pushState({ visorIncidencias: true }, ''); empujado = true; } catch (e) { empujado = false; }
  window.addEventListener('popstate', alVolver);
  window.addEventListener('hashchange', alCambiarRuta);
  mostrar();
  bCerrar.focus();
  return { cerrar };
}

// La foto como miniatura que se toca para verla grande (un botón, no un enlace a otra pestaña).
export function miniaturaAbrible(fotos, i, { alt } = {}) {
  const b = h('button', { class: 'inc-foto-ver', type: 'button', 'aria-label': `Ver la foto ${i + 1} de ${fotos.length}` },
    h('img', { src: fotos[i].url, alt: alt || `Foto ${i + 1}`, loading: 'lazy' }));
  b.addEventListener('click', () => abrirVisor({ fotos, indice: i, origen: b }));
  return b;
}
